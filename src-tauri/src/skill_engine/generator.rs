//! AI-assisted Skill generation (V2.1.0).
//!
//! Two flows, both backed by the user's configured chat model:
//!
//! * `generate_skill_from_description` — takes a free-form natural
//!   language description, runs the meta-prompt + few-shot example
//!   through the chosen model, extracts the YAML fence, validates it
//!   against `SkillSpec`/`validate_skill`. On a validation failure we
//!   retry once with the previous YAML + error list embedded in a
//!   follow-up prompt.
//!
//! * `refine_skill_from_chat` — same loop, but the prompt presents
//!   the CURRENT yaml + a user refinement instruction, so the model
//!   produces an edited version.
//!
//! Both stream tokens to the frontend via `skill_gen:token` so the
//! conversation UI feels alive.

use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::ai_client::{
    get_one as get_model_config, list_all, provider_for, AiError, Message,
};
use crate::AppState;

use super::uploader::{normalize_skill_content, validate_skill, SkillSpec};

// ============================================================
// Constants
// ============================================================

const META_PROMPT: &str = include_str!("../../templates/skill_generator_prompt.md");
const EXAMPLE_SKILL_YAML: &str = include_str!("../../../skills/general_read.yaml");

/// Cap on how many output tokens we allow the model to produce —
/// a 200-line YAML rarely needs more than ~3k tokens.
const MAX_TOKENS_CAP: i32 = 4000;

// ============================================================
// Public types
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResult {
    /// The validated YAML the user will see in the right-hand preview.
    pub yaml: String,
    /// Parsed spec — handy for the frontend to render without re-parsing.
    pub spec: SkillSpec,
    /// True when the first attempt failed validation and the retry
    /// succeeded. UI may surface a subtle "auto-fixed once" hint.
    pub retried: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct GenTokenPayload {
    pub text: String,
    pub done: bool,
    /// 1 on the first pass, 2 when the validation-fix retry is running.
    pub attempt: u8,
}

// ============================================================
// Prompt rendering
// ============================================================

/// Substitute `{user_description}` + `{example_yaml}` into the meta
/// prompt. Plain string-replace is enough; minijinja-style would
/// require us to escape `{{title}}` in the example.
pub fn render_meta_prompt(user_description: &str) -> String {
    META_PROMPT
        .replace("{user_description}", user_description.trim())
        .replace("{example_yaml}", EXAMPLE_SKILL_YAML.trim())
}

/// Refinement prompt: the model sees its previous YAML AND the user's
/// new instruction, and is asked to emit an updated full YAML.
pub fn render_refine_prompt(current_yaml: &str, instruction: &str) -> String {
    format!(
        "You previously produced this SGHUB Skill YAML for the user:\n\n\
         ```yaml\n{current}\n```\n\n\
         The user now asks you to change it:\n\n> {instruction}\n\n\
         Produce the **full updated YAML** with the change applied. \
         Same hard contract as before: ONE fenced ```yaml ... ``` block, \
         no prose, valid against the SGHUB Skill schema.",
        current = current_yaml.trim(),
        instruction = instruction.trim(),
    )
}

/// Retry prompt: hand the model its bad YAML + the validator errors
/// and ask for a fix.
pub fn render_fix_prompt(bad_yaml: &str, errors: &[String]) -> String {
    format!(
        "Your last response did not pass the SGHUB Skill validator. \
         Here is the YAML you produced:\n\n```yaml\n{yaml}\n```\n\n\
         Validation errors:\n{errs}\n\n\
         Fix every error and emit the corrected YAML. Same contract: \
         ONE fenced ```yaml ... ``` block, nothing else.",
        yaml = bad_yaml.trim(),
        errs = errors
            .iter()
            .map(|e| format!("- {}", e))
            .collect::<Vec<_>>()
            .join("\n"),
    )
}

// ============================================================
// YAML fence extraction
// ============================================================

/// Pull the first ```yaml ...``` (or bare ``` ... ```) fenced block
/// out of `text`. When no fence is found we return the raw text after
/// `normalize_skill_content` (handles models that ignore the contract
/// and emit naked YAML).
pub fn extract_yaml_block(text: &str) -> String {
    // Look for fenced block. The fence may be ```yaml, ```yml, ```YAML or
    // bare ```. We greedily take everything until the next ```.
    let lower = text.to_lowercase();
    let candidates = ["```yaml", "```yml", "```"];
    let mut best: Option<(usize, usize)> = None; // (open_end, close_start)
    for tag in candidates {
        if let Some(start) = lower.find(tag) {
            let open_end = start + tag.len();
            if let Some(rest_close) = text[open_end..].find("```") {
                let close_start = open_end + rest_close;
                best = Some((open_end, close_start));
                break;
            }
        }
    }
    if let Some((open_end, close_start)) = best {
        let inner = &text[open_end..close_start];
        // Skip the trailing newline of the opening fence
        return inner.trim_start_matches(['\r', '\n']).trim().to_string();
    }
    // No fence — fall back to the normalizer that the upload path uses.
    normalize_skill_content(text)
}

// ============================================================
// Core run loop — used by both Tauri commands
// ============================================================

async fn run_chat(
    pool: &crate::db::DbPool,
    app: &tauri::AppHandle,
    model_config_id: &str,
    prompt: String,
    attempt: u8,
) -> Result<String, String> {
    use futures::StreamExt;

    let pool_for_lookup = pool.clone();
    let mid = model_config_id.to_string();
    let mut config = tokio::task::spawn_blocking(move || get_model_config(&pool_for_lookup, &mid))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("model `{}` not found", model_config_id))?;
    config.max_tokens = config.max_tokens.min(MAX_TOKENS_CAP);

    let api_key: Option<String> = if config.provider == "ollama" {
        None
    } else {
        match crate::keychain::get_api_key(model_config_id) {
            Ok(Some(k)) => Some(k),
            Ok(None) => return Err(AiError::NoApiKey.to_string()),
            Err(e) => return Err(format!("Keychain 错误: {}", e)),
        }
    };

    let provider = provider_for(&config.provider, api_key).map_err(|e| e.to_string())?;
    let messages = vec![Message {
        role: "user".into(),
        content: prompt,
    }];
    let mut stream = provider
        .chat_stream(messages, &config)
        .await
        .map_err(|e| e.to_string())?;

    let mut full = String::new();
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(text) => {
                full.push_str(&text);
                let _ = app.emit(
                    "skill_gen:token",
                    GenTokenPayload {
                        text,
                        done: false,
                        attempt,
                    },
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "skill_gen:token",
                    GenTokenPayload {
                        text: format!("\n[ERROR: {}]\n", e),
                        done: true,
                        attempt,
                    },
                );
                return Err(e.to_string());
            }
        }
    }
    // Terminal done — let UI flush its buffer
    let _ = app.emit(
        "skill_gen:token",
        GenTokenPayload {
            text: String::new(),
            done: true,
            attempt,
        },
    );

    // V2.1.0 — record usage so cost rolls up under "近 7 天" too.
    let cfg_for_usage = config.clone();
    let pool_for_usage = pool.clone();
    let in_tokens = crate::ai_client::estimate_tokens(EXAMPLE_SKILL_YAML);
    let out_tokens = crate::ai_client::estimate_tokens(&full);
    let _ = tokio::task::spawn_blocking(move || {
        crate::ai_client::usage::record_usage(
            &pool_for_usage,
            &cfg_for_usage,
            in_tokens,
            out_tokens,
        )
    })
    .await;

    Ok(full)
}

