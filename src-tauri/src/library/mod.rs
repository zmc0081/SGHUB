use std::collections::HashMap;

use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::search::Paper;
use crate::AppState;

pub mod pdf_download;

// ============================================================
// Event payloads (broadcast on library mutations so any open page
// — Search / Feed / Library / Chat — can reactively refresh state.
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperFolderChangedPayload {
    pub paper_id: String,
    /// "added" | "removed" | "moved"
    pub kind: String,
    pub folder_id: Option<String>,
    pub from_folder_id: Option<String>,
    pub to_folder_id: Option<String>,
}

fn emit_paper_folder_changed(app: &tauri::AppHandle, payload: &PaperFolderChangedPayload) {
    if let Err(e) = app.emit("library:paper_folder_changed", payload) {
        log::warn!("emit library:paper_folder_changed failed: {}", e);
    }
}

const UNCATEGORIZED_ID: &str = "00000000-0000-0000-0000-000000000001";

const READ_STATUSES: &[&str] = &["unread", "reading", "read", "parsed"];

// ============================================================
// Types
// ============================================================

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderNode {
    #[serde(flatten)]
    pub folder: Folder,
    pub paper_count: i64,
    pub children: Vec<FolderNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
    pub paper_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageResult<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

// ============================================================
// Helpers
// ============================================================

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn new_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

fn row_to_folder(row: &Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: row.get(0)?,
        parent_id: row.get(1)?,
        name: row.get(2)?,
        sort_order: row.get(3)?,
        is_smart: row.get::<_, i64>(4)? == 1,
        smart_rule: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

const FOLDER_COLS: &str =
    "id, parent_id, name, sort_order, is_smart, smart_rule, created_at, updated_at";

fn row_to_paper(row: &Row) -> rusqlite::Result<Paper> {
    let authors_json: String = row.get(2)?;
    let authors: Vec<String> = serde_json::from_str(&authors_json).unwrap_or_default();
    Ok(Paper {
        id: row.get(0)?,
        title: row.get(1)?,
        authors,
        abstract_: row.get(3)?,
        doi: row.get(4)?,
        source: row.get(5)?,
        source_id: row.get(6)?,
        source_url: row.get(7)?,
        published_at: row.get(8)?,
        pdf_path: row.get(9)?,
        read_status: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

const PAPER_COLS: &str =
    "p.id, p.title, p.authors, p.abstract, p.doi, p.source, p.source_id, p.source_url, \
     p.published_at, p.pdf_path, p.read_status, p.created_at, p.updated_at";

fn row_to_tag(row: &Row) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        created_at: row.get(3)?,
        paper_count: row.get(4)?,
    })
}

// ============================================================
// Folder operations
// ============================================================

fn db_create_folder(
    pool: &crate::db::DbPool,
    name: &str,
    parent_id: Option<&str>,
) -> rusqlite::Result<Folder> {
    let id = new_id();
    let now = now_iso();
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    let next_sort: i32 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 10 FROM folders WHERE parent_id IS ?1",
        params![parent_id],
        |r| r.get(0),
    )?;

    conn.execute(
        "INSERT INTO folders (id, parent_id, name, sort_order, is_smart, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5)",
        params![id, parent_id, name, next_sort, now],
    )?;

    Ok(Folder {
        id,
        parent_id: parent_id.map(String::from),
        name: name.into(),
        sort_order: next_sort,
        is_smart: false,
        smart_rule: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

fn db_rename_folder(
    pool: &crate::db::DbPool,
    id: &str,
    name: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE folders SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, now_iso(), id],
    )
}

fn db_move_folder(
    pool: &crate::db::DbPool,
    id: &str,
    new_parent_id: Option<&str>,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    // Cycle prevention: walk up from new_parent — if we ever hit `id`, abort.
    if let Some(np) = new_parent_id {
        if np == id {
            return Err(rusqlite::Error::InvalidParameterName(
                "cannot move folder into itself".into(),
            ));
        }
        let mut cur: Option<String> = Some(np.to_string());
        while let Some(c) = cur {
            if c == id {
                return Err(rusqlite::Error::InvalidParameterName(
                    "cycle detected".into(),
                ));
            }
            cur = conn
                .query_row(
                    "SELECT parent_id FROM folders WHERE id = ?1",
                    [&c],
                    |r| r.get::<_, Option<String>>(0),
                )
                .optional()?
                .flatten();
        }
    }

    conn.execute(
        "UPDATE folders SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_parent_id, now_iso(), id],
    )
}

fn db_delete_folder(pool: &crate::db::DbPool, id: &str) -> rusqlite::Result<usize> {
    if id == UNCATEGORIZED_ID {
        return Err(rusqlite::Error::InvalidParameterName(
            "cannot delete the default '未分类' folder".into(),
        ));
    }
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute("DELETE FROM folders WHERE id = ?1", [id])
}

fn db_reorder_folders(
    pool: &crate::db::DbPool,
    parent_id: Option<&str>,
    ordered_ids: &[String],
) -> rusqlite::Result<()> {
    let mut conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let now = now_iso();
    let tx = conn.transaction()?;
    for (i, id) in ordered_ids.iter().enumerate() {
        let sort = (i as i32 + 1) * 10;
        tx.execute(
            "UPDATE folders SET sort_order = ?1, updated_at = ?2 \
             WHERE id = ?3 AND parent_id IS ?4",
            params![sort, now, id, parent_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

fn db_list_folders(pool: &crate::db::DbPool) -> rusqlite::Result<Vec<Folder>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM folders ORDER BY sort_order, name",
        FOLDER_COLS
    ))?;
    let rows: Vec<Folder> = stmt
        .query_map([], row_to_folder)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

fn db_folder_tree(pool: &crate::db::DbPool) -> rusqlite::Result<Vec<FolderNode>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM folders ORDER BY sort_order, name",
        FOLDER_COLS
    ))?;
    let folders: Vec<Folder> = stmt
        .query_map([], row_to_folder)?
        .collect::<Result<_, _>>()?;

    let mut counts: HashMap<String, i64> = HashMap::new();
    let mut count_stmt =
        conn.prepare("SELECT folder_id, COUNT(*) FROM folder_papers GROUP BY folder_id")?;
    let rows = count_stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
    for r in rows {
        let (k, v) = r?;
        counts.insert(k, v);
    }

    Ok(build_tree(folders, &counts, None))
}

fn build_tree(
    folders: Vec<Folder>,
    counts: &HashMap<String, i64>,
    parent: Option<&str>,
) -> Vec<FolderNode> {
    let parent_key = parent.map(String::from);
    let (matching, rest): (Vec<Folder>, Vec<Folder>) =
        folders.into_iter().partition(|f| f.parent_id == parent_key);

    matching
        .into_iter()
        .map(|f| {
            let count = counts.get(&f.id).copied().unwrap_or(0);
            let children = build_tree(rest.clone(), counts, Some(&f.id));
            FolderNode {
                folder: f,
                paper_count: count,
                children,
            }
        })
        .collect()
}

// ============================================================
// Folder-paper membership
// ============================================================

fn db_add_to_folder(
    pool: &crate::db::DbPool,
    folder_id: &str,
    paper_id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT OR IGNORE INTO folder_papers (folder_id, paper_id) VALUES (?1, ?2)",
        params![folder_id, paper_id],
    )
}

