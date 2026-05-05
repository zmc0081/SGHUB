//! Keyword subscriptions: CRUD, scheduled execution, and per-paper bookkeeping.

use std::time::Duration;

use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

use crate::search::Paper;
use crate::AppState;

const SOURCE_TIMEOUT: Duration = Duration::from_secs(15);

// ============================================================
// Types
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: String,
    pub keyword_expr: String,
    pub sources: Vec<String>,
    pub frequency: String,
    pub max_results: i32,
    pub is_active: bool,
    pub last_run_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Form-style payload from the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionInput {
    pub keyword_expr: String,
    pub sources: Vec<String>,
    pub frequency: String,
    pub max_results: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
    pub is_read: bool,
    pub related_id: Option<String>,
    pub created_at: String,
}

/// Paper found by a subscription run, with its is_read flag and the
/// subscription that surfaced it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionResult {
    pub subscription_id: String,
    pub subscription_keyword: String,
    pub paper: Paper,
    pub found_at: String,
    pub is_read: bool,
}

// ============================================================
// DB row mappers
// ============================================================

fn row_to_subscription(row: &Row) -> rusqlite::Result<Subscription> {
    let sources_json: String = row.get(2)?;
    let sources: Vec<String> = serde_json::from_str(&sources_json).unwrap_or_default();
    Ok(Subscription {
        id: row.get(0)?,
        keyword_expr: row.get(1)?,
        sources,
        frequency: row.get(3)?,
        max_results: row.get(4)?,
        is_active: row.get::<_, i64>(5)? == 1,
        last_run_at: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

const SUB_COLS: &str =
    "id, keyword_expr, sources, frequency, max_results, is_active, last_run_at, created_at, updated_at";

fn row_to_notification(row: &Row) -> rusqlite::Result<Notification> {
    Ok(Notification {
        id: row.get(0)?,
        kind: row.get(1)?,
        title: row.get(2)?,
        body: row.get(3)?,
        is_read: row.get::<_, i64>(4)? == 1,
        related_id: row.get(5)?,
        created_at: row.get(6)?,
    })
}

const NOTIF_COLS: &str = "id, type, title, body, is_read, related_id, created_at";

// ============================================================
// CRUD
// ============================================================

fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn db_create(
    pool: &crate::db::DbPool,
    input: &SubscriptionInput,
) -> rusqlite::Result<Subscription> {
    let id = uuid::Uuid::now_v7().to_string();
    let now = now_iso();
    let sources_json = serde_json::to_string(&input.sources).unwrap_or_else(|_| "[]".into());

    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO subscriptions \
         (id, keyword_expr, sources, frequency, max_results, is_active, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6)",
        params![
            id,
            input.keyword_expr,
            sources_json,
            input.frequency,
            input.max_results,
            now,
        ],
    )?;

    Ok(Subscription {
        id,
        keyword_expr: input.keyword_expr.clone(),
        sources: input.sources.clone(),
        frequency: input.frequency.clone(),
        max_results: input.max_results,
        is_active: true,
        last_run_at: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

fn db_update(
    pool: &crate::db::DbPool,
    id: &str,
    input: &SubscriptionInput,
) -> rusqlite::Result<usize> {
    let sources_json = serde_json::to_string(&input.sources).unwrap_or_else(|_| "[]".into());
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE subscriptions \
         SET keyword_expr = ?1, sources = ?2, frequency = ?3, max_results = ?4, updated_at = ?5 \
         WHERE id = ?6",
        params![
            input.keyword_expr,
            sources_json,
            input.frequency,
            input.max_results,
            now_iso(),
            id,
        ],
    )
}

fn db_delete(pool: &crate::db::DbPool, id: &str) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute("DELETE FROM subscriptions WHERE id = ?1", [id])
}

fn db_toggle_active(pool: &crate::db::DbPool, id: &str) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE subscriptions \
         SET is_active = CASE is_active WHEN 1 THEN 0 ELSE 1 END, updated_at = ?1 \
         WHERE id = ?2",
        params![now_iso(), id],
    )
}

fn db_list(pool: &crate::db::DbPool) -> rusqlite::Result<Vec<Subscription>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM subscriptions ORDER BY created_at DESC",
        SUB_COLS
    ))?;
    let rows: Vec<Subscription> = stmt
        .query_map([], row_to_subscription)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

