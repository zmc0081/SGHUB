use std::path::{Path, PathBuf};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::Serialize;
use tauri::{AppHandle, Runtime};
use thiserror::Error;

pub type DbPool = Pool<SqliteConnectionManager>;

mod embedded {
    refinery::embed_migrations!("./migrations");
}

#[derive(Debug, Error)]
pub enum DbError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("pool error: {0}")]
    Pool(#[from] r2d2::Error),
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("migration error: {0}")]
    Migration(#[from] refinery::Error),
}

#[derive(Debug, Serialize)]
pub struct TableInfo {
    pub name: String,
    pub row_count: i64,
}

#[derive(Debug, Serialize)]
pub struct DbStatus {
    pub table_count: usize,
    pub tables: Vec<TableInfo>,
}

pub fn init<R: Runtime>(app: &AppHandle<R>) -> Result<DbPool, DbError> {
    // V2.1.0 — go through `config::paths` so the bootstrap-controlled
    // custom data dir is honoured. `data_root` already appends "data/".
    let data_dir = crate::config::paths::data_root(app);
    init_at(&data_dir)
}

/// Highest known migration version. Bump when adding a new V###__*.sql.
const LATEST_MIGRATION_VERSION: i64 = 4;

pub fn init_at(data_dir: &Path) -> Result<DbPool, DbError> {
    std::fs::create_dir_all(data_dir)?;
    let db_path: PathBuf = data_dir.join("sghub.db");

    let manager = SqliteConnectionManager::file(&db_path).with_init(|c| {
        c.execute_batch(
            "PRAGMA journal_mode = WAL;\n\
             PRAGMA foreign_keys = ON;\n\
             PRAGMA synchronous = NORMAL;",
        )
    });

    let pool = Pool::builder().max_size(4).build(manager)?;

    // If we're upgrading an existing DB (any version < latest), back up first.
    {
        let conn = pool.get()?;
        if let Some(bak) = maybe_backup(&db_path, &conn)? {
            log::info!("DB backed up before migration: {}", bak.display());
        }
    }

    let mut conn = pool.get()?;
    // Tolerate divergent migration checksums — in dev, the V*.sql files often
    // get touched by line-ending conversion / linters after a migration was
    // already applied. Default behavior would abort; we prefer "trust the DB
    // state, don't re-apply". For prod releases we ship immutable migrations
    // so divergence shouldn't happen, and if it does we'd see it via tests.
    embedded::migrations::runner()
        .set_abort_divergent(false)
        .set_abort_missing(false)
        .run(&mut *conn)?;

    Ok(pool)
}

/// Copy `sghub.db` to `sghub.db.bak.{timestamp}` if and only if:
/// - `refinery_schema_history` exists (i.e. DB is initialized), AND
/// - At least one migration has been applied (it's not a fresh init), AND
/// - The applied version is less than `LATEST_MIGRATION_VERSION` (we're upgrading).
fn maybe_backup(
    db_path: &Path,
    conn: &rusqlite::Connection,
) -> Result<Option<PathBuf>, DbError> {
    let history_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master \
         WHERE type='table' AND name='refinery_schema_history'",
        [],
        |r| r.get::<_, i64>(0),
    )? > 0;
    if !history_exists {
        return Ok(None);
    }

    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM refinery_schema_history",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if current == 0 || current >= LATEST_MIGRATION_VERSION {
        return Ok(None);
    }

    let ts = chrono::Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
    let bak_name = format!("sghub.db.bak.{}", ts);
    let bak_path = db_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(bak_name);
    std::fs::copy(db_path, &bak_path)?;
    Ok(Some(bak_path))
}

