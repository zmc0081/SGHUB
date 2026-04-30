use serde::{Deserialize, Serialize};

use crate::search::{mock_papers, Paper};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub sort_order: i32,
    pub is_smart: bool,
    pub smart_rule: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn mock_folders() -> Vec<Folder> {
    vec![
        Folder {
            id: "00000000-0000-0000-0000-000000000001".into(),
            parent_id: None,
            name: "未分类".into(),
            sort_order: 9999,
            is_smart: false,
            smart_rule: None,
            created_at: "2026-04-28T09:00:00Z".into(),
            updated_at: "2026-04-28T09:00:00Z".into(),
        },
        Folder {
            id: "00000000-0000-0000-0000-000000000010".into(),
            parent_id: None,
            name: "LLM 基础架构".into(),
            sort_order: 10,
            is_smart: false,
            smart_rule: None,
            created_at: "2026-04-28T09:10:00Z".into(),
            updated_at: "2026-04-28T09:10:00Z".into(),
        },
        Folder {
            id: "00000000-0000-0000-0000-000000000011".into(),
            parent_id: Some("00000000-0000-0000-0000-000000000010".into()),
            name: "Transformer 架构".into(),
            sort_order: 11,
            is_smart: false,
            smart_rule: None,
            created_at: "2026-04-28T09:11:00Z".into(),
            updated_at: "2026-04-28T09:11:00Z".into(),
        },
        Folder {
            id: "00000000-0000-0000-0000-000000000012".into(),
            parent_id: Some("00000000-0000-0000-0000-000000000010".into()),
            name: "Few-shot Learning".into(),
            sort_order: 12,
            is_smart: false,
            smart_rule: None,
            created_at: "2026-04-28T09:12:00Z".into(),
            updated_at: "2026-04-28T09:12:00Z".into(),
        },
        Folder {
            id: "00000000-0000-0000-0000-000000000020".into(),
            parent_id: None,
            name: "RLHF & 对齐".into(),
            sort_order: 20,
            is_smart: false,
            smart_rule: None,
            created_at: "2026-04-28T09:20:00Z".into(),
            updated_at: "2026-04-28T09:20:00Z".into(),
        },
        Folder {
            id: "00000000-0000-0000-0000-000000000030".into(),
            parent_id: None,
            name: "结构生物学".into(),
            sort_order: 30,
            is_smart: false,
            smart_rule: None,
            created_at: "2026-04-29T15:00:00Z".into(),
            updated_at: "2026-04-29T15:00:00Z".into(),
        },
        Folder {
            id: "00000000-0000-0000-0000-000000000099".into(),
            parent_id: None,
            name: "📌 待读 (智能)".into(),
            sort_order: 99,
            is_smart: true,
            smart_rule: Some(r#"{"read_status":"unread"}"#.into()),
            created_at: "2026-04-28T09:30:00Z".into(),
            updated_at: "2026-04-28T09:30:00Z".into(),
        },
    ]
}

#[tauri::command]
pub async fn get_folders() -> Result<Vec<Folder>, String> {
    Ok(mock_folders())
}

#[tauri::command]
pub async fn get_papers_by_folder(folder_id: String) -> Result<Vec<Paper>, String> {
    let papers = mock_papers();
    let result: Vec<Paper> = match folder_id.as_str() {
        "00000000-0000-0000-0000-000000000011" => papers
            .into_iter()
            .filter(|p| {
                p.title.contains("Attention")
                    || p.title.contains("BERT")
                    || p.title.contains("LLaMA")
            })
            .collect(),
        "00000000-0000-0000-0000-000000000012" => papers
            .into_iter()
            .filter(|p| p.title.contains("Few-Shot"))
            .collect(),
        "00000000-0000-0000-0000-000000000020" => papers
            .into_iter()
            .filter(|p| p.title.contains("Direct Preference"))
            .collect(),
        "00000000-0000-0000-0000-000000000030" => papers
            .into_iter()
            .filter(|p| p.source == "pubmed")
            .collect(),
        "00000000-0000-0000-0000-000000000099" => papers
            .into_iter()
            .filter(|p| p.read_status == "unread")
            .collect(),
        _ => papers,
    };
    Ok(result)
}
