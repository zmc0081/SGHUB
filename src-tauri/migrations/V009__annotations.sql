-- V2.2.10 (Session 49) — PDF reader text annotations (highlight / underline).
-- anchor: JSON of page-normalised rects: {"rects":[{"x":..,"y":..,"w":..,"h":..}]}
--         (0–1 fractions of the page size, so rendering adapts to any zoom).
-- type:   'highlight' | 'underline'
-- color:  'yellow' | 'green' | 'pink'  (token-mapped in the frontend)
-- note:   reserved for a future note/comment feature.
CREATE TABLE annotations (
  id          TEXT PRIMARY KEY,
  paper_id    TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  page        INTEGER NOT NULL,
  anchor      TEXT NOT NULL,
  type        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'yellow',
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX idx_annotations_paper ON annotations(paper_id);
