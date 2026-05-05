use std::path::{Path, PathBuf};

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};
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
    let app_data_dir: PathBuf = app.path().app_data_dir()?;
    let data_dir = app_data_dir.join("data");
    init_at(&data_dir)
}

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

    let mut conn = pool.get()?;
    embedded::migrations::runner().run(&mut *conn)?;

    Ok(pool)
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
        // V001: 10 base tables + V002: subscription_papers = 11
        assert_eq!(status.table_count, 11);

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
}