pub(crate) fn db_list_active(
    pool: &crate::db::DbPool,
) -> rusqlite::Result<Vec<Subscription>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM subscriptions WHERE is_active = 1 ORDER BY created_at",
        SUB_COLS
    ))?;
    let rows: Vec<Subscription> = stmt
        .query_map([], row_to_subscription)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

fn db_set_last_run(pool: &crate::db::DbPool, id: &str) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE subscriptions SET last_run_at = ?1 WHERE id = ?2",
        params![now_iso(), id],
    )
}

fn db_link_papers(
    pool: &crate::db::DbPool,
    subscription_id: &str,
    paper_ids: &[String],
) -> rusqlite::Result<usize> {
    let mut conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let tx = conn.transaction()?;
    let mut new_count = 0usize;
    {
        let mut stmt = tx.prepare(
            "INSERT OR IGNORE INTO subscription_papers (subscription_id, paper_id) VALUES (?1, ?2)",
        )?;
        for pid in paper_ids {
            new_count += stmt.execute(params![subscription_id, pid])?;
        }
    }
    tx.commit()?;
    Ok(new_count)
}

fn db_insert_notification(
    pool: &crate::db::DbPool,
    title: &str,
    body: &str,
    related_id: &str,
) -> rusqlite::Result<()> {
    let id = uuid::Uuid::now_v7().to_string();
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "INSERT INTO notifications (id, type, title, body, is_read, related_id, created_at) \
         VALUES (?1, 'subscription', ?2, ?3, 0, ?4, ?5)",
        params![id, title, body, related_id, now_iso()],
    )?;
    Ok(())
}

fn db_list_notifications(
    pool: &crate::db::DbPool,
    unread_only: bool,
) -> rusqlite::Result<Vec<Notification>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    let sql = if unread_only {
        format!(
            "SELECT {} FROM notifications WHERE is_read = 0 ORDER BY created_at DESC",
            NOTIF_COLS
        )
    } else {
        format!(
            "SELECT {} FROM notifications ORDER BY created_at DESC LIMIT 200",
            NOTIF_COLS
        )
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows: Vec<Notification> = stmt
        .query_map([], row_to_notification)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

fn db_mark_notification_read(
    pool: &crate::db::DbPool,
    id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ?1",
        [id],
    )
}

fn db_subscription_results(
    pool: &crate::db::DbPool,
    subscription_id: Option<&str>,
) -> rusqlite::Result<Vec<SubscriptionResult>> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    let base_sql = "SELECT \
        sp.subscription_id, s.keyword_expr, sp.found_at, sp.is_read, \
        p.id, p.title, p.authors, p.abstract, p.doi, p.source, p.source_id, \
        p.source_url, p.published_at, p.pdf_path, p.read_status, p.created_at, p.updated_at \
        FROM subscription_papers sp \
        JOIN subscriptions s ON s.id = sp.subscription_id \
        JOIN papers p ON p.id = sp.paper_id";

    let map_row = |row: &Row| -> rusqlite::Result<SubscriptionResult> {
        let authors_json: String = row.get(6)?;
        let authors: Vec<String> = serde_json::from_str(&authors_json).unwrap_or_default();
        Ok(SubscriptionResult {
            subscription_id: row.get(0)?,
            subscription_keyword: row.get(1)?,
            found_at: row.get(2)?,
            is_read: row.get::<_, i64>(3)? == 1,
            paper: Paper {
                id: row.get(4)?,
                title: row.get(5)?,
                authors,
                abstract_: row.get(7)?,
                doi: row.get(8)?,
                source: row.get(9)?,
                source_id: row.get(10)?,
                source_url: row.get(11)?,
                published_at: row.get(12)?,
                pdf_path: row.get(13)?,
                read_status: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            },
        })
    };

    let rows: Vec<SubscriptionResult> = if let Some(sid) = subscription_id {
        let sql = format!(
            "{} WHERE sp.subscription_id = ?1 ORDER BY sp.found_at DESC",
            base_sql
        );
        let mut stmt = conn.prepare(&sql)?;
        let collected: Vec<SubscriptionResult> = stmt
            .query_map([sid], map_row)?
            .collect::<rusqlite::Result<_>>()?;
        collected
    } else {
        let sql = format!("{} ORDER BY sp.found_at DESC LIMIT 200", base_sql);
        let mut stmt = conn.prepare(&sql)?;
        let collected: Vec<SubscriptionResult> = stmt
            .query_map([], map_row)?
            .collect::<rusqlite::Result<_>>()?;
        collected
    };
    Ok(rows)
}

