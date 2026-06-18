-- V007 (V2.2.5) — remove cost estimation entirely (方案 B).
--
-- Drops the per-model price columns and the usage_stats cost aggregate.
-- These columns are not referenced by any index, FK, trigger, or view, so
-- `ALTER TABLE ... DROP COLUMN` (SQLite 3.35+) is safe and runs cleanly
-- inside refinery's per-migration transaction — no FK-toggle / table-
-- rebuild dance needed (which would conflict with the wrapping
-- transaction). Existing token/call data in usage_stats is preserved;
-- only the cost column is removed.

ALTER TABLE model_configs DROP COLUMN input_price_per_1m_tokens;
ALTER TABLE model_configs DROP COLUMN output_price_per_1m_tokens;

ALTER TABLE usage_stats DROP COLUMN cost_est_total;
