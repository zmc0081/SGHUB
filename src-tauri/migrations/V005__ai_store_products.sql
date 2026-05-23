-- V005 (V2.2.1 Session 28) — AI Store local catalog cache.
--
-- Two tables:
--   ai_store_products    one row per SG AI Store SKU; refreshed by
--                        the sync strategy (manual + 5-min periodic +
--                        SSE pushes from sgaistore.com).
--   ai_store_sync_meta   single-row sync state (ETag + timestamps).

CREATE TABLE IF NOT EXISTS ai_store_products (
    id              TEXT PRIMARY KEY,
    name_json       TEXT NOT NULL,       -- LocalizedString — { "zh-CN": "…", "en-US": "…" }
    description_json TEXT NOT NULL,
    icon_url        TEXT NOT NULL DEFAULT '',
    model_provider  TEXT NOT NULL,       -- 'anthropic' | 'openai' | 'deepseek' | 'ollama' | 'multi'
    model_id        TEXT NOT NULL,
    billing_period  TEXT NOT NULL,       -- 'monthly' | 'yearly'
    price_cny       REAL NOT NULL,
    price_usd       REAL NOT NULL,
    token_quota     INTEGER NOT NULL,
    features_json   TEXT NOT NULL,       -- LocalizedStringArray
    tags_json       TEXT NOT NULL,       -- string[]
    popular         INTEGER NOT NULL DEFAULT 0,
    purchase_url    TEXT NOT NULL,
    synced_at       TEXT NOT NULL        -- ISO 8601, when this row was last refreshed
);

CREATE TABLE IF NOT EXISTS ai_store_sync_meta (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    etag            TEXT,                -- HTTP ETag of the last successful sync
    last_synced_at  TEXT,                -- ISO 8601
    next_sync_at    TEXT                 -- ISO 8601, when the next periodic sync is due
);

-- Single-row state init so UPDATE has a target without a separate UPSERT.
INSERT OR IGNORE INTO ai_store_sync_meta (id, etag, last_synced_at, next_sync_at)
VALUES (1, NULL, NULL, NULL);
