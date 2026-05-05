-- Link table: which papers were found by which subscription run.
-- One row per (subscription, paper) pair. INSERT OR IGNORE makes
-- repeat runs idempotent — only NEW papers (vs prior runs) become rows.

CREATE TABLE IF NOT EXISTS subscription_papers (
    subscription_id TEXT NOT NULL,
    paper_id        TEXT NOT NULL,
    found_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    is_read         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (subscription_id, paper_id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_papers_sub_found
    ON subscription_papers(subscription_id, found_at DESC);

CREATE INDEX IF NOT EXISTS idx_sub_papers_unread
    ON subscription_papers(is_read) WHERE is_read = 0;
