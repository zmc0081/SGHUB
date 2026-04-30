-- SGHUB V2.0.0 SQLite Schema
-- 文件: src-tauri/migrations/V001__initial_schema.sql
-- 说明: 所有表使用 UUID v7 (TEXT) 作为主键
--       created_at / updated_at 为 ISO 8601 时间戳
--       deleted_at 为软删除标记

-- ============================================================
-- 1. papers - 文献元数据
-- ============================================================
CREATE TABLE IF NOT EXISTS papers (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    authors     TEXT NOT NULL,           -- JSON array: ["Author A", "Author B"]
    abstract    TEXT,
    doi         TEXT,
    source      TEXT NOT NULL,           -- 'arxiv' | 'pubmed' | 'semantic_scholar' | 'openalex' | 'local'
    source_id   TEXT,                    -- 数据源原始 ID (如 arXiv ID)
    source_url  TEXT,                    -- 原文链接
    published_at TEXT,                   -- ISO 8601
    pdf_path    TEXT,                    -- 本地 PDF 路径 (相对于 ~/.sghub/data/pdfs/)
    read_status TEXT NOT NULL DEFAULT 'unread',  -- 'unread' | 'reading' | 'read' | 'parsed'
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
    parent_id   TEXT,                    -- NULL = 顶级文件夹
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_smart    INTEGER NOT NULL DEFAULT 0,  -- 1 = 智能文件夹
    smart_rule  TEXT,                    -- JSON: 智能文件夹规则
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
    color       TEXT NOT NULL DEFAULT '#1F3864',  -- HEX 颜色
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
    keyword_expr    TEXT NOT NULL,           -- 布尔表达式: "LLM alignment" OR "RLHF"
    sources         TEXT NOT NULL DEFAULT '["arxiv","semantic_scholar"]',  -- JSON array
    frequency       TEXT NOT NULL DEFAULT 'daily',   -- 'daily' | 'weekly'
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
    name        TEXT NOT NULL,               -- 显示名称: "Claude Opus 4.7"
    provider    TEXT NOT NULL,               -- 'openai' | 'anthropic' | 'ollama' | 'custom'
    endpoint    TEXT NOT NULL,               -- API endpoint URL
    model_id    TEXT NOT NULL,               -- 模型标识: "claude-opus-4-7-20260301"
    max_tokens  INTEGER NOT NULL DEFAULT 128000,
    is_default  INTEGER NOT NULL DEFAULT 0,  -- 1 = 默认模型
    keychain_ref TEXT,                       -- OS Keychain 中的 Key 引用标识
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 确保只有一个默认模型
CREATE UNIQUE INDEX IF NOT EXISTS idx_model_default
    ON model_configs(is_default) WHERE is_default = 1;

-- ============================================================
-- 8. ai_parse_results - AI 解析结果
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_parse_results (
    id          TEXT PRIMARY KEY,
    paper_id    TEXT NOT NULL,
    skill_name  TEXT NOT NULL,               -- 'general_read' | 'methodology' | ...
    model_name  TEXT NOT NULL,               -- 实际使用的模型名
    result_json TEXT NOT NULL,               -- 结构化解析结果 JSON
    tokens_in   INTEGER NOT NULL DEFAULT 0,
    tokens_out  INTEGER NOT NULL DEFAULT 0,
    cost_est    REAL NOT NULL DEFAULT 0.0,   -- 预估成本 (USD)
    duration_ms INTEGER NOT NULL DEFAULT 0,  -- 解析耗时 (毫秒)
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
    type        TEXT NOT NULL,               -- 'subscription' | 'update' | 'system'
    title       TEXT NOT NULL,
    body        TEXT,
    is_read     INTEGER NOT NULL DEFAULT 0,
    related_id  TEXT,                        -- 关联的 subscription_id 或 paper_id
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(is_read) WHERE is_read = 0;

-- ============================================================
-- 10. usage_stats - AI 模型用量统计 (按日聚合)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_stats (
    id              TEXT PRIMARY KEY,
    model_config_id TEXT NOT NULL,
    date            TEXT NOT NULL,           -- 'YYYY-MM-DD'
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
