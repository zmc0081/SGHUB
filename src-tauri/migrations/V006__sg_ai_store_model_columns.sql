-- V006 (V2.2.1 Session 29) — SG AI Store columns on model_configs.
--
-- All additions are nullable / DEFAULT-bearing, so existing rows keep
-- working untouched. The Rust ModelConfig struct mirrors these as
-- `#[serde(default)]` so older JSON payloads still deserialize.
--
-- Semantics:
--   is_sg_ai_store        1 iff this model is a SG AI Store SKU
--                         (auto-set in Rust when endpoint contains
--                         "sgaistore.com"; users can flip via UI later).
--   balance_cny           Last-known balance in CNY. NULL = never queried.
--   remaining_tokens      Last-known token allowance.
--   subscription_expires_at  ISO 8601, when current pack expires.
--   balance_synced_at     ISO 8601 of the last successful balance fetch.

ALTER TABLE model_configs
    ADD COLUMN is_sg_ai_store INTEGER NOT NULL DEFAULT 0;

ALTER TABLE model_configs
    ADD COLUMN balance_cny REAL;

ALTER TABLE model_configs
    ADD COLUMN remaining_tokens INTEGER;

ALTER TABLE model_configs
    ADD COLUMN subscription_expires_at TEXT;

ALTER TABLE model_configs
    ADD COLUMN balance_synced_at TEXT;
