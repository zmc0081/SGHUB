//! V2.2.6 — full-document translation via the configured default model.
//!
//! Pipeline: extract PDF text → paragraph-aware chunking → translate each
//! chunk through the default `AiProvider` with an academic system prompt
//! that enforces structure preservation + terminology consistency (the
//! tail of the previous translation is passed as rolling context) →
//! reassemble. Progress (with original + translated text per chunk) is
//! streamed to the frontend via the `translate:progress` event so it can
//! render incrementally and align originals in compare mode. The full
//! translated Markdown is returned from the command.

use futures::StreamExt;
use rusqlite::OptionalExtension;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::ai_client::{self, estimate_tokens, Message};
use crate::{keychain, AppState};

/// Max characters per translation chunk (keeps each request well within
/// context limits and preserves quality vs. huge dumps).
const MAX_CHUNK_CHARS: usize = 2500;
/// How much of the previous translation to carry forward as context.
const CONTEXT_TAIL_CHARS: usize = 300;

#[derive(Debug, Clone, Serialize)]
struct TranslateProgress {
    current: usize,
    total: usize,
    percent: u32,
    original: String,
    translated: String,
}

// ============================================================
// Chunking (pure — unit tested)
// ============================================================

/// Hard-split an over-long paragraph at char boundaries (UTF-8 safe).
fn hard_split(s: &str, max: usize) -> Vec<String> {
    let chars: Vec<char> = s.chars().collect();
    chars
        .chunks(max)
        .map(|c| c.iter().collect::<String>())
        .collect()
}

