//! V2.2.10 (Session 49) — PDF reader annotations (highlight / underline).
//!
//! Stored per paper + page with a JSON `anchor` of page-normalised rects, so
//! the frontend can re-render them at any zoom level. Adds/deletes/recolors
//! persist immediately; the reader loads a paper's annotations on open.

use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    pub id: String,
    pub paper_id: String,
    pub page: i64,
    /// JSON: {"rects":[{"x":..,"y":..,"w":..,"h":..}, ...]} (0–1 fractions)
    pub anchor: String,
    /// "highlight" | "underline"
    #[serde(rename = "type")]
    pub kind: String,
    /// "yellow" | "green" | "pink"
    pub color: String,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnnotationInput {
    pub paper_id: String,
    pub page: i64,
    pub anchor: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub color: String,
}

const COLS: &str = "id, paper_id, page, anchor, type, color, note, created_at";

fn row_to_annotation(row: &Row) -> rusqlite::Result<Annotation> {
    Ok(Annotation {
        id: row.get(0)?,
        paper_id: row.get(1)?,
        page: row.get(2)?,
        anchor: row.get(3)?,
        kind: row.get(4)?,
        color: row.get(5)?,
        note: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

// ── DB helpers (sync — call via spawn_blocking) ─────────────────────

pub(crate) fn db_insert_annotation(
    pool: &crate::db::DbPool,
    input: &AnnotationInput,
) -> rusqlite::Result<Annotation> {
    let id = uuid::Uuid::now_v7().to_string();
    let now = now_iso();
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        &format!("INSERT INTO annotations ({COLS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)"),
        params![
            id,
            input.paper_id,
            input.page,
            input.anchor,
            input.kind,
            input.color,
            now
        ],
    )?;
    Ok(Annotation {
        id,
        paper_id: input.paper_id.clone(),
        page: input.page,
        anchor: input.anchor.clone(),
        kind: input.kind.clone(),
        color: input.color.clone(),
        note: None,
        created_at: now,
    })
}

pub(crate) fn db_list_annotations(
    pool: &crate::db::DbPool,
    paper_id: &str,
) -> rusqlite::Result<Vec<Annotation>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM annotations WHERE paper_id = ?1 ORDER BY page ASC, created_at ASC"
    ))?;
    let rows: Vec<Annotation> = stmt
        .query_map([paper_id], row_to_annotation)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

pub(crate) fn db_delete_annotation(
    pool: &crate::db::DbPool,
    id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute("DELETE FROM annotations WHERE id = ?1", [id])
}

pub(crate) fn db_update_annotation_color(
    pool: &crate::db::DbPool,
    id: &str,
    color: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE annotations SET color = ?1 WHERE id = ?2",
        params![color, id],
    )
}

// ── Tauri commands ──────────────────────────────────────────────────

#[tauri::command]
pub async fn list_annotations(
    state: tauri::State<'_, AppState>,
    paper_id: String,
) -> Result<Vec<Annotation>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_list_annotations(&pool, &paper_id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_annotation(
    state: tauri::State<'_, AppState>,
    input: AnnotationInput,
) -> Result<Annotation, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_insert_annotation(&pool, &input))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_annotation(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || db_delete_annotation(&pool, &id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("annotation not found".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn update_annotation_color(
    state: tauri::State<'_, AppState>,
    id: String,
    color: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n =
        tokio::task::spawn_blocking(move || db_update_annotation_color(&pool, &id, &color))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("annotation not found".into());
    }
    Ok(())
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_at;
    use tempfile::TempDir;

    fn fresh_with_paper() -> (TempDir, crate::db::DbPool) {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO papers (id, title, authors, source) VALUES ('p1', 'T', '[]', 'arxiv')",
            [],
        )
        .unwrap();
        (tmp, pool)
    }

    fn input(page: i64, kind: &str, color: &str) -> AnnotationInput {
        AnnotationInput {
            paper_id: "p1".into(),
            page,
            anchor: r#"{"rects":[{"x":0.1,"y":0.2,"w":0.5,"h":0.02}]}"#.into(),
            kind: kind.into(),
            color: color.into(),
        }
    }

    #[test]
    fn add_list_roundtrip_ordered_by_page() {
        let (_t, pool) = fresh_with_paper();
        db_insert_annotation(&pool, &input(3, "underline", "green")).unwrap();
        db_insert_annotation(&pool, &input(1, "highlight", "yellow")).unwrap();
        let all = db_list_annotations(&pool, "p1").unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].page, 1);
        assert_eq!(all[0].kind, "highlight");
        assert_eq!(all[1].page, 3);
        assert_eq!(all[1].color, "green");
        assert!(all[0].anchor.contains("rects"));
    }

    #[test]
    fn delete_and_recolor() {
        let (_t, pool) = fresh_with_paper();
        let a = db_insert_annotation(&pool, &input(1, "highlight", "yellow")).unwrap();
        let b = db_insert_annotation(&pool, &input(1, "highlight", "yellow")).unwrap();
        assert_eq!(db_update_annotation_color(&pool, &a.id, "pink").unwrap(), 1);
        assert_eq!(db_delete_annotation(&pool, &b.id).unwrap(), 1);
        let all = db_list_annotations(&pool, "p1").unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].color, "pink");
        // unknown id → 0 rows
        assert_eq!(db_delete_annotation(&pool, "nope").unwrap(), 0);
    }
}
