//! Build the `Vec<Message>` sent to the LLM for a turn of chat.
//!
//! Layering (oldest → newest):
//! 1. System prompt — from skill (if set) or session.system_prompt
//! 2. History — past chat_messages (user/assistant alternating)
//! 3. Current input — prepend each attachment's extracted_text as a markdown
//!    blockquote, then the user's typed content
//!
//! Token budgeting: estimate via 4-chars-per-token, LRU-drop oldest non-system
//! messages until under (model.max_tokens * 0.8). Attachments inside the
//! current input are NEVER dropped — only history messages.

use crate::ai_client::{estimate_tokens, Message};
use crate::skill_engine::find_skill;

use super::attachment::{db_get_attachments, ChatAttachment};
use super::message::db_list_messages;

/// Build the LLM-bound message list for this turn.
pub(crate) fn build_messages_for_api(
    app: &tauri::AppHandle,
    pool: &crate::db::DbPool,
    session_id: &str,
    skill_name: Option<&str>,
    current_input: &str,
    attachment_ids: &[String],
    max_tokens: i64,
) -> Result<(Vec<Message>, i64), String> {
    let mut messages: Vec<Message> = Vec::new();

    // 1. System prompt from skill
    if let Some(sn) = skill_name {
        if let Some(skill) = find_skill(app, sn) {
            // skill prompt_template uses {{...}} placeholders we don't fill in chat —
            // the user types their own questions. Strip placeholders so the model
            // doesn't see literal "{{title}}" in its system message.
            let cleaned = sanitize_skill_prompt(&skill.prompt_template);
            messages.push(Message {
                role: "system".into(),
                content: cleaned,
            });
        }
    }

    // 2. Past messages (ASC)
    let history =
        db_list_messages(pool, session_id, 500, None).map_err(|e| e.to_string())?;
    for m in history {
        messages.push(Message {
            role: m.role,
            content: m.content,
        });
    }

    // 3. Current input + attachments
    let attachments =
        db_get_attachments(pool, attachment_ids).map_err(|e| e.to_string())?;
    let composed_input = compose_user_input(current_input, &attachments);
    messages.push(Message {
        role: "user".into(),
        content: composed_input,
    });

    // 4. Token budget — drop oldest non-system messages (skip 1st system + last user)
    let budget = (max_tokens as f64 * 0.8) as i64;
    let mut total: i64 = messages.iter().map(|m| estimate_tokens(&m.content)).sum();
    while total > budget {
        // Find first removable index: skip leading system messages, never remove
        // the LAST message (the current user input).
        let mut remove_at: Option<usize> = None;
        for (i, m) in messages.iter().enumerate() {
            if m.role == "system" {
                continue;
            }
            if i == messages.len() - 1 {
                break; // never drop the current input
            }
            remove_at = Some(i);
            break;
        }
        match remove_at {
            Some(i) => {
                let removed = messages.remove(i);
                total -= estimate_tokens(&removed.content);
            }
            None => break, // can't trim further
        }
    }

    Ok((messages, total))
}

fn compose_user_input(text: &str, attachments: &[ChatAttachment]) -> String {
    if attachments.is_empty() {
        return text.to_string();
    }
    let mut out = String::new();
    for att in attachments {
        let Some(extracted) = att.extracted_text.as_deref() else {
            continue;
        };
        out.push_str(&format!("> **附件: {}**", att.file_name));
        if let Some(pid) = &att.paper_id {
            out.push_str(&format!(" (paper: {})", pid));
        }
        out.push_str("\n>\n");
        for line in extracted.lines() {
            out.push_str("> ");
            out.push_str(line);
            out.push('\n');
        }
        out.push('\n');
    }
    if !text.is_empty() {
        out.push_str(text);
    }
    out
}

/// Skill prompts have `{{title}}` etc. that are only meaningful when running
/// against a paper. In chat, the user types freely. Replace placeholders with
/// generic descriptions so the model gets a usable system prompt.
fn sanitize_skill_prompt(template: &str) -> String {
    template
        .replace("{{title}}", "(论文标题 — 当用户提供时)")
        .replace("{{authors}}", "(作者列表 — 当用户提供时)")
        .replace("{{abstract}}", "(论文摘要 — 当用户提供时)")
        .replace("{{full_text}}", "(论文全文 — 由用户附件提供)")
        .replace("{{language}}", "中文")
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compose_input_prefixes_attachments_as_blockquote() {
        let atts = vec![ChatAttachment {
            id: "a".into(),
            session_id: "s".into(),
            message_id: None,
            kind: "md".into(),
            file_name: "notes.md".into(),
            file_path: None,
            file_size: None,
            extracted_text: Some("hello\nworld".into()),
            paper_id: None,
            created_at: String::new(),
        }];
        let out = compose_user_input("Question?", &atts);
        assert!(out.contains("> **附件: notes.md**"));
        assert!(out.contains("> hello"));
        assert!(out.contains("> world"));
        assert!(out.ends_with("Question?"));
    }

    #[test]
    fn compose_input_no_attachments_is_passthrough() {
        let out = compose_user_input("hi", &[]);
        assert_eq!(out, "hi");
    }

    #[test]
    fn sanitize_replaces_all_placeholders() {
        let s = sanitize_skill_prompt(
            "T:{{title}} A:{{authors}} B:{{abstract}} F:{{full_text}} L:{{language}}",
        );
        assert!(!s.contains("{{"));
        assert!(s.contains("中文"));
    }
}