/// Split text into paragraph-aware chunks no larger than `MAX_CHUNK_CHARS`
/// characters. Prefers blank-line paragraph boundaries; falls back to
/// single newlines when the extractor produced no blank lines.
fn chunk_text(text: &str) -> Vec<String> {
    let mut paras: Vec<String> = text
        .split("\n\n")
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .map(|p| p.to_string())
        .collect();
    if paras.len() <= 1 {
        paras = text
            .split('\n')
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .map(|p| p.to_string())
            .collect();
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut cur = String::new();
    for p in paras {
        if p.chars().count() > MAX_CHUNK_CHARS {
            if !cur.is_empty() {
                chunks.push(std::mem::take(&mut cur));
            }
            chunks.extend(hard_split(&p, MAX_CHUNK_CHARS));
            continue;
        }
        if !cur.is_empty() && cur.chars().count() + p.chars().count() + 2 > MAX_CHUNK_CHARS {
            chunks.push(std::mem::take(&mut cur));
        }
        if !cur.is_empty() {
            cur.push_str("\n\n");
        }
        cur.push_str(&p);
    }
    if !cur.is_empty() {
        chunks.push(cur);
    }
    chunks
}

/// Last `n` chars of a string (UTF-8 safe).
fn tail(s: &str, n: usize) -> String {
    let count = s.chars().count();
    s.chars().skip(count.saturating_sub(n)).collect()
}

/// Map a language code to a human name for the prompt.
fn lang_name(code: &str) -> String {
    match code {
        "zh-CN" | "zh" => "简体中文 (Simplified Chinese)".into(),
        "zh-TW" => "繁體中文 (Traditional Chinese)".into(),
        "en" | "en-US" => "English".into(),
        "ja" | "ja-JP" => "日本語 (Japanese)".into(),
        "fr" | "fr-FR" => "Français (French)".into(),
        other => other.to_string(),
    }
}

fn system_prompt(lang: &str) -> String {
    format!(
        "You are a professional academic/scientific translator. Translate the text the user provides into {lang}.\n\n\
         Rules:\n\
         - Output ONLY the translation — no preamble, notes, or explanations.\n\
         - Preserve the document structure: keep headings, paragraph breaks, lists and figure/table captions in the same order. Output well-formed Markdown.\n\
         - Keep technical and domain terminology precise and CONSISTENT across the whole document.\n\
         - Leave mathematical formulas, inline code, URLs, citation markers (e.g. [12], (Smith et al., 2020)) and figure/table labels unchanged.\n\
         - Maintain a formal, professional academic tone; do not summarize or omit content."
    )
}

// ============================================================
// Source-text resolution
// ============================================================

async fn resolve_text(
    app: &AppHandle,
    pool: &crate::db::DbPool,
    paper_id: Option<String>,
    file_path: Option<String>,
) -> Result<String, String> {
    if let Some(fp) = file_path.filter(|s| !s.trim().is_empty()) {
        // `fp` is a `papers.pdf_path` value — relative for uploaded papers,
        // absolute for downloaded ones. Resolve both via the shared helper.
        let p = crate::config::paths::resolve_pdf_path(app, &fp);
        return tokio::task::spawn_blocking(move || crate::pdf_extract::extract_text(&p))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string());
    }
    if let Some(pid) = paper_id.filter(|s| !s.trim().is_empty()) {
        let pool = pool.clone();
        let pdf_path: Option<String> = tokio::task::spawn_blocking(move || {
            let conn = pool
                .get()
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            conn.query_row("SELECT pdf_path FROM papers WHERE id = ?1", [pid], |r| {
                r.get::<_, Option<String>>(0)
            })
            .optional()
            .map(|o| o.flatten())
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;

        let pdf_path = pdf_path.ok_or_else(|| "该文献无本地 PDF — 请先下载 PDF".to_string())?;
        let app = app.clone();
        return tokio::task::spawn_blocking(move || {
            crate::pdf_extract::extract_paper_text(&app, &pdf_path)
        })
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string());
    }
    Err("缺少 PDF 来源(需要 paper_id 或 file_path)".into())
}

// ============================================================
// Command
// ============================================================

/// Translate a PDF/document's full text into `target_lang`. Emits
/// `translate:progress` per chunk; returns the full translated Markdown.
/// `mode` ("replace" | "compare") is display-only on the frontend.
#[tauri::command]
pub async fn translate_document(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    paper_id: Option<String>,
    file_path: Option<String>,
    target_lang: String,
    mode: String,
) -> Result<String, String> {
    let _ = mode; // frontend-only (replace vs compare layout)

    // 1. Source text
    let pool = state.db_pool.clone();
    let text = resolve_text(&app, &pool, paper_id, file_path).await?;
    if text.trim().is_empty() {
        return Err("未能从 PDF 提取到文本(可能是扫描件 / 图片型 PDF)".into());
    }

    // 2. Default model + key + provider
    let pool2 = state.db_pool.clone();
    let configs = tokio::task::spawn_blocking(move || ai_client::list_all(&pool2))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let config = configs
        .into_iter()
        .find(|c| c.is_default)
        .ok_or_else(|| "未配置默认模型 — 请先在「模型配置」设置默认模型".to_string())?;

    let api_key = if !ai_client::needs_api_key(&config) {
        None
    } else {
        match keychain::get_api_key(&config.id) {
            Ok(Some(k)) => Some(k),
            Ok(None) => return Err("默认模型未配置 API Key".into()),
            Err(e) => return Err(format!("Keychain 读取失败: {}", e)),
        }
    };

    // 3. Chunk + translate
    let lang = lang_name(&target_lang);
    let system = system_prompt(&lang);
    let chunks = chunk_text(&text);
    let total = chunks.len();
    if total == 0 {
        return Err("文档为空,无可翻译内容".into());
    }
    log::info!(
        "translate: model={} provider={} chunks={} target={}",
        config.name,
        config.provider,
        total,
        target_lang
    );

    let mut full = String::new();
    let mut prev_tail = String::new();
    let mut total_in: i64 = 0;

    for (i, chunk) in chunks.iter().enumerate() {
        let provider =
            ai_client::provider_for_config(&config, api_key.clone()).map_err(|e| e.to_string())?;
        let user = if prev_tail.is_empty() {
            chunk.clone()
        } else {
            format!(
                "(Already-translated context, for terminology consistency only — do NOT re-translate it: {prev})\n\n---\nTranslate the following:\n{chunk}",
                prev = prev_tail,
                chunk = chunk
            )
        };
        let messages = vec![
            Message {
                role: "system".into(),
                content: system.clone(),
                images: Vec::new(),
            },
            Message {
                role: "user".into(),
                content: user.clone(),
                images: Vec::new(),
            },
        ];
        total_in += estimate_tokens(&system) + estimate_tokens(&user);

        let mut stream = provider
            .chat_stream(messages, &config)
            .await
            .map_err(|e| format!("翻译失败(第 {}/{} 段): {}", i + 1, total, e))?;
        let mut translated = String::new();
        while let Some(tok) = stream.next().await {
            match tok {
                Ok(t) => translated.push_str(&t),
                Err(e) => return Err(format!("翻译失败(第 {}/{} 段): {}", i + 1, total, e)),
            }
        }
        let translated = translated.trim().to_string();

        let percent = (((i + 1) as f64 / total as f64) * 100.0) as u32;
        let _ = app.emit(
            "translate:progress",
            TranslateProgress {
                current: i + 1,
                total,
                percent,
                original: chunk.clone(),
                translated: translated.clone(),
            },
        );

        if !full.is_empty() {
            full.push_str("\n\n");
        }
        full.push_str(&translated);
        prev_tail = tail(&translated, CONTEXT_TAIL_CHARS);
    }

    // Best-effort usage accounting (tokens only; cost removed in V2.2.5).
    let pool3 = state.db_pool.clone();
    let cfg = config.clone();
    let tokens_out = estimate_tokens(&full);
    let _ = tokio::task::spawn_blocking(move || {
        ai_client::usage::record_usage(&pool3, &cfg, total_in, tokens_out)
    })
    .await;

    Ok(full)
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunk_groups_paragraphs_under_limit() {
        let text = "Para one.\n\nPara two.\n\nPara three.";
        let chunks = chunk_text(text);
        // All short → a single chunk joined by blank lines.
        assert_eq!(chunks.len(), 1);
        assert!(chunks[0].contains("Para one."));
        assert!(chunks[0].contains("Para three."));
    }

    #[test]
    fn chunk_splits_when_exceeding_limit() {
        let big = "x".repeat(MAX_CHUNK_CHARS - 10);
        let big2 = "y".repeat(MAX_CHUNK_CHARS - 10);
        let text = format!("{big}\n\n{big2}");
        let chunks = chunk_text(&text);
        assert_eq!(chunks.len(), 2, "two near-limit paragraphs → two chunks");
    }

    #[test]
    fn chunk_hard_splits_oversized_paragraph() {
        let huge = "z".repeat(MAX_CHUNK_CHARS * 2 + 100);
        let chunks = chunk_text(&huge);
        assert!(chunks.len() >= 3);
        for c in &chunks {
            assert!(c.chars().count() <= MAX_CHUNK_CHARS);
        }
    }

    #[test]
    fn chunk_empty_text() {
        assert!(chunk_text("   \n\n  ").is_empty());
    }

    #[test]
    fn tail_is_utf8_safe() {
        let s = "héllo wörld 中文测试内容";
        let tl = tail(s, 4);
        assert_eq!(tl.chars().count(), 4);
        assert_eq!(tl, "测试内容");
        // Tail longer than the string returns the whole string.
        assert_eq!(tail("ab", 10), "ab");
    }

    #[test]
    fn lang_name_maps_known_codes() {
        assert!(lang_name("zh-CN").contains("Simplified"));
        assert_eq!(lang_name("en"), "English");
        assert_eq!(lang_name("xx-YY"), "xx-YY");
    }
}