fn db_remove_from_folder(
    pool: &crate::db::DbPool,
    folder_id: &str,
    paper_id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "DELETE FROM folder_papers WHERE folder_id = ?1 AND paper_id = ?2",
        params![folder_id, paper_id],
    )
}

fn db_move_paper_to_folder(
    pool: &crate::db::DbPool,
    paper_id: &str,
    from_folder_id: &str,
    to_folder_id: &str,
) -> rusqlite::Result<()> {
    let mut conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM folder_papers WHERE folder_id = ?1 AND paper_id = ?2",
        params![from_folder_id, paper_id],
    )?;
    tx.execute(
        "INSERT OR IGNORE INTO folder_papers (folder_id, paper_id) VALUES (?1, ?2)",
        params![to_folder_id, paper_id],
    )?;
    tx.commit()?;
    Ok(())
}

/// List the folder IDs a paper currently belongs to. Empty when the paper
/// has not been collected yet — that's the signal the frontend uses to
/// render the ☆/⭐ state of the FavoriteButton.
fn db_get_paper_folders(
    pool: &crate::db::DbPool,
    paper_id: &str,
) -> rusqlite::Result<Vec<String>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(
        "SELECT folder_id FROM folder_papers WHERE paper_id = ?1 ORDER BY folder_id",
    )?;
    let rows: Vec<String> = stmt
        .query_map([paper_id], |r| r.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

fn db_batch_add_to_folder(
    pool: &crate::db::DbPool,
    folder_id: &str,
    paper_ids: &[String],
) -> rusqlite::Result<usize> {
    let mut conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let tx = conn.transaction()?;
    let mut count = 0usize;
    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO folder_papers (folder_id, paper_id) VALUES (?1, ?2)",
        )?;
        for pid in paper_ids {
            count += stmt.execute(params![folder_id, pid])?;
        }
    }
    tx.commit()?;
    Ok(count)
}

