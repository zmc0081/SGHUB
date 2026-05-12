//! Skill engine — load YAML skill definitions (built-in via include_str!,
//! user via runtime scan of `{app_data_dir}/skills/*.yaml`), render prompts,
//! and orchestrate the full parse pipeline.

use std::path::PathBuf;
use std::time::Instant;

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::ai_client::{
    estimate_tokens, get_one as get_model_config, provider_for, upsert_usage_stats, AiError,
    Message, TokenPayload,
};
use crate::keychain;
use crate::search::Paper;
use crate::AppState;

pub mod uploader;

// ============================================================
// Built-in skills — embedded at compile time
// ============================================================

const BUILTIN_SKILLS: &[(&str, &str)] = &[(
    "general_read",
    include_str!("../../../skills/general_read.yaml"),
)];

// ============================================================
// Types
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputDimension {
    pub key: String,
    pub title: String,
    #[serde(default)]
    pub title_en: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EstimatedTokens {
    #[serde(default)]
    pub input: i64,
    #[serde(default)]
    pub output: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub display_name_en: Option<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub category: String,
    pub prompt_template: String,
    #[serde(default)]
    pub output_dimensions: Vec<OutputDimension>,
    #[serde(default)]
    pub recommended_models: Vec<String>,
    #[serde(default)]
    pub estimated_tokens: Option<EstimatedTokens>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    /// Set by loader, not in YAML. "builtin" or "user".
    #[serde(default = "default_source")]
    pub source: String,
}

fn default_source() -> String {
    "builtin".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub id: String,
    pub paper_id: String,
    pub skill_name: String,
    pub model_name: String,
    pub result_json: String,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub cost_est: f64,
    pub duration_ms: i64,
    pub created_at: String,
}

// ============================================================
// Loading
// ============================================================

pub fn load_builtin_skills() -> Vec<Skill> {
    BUILTIN_SKILLS
        .iter()
        .filter_map(|(name, yaml)| match serde_yaml::from_str::<Skill>(yaml) {
            Ok(mut s) => {
                s.source = "builtin".into();
                if s.name.is_empty() {
                    s.name = (*name).to_string();
                }
                Some(s)
            }
            Err(e) => {
                log::warn!("failed to parse builtin skill {}: {}", name, e);
                None
            }
        })
        .collect()
}

pub fn load_user_skills(app: &tauri::AppHandle) -> Vec<Skill> {
    use tauri::Manager;
    let dir: PathBuf = match app.path().app_data_dir() {
        Ok(d) => d.join("skills"),
        Err(_) => return Vec::new(),
    };
    if !dir.exists() {
        return Vec::new();
    }
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(e) => {
            log::warn!("read user skills dir failed: {}", e);
            return Vec::new();
        }
    };
    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|x| x == "yaml" || x == "yml")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let p = e.path();
            let content = std::fs::read_to_string(&p).ok()?;
            match serde_yaml::from_str::<Skill>(&content) {
                Ok(mut s) => {
                    s.source = "user".into();
                    Some(s)
                }
                Err(err) => {
                    log::warn!("failed to parse {}: {}", p.display(), err);
                    None
                }
            }
        })
        .collect()
}

pub fn load_all_skills(app: &tauri::AppHandle) -> Vec<Skill> {
    let mut all = load_builtin_skills();
    all.extend(load_user_skills(app));
    all
}

pub fn find_skill(app: &tauri::AppHandle, name: &str) -> Option<Skill> {
    load_all_skills(app).into_iter().find(|s| s.name == name)
}

// ============================================================
// Prompt rendering
// ============================================================

/// Replace `{{title}}`, `{{authors}}`, `{{abstract}}`, `{{full_text}}`,
/// `{{language}}` in `template` with paper-derived values.
pub fn render_prompt(
    template: &str,
    paper: &Paper,
    full_text: &str,
    language: &str,
) -> String {
    let mut out = template.to_string();
    out = out.replace("{{title}}", &paper.title);
    out = out.replace("{{authors}}", &paper.authors.join(", "));
    out = out.replace(
        "{{abstract}}",
        paper.abstract_.as_deref().unwrap_or(""),
    );
    out = out.replace("{{full_text}}", full_text);
    out = out.replace("{{language}}", language);
    out
}

// ============================================================
// Tauri commands
// ============================================================

/// Lean view returned by `get_skills` for list pages — keeps IPC payload
/// small (skill prompts can be many KB). Use `get_skill_detail` for the
/// full struct (needed by the parse page to render output_dimensions).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSummary {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub icon: String,
    pub is_builtin: bool,
    pub recommended_models: Vec<String>,
    pub author: Option<String>,
    pub version: Option<String>,
}

