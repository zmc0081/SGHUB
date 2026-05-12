//! Skill upload + validation.
//!
//! Logic split:
//! - Pure functions (parse, validate, write) — unit-testable
//! - Tauri commands — thin wrappers that resolve the user skills dir
//!   from `app.path().app_data_dir()` and `emit("skills:updated")`

use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::path::{Path, PathBuf};

use minijinja::Environment;
use serde::{Deserialize, Serialize};

use super::{load_builtin_skills, load_user_skills, OutputDimension};

/// Equivalent to `^[a-z][a-z0-9_-]*$` — rolled by hand to avoid pulling
/// in `regex` (~3 MB of compile-time deps for one pattern).
fn is_valid_name(name: &str) -> bool {
    let mut chars = name.chars();
    let Some(first) = chars.next() else { return false };
    if !first.is_ascii_lowercase() {
        return false;
    }
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
}

/// Heuristic: template contains at least one `{{...}}` placeholder.
/// Minijinja catches malformed templates downstream in `render_check`.
fn has_template_var(template: &str) -> bool {
    let Some(open) = template.find("{{") else { return false };
    let after_open = &template[open + 2..];
    let Some(close_rel) = after_open.find("}}") else { return false };
    close_rel > 0 // require at least one character between {{ and }}
}

/// Pre-process YAML content from various sources (incl. LLM-generated).
/// Handles:
/// - UTF-8 BOM stripping
/// - Markdown code fences (```yaml ... ``` or ``` ... ```) — extract inner content
/// - Leading prose like "Here is your skill:" — find first YAML root key
///
/// CRITICAL: if the content is already in Anthropic frontmatter format
/// (`---\n[YAML]\n---\n[markdown body]`), DO NOT touch it — the markdown
/// body legitimately contains code fences (` ```css `, ` ```python `, ...)
/// that must NOT be hoisted as YAML. `parse_skill_frontmatter` handles
/// this content downstream.
pub(crate) fn sanitize_llm_yaml(content: &str) -> String {
    // 1. Strip BOM
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(content);

    // 2. Frontmatter format takes precedence over fence extraction
    if looks_like_frontmatter(content) {
        return content.to_string();
    }

    // 3. Extract content between markdown code fences if present
    //    (LLM wrappers like "Here's your YAML: ```yaml ... ``` Hope this helps")
    if let Some(extracted) = extract_first_code_fence(content) {
        return extracted;
    }

    // 4. No fences — try to skip leading prose by finding the first
    //    line that looks like a YAML root mapping key.
    if let Some(start) = content.lines().position(is_yaml_start_line) {
        if start > 0 {
            return content
                .lines()
                .skip(start)
                .collect::<Vec<_>>()
                .join("\n");
        }
    }

    content.to_string()
}

fn is_yaml_start_line(line: &str) -> bool {
    // Only column-0 lines count as "root mapping start" — otherwise we'd
    // mistake nested array fields (e.g. "  display_name:" inside `- name:`)
    // for the start of a fresh YAML document.
    if line.starts_with(' ') || line.starts_with('\t') {
        return false;
    }
    let t = line.trim_end();
    t == "---"
        || t.starts_with("name:")
        || t.starts_with("name :")
        || t.starts_with("display_name:")
        || t.starts_with("displayName:")
}

/// Truncate user-facing strings so the toast / error log stays readable
/// even if a serde_yaml::Error decides to dump 5KB of CSS at us.
pub(crate) fn truncate_for_display(s: String, max_chars: usize) -> String {
    let count = s.chars().count();
    if count <= max_chars {
        return s;
    }
    let head: String = s.chars().take(max_chars).collect();
    format!("{}... (省略 {} 字符)", head, count - max_chars)
}

/// Heuristic content-type sniffer. Returns Some(kind) if the input is
/// CLEARLY not a SGHUB skill, so we can fail fast with a useful message.
pub(crate) fn detect_non_yaml_content(content: &str) -> Option<&'static str> {
    let head: String = content
        .trim_start()
        .chars()
        .take(64)
        .collect::<String>()
        .to_lowercase();
    // HTML
    if head.starts_with("<html")
        || head.starts_with("<!doctype")
        || head.starts_with("<style")
        || head.starts_with("<body")
        || head.starts_with("<head")
        || head.starts_with("<div")
    {
        return Some("HTML 文档");
    }
    // CSS
    if head.starts_with(":root")
        || head.starts_with("body{")
        || head.starts_with("body {")
        || head.starts_with("@import")
        || head.starts_with("@media")
        || head.starts_with("*{")
        || head.starts_with("* {")
    {
        return Some("CSS 样式表");
    }
    // JS/TS
    if head.starts_with("function ")
        || head.starts_with("const ")
        || head.starts_with("import ")
        || head.starts_with("export ")
        || head.starts_with("require(")
    {
        return Some("JavaScript / TypeScript");
    }
    // Python
    if head.starts_with("def ")
        || head.starts_with("class ")
        || head.starts_with("from ")
        || head.starts_with("#!/usr/bin/env python")
    {
        return Some("Python 代码");
    }
    // Shell
    if head.starts_with("#!/bin/bash") || head.starts_with("#!/bin/sh") {
        return Some("Shell 脚本");
    }
    None
}

/// Top-level normalize: handle BOM / fences / prose AND Anthropic-style
/// `.skill` frontmatter format. Returns canonical YAML that can be fed
/// straight to `serde_yaml::from_str`.
pub(crate) fn normalize_skill_content(content: &str) -> String {
    let cleaned = sanitize_llm_yaml(content);
    if looks_like_frontmatter(&cleaned) {
        if let Some(yaml) = parse_skill_frontmatter(&cleaned) {
            return yaml;
        }
    }
    cleaned
}