fn db_mark_subscription_paper_read(
    pool: &crate::db::DbPool,
    subscription_id: &str,
    paper_id: &str,
) -> rusqlite::Result<usize> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.execute(
        "UPDATE subscription_papers SET is_read = 1 \
         WHERE subscription_id = ?1 AND paper_id = ?2",
        params![subscription_id, paper_id],
    )
}

fn db_unread_count(pool: &crate::db::DbPool) -> rusqlite::Result<i64> {
    let conn = pool
        .get()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    conn.query_row(
        "SELECT COUNT(*) FROM subscription_papers WHERE is_read = 0",
        [],
        |r| r.get(0),
    )
}

// ============================================================
// Run one subscription — fan-out search, dedup, link, notify
// ============================================================

pub(crate) async fn run_one(
    app: &tauri::AppHandle,
    sub: &Subscription,
) -> Result<usize, String> {
    let mut all_papers: Vec<Paper> = Vec::new();

    for source in &sub.sources {
        let q = sub.keyword_expr.as_str();
        let limit = sub.max_results as u32;
        let result = match source.as_str() {
            "arxiv" => tokio::time::timeout(SOURCE_TIMEOUT, crate::search::arxiv::search(q, limit)).await,
            "semantic_scholar" => {
                tokio::time::timeout(
                    SOURCE_TIMEOUT,
                    crate::search::semantic_scholar::search(q, limit),
                )
                .await
            }
            "pubmed" => {
                tokio::time::timeout(SOURCE_TIMEOUT, crate::search::pubmed::search(q, limit)).await
            }
            "openalex" => {
                tokio::time::timeout(SOURCE_TIMEOUT, crate::search::openalex::search(q, limit))
                    .await
            }
            other => {
                log::warn!("subscription {}: unknown source `{}`", sub.id, other);
                continue;
            }
        };
        match result {
            Ok(Ok(papers)) => all_papers.extend(papers),
            Ok(Err(e)) => log::warn!("subscription {}: source {} failed: {}", sub.id, source, e),
            Err(_) => log::warn!("subscription {}: source {} timed out", sub.id, source),
        }
    }

    if all_papers.is_empty() {
        // Still update last_run_at so we don't appear "never ran"
        update_run_state(app, &sub.id).await;
        return Ok(0);
    }

    let deduped = crate::search::dedupe(all_papers);

    // Persist papers + link to subscription
    let pool = {
        use tauri::Manager;
        let state: tauri::State<AppState> = app.state();
        state.db_pool.clone()
    };

    let papers_for_persist = deduped.clone();
    let sub_id_clone = sub.id.clone();
    let pool_for_blocking = pool.clone();
    let new_count_result: Result<usize, String> = tokio::task::spawn_blocking(move || {
        crate::search::persist(&pool_for_blocking, &papers_for_persist)
            .map_err(|e| e.to_string())?;
        let ids: Vec<String> = papers_for_persist.iter().map(|p| p.id.clone()).collect();
        db_link_papers(&pool_for_blocking, &sub_id_clone, &ids).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?;
    let new_count = new_count_result?;

    update_run_state(app, &sub.id).await;

    if new_count > 0 {
        // Audit log
        let pool_clone = pool.clone();
        let title = format!("发现 {} 篇新文献", new_count);
        let body = format!("订阅: {}", sub.keyword_expr);
        let sub_id_for_notif = sub.id.clone();
        let _ = tokio::task::spawn_blocking(move || {
            db_insert_notification(&pool_clone, &title, &body, &sub_id_for_notif)
        })
        .await;

        // Native OS notification
        crate::notify::send_subscription_notification(app, &sub.keyword_expr, new_count);

        log::info!(
            "subscription `{}` ran: {} new papers from {} total",
            sub.keyword_expr,
            new_count,
            deduped.len()
        );
    }

    Ok(new_count)
}

async fn update_run_state(app: &tauri::AppHandle, sub_id: &str) {
    use tauri::Manager;
    let state: tauri::State<AppState> = app.state();
    let pool = state.db_pool.clone();
    let id = sub_id.to_string();
    let _ = tokio::task::spawn_blocking(move || db_set_last_run(&pool, &id)).await;
}

pub(crate) async fn run_all_active(app: &tauri::AppHandle) {
    use tauri::Manager;
    let pool = {
        let state: tauri::State<AppState> = app.state();
        state.db_pool.clone()
    };
    let subs = match tokio::task::spawn_blocking(move || db_list_active(&pool)).await {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            log::warn!("scheduler: list_active failed: {}", e);
            return;
        }
        Err(e) => {
            log::warn!("scheduler: spawn_blocking failed: {}", e);
            return;
        }
    };
    log::info!("scheduler: running {} active subscriptions", subs.len());
    for sub in subs {
        if let Err(e) = run_one(app, &sub).await {
            log::warn!("scheduler: subscription {} failed: {}", sub.id, e);
        }
    }
}

// ============================================================
// Tauri commands
// ============================================================

#[tauri::command]
pub async fn create_subscription(
    state: tauri::State<'_, AppState>,
    input: SubscriptionInput,
) -> Result<Subscription, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_create(&pool, &input))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_subscription(
    state: tauri::State<'_, AppState>,
    id: String,
    input: SubscriptionInput,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    let n = tokio::task::spawn_blocking(move || db_update(&pool, &id, &input))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err("subscription not found".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_subscription(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_delete(&pool, &id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn toggle_subscription_active(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_toggle_active(&pool, &id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_subscriptions(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Subscription>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_list(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_subscription_results(
    state: tauri::State<'_, AppState>,
    subscription_id: Option<String>,
) -> Result<Vec<SubscriptionResult>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        db_subscription_results(&pool, subscription_id.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mark_subscription_paper_read(
    state: tauri::State<'_, AppState>,
    subscription_id: String,
    paper_id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || {
        db_mark_subscription_paper_read(&pool, &subscription_id, &paper_id)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_unread_subscription_count(
    state: tauri::State<'_, AppState>,
) -> Result<i64, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_unread_count(&pool))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_notifications(
    state: tauri::State<'_, AppState>,
    unread_only: bool,
) -> Result<Vec<Notification>, String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_list_notifications(&pool, unread_only))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mark_notification_read(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let pool = state.db_pool.clone();
    tokio::task::spawn_blocking(move || db_mark_notification_read(&pool, &id))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Manual trigger — useful for "Refresh now" button + integration tests.
#[tauri::command]
pub async fn run_subscriptions_now(app: tauri::AppHandle) -> Result<(), String> {
    run_all_active(&app).await;
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

    fn input(kw: &str) -> SubscriptionInput {
        SubscriptionInput {
            keyword_expr: kw.into(),
            sources: vec!["arxiv".into()],
            frequency: "daily".into(),
            max_results: 20,
        }
    }

    fn insert_paper(pool: &crate::db::DbPool, id: &str) {
        let conn = pool.get().unwrap();
        conn.execute(
            "INSERT INTO papers (id, title, authors, source) VALUES (?1, ?2, '[]', 'arxiv')",
            params![id, format!("Title {}", id)],
        )
        .unwrap();
    }

    #[test]
    fn create_then_list() {
        let (_tmp, pool) = fresh();
        db_create(&pool, &input("transformer")).unwrap();
        let all = db_list(&pool).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].keyword_expr, "transformer");
        assert!(all[0].is_active);
        assert_eq!(all[0].sources, vec!["arxiv".to_string()]);
    }

    #[test]
    fn update_changes_fields() {
        let (_tmp, pool) = fresh();
        let s = db_create(&pool, &input("X")).unwrap();
        let mut new_input = input("Y");
        new_input.sources = vec!["arxiv".into(), "pubmed".into()];
        new_input.max_results = 50;
        db_update(&pool, &s.id, &new_input).unwrap();
        let all = db_list(&pool).unwrap();
        assert_eq!(all[0].keyword_expr, "Y");
        assert_eq!(all[0].sources.len(), 2);
        assert_eq!(all[0].max_results, 50);
    }

    #[test]
    fn toggle_flips_active_flag() {
        let (_tmp, pool) = fresh();
        let s = db_create(&pool, &input("X")).unwrap();
        assert!(s.is_active);
        db_toggle_active(&pool, &s.id).unwrap();
        assert!(!db_list(&pool).unwrap()[0].is_active);
        db_toggle_active(&pool, &s.id).unwrap();
        assert!(db_list(&pool).unwrap()[0].is_active);
    }

    #[test]
    fn list_active_filters() {
        let (_tmp, pool) = fresh();
        let a = db_create(&pool, &input("A")).unwrap();
        let _b = db_create(&pool, &input("B")).unwrap();
        db_toggle_active(&pool, &a.id).unwrap(); // A inactive
        let active = db_list_active(&pool).unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].keyword_expr, "B");
    }

    #[test]
    fn link_papers_idempotent_returns_new_count_only() {
        let (_tmp, pool) = fresh();
        let s = db_create(&pool, &input("X")).unwrap();
        for i in 0..3 {
            insert_paper(&pool, &format!("p{}", i));
        }
        let n1 = db_link_papers(
            &pool,
            &s.id,
            &["p0".into(), "p1".into(), "p2".into()],
        )
        .unwrap();
        assert_eq!(n1, 3);
        // Re-run with same set — INSERT OR IGNORE means 0 new
        let n2 = db_link_papers(
            &pool,
            &s.id,
            &["p0".into(), "p1".into(), "p2".into()],
        )
        .unwrap();
        assert_eq!(n2, 0);
    }

    #[test]
    fn subscription_results_join_returns_papers() {
        let (_tmp, pool) = fresh();
        let s = db_create(&pool, &input("transformer")).unwrap();
        insert_paper(&pool, "p1");
        db_link_papers(&pool, &s.id, &["p1".into()]).unwrap();
        let results = db_subscription_results(&pool, None).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].subscription_keyword, "transformer");
        assert_eq!(results[0].paper.id, "p1");
        assert!(!results[0].is_read);
    }

    #[test]
    fn mark_paper_read_flips_flag() {
        let (_tmp, pool) = fresh();
        let s = db_create(&pool, &input("X")).unwrap();
        insert_paper(&pool, "p1");
        db_link_papers(&pool, &s.id, &["p1".into()]).unwrap();
        assert_eq!(db_unread_count(&pool).unwrap(), 1);
        db_mark_subscription_paper_read(&pool, &s.id, "p1").unwrap();
        assert_eq!(db_unread_count(&pool).unwrap(), 0);
    }

    #[test]
    fn delete_subscription_cascades_to_papers_link() {
        let (_tmp, pool) = fresh();
        let s = db_create(&pool, &input("X")).unwrap();
        insert_paper(&pool, "p1");
        db_link_papers(&pool, &s.id, &["p1".into()]).unwrap();
        db_delete(&pool, &s.id).unwrap();
        // CASCADE: subscription_papers row should be gone
        let results = db_subscription_results(&pool, None).unwrap();
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn notifications_insert_and_list() {
        let (_tmp, pool) = fresh();
        let s = db_create(&pool, &input("X")).unwrap();
        db_insert_notification(&pool, "Found 3 new", "kw=X", &s.id).unwrap();
        let all = db_list_notifications(&pool, false).unwrap();
        assert_eq!(all.len(), 1);
        assert!(!all[0].is_read);
        assert_eq!(all[0].kind, "subscription");

        let unread = db_list_notifications(&pool, true).unwrap();
        assert_eq!(unread.len(), 1);

        db_mark_notification_read(&pool, &all[0].id).unwrap();
        assert_eq!(db_list_notifications(&pool, true).unwrap().len(), 0);
    }
}
