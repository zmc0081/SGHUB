-- V003 — Chat sessions / messages / attachments + papers.uploaded_at
-- (Numbered V003 because V002 is already subscription_papers.)

-- Chat 会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '新对话',
    model_config_id TEXT,                                   -- 当前会话默认模型
    system_prompt TEXT,                                      -- Skill 注入的系统提示
    skill_name TEXT,                                         -- 引用的 Skill (可空)
    pinned INTEGER NOT NULL DEFAULT 0,                       -- 置顶标记
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at TEXT,
    FOREIGN KEY (model_config_id) REFERENCES model_configs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated
    ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned
    ON chat_sessions(pinned, updated_at DESC);

-- Chat 消息表
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,                                      -- 'user' | 'assistant' | 'system'
    content TEXT NOT NULL,
    attachments_json TEXT,                                   -- JSON 数组,引用 chat_attachments
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    model_name TEXT,                                         -- 该消息实际使用的模型
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
    ON chat_messages(session_id, created_at);

-- Chat 附件表
CREATE TABLE IF NOT EXISTS chat_attachments (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    message_id TEXT,                                         -- 可空,允许预上传
    type TEXT NOT NULL,                                      -- 'pdf' | 'docx' | 'md' | 'txt' | 'image' | 'url'
    file_name TEXT NOT NULL,
    file_path TEXT,                                          -- 本地存储路径
    file_size INTEGER,
    extracted_text TEXT,                                     -- 提取的文本内容
    paper_id TEXT,                                           -- 若引用自收藏文献
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_attach_session
    ON chat_attachments(session_id);

-- 扩展 papers 表
ALTER TABLE papers ADD COLUMN uploaded_at TEXT;

-- ai_parse_results.skill_name 长度:SQLite TEXT 无长度限制,无需 ALTER。
-- 通过文档约定即可(CLAUDE.md 中明确长度上限)。
