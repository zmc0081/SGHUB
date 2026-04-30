-- SGHUB V2.0.0 SQLite Schema
-- 所有表使用 UUID v7 (TEXT) 作为主键
-- created_at / updated_at 为 ISO 8601 时间戳
-- deleted_at 为软删除标记

-- ============================================================
-- 1. papers - 文献元数据
-- ============================================================
CREATE TABLE IF NOT EXISTS papers (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    authors     TEXT NOT NULL,
    abstract    TEXT,
    doi         TEXT,
    source      TEXT NOT NULL,
    source_id   TEXT,
    source_url  TEXT,
    published_at TEXT,
    pdf_path    TEXT,
    read_status TEXT NOT NULL DEFAULT 'unread',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_papers_source ON papers(source, source_id);
CREATE INDEX IF NOT EXISTS idx_papers_published ON papers(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_read_status ON papers(read_status);

-- 全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
    title,
    authors,
    abstract,
    content='papers',
    content_rowid='rowid'
);

-- FTS 同步触发器
CREATE TRIGGER IF NOT EXISTS papers_ai AFTER INSERT ON papers BEGIN
    INSERT INTO papers_fts(rowid, title, authors, abstract)
    VALUES (new.rowid, new.title, new.authors, new.abstract);
END;

CREATE TRIGGER IF NOT EXISTS papers_ad AFTER DELETE ON papers BEGIN
    INSERT INTO papers_fts(papers_fts, rowid, title, authors, abstract)
    VALUES ('delete', old.rowid, old.title, old.authors, old.abstract);
END;

CREATE TRIGGER IF NOT EXISTS papers_au AFTER UPDATE ON papers BEGIN
    INSERT INTO papers_fts(papers_fts, rowid, title, authors, abstract)
    VALUES ('delete', old.rowid, old.title, old.authors, old.abstract);
    INSERT INTO papers_fts(rowid, title, authors, abstract)
    VALUES (new.rowid, new.title, new.authors, new.abstract);
END;

-- ============================================================
-- 2. folders - 收藏夹文件夹 (自引用树)
-- ============================================================
CREATE TABLE IF NOT EXISTS folders (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT,
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_smart    INTEGER NOT NULL DEFAULT 0,
    smart_rule  TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

-- ============================================================
-- 3. folder_papers - 文件夹与文献多对多关联
-- ============================================================
CREATE TABLE IF NOT EXISTS folder_papers (
    folder_id   TEXT NOT NULL,
    paper_id    TEXT NOT NULL,
    added_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (folder_id, paper_id),
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

-- ============================================================
-- 4. tags - 标签
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    color       TEXT NOT NULL DEFAULT '#1F3864',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================
-- 5. tag_papers - 标签与文献多对多关联
-- ============================================================
CREATE TABLE IF NOT EXISTS tag_papers (
    tag_id      TEXT NOT NULL,
    paper_id    TEXT NOT NULL,
    PRIMARY KEY (tag_id, paper_id),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

-- ============================================================
-- 6. subscriptions - 关键词订阅
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id              TEXT PRIMARY KEY,
    keyword_expr    TEXT NOT NULL,
    sources         TEXT NOT NULL DEFAULT '["arxiv","semantic_scholar"]',
    frequency       TEXT NOT NULL DEFAULT 'daily',
    max_results     INTEGER NOT NULL DEFAULT 20,
    is_active       INTEGER NOT NULL DEFAULT 1,
    last_run_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================
-- 7. model_configs - AI 模型配置
-- ============================================================
CREATE TABLE IF NOT EXISTS model_configs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    provider    TEXT NOT NULL,
    endpoint    TEXT NOT NULL,
    model_id    TEXT NOT NULL,
    max_tokens  INTEGER NOT NULL DEFAULT 128000,
    is_default  INTEGER NOT NULL DEFAULT 0,
    keychain_ref TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_default
    ON model_configs(is_default) WHERE is_default = 1;

-- ============================================================
-- 8. ai_parse_results - AI 解析结果
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_parse_results (
    id          TEXT PRIMARY KEY,
    paper_id    TEXT NOT NULL,
    skill_name  TEXT NOT NULL,
    model_name  TEXT NOT NULL,
    result_json TEXT NOT NULL,
    tokens_in   INTEGER NOT NULL DEFAULT 0,
    tokens_out  INTEGER NOT NULL DEFAULT 0,
    cost_est    REAL NOT NULL DEFAULT 0.0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parse_paper ON ai_parse_results(paper_id);
CREATE INDEX IF NOT EXISTS idx_parse_created ON ai_parse_results(created_at DESC);

-- ============================================================
-- 9. notifications - 推送通知
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    body        TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    related_id  TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(is_read) WHERE is_read = 0;

-- ============================================================
-- 10. usage_stats - AI 模型用量统计 (按日聚合)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_stats (
    id              TEXT PRIMARY KEY,
    model_config_id TEXT NOT NULL,
    date            TEXT NOT NULL,
    tokens_in_total INTEGER NOT NULL DEFAULT 0,
    tokens_out_total INTEGER NOT NULL DEFAULT 0,
    call_count      INTEGER NOT NULL DEFAULT 0,
    cost_est_total  REAL NOT NULL DEFAULT 0.0,
    FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE CASCADE,
    UNIQUE(model_config_id, date)
);

-- ============================================================
-- 初始数据: 默认文件夹
-- ============================================================
INSERT OR IGNORE INTO folders (id, parent_id, name, sort_order)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, '未分类', 9999);