// ============================================================
// Tags
// ============================================================

fn db_create_tag(
    pool: &crate::db::DbPool,
    name: &str,
    color: &str,
) -> rusqlite::Result<Tag> {
    let id = new_id();
    let now = now_iso();
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, color, now],
    )?;
    Ok(Tag {
        id,
        name: name.into(),
        color: color.into(),
        created_at: now,
        paper_count: 0,
    })
}

fn db_delete_tag(pool: &crate::db::DbPool, id: &str) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute("DELETE FROM tags WHERE id = ?1", [id])
}

fn db_list_tags(pool: &crate::db::DbPool) -> rusqlite::Result<Vec<Tag>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, t.color, t.created_at, COUNT(tp.paper_id) \
         FROM tags t LEFT JOIN tag_papers tp ON tp.tag_id = t.id \
         GROUP BY t.id ORDER BY t.name",
    )?;
    let rows: Vec<Tag> = stmt
        .query_map([], row_to_tag)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

fn db_add_tag_to_paper(
    pool: &crate::db::DbPool,
    tag_id: &str,
    paper_id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT OR IGNORE INTO tag_papers (tag_id, paper_id) VALUES (?1, ?2)",
        params![tag_id, paper_id],
    )
}

fn db_remove_tag_from_paper(
    pool: &crate::db::DbPool,
    tag_id: &str,
    paper_id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "DELETE FROM tag_papers WHERE tag_id = ?1 AND paper_id = ?2",
        params![tag_id, paper_id],
    )
}

fn db_batch_tag(
    pool: &crate::db::DbPool,
    tag_id: &str,
    paper_ids: &[String],
) -> rusqlite::Result<usize> {
    let mut conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let tx = conn.transaction()?;
    let mut count = 0usize;
    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO tag_papers (tag_id, paper_id) VALUES (?1, ?2)",
        )?;
        for pid in paper_ids {
            count += stmt.execute(params![tag_id, pid])?;
        }
    }
    tx.commit()?;
    Ok(count)
}

// ============================================================
// Paper queries
// ============================================================

fn db_papers_by_folder(
    pool: &crate::db::DbPool,
    folder_id: &str,
    page: u32,
    page_size: u32,
) -> rusqlite::Result<PageResult<Paper>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM folder_papers WHERE folder_id = ?1",
        [folder_id],
        |r| r.get(0),
    )?;

    let offset = (page as i64) * (page_size as i64);
    let limit = page_size as i64;

    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM papers p \
         JOIN folder_papers fp ON p.id = fp.paper_id \
         WHERE fp.folder_id = ?1 \
         ORDER BY fp.added_at DESC \
         LIMIT ?2 OFFSET ?3",
        PAPER_COLS
    ))?;
    let items: Vec<Paper> = stmt
        .query_map(params![folder_id, limit, offset], row_to_paper)?
        .collect::<Result<_, _>>()?;

    Ok(PageResult {
        items,
        total,
        page,
        page_size,
    })
}

/// Lookup a single paper by id. Used by parse / AI features.
pub fn db_get_paper_by_id(
    pool: &crate::db::DbPool,
    id: &str,
) -> rusqlite::Result<Option<Paper>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.query_row(
        &format!("SELECT {} FROM papers p WHERE p.id = ?1", PAPER_COLS),
        [id],
        row_to_paper,
    )
    .optional()
}

fn db_recent_papers(
    pool: &crate::db::DbPool,
    limit: u32,
) -> rusqlite::Result<Vec<Paper>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM papers p \
         WHERE p.deleted_at IS NULL \
         ORDER BY p.created_at DESC \
         LIMIT ?1",
        PAPER_COLS
    ))?;
    let rows: Vec<Paper> = stmt
        .query_map([limit as i64], row_to_paper)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