fn looks_like_frontmatter(content: &str) -> bool {
    let trimmed = content.trim_start();
    trimmed.starts_with("---\n") || trimmed.starts_with("---\r\n")
}

/// Parse `---\n[YAML]\n---\n[markdown body]` (Claude / Anthropic Skills
/// convention). Merges body into `prompt_template` and fills smart defaults
/// for missing required fields so the file passes our strict validation.
fn parse_skill_frontmatter(content: &str) -> Option<String> {
    let trimmed = content.trim_start();
    let after_open = trimmed
        .strip_prefix("---\r\n")
        .or_else(|| trimmed.strip_prefix("---\n"))?;
    let close_pos = after_open
        .find("\n---\n")
        .or_else(|| after_open.find("\r\n---\r\n"))?;

    let frontmatter = &after_open[..close_pos];
    let body_offset = close_pos + after_open[close_pos..].find("---")? + 3;
    let body = after_open[body_offset..]
        .trim_start_matches('\n')
        .trim_start_matches("\r\n")
        .trim()
        .to_string();

    let mut value: serde_yaml::Value = serde_yaml::from_str(frontmatter).ok()?;
    let mapping = value.as_mapping_mut()?;

    // Inject body as prompt_template if frontmatter doesn't have one
    let has_prompt = mapping.contains_key(yk("prompt_template"))
        || mapping.contains_key(yk("promptTemplate"));
    if !has_prompt && !body.is_empty() {
        // If body has no placeholders, auto-wrap with paper context preamble
        let prompt = if body.contains("{{") {
            body
        } else {
            format!(
                "你将分析以下论文,请按下方指令输出(语言:{{{{language}}}})。\n\n\
                 论文标题: {{{{title}}}}\n\
                 作者: {{{{authors}}}}\n\
                 摘要: {{{{abstract}}}}\n\n\
                 论文全文:\n{{{{full_text}}}}\n\n\
                 ---\n指令:\n{}",
                body
            )
        };
        mapping.insert(yk("prompt_template"), serde_yaml::Value::String(prompt));
    }

    // Default display_name from name (if missing)
    let has_display = mapping.contains_key(yk("display_name"))
        || mapping.contains_key(yk("displayName"));
    if !has_display {
        if let Some(serde_yaml::Value::String(name)) = mapping.get(yk("name")) {
            let display = humanize_name(name);
            mapping.insert(yk("display_name"), serde_yaml::Value::String(display));
        }
    }

    // Default output_dimensions (single "response" dimension) if missing
    let has_dims = mapping.contains_key(yk("output_dimensions"))
        || mapping.contains_key(yk("outputDimensions"));
    if !has_dims {
        let mut dim = serde_yaml::Mapping::new();
        dim.insert(yk("key"), serde_yaml::Value::String("response".into()));
        dim.insert(yk("title"), serde_yaml::Value::String("📝 输出".into()));
        let dims = serde_yaml::Value::Sequence(vec![serde_yaml::Value::Mapping(dim)]);
        mapping.insert(yk("output_dimensions"), dims);
    }

    serde_yaml::to_string(&value).ok()
}

fn yk(s: &str) -> serde_yaml::Value {
    serde_yaml::Value::String(s.to_string())
}

/// "paper-summarizer" / "paper_summarizer" -> "Paper Summarizer"
fn humanize_name(name: &str) -> String {
    name.replace(['-', '_'], " ")
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Find the first ```yaml / ```yml / ``` code block and return its body.
fn extract_first_code_fence(content: &str) -> Option<String> {
    for marker in ["```yaml", "```YAML", "```yml", "```YML", "```"] {
        let Some(start) = content.find(marker) else { continue };
        // Skip the opening marker AND its language tag line — body begins
        // after the first newline that follows the marker.
        let after_marker = start + marker.len();
        let rest = content.get(after_marker..)?;
        let nl = rest.find('\n')?;
        let body_start = after_marker + nl + 1;
        let body = content.get(body_start..)?;
        let close = body.find("\n```").unwrap_or(body.len());
        return Some(body[..close].to_string());
    }
    None
}

const FAKE_VARS: &[(&str, &str)] = &[
    ("title", "Test Paper"),
    ("authors", "Test Author"),
    ("abstract", "Test abstract."),
    ("full_text", "Lorem ipsum dolor sit amet."),
    ("language", "zh-CN"),
];

// ============================================================
// Spec struct (strict — required fields fail at deserialize)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillSpec {
    pub name: String,
    #[serde(alias = "displayName")]
    pub display_name: String,
    pub description: String,
    #[serde(alias = "promptTemplate")]
    pub prompt_template: String,
    #[serde(alias = "outputDimensions")]
    pub output_dimensions: Vec<OutputDimension>,
    #[serde(default, alias = "recommendedModels")]
    pub recommended_models: Vec<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillUploadResult {
    pub filename: String,
    pub success: bool,
    pub skill: Option<SkillSpec>,
    pub errors: Vec<String>,
}

// ============================================================
// Pure validation
// ============================================================