/// Pick a model: caller-supplied id, or the user's default, or fail.
async fn resolve_model_id(
    pool: &crate::db::DbPool,
    supplied: Option<String>,
) -> Result<String, String> {
    if let Some(id) = supplied {
        return Ok(id);
    }
    let pool_clone = pool.clone();
    let all = tokio::task::spawn_blocking(move || list_all(&pool_clone))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if let Some(d) = all.iter().find(|c| c.is_default) {
        return Ok(d.id.clone());
    }
    if let Some(first) = all.first() {
        return Ok(first.id.clone());
    }
    Err("no model configured — open Models to add one".to_string())
}

/// Try to validate. On failure, run one fix-up round through the same
/// model with the previous YAML + error list embedded.
async fn validate_or_retry(
    pool: &crate::db::DbPool,
    app: &tauri::AppHandle,
    model_id: &str,
    first_pass_text: String,
) -> Result<GenerateResult, String> {
    let yaml = extract_yaml_block(&first_pass_text);
    match parse_and_validate(&yaml) {
        Ok(spec) => Ok(GenerateResult {
            yaml,
            spec,
            retried: false,
        }),
        Err(errs) => {
            log::info!(
                "skill_gen: first pass invalid ({} errors) — retrying",
                errs.len()
            );
            let fix_prompt = render_fix_prompt(&yaml, &errs);
            let second = run_chat(pool, app, model_id, fix_prompt, 2).await?;
            let yaml2 = extract_yaml_block(&second);
            let spec = parse_and_validate(&yaml2).map_err(|e2| {
                format!(
                    "AI 生成的 Skill 仍然不合法(已自动重试一次)。错误:\n{}",
                    e2.join("\n")
                )
            })?;
            Ok(GenerateResult {
                yaml: yaml2,
                spec,
                retried: true,
            })
        }
    }
}

fn parse_and_validate(yaml: &str) -> Result<SkillSpec, Vec<String>> {
    let spec: SkillSpec = serde_yaml::from_str(yaml).map_err(|e| {
        vec![format!("YAML 解析失败: {}", e)]
    })?;
    validate_skill(&spec)?;
    Ok(spec)
}