pub fn get_status(pool: &DbPool) -> Result<DbStatus, DbError> {
    let conn = pool.get()?;

    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master \
         WHERE type = 'table' \
           AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' \
           AND name != 'refinery_schema_history' \
           AND name NOT LIKE 'papers\\_fts%' ESCAPE '\\' \
         ORDER BY name",
    )?;
    let names: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut tables = Vec::with_capacity(names.len());
    for name in names {
        let count: i64 = conn.query_row(
            &format!("SELECT COUNT(*) FROM \"{}\"", name.replace('"', "\"\"")),
            [],
            |r| r.get(0),
        )?;
        tables.push(TableInfo {
            name,
            row_count: count,
        });
    }

    Ok(DbStatus {
        table_count: tables.len(),
        tables,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn fresh_pool() -> (TempDir, DbPool) {
        let tmp = TempDir::new().expect("tempdir");
        let pool = init_at(tmp.path()).expect("init_at");
        (tmp, pool)
    }

    #[test]
    fn init_creates_db_file_and_pool() {
        let (tmp, pool) = fresh_pool();
        assert!(tmp.path().join("sghub.db").is_file());
        assert_eq!(pool.max_size(), 4);
    }

    #[test]
    fn all_expected_tables_exist() {
        let (_tmp, pool) = fresh_pool();
        let conn = pool.get().unwrap();

        let expected = [
            "ai_parse_results",
            "folder_papers",
            "folders",
            "model_configs",
            "notifications",
            "papers",
            "subscriptions",
            "tag_papers",
            "tags",
            "usage_stats",
        ];

        for table in expected {
            let count: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "table `{}` missing", table);
        }
    }

    #[test]
    fn wal_mode_enabled() {
        let (_tmp, pool) = fresh_pool();
        let conn = pool.get().unwrap();
        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |r| r.get(0))
            .unwrap();
        assert_eq!(mode.to_lowercase(), "wal");
    }

    #[test]
    fn foreign_keys_enabled() {
        let (_tmp, pool) = fresh_pool();
        let conn = pool.get().unwrap();
        let on: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        assert_eq!(on, 1);
    }

    #[test]
    fn fts5_search_finds_inserted_paper() {
        let (_tmp, pool) = fresh_pool();
        let conn = pool.get().unwrap();

        conn.execute(
            "INSERT INTO papers (id, title, authors, abstract, source) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                "00000000-0000-0000-0000-000000000010",
                "Attention Is All You Need",
                r#"["Ashish Vaswani","Noam Shazeer"]"#,
                "We propose a new simple network architecture, the Transformer.",
                "arxiv"
            ],
        )
        .expect("insert paper");

        let hits_transformer: i64 = conn
            .query_row(
                "SELECT count(*) FROM papers_fts WHERE papers_fts MATCH 'Transformer'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(hits_transformer, 1);

        let hits_attention: i64 = conn
            .query_row(
                "SELECT count(*) FROM papers_fts WHERE papers_fts MATCH 'Attention'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(hits_attention, 1);

        let hits_miss: i64 = conn
            .query_row(
                "SELECT count(*) FROM papers_fts WHERE papers_fts MATCH 'quantum'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(hits_miss, 0);
    }

    #[test]
    fn default_folder_inserted() {
        let (_tmp, pool) = fresh_pool();
        let conn = pool.get().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM folders WHERE id = '00000000-0000-0000-0000-000000000001'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn init_is_idempotent() {
        let tmp = TempDir::new().unwrap();
        let _first = init_at(tmp.path()).expect("first init");
        let second = init_at(tmp.path()).expect("second init");
        let conn = second.get().unwrap();
        let folders: i64 = conn
            .query_row("SELECT count(*) FROM folders", [], |r| r.get(0))
            .unwrap();
        assert_eq!(folders, 1, "default folder should not be duplicated");
    }

    #[test]
    fn get_status_returns_all_user_tables() {
        let (_tmp, pool) = fresh_pool();
        let status = get_status(&pool).expect("status");
        // V001: 10 base tables + V002: subscription_papers
        // + V003: chat_sessions + chat_messages + chat_attachments = 14
        assert_eq!(status.table_count, 14);

        let folders = status.tables.iter().find(|t| t.name == "folders").unwrap();
        assert_eq!(folders.row_count, 1);

        let papers = status.tables.iter().find(|t| t.name == "papers").unwrap();
        assert_eq!(papers.row_count, 0);

        assert!(!status.tables.iter().any(|t| t.name.contains("fts")));
        assert!(!status
            .tables
            .iter()
            .any(|t| t.name == "refinery_schema_history"));
    }

    // ============================================================
    // V001 → V002 → V003 migration tests
    // ============================================================

    #[test]
    fn fresh_init_creates_all_v003_tables() {
        let (_tmp, pool) = fresh_pool();
        let conn = pool.get().unwrap();
        for name in [
            "papers",
            "folders",
            "folder_papers",
            "tags",
            "tag_papers",
            "subscriptions",
            "model_configs",
            "ai_parse_results",
            "notifications",
            "usage_stats",
            "subscription_papers",
            "chat_sessions",
            "chat_messages",
            "chat_attachments",
        ] {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?1",
                    [name],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "table `{}` should exist after init", name);
        }
    }

    #[test]
    fn v001_data_survives_upgrade_to_v003_and_papers_gets_uploaded_at() {
        let tmp = TempDir::new().unwrap();
        let data_dir = tmp.path();
        std::fs::create_dir_all(data_dir).unwrap();
        let db_path = data_dir.join("sghub.db");

        // 1. Apply ONLY V001 — simulates legacy database from a prior install
        {
            let manager = SqliteConnectionManager::file(&db_path);
            let pool = Pool::builder().max_size(1).build(manager).unwrap();
            let mut conn = pool.get().unwrap();
            embedded::migrations::runner()
                .set_target(refinery::Target::Version(1))
                .run(&mut *conn)
                .expect("apply V001 only");

            // Insert 10 papers using V001 schema (no uploaded_at column yet)
            for i in 0..10 {
                conn.execute(
                    "INSERT INTO papers (id, title, authors, source) \
                     VALUES (?1, ?2, '[]', 'arxiv')",
                    rusqlite::params![format!("p{}", i), format!("Paper {}", i)],
                )
                .unwrap();
            }
        }

        // Verify uploaded_at does NOT exist yet
        {
            let manager = SqliteConnectionManager::file(&db_path);
            let pool = Pool::builder().max_size(1).build(manager).unwrap();
            let conn = pool.get().unwrap();
            let mut stmt = conn.prepare("PRAGMA table_info(papers)").unwrap();
            let cols: Vec<String> = stmt
                .query_map([], |r| r.get::<_, String>(1))
                .unwrap()
                .collect::<rusqlite::Result<_>>()
                .unwrap();
            assert!(
                !cols.iter().any(|c| c == "uploaded_at"),
                "uploaded_at must not exist after V001 only"
            );
        }

        // 2. Now run init_at — should detect upgrade, back up, apply V002+V003
        let pool = init_at(data_dir).expect("upgrade init");
        let conn = pool.get().unwrap();

        // 2a. Original V001 data preserved
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM papers", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 10, "V001 papers must survive upgrade");

        let third_title: String = conn
            .query_row("SELECT title FROM papers WHERE id = 'p3'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(third_title, "Paper 3");

        // 2b. New V003 column exists
        let mut stmt = conn.prepare("PRAGMA table_info(papers)").unwrap();
        let cols: Vec<String> = stmt
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert!(
            cols.iter().any(|c| c == "uploaded_at"),
            "uploaded_at must be added by V003"
        );

        // 2c. Backup file should have been created
        let entries: Vec<_> = std::fs::read_dir(data_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("sghub.db.bak.")
            })
            .collect();
        assert_eq!(
            entries.len(),
            1,
            "exactly one backup should exist after upgrade"
        );
    }

    #[test]
    fn fresh_init_does_not_create_backup() {
        let tmp = TempDir::new().unwrap();
        let _pool = init_at(tmp.path()).unwrap();
        let backups: Vec<_> = std::fs::read_dir(tmp.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("sghub.db.bak.")
            })
            .collect();
        assert!(
            backups.is_empty(),
            "fresh init must not produce a backup file"
        );
    }

    #[test]
    fn chat_session_cascades_to_messages_and_attachments() {
        let (_tmp, pool) = fresh_pool();
        let conn = pool.get().unwrap();

        conn.execute(
            "INSERT INTO chat_sessions (id, title) VALUES ('s1', 'Test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content) \
             VALUES ('m1', 's1', 'user', 'hello')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content) \
             VALUES ('m2', 's1', 'assistant', 'hi')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chat_attachments (id, session_id, type, file_name) \
             VALUES ('a1', 's1', 'pdf', 'paper.pdf')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chat_attachments (id, session_id, message_id, type, file_name) \
             VALUES ('a2', 's1', 'm1', 'pdf', 'attached.pdf')",
            [],
        )
        .unwrap();

        // Sanity counts
        let m_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM chat_messages WHERE session_id = 's1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let a_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM chat_attachments WHERE session_id = 's1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(m_count, 2);
        assert_eq!(a_count, 2);

        // Deleting the session must cascade to both children
        conn.execute("DELETE FROM chat_sessions WHERE id = 's1'", [])
            .unwrap();

        let m_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM chat_messages", [], |r| r.get(0))
            .unwrap();
        let a_after: i64 = conn
            .query_row("SELECT COUNT(*) FROM chat_attachments", [], |r| r.get(0))
            .unwrap();
        assert_eq!(m_after, 0, "messages must cascade-delete with session");
        assert_eq!(a_after, 0, "attachments must cascade-delete with session");
    }

    #[test]
    fn deleting_message_cascades_to_its_attachments_only() {
        let (_tmp, pool) = fresh_pool();
        let conn = pool.get().unwrap();

        conn.execute(
            "INSERT INTO chat_sessions (id, title) VALUES ('s1', 'T')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chat_messages (id, session_id, role, content) \
             VALUES ('m1', 's1', 'user', 'q')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chat_attachments (id, session_id, message_id, type, file_name) \
             VALUES ('a1', 's1', 'm1', 'pdf', 'a.pdf')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO chat_attachments (id, session_id, type, file_name) \
             VALUES ('a2', 's1', 'pdf', 'preupload.pdf')",
            [],
        )
        .unwrap();

        conn.execute("DELETE FROM chat_messages WHERE id = 'm1'", [])
            .unwrap();

        // a1 should be gone (cascade via message_id), a2 should survive
        let a_remaining: Vec<String> = {
            let mut stmt = conn.prepare("SELECT id FROM chat_attachments").unwrap();
            stmt.query_map([], |r| r.get::<_, String>(0))
                .unwrap()
                .collect::<rusqlite::Result<_>>()
                .unwrap()
        };
        assert_eq!(a_remaining, vec!["a2".to_string()]);
    }
}