/// Returns Ok if the spec passes all rules, otherwise Err with
/// one human-readable error per rule failure (field name first).
pub fn validate_skill(spec: &SkillSpec) -> Result<(), Vec<String>> {
    let mut errs: Vec<String> = Vec::new();

    // name
    if spec.name.trim().is_empty() {
        errs.push("name: 不能为空".into());
    } else if !is_valid_name(&spec.name) {
        errs.push(format!(
            "name: `{}` 不是合法标识符 (要求: 小写字母开头,只允许 a-z, 0-9, _, -)",
            spec.name
        ));
    }

    // display_name
    if spec.display_name.trim().is_empty() {
        errs.push("display_name: 不能为空".into());
    }

    // description
    if spec.description.trim().is_empty() {
        errs.push("description: 不能为空".into());
    }

    // prompt_template
    if spec.prompt_template.trim().is_empty() {
        errs.push("prompt_template: 不能为空".into());
    } else {
        if !has_template_var(&spec.prompt_template) {
            errs.push("prompt_template: 必须包含至少一个变量占位符 (如 {{title}})".into());
        }
        if let Err(e) = render_check(&spec.prompt_template) {
            errs.push(format!("prompt_template: 模板渲染失败 — {}", e));
        }
    }

    // output_dimensions
    if spec.output_dimensions.is_empty() {
        errs.push("output_dimensions: 至少需要 1 个维度".into());
    } else {
        let mut keys_seen: HashSet<&str> = HashSet::new();
        for (i, dim) in spec.output_dimensions.iter().enumerate() {
            if dim.key.trim().is_empty() {
                errs.push(format!("output_dimensions[{}].key: 不能为空", i));
            } else if !keys_seen.insert(dim.key.as_str()) {
                errs.push(format!(
                    "output_dimensions[{}].key: `{}` 与其他维度重复",
                    i, dim.key
                ));
            }
            if dim.title.trim().is_empty() {
                errs.push(format!("output_dimensions[{}].title: 不能为空", i));
            }
        }
    }

    if errs.is_empty() {
        Ok(())
    } else {
        Err(errs)
    }
}

fn render_check(template: &str) -> Result<(), String> {
    let mut env = Environment::new();
    env.add_template_owned("__validate__", template.to_string())
        .map_err(|e| format!("语法错误: {}", e))?;
    let tmpl = env.get_template("__validate__").unwrap();
    let ctx: HashMap<&str, &str> = FAKE_VARS.iter().copied().collect();
    tmpl.render(ctx).map_err(|e| format!("渲染错误: {}", e))?;
    Ok(())
}

// ============================================================
// Pure I/O — testable with tempdir
// ============================================================

/// Parse + validate + write to `{user_dir}/{name}.yaml`.
/// `existing_names` is the set of all skill names already present
/// (built-in + user) so we can reject duplicates.
pub fn upload_skill_to_dir(
    user_dir: &Path,
    content: &str,
    existing_names: &HashSet<String>,
) -> Result<SkillSpec, Vec<String>> {
    // Normalize: strip code fences / prose / BOM, AND handle Anthropic
    // `.skill` frontmatter format (---\n[YAML]\n---\n[markdown body])
    let cleaned = normalize_skill_content(content);

    // Early sniff: if the body is clearly some other text format
    // (HTML / CSS / source code), surface that immediately instead of
    // dumping a 30-line serde_yaml error.
    if let Some(kind) = detect_non_yaml_content(&cleaned) {
        return Err(vec![format!(
            "文件内容看起来是 {} 而非 SGHUB Skill — 请确认文件未损坏,内容应为 YAML(或带 YAML frontmatter 的 markdown)",
            kind
        )]);
    }

    let spec: SkillSpec = match serde_yaml::from_str::<SkillSpec>(&cleaned) {
        Ok(s) => s,
        Err(e) => {
            // Hint when the YAML is actually a list of skills (ChatGPT often
            // generates this for "multiple skills" prompts)
            if let Ok(arr) = serde_yaml::from_str::<Vec<serde_yaml::Value>>(&cleaned) {
                return Err(vec![format!(
                    "YAML 解析失败: 检测到包含 {} 项的列表 — 请将每个 Skill 分别保存为单独的 .yaml/.skill 文件,或打包为 .zip(zip 内每个 skill 一个文件)",
                    arr.len()
                )]);
            }
            return Err(vec![truncate_for_display(
                format!("YAML 解析失败: {}", e),
                240,
            )]);
        }
    };
    validate_skill(&spec)?;

    if existing_names.contains(&spec.name) {
        return Err(vec![format!(
            "name: `{}` 与已有 Skill 重名 — 请改名后重传",
            spec.name
        )]);
    }

    std::fs::create_dir_all(user_dir).map_err(|e| vec![format!("创建目录失败: {}", e)])?;
    let target = user_dir.join(format!("{}.yaml", spec.name));
    // Write the CLEANED version so future loads don't trip on prose/fences.
    std::fs::write(&target, &cleaned).map_err(|e| vec![format!("写文件失败: {}", e)])?;
    Ok(spec)
}