// ============================================================
// Tauri commands
// ============================================================

#[tauri::command]
pub async fn generate_skill_from_description(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    description: String,
    model_config_id: Option<String>,
) -> Result<GenerateResult, String> {
    if description.trim().is_empty() {
        return Err("description 不能为空".into());
    }
    let pool = state.db_pool.clone();
    let mid = resolve_model_id(&pool, model_config_id).await?;
    let prompt = render_meta_prompt(&description);
    let first = run_chat(&pool, &app, &mid, prompt, 1).await?;
    validate_or_retry(&pool, &app, &mid, first).await
}

#[tauri::command]
pub async fn refine_skill_from_chat(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    current_yaml: String,
    refine_instruction: String,
    model_config_id: Option<String>,
) -> Result<GenerateResult, String> {
    if current_yaml.trim().is_empty() {
        return Err("current_yaml 不能为空".into());
    }
    if refine_instruction.trim().is_empty() {
        return Err("refine_instruction 不能为空".into());
    }
    let pool = state.db_pool.clone();
    let mid = resolve_model_id(&pool, model_config_id).await?;
    let prompt = render_refine_prompt(&current_yaml, &refine_instruction);
    let first = run_chat(&pool, &app, &mid, prompt, 1).await?;
    validate_or_retry(&pool, &app, &mid, first).await
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meta_prompt_contains_user_description_and_example() {
        let p = render_meta_prompt("Skill for clinical trial papers");
        assert!(p.contains("Skill for clinical trial papers"));
        assert!(p.contains("name: general_read"), "few-shot must be present");
        // The hard contract sentence
        assert!(p.contains("ONE fenced"), "hard-output contract must be there");
    }

    #[test]
    fn meta_prompt_trims_user_input() {
        let p = render_meta_prompt("   foo   \n  ");
        assert!(p.contains("> foo\n"));
        assert!(!p.contains("> foo   "));
    }

    #[test]
    fn extract_yaml_block_handles_yaml_fence() {
        let text = "Here you go:\n\n```yaml\nname: foo\ndisplay_name: F\n```\n\nDone.";
        let y = extract_yaml_block(text);
        assert_eq!(y, "name: foo\ndisplay_name: F");
    }

    #[test]
    fn extract_yaml_block_handles_bare_fence() {
        let text = "```\nname: bar\n```";
        let y = extract_yaml_block(text);
        assert_eq!(y, "name: bar");
    }

    #[test]
    fn extract_yaml_block_handles_yml_alias() {
        let text = "```yml\nname: baz\n```";
        let y = extract_yaml_block(text);
        assert_eq!(y, "name: baz");
    }

    #[test]
    fn extract_yaml_block_falls_back_when_no_fence() {
        let raw = "name: bare\ndisplay_name: B\ndescription: x";
        let y = extract_yaml_block(raw);
        // normalize_skill_content keeps the content intact
        assert!(y.contains("name: bare"));
    }

    #[test]
    fn extract_yaml_block_picks_first_fence_only() {
        let text = "```yaml\nname: first\n```\n\nanother:\n```yaml\nname: second\n```";
        let y = extract_yaml_block(text);
        assert_eq!(y, "name: first");
    }

    #[test]
    fn refine_prompt_includes_current_yaml_and_instruction() {
        let p = render_refine_prompt("name: x\n", "add author field");
        assert!(p.contains("name: x"));
        assert!(p.contains("add author field"));
        assert!(p.contains("full updated YAML"));
    }

    #[test]
    fn fix_prompt_includes_errors() {
        let p = render_fix_prompt(
            "name: bad\n",
            &[
                "output_dimensions: 至少需要 1 个维度".into(),
                "prompt_template: 不能为空".into(),
            ],
        );
        assert!(p.contains("output_dimensions: 至少需要 1 个维度"));
        assert!(p.contains("prompt_template: 不能为空"));
        assert!(p.contains("name: bad"));
    }

    #[test]
    fn parse_and_validate_rejects_missing_template_var() {
        let bad = "name: t\ndisplay_name: T\ndescription: d\nprompt_template: \"no vars here\"\noutput_dimensions:\n  - { key: a, title: '🅰️ A' }";
        let r = parse_and_validate(bad);
        assert!(r.is_err());
        let errs = r.unwrap_err();
        assert!(
            errs.iter().any(|e| e.contains("模板") || e.contains("变量")),
            "errors: {:?}",
            errs
        );
    }

    #[test]
    fn parse_and_validate_accepts_general_read_example() {
        let r = parse_and_validate(EXAMPLE_SKILL_YAML.trim());
        assert!(r.is_ok(), "general_read.yaml must validate: {:?}", r.err());
    }
}