fn db_papers_by_tag(
    pool: &crate::db::DbPool,
    tag_id: &str,
) -> rusqlite::Result<Vec<Paper>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM papers p \
         JOIN tag_papers tp ON p.id = tp.paper_id \
         WHERE tp.tag_id = ?1 \
         ORDER BY p.created_at DESC",
        PAPER_COLS
    ))?;
    let rows: Vec<Paper> = stmt
        .query_map([tag_id], row_to_paper)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

fn db_set_read_status(
    pool: &crate::db::DbPool,
    paper_id: &str,
    status: &str,
) -> rusqlite::Result<usize> {
    if !READ_STATUSES.contains(&status) {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "invalid read_status `{}`",
            status
        )));
    }
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE papers SET read_status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, now_iso(), paper_id],
    )
}

// ============================================================
// Tauri commands
// ============================================================

macro_rules! spawn_db {
    ($state:expr, $body:expr) => {{
        let pool = $state.db_pool.clone();
        tokio::task::spawn_blocking(move || $body(&pool))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| e.to_string())
    }};
}

#[tauri::command]
pub async fn get_folders(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Folder>, String> {
    spawn_db!(state, db_list_folders)
}

#[tauri::command]
pub async fn get_folder_tree(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<FolderNode>, String> {
    spawn_db!(state, db_folder_tree)
}

#[tauri::command]
pub async fn create_folder(
    state: tauri::State<'_, AppState>,
    name: String,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_create_folder(&pool, &name, parent_id.as_deref()))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_folder(
    state: tauri::State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || db_rename_folder(&pool, &id, &name))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("folder not found".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn move_folder(
    state: tauri::State<'_, AppState>,
    id: String,
    new_parent_id: Option<String>,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || {
        db_move_folder(&pool, &id, new_parent_id.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("folder not found".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_folder(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || db_delete_folder(&pool, &id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("folder not found".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn reorder_folders(
    state: tauri::State<'_, AppState>,
    parent_id: Option<String>,
    ordered_ids: Vec<String>,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        db_reorder_folders(&pool, parent_id.as_deref(), &ordered_ids)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_to_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    folder_id: String,
    paper_id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let folder_for_db = folder_id.clone();
    let paper_for_db = paper_id.clone();
    tokio::task::spawn_blocking(move || db_add_to_folder(&pool, &folder_for_db, &paper_for_db))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    emit_paper_folder_changed(
        &app,
        &PaperFolderChangedPayload {
            paper_id,
            kind: "added".into(),
            folder_id: Some(folder_id),
            from_folder_id: None,
            to_folder_id: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn remove_from_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    folder_id: String,
    paper_id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let folder_for_db = folder_id.clone();
    let paper_for_db = paper_id.clone();
    tokio::task::spawn_blocking(move || {
        db_remove_from_folder(&pool, &folder_for_db, &paper_for_db)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    emit_paper_folder_changed(
        &app,
        &PaperFolderChangedPayload {
            paper_id,
            kind: "removed".into(),
            folder_id: Some(folder_id),
            from_folder_id: None,
            to_folder_id: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn move_paper_to_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    paper_id: String,
    from_folder_id: String,
    to_folder_id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let paper_for_db = paper_id.clone();
    let from_for_db = from_folder_id.clone();
    let to_for_db = to_folder_id.clone();
    tokio::task::spawn_blocking(move || {
        db_move_paper_to_folder(&pool, &paper_for_db, &from_for_db, &to_for_db)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    emit_paper_folder_changed(
        &app,
        &PaperFolderChangedPayload {
            paper_id,
            kind: "moved".into(),
            folder_id: None,
            from_folder_id: Some(from_folder_id),
            to_folder_id: Some(to_folder_id),
        },
    );
    Ok(())
}

#[tauri::command]
pub async fn batch_add_to_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    folder_id: String,
    paper_ids: Vec<String>,
) -> Result<usize, String> {
    let pool = state.db_pool.clone();
    let folder_for_db = folder_id.clone();
    let ids_for_db = paper_ids.clone();
    let n = tokio::task::spawn_blocking(move || {
        db_batch_add_to_folder(&pool, &folder_for_db, &ids_for_db)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    for pid in paper_ids {
        emit_paper_folder_changed(
            &app,
            &PaperFolderChangedPayload {
                paper_id: pid,
                kind: "added".into(),
                folder_id: Some(folder_id.clone()),
                from_folder_id: None,
                to_folder_id: None,
            },
        );
    }
    Ok(n)
}

#[tauri::command]
pub async fn get_paper_folders(
    state: tauri::State<'_, AppState>,
    paper_id: String,
) -> Result<Vec<String>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_get_paper_folders(&pool, &paper_id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// Convenience wrapper that creates a folder and is more explicit on the
/// FavoriteButton's "+ new folder" path. Returns the freshly-created folder
/// (frontend can then call `add_to_folder` to drop the paper in immediately).
#[tauri::command]
pub async fn create_quick_folder(
    state: tauri::State<'_, AppState>,
    name: String,
    parent_id: Option<String>,
) -> Result<Folder, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_create_folder(&pool, &name, parent_id.as_deref()))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_tag(
    state: tauri::State<'_, AppState>,
    name: String,
    color: String,
) -> Result<Tag, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_create_tag(&pool, &name, &color))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_tag(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || db_delete_tag(&pool, &id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("tag not found".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn get_tags(state: tauri::State<'_, AppState>) -> Result<Vec<Tag>, String> {
    spawn_db!(state, db_list_tags)
}

#[tauri::command]
pub async fn add_tag_to_paper(
    state: tauri::State<'_, AppState>,
    tag_id: String,
    paper_id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_add_tag_to_paper(&pool, &tag_id, &paper_id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn remove_tag_from_paper(
    state: tauri::State<'_, AppState>,
    tag_id: String,
    paper_id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_remove_tag_from_paper(&pool, &tag_id, &paper_id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn batch_tag(
    state: tauri::State<'_, AppState>,
    tag_id: String,
    paper_ids: Vec<String>,
) -> Result<usize, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_batch_tag(&pool, &tag_id, &paper_ids))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_papers_by_folder(
    state: tauri::State<'_, AppState>,
    folder_id: String,
    page: u32,
    page_size: u32,
) -> Result<PageResult<Paper>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_papers_by_folder(&pool, &folder_id, page, page_size))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_papers(
    state: tauri::State<'_, AppState>,
    limit: u32,
) -> Result<Vec<Paper>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_recent_papers(&pool, limit))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_paper(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<Paper>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_get_paper_by_id(&pool, &id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_papers_by_tag(
    state: tauri::State<'_, AppState>,
    tag_id: String,
) -> Result<Vec<Paper>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_papers_by_tag(&pool, &tag_id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// Generic file export — writes `content` into `<app_data_dir>/exports/<sanitized_name>`.
/// Returns the absolute path so the UI can show it / open Explorer.
#[tauri::command]
pub async fn export_text_file(
    app: tauri::AppHandle,
    suggested_name: String,
    content: String,
) -> Result<String, String> {
    use std::path::PathBuf;
    use tauri::Manager;

    // Strip any directory traversal — only keep the filename.
    let safe_name: String = suggested_name
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("export.txt")
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '|' | '?' | '*' | '\0'))
        .collect();
    let safe_name = if safe_name.trim().is_empty() {
        "export.txt".to_string()
    } else {
        safe_name
    };

    let dir: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("exports");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(safe_name);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn set_read_status(
    state: tauri::State<'_, AppState>,
    paper_id: String,
    status: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || db_set_read_status(&pool, &paper_id, &status))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("paper not found".into());
    }
    Ok(())
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_at;
    use tempfile::TempDir;

    fn fresh() -> (TempDir, crate::db::DbPool) {
        let tmp = TempDir::new().unwrap();
        let pool = init_at(tmp.path()).unwrap();
        (tmp, pool)
    }

    fn insert_paper(pool: &crate::db::DbPool, id: &str, title: &str) {
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO papers (id, title, authors, source, read_status) \
             VALUES (?1, ?2, '[]', 'arxiv', 'unread')",
            params![id, title],
        )
        .unwrap();
    }

    #[test]
    fn create_lists_with_seeded_default() {
        let (_tmp, pool) = fresh();
        let folders = db_list_folders(&pool).unwrap();
        // Migration seeded "未分类" — should be present
        assert!(folders.iter().any(|f| f.id == UNCATEGORIZED_ID));
    }

    #[test]
    fn create_assigns_incremental_sort() {
        let (_tmp, pool) = fresh();
        let a = db_create_folder(&pool, "A", None).unwrap();
        let b = db_create_folder(&pool, "B", None).unwrap();
        assert!(b.sort_order > a.sort_order);
    }

    #[test]
    fn rename_changes_name() {
        let (_tmp, pool) = fresh();
        let f = db_create_folder(&pool, "Old", None).unwrap();
        assert_eq!(db_rename_folder(&pool, &f.id, "New").unwrap(), 1);
        let folders = db_list_folders(&pool).unwrap();
        assert!(folders.iter().any(|x| x.id == f.id && x.name == "New"));
    }

    #[test]
    fn move_folder_into_new_parent() {
        let (_tmp, pool) = fresh();
        let parent = db_create_folder(&pool, "Parent", None).unwrap();
        let child = db_create_folder(&pool, "Child", None).unwrap();
        db_move_folder(&pool, &child.id, Some(&parent.id)).unwrap();
        let tree = db_folder_tree(&pool).unwrap();
        let p = tree.iter().find(|n| n.folder.id == parent.id).unwrap();
        assert!(p.children.iter().any(|c| c.folder.id == child.id));
    }

    #[test]
    fn move_folder_rejects_self_cycle() {
        let (_tmp, pool) = fresh();
        let f = db_create_folder(&pool, "F", None).unwrap();
        let r = db_move_folder(&pool, &f.id, Some(&f.id));
        assert!(r.is_err(), "moving folder into itself must fail");
    }

    #[test]
    fn move_folder_rejects_descendant_cycle() {
        let (_tmp, pool) = fresh();
        let a = db_create_folder(&pool, "A", None).unwrap();
        let b = db_create_folder(&pool, "B", None).unwrap();
        db_move_folder(&pool, &b.id, Some(&a.id)).unwrap();
        // now a > b. Trying to move a INTO b would cycle.
        let r = db_move_folder(&pool, &a.id, Some(&b.id));
        assert!(r.is_err());
    }

    #[test]
    fn delete_uncategorized_is_blocked() {
        let (_tmp, pool) = fresh();
        let r = db_delete_folder(&pool, UNCATEGORIZED_ID);
        assert!(r.is_err());
    }

    #[test]
    fn delete_cascades_membership() {
        let (_tmp, pool) = fresh();
        insert_paper(&pool, "p1", "P1");
        let f = db_create_folder(&pool, "X", None).unwrap();
        db_add_to_folder(&pool, &f.id, "p1").unwrap();
        assert_eq!(db_delete_folder(&pool, &f.id).unwrap(), 1);
        // folder_papers should be empty for this folder due to FK CASCADE
        let res = db_papers_by_folder(&pool, &f.id, 0, 10).unwrap();
        assert_eq!(res.total, 0);
    }

    #[test]
    fn reorder_assigns_increasing_sort() {
        let (_tmp, pool) = fresh();
        let a = db_create_folder(&pool, "A", None).unwrap();
        let b = db_create_folder(&pool, "B", None).unwrap();
        let c = db_create_folder(&pool, "C", None).unwrap();
        db_reorder_folders(&pool, None, &[c.id.clone(), a.id.clone(), b.id.clone()]).unwrap();
        let folders = db_list_folders(&pool).unwrap();
        // first three by sort_order should be C, A, B
        let mut top3: Vec<_> = folders
            .iter()
            .filter(|f| [&c.id, &a.id, &b.id].contains(&&f.id))
            .collect();
        top3.sort_by_key(|f| f.sort_order);
        assert_eq!(top3[0].id, c.id);
        assert_eq!(top3[1].id, a.id);
        assert_eq!(top3[2].id, b.id);
    }

    #[test]
    fn add_to_folder_is_idempotent() {
        let (_tmp, pool) = fresh();
        insert_paper(&pool, "p1", "P1");
        let f = db_create_folder(&pool, "X", None).unwrap();
        assert_eq!(db_add_to_folder(&pool, &f.id, "p1").unwrap(), 1);
        assert_eq!(db_add_to_folder(&pool, &f.id, "p1").unwrap(), 0); // duplicate ignored
    }

    #[test]
    fn move_paper_between_folders() {
        let (_tmp, pool) = fresh();
        insert_paper(&pool, "p1", "P1");
        let a = db_create_folder(&pool, "A", None).unwrap();
        let b = db_create_folder(&pool, "B", None).unwrap();
        db_add_to_folder(&pool, &a.id, "p1").unwrap();
        db_move_paper_to_folder(&pool, "p1", &a.id, &b.id).unwrap();
        assert_eq!(db_papers_by_folder(&pool, &a.id, 0, 10).unwrap().total, 0);
        assert_eq!(db_papers_by_folder(&pool, &b.id, 0, 10).unwrap().total, 1);
    }

    #[test]
    fn batch_add_returns_inserted_count() {
        let (_tmp, pool) = fresh();
        for i in 0..3 {
            insert_paper(&pool, &format!("p{}", i), &format!("P{}", i));
        }
        let f = db_create_folder(&pool, "X", None).unwrap();
        let n = db_batch_add_to_folder(
            &pool,
            &f.id,
            &["p0".into(), "p1".into(), "p2".into(), "p0".into()],
        )
        .unwrap();
        assert_eq!(n, 3, "p0 dup should not double-count");
    }

    #[test]
    fn pagination_returns_total_and_slice() {
        let (_tmp, pool) = fresh();
        let f = db_create_folder(&pool, "X", None).unwrap();
        for i in 0..7 {
            insert_paper(&pool, &format!("p{}", i), &format!("P{}", i));
            db_add_to_folder(&pool, &f.id, &format!("p{}", i)).unwrap();
        }
        let page0 = db_papers_by_folder(&pool, &f.id, 0, 3).unwrap();
        assert_eq!(page0.total, 7);
        assert_eq!(page0.items.len(), 3);
        let page2 = db_papers_by_folder(&pool, &f.id, 2, 3).unwrap();
        assert_eq!(page2.items.len(), 1, "last page has remainder");
    }

    #[test]
    fn folder_tree_includes_paper_counts() {
        let (_tmp, pool) = fresh();
        insert_paper(&pool, "p1", "P1");
        let f = db_create_folder(&pool, "X", None).unwrap();
        db_add_to_folder(&pool, &f.id, "p1").unwrap();
        let tree = db_folder_tree(&pool).unwrap();
        let node = tree.iter().find(|n| n.folder.id == f.id).unwrap();
        assert_eq!(node.paper_count, 1);
    }

    #[test]
    fn tag_crud_and_paper_link() {
        let (_tmp, pool) = fresh();
        insert_paper(&pool, "p1", "P1");
        let t = db_create_tag(&pool, "todo", "#FF8800").unwrap();
        db_add_tag_to_paper(&pool, &t.id, "p1").unwrap();

        let papers = db_papers_by_tag(&pool, &t.id).unwrap();
        assert_eq!(papers.len(), 1);

        let tags = db_list_tags(&pool).unwrap();
        let tag = tags.iter().find(|x| x.id == t.id).unwrap();
        assert_eq!(tag.paper_count, 1);

        db_remove_tag_from_paper(&pool, &t.id, "p1").unwrap();
        assert_eq!(db_papers_by_tag(&pool, &t.id).unwrap().len(), 0);
    }

    #[test]
    fn batch_tag_links_multiple_papers() {
        let (_tmp, pool) = fresh();
        for i in 0..3 {
            insert_paper(&pool, &format!("p{}", i), &format!("P{}", i));
        }
        let t = db_create_tag(&pool, "x", "#000000").unwrap();
        let n = db_batch_tag(
            &pool,
            &t.id,
            &["p0".into(), "p1".into(), "p2".into()],
        )
        .unwrap();
        assert_eq!(n, 3);
    }

    #[test]
    fn set_read_status_updates_and_validates() {
        let (_tmp, pool) = fresh();
        insert_paper(&pool, "p1", "P1");
        assert_eq!(db_set_read_status(&pool, "p1", "reading").unwrap(), 1);
        let conn = pool.get().unwrap();
        let s: String = conn
            .query_row("SELECT read_status FROM papers WHERE id = 'p1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(s, "reading");

        let bad = db_set_read_status(&pool, "p1", "nonsense");
        assert!(bad.is_err());
    }
}