/// Iterate every `.yaml`/`.yml` entry inside the zip and try to upload
/// each. Returns one result per entry — never fails the whole batch.
pub fn upload_zip_to_dir(
    user_dir: &Path,
    zip_bytes: &[u8],
    builtin_names: &HashSet<String>,
) -> Result<Vec<SkillUploadResult>, String> {
    let cursor = std::io::Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("zip 解析失败: {}", e))?;
    let mut results: Vec<SkillUploadResult> = Vec::new();

    // Names already taken — refresh after each successful upload so
    // duplicates within the same zip are also rejected.
    let mut taken: HashSet<String> = builtin_names.clone();
    for entry in std::fs::read_dir(user_dir).into_iter().flatten().flatten() {
        if let Some(stem) = entry.path().file_stem().and_then(|s| s.to_str()) {
            taken.insert(stem.to_string());
        }
    }

    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                results.push(SkillUploadResult {
                    filename: format!("(entry #{})", i),
                    success: false,
                    skill: None,
                    errors: vec![format!("读取条目失败: {}", e)],
                });
                continue;
            }
        };
        let raw_name = file.name().to_string();
        let lower = raw_name.to_lowercase();
        // Anthropic .skill packages bundle SKILL.md at root (or in a folder)
        let is_skill_md = lower == "skill.md" || lower.ends_with("/skill.md");
        if !lower.ends_with(".yaml")
            && !lower.ends_with(".yml")
            && !lower.ends_with(".skill")
            && !is_skill_md
        {
            continue; // silently skip non-skill entries (READMEs, scripts, etc.)
        }
        let display_name = raw_name
            .rsplit('/')
            .next()
            .unwrap_or(&raw_name)
            .to_string();

        let mut content = String::new();
        if let Err(e) = file.read_to_string(&mut content) {
            results.push(SkillUploadResult {
                filename: display_name,
                success: false,
                skill: None,
                errors: vec![format!("读取内容失败 (二进制?): {}", e)],
            });
            continue;
        }

        match upload_skill_to_dir(user_dir, &content, &taken) {
            Ok(spec) => {
                taken.insert(spec.name.clone());
                results.push(SkillUploadResult {
                    filename: display_name,
                    success: true,
                    skill: Some(spec),
                    errors: vec![],
                });
            }
            Err(errs) => results.push(SkillUploadResult {
                filename: display_name,
                success: false,
                skill: None,
                errors: errs,
            }),
        }
    }

    Ok(results)
}

pub fn delete_skill_from_dir(user_dir: &Path, name: &str) -> Result<(), String> {
    let target = user_dir.join(format!("{}.yaml", name));
    if !target.exists() {
        return Err(format!("未找到自定义 Skill `{}` (不能删除内置 Skill)", name));
    }
    std::fs::remove_file(&target).map_err(|e| format!("删除失败: {}", e))?;
    Ok(())
}

// ============================================================
// Tauri commands
// ============================================================

fn user_skills_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?
        .join("skills");
    Ok(dir)
}

fn current_existing_names(app: &tauri::AppHandle) -> HashSet<String> {
    let mut names: HashSet<String> = load_builtin_skills()
        .into_iter()
        .map(|s| s.name)
        .collect();
    for s in load_user_skills(app) {
        names.insert(s.name);
    }
    names
}

#[tauri::command]
pub async fn upload_skill_file(
    app: tauri::AppHandle,
    content: String,
    filename: String,
) -> Result<SkillSpec, Vec<String>> {
    use tauri::Emitter;
    let dir = user_skills_dir(&app).map_err(|e| vec![e])?;
    let existing = current_existing_names(&app);
    let result = upload_skill_to_dir(&dir, &content, &existing);
    if let Ok(spec) = &result {
        let _ = app.emit("skills:updated", spec.name.clone());
        log::info!(
            "uploaded skill `{}` from `{}` -> {}",
            spec.name,
            filename,
            dir.join(format!("{}.yaml", spec.name)).display()
        );
    }
    result
}

#[tauri::command]
pub async fn upload_skill_zip(
    app: tauri::AppHandle,
    zip_bytes: Vec<u8>,
) -> Result<Vec<SkillUploadResult>, String> {
    use tauri::Emitter;
    let dir = user_skills_dir(&app)?;
    let builtin_names: HashSet<String> = load_builtin_skills()
        .into_iter()
        .map(|s| s.name)
        .collect();
    let results = upload_zip_to_dir(&dir, &zip_bytes, &builtin_names)?;
    if results.iter().any(|r| r.success) {
        let _ = app.emit("skills:updated", "zip-batch");
    }
    log::info!(
        "zip upload: {} entries, {} succeeded",
        results.len(),
        results.iter().filter(|r| r.success).count()
    );
    Ok(results)
}