impl From<&Skill> for SkillSummary {
    fn from(s: &Skill) -> Self {
        Self {
            name: s.name.clone(),
            display_name: s.display_name.clone(),
            description: s.description.clone(),
            icon: s.icon.clone(),
            is_builtin: s.source == "builtin",
            recommended_models: s.recommended_models.clone(),
            author: s.author.clone(),
            version: s.version.clone(),
        }
    }
}

#[tauri::command]
pub fn get_skills(app: tauri::AppHandle) -> Vec<SkillSummary> {
    load_all_skills(&app).iter().map(SkillSummary::from).collect()
}

#[tauri::command]
pub fn get_skill_detail(app: tauri::AppHandle, name: String) -> Option<Skill> {
    find_skill(&app, &name)
}

#[tauri::command]
pub async fn get_parse_history(
    state: tauri::State<'_, AppState>,
    paper_id: String,
) -> Result<Vec<ParseResult>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_list_parse_results(&pool, &paper_id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_parse(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    paper_id: String,
    skill_name: String,
    model_config_id: String,
) -> Result<String, String> {
    use futures::StreamExt;
    use tauri::Emitter;

    let started = Instant::now();

    // 1. Load paper + extract text
    let pool = state.db_pool.clone();
    let pid = paper_id.clone();
    let paper = tokio::task::spawn_blocking(move || crate::library::db_get_paper_by_id(&pool, &pid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("paper `{}` not found", paper_id))?;

    let full_text = match &paper.pdf_path {
        Some(p) => crate::pdf_extract::extract_paper_text(&app, p)
            .unwrap_or_else(|e| {
                log::warn!("pdf extract failed, falling back to abstract: {}", e);
                paper.abstract_.clone().unwrap_or_default()
            }),
        None => paper.abstract_.clone().unwrap_or_default(),
    };

    // 2. Load skill + render prompt
    let skill = find_skill(&app, &skill_name)
        .ok_or_else(|| format!("skill `{}` not found", skill_name))?;

    let prompt = render_prompt(&skill.prompt_template, &paper, &full_text, "中文");
    let messages = vec![Message {
        role: "user".into(),
        content: prompt,
    }];

    // 3. Look up model config + key
    let pool = state.db_pool.clone();
    let mid = model_config_id.clone();
    let config = tokio::task::spawn_blocking(move || get_model_config(&pool, &mid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("model `{}` not found", model_config_id))?;

    let api_key: Option<String> = if config.provider == "ollama" {
        None
    } else {
        match keychain::get_api_key(&model_config_id) {
            Ok(Some(k)) => Some(k),
            Ok(None) => return Err(AiError::NoApiKey.to_string()),
            Err(e) => return Err(format!("Keychain 读取失败: {}", e)),
        }
    };

    let provider = provider_for(&config.provider, api_key).map_err(|e| e.to_string())?;

    let tokens_in: i64 = messages.iter().map(|m| estimate_tokens(&m.content)).sum();

    // 4. Stream tokens, emit parse:token events
    let mut stream = provider
        .chat_stream(messages, &config)
        .await
        .map_err(|e| e.to_string())?;

    let mut full_response = String::new();
    let mut tokens_out: i64 = 0;
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(text) => {
                tokens_out += estimate_tokens(&text);
                full_response.push_str(&text);
                let _ = app.emit("parse:token", TokenPayload { text, done: false });
            }
            Err(e) => {
                let _ = app.emit(
                    "parse:token",
                    TokenPayload {
                        text: format!("\n[ERROR: {}]\n", e),
                        done: true,
                    },
                );
                return Err(e.to_string());
            }
        }
    }
    let _ = app.emit(
        "parse:token",
        TokenPayload {
            text: String::new(),
            done: true,
        },
    );

    let duration_ms = started.elapsed().as_millis() as i64;

    // 5. Save result + update usage
    let result_payload = serde_json::json!({
        "text": full_response,
        "skill_name": skill.name,
        "language": "中文",
    })
    .to_string();
    let parse_id = uuid::Uuid::now_v7().to_string();
    let pool = state.db_pool.clone();
    let pid = paper_id.clone();
    let sn = skill.name.clone();
    let mn = config.name.clone();
    let _ = tokio::task::spawn_blocking(move || {
        db_save_parse_result(
            &pool,
            &parse_id,
            &pid,
            &sn,
            &mn,
            &result_payload,
            tokens_in,
            tokens_out,
            duration_ms,
        )
    })
    .await
    .map(|r| r.map_err(|e| log::warn!("save parse failed: {}", e)));

    let pool = state.db_pool.clone();
    let mcid = config.id.clone();
    let _ = tokio::task::spawn_blocking(move || {
        upsert_usage_stats(&pool, &mcid, tokens_in, tokens_out)
    })
    .await;

    log::info!(
        "parse done: paper={} skill={} model={} duration={}ms in≈{} out≈{}",
        paper_id,
        skill.name,
        config.name,
        duration_ms,
        tokens_in,
        tokens_out
    );

    Ok(full_response)
}

// ============================================================
// DB helpers
// ============================================================

#[allow(clippy::too_many_arguments)]
fn db_save_parse_result(
    pool: &crate::db::DbPool,
    id: &str,
    paper_id: &str,
    skill_name: &str,
    model_name: &str,
    result_json: &str,
    tokens_in: i64,
    tokens_out: i64,
    duration_ms: i64,
) -> rusqlite::Result<()> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO ai_parse_results \
         (id, paper_id, skill_name, model_name, result_json, tokens_in, tokens_out, cost_est, duration_ms) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0.0, ?8)",
        params![
            id, paper_id, skill_name, model_name, result_json, tokens_in, tokens_out, duration_ms
        ],
    )?;
    Ok(())
}