#[tauri::command]
pub async fn delete_custom_skill(app: tauri::AppHandle, name: String) -> Result<(), String> {
    use tauri::Emitter;
    // Refuse if name belongs to a builtin
    if load_builtin_skills().iter().any(|s| s.name == name) {
        return Err(format!("`{}` 是内置 Skill,不能删除", name));
    }
    let dir = user_skills_dir(&app)?;
    delete_skill_from_dir(&dir, &name)?;
    let _ = app.emit("skills:updated", name.clone());
    log::info!("deleted custom skill `{}`", name);
    Ok(())
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn good_spec() -> SkillSpec {
        SkillSpec {
            name: "my_skill".into(),
            display_name: "My Skill".into(),
            description: "Does things.".into(),
            prompt_template: "Title: {{title}}\nText: {{full_text}}\nLang: {{language}}".into(),
            output_dimensions: vec![
                OutputDimension {
                    key: "summary".into(),
                    title: "Summary".into(),
                    title_en: None,
                },
                OutputDimension {
                    key: "method".into(),
                    title: "Method".into(),
                    title_en: None,
                },
            ],
            recommended_models: vec!["claude-opus".into()],
            author: Some("alice".into()),
            version: Some("1.0".into()),
            icon: "📚".into(),
            category: "basic".into(),
        }
    }

    fn good_yaml() -> String {
        r#"
name: alice_methods
display_name: Methods Reading
description: Methodology-focused deep read.
prompt_template: |
  Read this paper: {{title}} — {{full_text}}
  Language: {{language}}
output_dimensions:
  - key: methodology
    title: 🔬 Methodology
  - key: results
    title: 📊 Results
recommended_models:
  - claude-opus
author: Alice
version: "0.1"
"#
        .to_string()
    }

    // ------------- validate_skill ----------------

    #[test]
    fn happy_path_passes() {
        assert!(validate_skill(&good_spec()).is_ok());
    }

    #[test]
    fn empty_name_fails() {
        let mut s = good_spec();
        s.name = "".into();
        let errs = validate_skill(&s).unwrap_err();
        assert!(errs.iter().any(|e| e.starts_with("name:")));
    }

    #[test]
    fn invalid_name_fails() {
        for bad in &["UpperCase", "1starts_digit", "has space", "中文", ""] {
            let mut s = good_spec();
            s.name = (*bad).into();
            assert!(
                validate_skill(&s).is_err(),
                "expected error for name `{}`",
                bad
            );
        }
    }

    #[test]
    fn valid_name_chars_pass() {
        for good in &["a", "abc", "a_b", "a-b", "a1", "a_1-b"] {
            let mut s = good_spec();
            s.name = (*good).into();
            assert!(validate_skill(&s).is_ok(), "expected OK for name `{}`", good);
        }
    }

    #[test]
    fn template_without_variables_fails() {
        let mut s = good_spec();
        s.prompt_template = "Just static text, no placeholders.".into();
        let errs = validate_skill(&s).unwrap_err();
        assert!(errs.iter().any(|e| e.contains("变量占位符")));
    }

    #[test]
    fn template_with_invalid_jinja_fails() {
        let mut s = good_spec();
        s.prompt_template = "{{ unclosed".into();
        let errs = validate_skill(&s).unwrap_err();
        // Either "变量占位符" (no closing) OR "模板渲染失败" — both acceptable.
        assert!(!errs.is_empty());
    }

    #[test]
    fn empty_dimensions_fails() {
        let mut s = good_spec();
        s.output_dimensions.clear();
        assert!(validate_skill(&s).unwrap_err().iter().any(|e| e.contains("output_dimensions")));
    }

    #[test]
    fn duplicate_dimension_keys_fails() {
        let mut s = good_spec();
        s.output_dimensions[1].key = s.output_dimensions[0].key.clone();
        let errs = validate_skill(&s).unwrap_err();
        assert!(errs.iter().any(|e| e.contains("重复")));
    }

    #[test]
    fn dimension_missing_title_fails() {
        let mut s = good_spec();
        s.output_dimensions[0].title = "".into();
        assert!(validate_skill(&s).unwrap_err().iter().any(|e| e.contains(".title")));
    }

    #[test]
    fn collects_all_errors_at_once() {
        let mut s = good_spec();
        s.name = "BAD".into();
        s.display_name = "".into();
        s.prompt_template = "no vars".into();
        s.output_dimensions.clear();
        let errs = validate_skill(&s).unwrap_err();
        assert!(errs.len() >= 4, "should collect all 4+ failures, got {:?}", errs);
    }

    // ------------- upload_skill_to_dir ----------------

    #[test]
    fn upload_writes_file_and_returns_spec() {
        let tmp = TempDir::new().unwrap();
        let existing = HashSet::new();
        let spec = upload_skill_to_dir(tmp.path(), &good_yaml(), &existing).unwrap();
        assert_eq!(spec.name, "alice_methods");
        let written = tmp.path().join("alice_methods.yaml");
        assert!(written.exists());
        assert!(std::fs::read_to_string(&written)
            .unwrap()
            .contains("alice_methods"));
    }

    #[test]
    fn upload_rejects_duplicate_name() {
        let tmp = TempDir::new().unwrap();
        let mut existing = HashSet::new();
        existing.insert("alice_methods".into());
        let errs = upload_skill_to_dir(tmp.path(), &good_yaml(), &existing).unwrap_err();
        assert!(errs[0].contains("重名"));
    }

    #[test]
    fn upload_rejects_missing_required_field() {
        let tmp = TempDir::new().unwrap();
        let bad = "name: x\ndisplay_name: Y\n"; // missing description, prompt_template, output_dimensions
        let errs = upload_skill_to_dir(tmp.path(), bad, &HashSet::new()).unwrap_err();
        assert!(errs[0].contains("YAML 解析失败"));
    }

    #[test]
    fn upload_rejects_invalid_template() {
        let tmp = TempDir::new().unwrap();
        let bad = r#"
name: bad_template
display_name: Bad
description: Has no vars.
prompt_template: "static text"
output_dimensions:
  - key: x
    title: X
"#;
        let errs = upload_skill_to_dir(tmp.path(), bad, &HashSet::new()).unwrap_err();
        assert!(errs.iter().any(|e| e.contains("变量占位符")));
    }

    // ------------- upload_zip_to_dir ----------------

    fn make_zip(entries: &[(&str, &str)]) -> Vec<u8> {
        use std::io::Write;
        let mut buf: Vec<u8> = Vec::new();
        {
            let cursor = std::io::Cursor::new(&mut buf);
            let mut zip = zip::ZipWriter::new(cursor);
            let opts: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default();
            for (name, content) in entries {
                zip.start_file(*name, opts).unwrap();
                zip.write_all(content.as_bytes()).unwrap();
            }
            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn zip_mixed_success_and_failure() {
        let tmp = TempDir::new().unwrap();
        let bad_yaml = "name: bad\n"; // missing required fields
        let zip = make_zip(&[
            ("alice_methods.yaml", &good_yaml()),
            ("bad.yaml", bad_yaml),
            ("readme.txt", "ignored"),
        ]);
        let results = upload_zip_to_dir(tmp.path(), &zip, &HashSet::new()).unwrap();
        // readme.txt is filtered, so 2 entries
        assert_eq!(results.len(), 2);
        let ok = results.iter().find(|r| r.filename.starts_with("alice")).unwrap();
        assert!(ok.success);
        let bad = results.iter().find(|r| r.filename.starts_with("bad")).unwrap();
        assert!(!bad.success);
        assert!(!bad.errors.is_empty());
    }

    #[test]
    fn zip_internal_dup_rejected_after_first() {
        let tmp = TempDir::new().unwrap();
        let zip = make_zip(&[
            ("first.yaml", &good_yaml()),
            ("second.yaml", &good_yaml()), // same `name` inside YAML
        ]);
        let results = upload_zip_to_dir(tmp.path(), &zip, &HashSet::new()).unwrap();
        assert_eq!(results.len(), 2);
        assert!(results[0].success);
        assert!(!results[1].success);
        assert!(results[1].errors[0].contains("重名"));
    }

    // ------------- delete_skill_from_dir ----------------

    // ------------- LLM output sanitization ----------------

    #[test]
    fn sanitize_strips_bom() {
        let s = "\u{FEFF}name: x\n";
        assert_eq!(sanitize_llm_yaml(s), "name: x\n");
    }

    #[test]
    fn sanitize_strips_yaml_code_fence() {
        let llm = "Here is your skill:\n\n```yaml\nname: chatgpt_skill\ndisplay_name: GPT\n```\n\nHope this helps!";
        let cleaned = sanitize_llm_yaml(llm);
        assert!(cleaned.contains("name: chatgpt_skill"));
        assert!(!cleaned.contains("Here is your"));
        assert!(!cleaned.contains("Hope this helps"));
        assert!(!cleaned.contains("```"));
    }

    #[test]
    fn sanitize_strips_plain_code_fence() {
        let llm = "```\nname: x\ndisplay_name: Y\n```";
        let cleaned = sanitize_llm_yaml(llm);
        assert!(cleaned.starts_with("name: x"));
    }

    #[test]
    fn sanitize_skips_leading_prose_no_fence() {
        let s = "I generated this skill for you:\nname: test\ndisplay_name: T\n";
        let cleaned = sanitize_llm_yaml(s);
        assert!(cleaned.starts_with("name: test"));
    }

    #[test]
    fn sanitize_passthrough_for_clean_yaml() {
        let s = "name: x\ndisplay_name: Y\n";
        assert_eq!(sanitize_llm_yaml(s), s);
    }

    #[test]
    fn upload_handles_chatgpt_style_yaml() {
        let tmp = TempDir::new().unwrap();
        let llm_output = r#"Here's a SGHUB skill for analyzing methods:

```yaml
name: methods_focus
displayName: Methods Focus
description: Methodology deep-read
promptTemplate: |
  Title: {{title}}
  Body: {{full_text}}
outputDimensions:
  - key: methods
    title: Methods
recommendedModels:
  - claude-opus
```

Hope this helps!
"#;
        let spec = upload_skill_to_dir(tmp.path(), llm_output, &HashSet::new()).unwrap();
        assert_eq!(spec.name, "methods_focus");
        assert_eq!(spec.display_name, "Methods Focus");
        assert_eq!(spec.recommended_models, vec!["claude-opus".to_string()]);

        // The file written to disk should be the CLEAN version (no prose/fence).
        let written = std::fs::read_to_string(tmp.path().join("methods_focus.yaml")).unwrap();
        assert!(!written.contains("Here's a SGHUB"));
        assert!(!written.contains("```"));
        assert!(!written.contains("Hope this helps"));
    }

    #[test]
    fn upload_handles_claude_style_yaml_with_explanation() {
        let tmp = TempDir::new().unwrap();
        let llm_output = r#"I'll create a SGHUB skill for paper synthesis. Here it is:

```yaml
name: synthesis
display_name: 综合分析
description: 跨论文对比综合
prompt_template: |
  对比以下论文: {{title}}
  全文: {{full_text}}
  用 {{language}} 输出
output_dimensions:
  - key: similarity
    title: 相似点
  - key: difference
    title: 差异点
author: Claude
version: "1.0"
```

This skill will help you synthesize information across multiple papers.
"#;
        let spec = upload_skill_to_dir(tmp.path(), llm_output, &HashSet::new()).unwrap();
        assert_eq!(spec.name, "synthesis");
        assert_eq!(spec.display_name, "综合分析");
        assert_eq!(spec.author.as_deref(), Some("Claude"));
        assert_eq!(spec.output_dimensions.len(), 2);
    }

    // ------------- Anthropic .skill frontmatter ----------------

    #[test]
    fn humanize_name_capitalizes_words() {
        assert_eq!(humanize_name("paper-summarizer"), "Paper Summarizer");
        assert_eq!(humanize_name("my_skill"), "My Skill");
        assert_eq!(humanize_name("a-b_c"), "A B C");
    }

    #[test]
    fn frontmatter_with_body_becomes_prompt_template() {
        let claude_skill = "---\n\
                            name: paper-summarizer\n\
                            description: Summarize academic papers\n\
                            ---\n\n\
                            Read the paper carefully and produce a structured summary covering thesis, methods, and results.\n";
        let cleaned = normalize_skill_content(claude_skill);
        assert!(cleaned.contains("paper-summarizer"));
        assert!(cleaned.contains("display_name") || cleaned.contains("displayName"));
        assert!(cleaned.contains("output_dimensions") || cleaned.contains("outputDimensions"));
        // Body should be wrapped with paper context (since it has no {{...}} placeholders)
        assert!(cleaned.contains("{{title}}") || cleaned.contains("{{ title }}"));
        assert!(cleaned.contains("{{full_text}}") || cleaned.contains("{{ full_text }}"));
        assert!(cleaned.contains("Read the paper carefully"));
    }

    #[test]
    fn frontmatter_with_explicit_prompt_template_is_preserved() {
        let s = "---\n\
                 name: x\n\
                 prompt_template: \"Custom: {{title}}\"\n\
                 ---\n\n\
                 This body should be ignored.";
        let cleaned = normalize_skill_content(s);
        assert!(cleaned.contains("Custom: {{title}}") || cleaned.contains("Custom: {{ title }}"));
        assert!(!cleaned.contains("This body should be ignored"));
    }

    #[test]
    fn frontmatter_with_placeholders_in_body_keeps_body_as_is() {
        let s = "---\n\
                 name: x\n\
                 description: D\n\
                 ---\n\n\
                 Title: {{title}}\nBody: {{full_text}}";
        let cleaned = normalize_skill_content(s);
        // Should NOT add the auto-wrapping preamble since body already has placeholders
        assert!(!cleaned.contains("你将分析以下论文"));
        assert!(cleaned.contains("Title:"));
    }

    #[test]
    fn upload_claude_dot_skill_full_round_trip() {
        let tmp = TempDir::new().unwrap();
        let claude_skill = "---\n\
                            name: critical-reading\n\
                            description: 批判性阅读论文\n\
                            author: Claude\n\
                            version: \"0.1\"\n\
                            ---\n\n\
                            你是一位严谨的学术评审。对论文进行批判性分析:\n\n\
                            1. 主要论点是否有充分证据支持?\n\
                            2. 实验设计是否合理?\n\
                            3. 是否存在遗漏的对照实验?\n\
                            4. 结论的推广性如何?\n\
                            ";
        let spec = upload_skill_to_dir(tmp.path(), claude_skill, &HashSet::new()).unwrap();
        assert_eq!(spec.name, "critical-reading");
        assert_eq!(spec.display_name, "Critical Reading"); // humanized from name
        assert_eq!(spec.author.as_deref(), Some("Claude"));
        assert_eq!(spec.output_dimensions.len(), 1); // default single dim
        assert_eq!(spec.output_dimensions[0].key, "response");
        // Prompt was synthesized: paper context preamble + user instructions
        assert!(spec.prompt_template.contains("{{full_text}}"));
        assert!(spec.prompt_template.contains("批判性分析"));

        // Disk file is the cleaned/normalized YAML, not the original markdown
        let written = std::fs::read_to_string(tmp.path().join("critical-reading.yaml")).unwrap();
        assert!(!written.starts_with("---"));
        assert!(written.contains("display_name"));
    }

    #[test]
    fn frontmatter_with_css_codeblock_in_body_does_not_hoist_css() {
        // Regression: a real Claude-generated SKILL.md had ```css fence
        // inside the markdown body. Earlier sanitize_llm_yaml grabbed the
        // CSS as if it were the YAML root → "CSS 样式表" false detection.
        let s = "---\n\
                 name: research-skill\n\
                 description: 文献研读\n\
                 ---\n\n\
                 # 概述\n\n\
                 输出 HTML 时使用以下 CSS:\n\n\
                 ```css\n\
                 :root{ --primary:#1a365d; --accent:#2b6cb0; }\n\
                 body{ font-family:'Segoe UI'; }\n\
                 ```\n\n\
                 然后调用相关函数。\n";
        let cleaned = normalize_skill_content(s);
        // Frontmatter must be parsed, NOT the inner CSS fence
        assert!(cleaned.contains("research-skill"), "got: {}", cleaned);
        assert!(cleaned.contains("display_name") || cleaned.contains("displayName"));
        // Body becomes prompt_template with paper-context preamble + body content
        assert!(cleaned.contains("{{title}}") || cleaned.contains("{{ title }}"));
        // CSS is preserved inside the prompt_template, not hoisted as root
        assert!(cleaned.contains(":root") && cleaned.contains("--primary"));
    }

    #[test]
    fn upload_real_anthropic_skill_with_codeblocks_succeeds() {
        let tmp = TempDir::new().unwrap();
        // Mimic the user's real-world file: long markdown body with ---
        // horizontal rules AND ```css fences AND mixed CN/EN content
        let s = "---\n\
                 name: research-scientific-literature\n\
                 description: 专业科研文献深度研读 skill\n\
                 ---\n\n\
                 # Research of Scientific Literature\n\n\
                 ## 定位与角色\n\n\
                 以**顶级科研领域资深教授**身份进行文献研读。\n\n\
                 ---\n\n\
                 ## 输出格式\n\n\
                 必须输出 HTML,使用以下 CSS:\n\n\
                 ```css\n\
                 :root{ --primary:#1a365d; }\n\
                 body{ font-family:'Segoe UI'; }\n\
                 ```\n\n\
                 ## 分析框架\n\n\
                 12 个 Tab 模块。\n";
        let spec = upload_skill_to_dir(tmp.path(), s, &HashSet::new()).unwrap();
        assert_eq!(spec.name, "research-scientific-literature");
        assert_eq!(spec.display_name, "Research Scientific Literature");
        assert_eq!(spec.output_dimensions.len(), 1); // default
        assert!(spec.prompt_template.contains("{{full_text}}"));
        assert!(spec.prompt_template.contains("12 个 Tab"));
        assert!(spec.prompt_template.contains(":root"));
    }

    #[test]
    fn upload_handles_camelcase_only() {
        let tmp = TempDir::new().unwrap();
        let camel = r#"
name: camel_skill
displayName: Camel Skill
description: All camelCase
promptTemplate: "{{title}}"
outputDimensions:
  - key: x
    title: X
recommendedModels: ["gpt-5"]
"#;
        let spec = upload_skill_to_dir(tmp.path(), camel, &HashSet::new()).unwrap();
        assert_eq!(spec.display_name, "Camel Skill");
        assert_eq!(spec.recommended_models, vec!["gpt-5".to_string()]);
    }

    #[test]
    fn upload_yaml_array_returns_helpful_error() {
        let tmp = TempDir::new().unwrap();
        let arr = r#"
- name: skill_one
  display_name: One
  description: D
  prompt_template: "{{title}}"
  output_dimensions:
    - key: x
      title: X
- name: skill_two
  display_name: Two
  description: D
  prompt_template: "{{title}}"
  output_dimensions:
    - key: x
      title: X
"#;
        let errs = upload_skill_to_dir(tmp.path(), arr, &HashSet::new()).unwrap_err();
        assert!(errs[0].contains("列表"), "should detect array, got {:?}", errs);
        assert!(errs[0].contains("2 项"));
    }

    #[test]
    fn zip_with_skill_md_processes_anthropic_format() {
        let tmp = TempDir::new().unwrap();
        let skill_md = "---\n\
                        name: paper-critique\n\
                        description: 批判性阅读\n\
                        ---\n\n\
                        请对论文进行批判性分析,关注实验设计的合理性。";
        // Zip with SKILL.md (typical Anthropic .skill structure)
        let zip = make_zip(&[
            ("SKILL.md", skill_md),
            ("scripts/helper.py", "# would be ignored"),
            ("README.md", "# would also be ignored"),
        ]);
        let results = upload_zip_to_dir(tmp.path(), &zip, &HashSet::new()).unwrap();
        // Only SKILL.md should be processed
        assert_eq!(results.len(), 1);
        assert!(results[0].success, "got: {:?}", results[0].errors);
        let spec = results[0].skill.as_ref().unwrap();
        assert_eq!(spec.name, "paper-critique");
        assert_eq!(spec.display_name, "Paper Critique");
        assert!(tmp.path().join("paper-critique.yaml").exists());
    }

    #[test]
    fn zip_with_nested_skill_md_works() {
        let tmp = TempDir::new().unwrap();
        let skill_md = "---\n\
                        name: nested\n\
                        description: D\n\
                        ---\n\n\
                        Test {{title}}";
        let zip = make_zip(&[("paper-critique/SKILL.md", skill_md)]);
        let results = upload_zip_to_dir(tmp.path(), &zip, &HashSet::new()).unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].success);
    }

    // ------------- non-YAML content sniffing ----------------

    #[test]
    fn detect_non_yaml_recognizes_html() {
        assert_eq!(
            detect_non_yaml_content("<!DOCTYPE html>\n<html>"),
            Some("HTML 文档")
        );
        assert_eq!(
            detect_non_yaml_content("<style>body{color:red;}</style>"),
            Some("HTML 文档")
        );
    }

    #[test]
    fn detect_non_yaml_recognizes_css() {
        assert_eq!(
            detect_non_yaml_content(":root{ --primary:#1a365d; }"),
            Some("CSS 样式表")
        );
        assert_eq!(
            detect_non_yaml_content("body { font-size: 16px; }"),
            Some("CSS 样式表")
        );
    }

    #[test]
    fn detect_non_yaml_recognizes_code() {
        assert!(detect_non_yaml_content("def main():").is_some());
        assert!(detect_non_yaml_content("function foo()").is_some());
        assert!(detect_non_yaml_content("import React").is_some());
    }

    #[test]
    fn detect_non_yaml_passes_real_yaml() {
        assert!(detect_non_yaml_content("name: x\n").is_none());
        assert!(detect_non_yaml_content("---\nname: x").is_none());
        assert!(detect_non_yaml_content("# comment\nname: x").is_none());
    }

    #[test]
    fn upload_css_content_returns_friendly_error() {
        let tmp = TempDir::new().unwrap();
        let css = ":root{ --primary:#1a365d; }\nbody{font-family:'Segoe UI';}";
        let errs = upload_skill_to_dir(tmp.path(), css, &HashSet::new()).unwrap_err();
        assert_eq!(errs.len(), 1);
        assert!(errs[0].contains("CSS 样式表"), "got: {:?}", errs);
        assert!(errs[0].contains("非 SGHUB Skill"));
    }

    #[test]
    fn upload_html_content_returns_friendly_error() {
        let tmp = TempDir::new().unwrap();
        let html = "<!DOCTYPE html>\n<html><body>Hi</body></html>";
        let errs = upload_skill_to_dir(tmp.path(), html, &HashSet::new()).unwrap_err();
        assert!(errs[0].contains("HTML 文档"));
    }

    #[test]
    fn truncate_for_display_passes_short() {
        assert_eq!(truncate_for_display("hello".into(), 10), "hello");
    }

    #[test]
    fn truncate_for_display_caps_long() {
        let long = "x".repeat(500);
        let cut = truncate_for_display(long, 100);
        assert!(cut.starts_with(&"x".repeat(100)));
        assert!(cut.contains("省略 400 字符"));
    }

    #[test]
    fn yaml_parse_error_is_truncated() {
        let tmp = TempDir::new().unwrap();
        // 4 KB of garbage that's not detected as known type but fails serde
        let huge = "weird_root: ".to_string() + &"x".repeat(4096);
        let errs = upload_skill_to_dir(tmp.path(), &huge, &HashSet::new()).unwrap_err();
        // Either truncated or hits the missing-required-field path; both fine
        assert!(errs[0].chars().count() < 600);
    }

    #[test]
    fn delete_existing_user_skill() {
        let tmp = TempDir::new().unwrap();
        upload_skill_to_dir(tmp.path(), &good_yaml(), &HashSet::new()).unwrap();
        assert!(tmp.path().join("alice_methods.yaml").exists());
        delete_skill_from_dir(tmp.path(), "alice_methods").unwrap();
        assert!(!tmp.path().join("alice_methods.yaml").exists());
    }

    #[test]
    fn delete_nonexistent_returns_error() {
        let tmp = TempDir::new().unwrap();
        let err = delete_skill_from_dir(tmp.path(), "nope").unwrap_err();
        assert!(err.contains("未找到"));
    }
}