fn db_list_parse_results(
    pool: &crate::db::DbPool,
    paper_id: &str,
) -> rusqlite::Result<Vec<ParseResult>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(
        "SELECT id, paper_id, skill_name, model_name, result_json, \
                tokens_in, tokens_out, cost_est, duration_ms, created_at \
         FROM ai_parse_results WHERE paper_id = ?1 ORDER BY created_at DESC",
    )?;
    let rows: Vec<ParseResult> = stmt
        .query_map([paper_id], |row| {
            Ok(ParseResult {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                skill_name: row.get(2)?,
                model_name: row.get(3)?,
                result_json: row.get(4)?,
                tokens_in: row.get(5)?,
                tokens_out: row.get(6)?,
                cost_est: row.get(7)?,
                duration_ms: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_at;
    use tempfile::TempDir;

    #[test]
    fn loads_builtin_general_read() {
        let skills = load_builtin_skills();
        assert!(!skills.is_empty(), "general_read.yaml should be embedded");
        let g = skills.iter().find(|s| s.name == "general_read").unwrap();
        assert_eq!(g.display_name, "通用精读");
        assert_eq!(g.source, "builtin");
        assert_eq!(g.output_dimensions.len(), 6);
        assert!(g.prompt_template.contains("{{title}}"));
        assert!(g.prompt_template.contains("{{full_text}}"));
    }

    #[test]
    fn renders_all_variables() {
        let paper = Paper {
            id: "p1".into(),
            title: "Attention Is All You Need".into(),
            authors: vec!["Vaswani".into(), "Shazeer".into()],
            abstract_: Some("We propose Transformer.".into()),
            doi: None,
            source: "arxiv".into(),
            source_id: None,
            source_url: None,
            published_at: None,
            pdf_path: None,
            read_status: "unread".into(),
            created_at: String::new(),
            updated_at: String::new(),
        };
        let template =
            "Title: {{title}}\nAuthors: {{authors}}\nAbstract: {{abstract}}\nText: {{full_text}}\nLang: {{language}}";
        let rendered = render_prompt(template, &paper, "BODY", "中文");
        assert!(rendered.contains("Title: Attention Is All You Need"));
        assert!(rendered.contains("Authors: Vaswani, Shazeer"));
        assert!(rendered.contains("Abstract: We propose Transformer."));
        assert!(rendered.contains("Text: BODY"));
        assert!(rendered.contains("Lang: 中文"));
    }

    #[test]
    fn render_handles_missing_abstract() {
        let mut paper = Paper {
            id: "p1".into(),
            title: "T".into(),
            authors: vec![],
            abstract_: None,
            doi: None,
            source: "arxiv".into(),
            source_id: None,
            source_url: None,
            published_at: None,
            pdf_path: None,
            read_status: "unread".into(),
            created_at: String::new(),
            updated_at: String::new(),
        };
        paper.abstract_ = None;
        let r = render_prompt("[{{abstract}}]", &paper, "", "en");
        assert_eq!(r, "[]");
    }

    #[test]
    fn save_and_list_parse_results() {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();

        // need a paper row for FK
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO papers (id, title, authors, source) VALUES ('p1', 'T', '[]', 'arxiv')",
            [],
        )
        .unwrap();
        drop(conn);

        db_save_parse_result(
            &pool,
            "r1",
            "p1",
            "general_read",
            "Claude",
            r#"{"text":"hi"}"#,
            100,
            50,
            1234,
        )
        .unwrap();

        let history = db_list_parse_results(&pool, "p1").unwrap();
        assert_eq!(history.len(), 1);
        let r = &history[0];
        assert_eq!(r.id, "r1");
        assert_eq!(r.skill_name, "general_read");
        assert_eq!(r.tokens_in, 100);
        assert_eq!(r.tokens_out, 50);
        assert_eq!(r.duration_ms, 1234);
    }
}
