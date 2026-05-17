-- V004 — model pricing fields for cost estimation (V2.1.0+)
--
-- Per-1M-token prices (USD). 0.0 means "unknown / free" — the
-- updater path still records call_count + tokens, just with 0 cost.

ALTER TABLE model_configs ADD COLUMN input_price_per_1m_tokens REAL NOT NULL DEFAULT 0.0;
ALTER TABLE model_configs ADD COLUMN output_price_per_1m_tokens REAL NOT NULL DEFAULT 0.0;

-- Backfill defaults for the built-in preset models. Custom rows the
-- user added with arbitrary model_ids stay at 0.0 — the user fills in
-- their numbers in the Models form. We match by `model_id` prefix so
-- new variants in the same family pick up the same price.

-- Anthropic Claude
UPDATE model_configs SET input_price_per_1m_tokens = 15.0,
                         output_price_per_1m_tokens = 75.0
  WHERE input_price_per_1m_tokens = 0.0
    AND output_price_per_1m_tokens = 0.0
    AND model_id LIKE 'claude-opus%';

UPDATE model_configs SET input_price_per_1m_tokens = 3.0,
                         output_price_per_1m_tokens = 15.0
  WHERE input_price_per_1m_tokens = 0.0
    AND output_price_per_1m_tokens = 0.0
    AND model_id LIKE 'claude-sonnet%';

UPDATE model_configs SET input_price_per_1m_tokens = 0.80,
                         output_price_per_1m_tokens = 4.0
  WHERE input_price_per_1m_tokens = 0.0
    AND output_price_per_1m_tokens = 0.0
    AND model_id LIKE 'claude-haiku%';

-- OpenAI GPT
UPDATE model_configs SET input_price_per_1m_tokens = 5.0,
                         output_price_per_1m_tokens = 15.0
  WHERE input_price_per_1m_tokens = 0.0
    AND output_price_per_1m_tokens = 0.0
    AND model_id LIKE 'gpt-5%';

UPDATE model_configs SET input_price_per_1m_tokens = 2.5,
                         output_price_per_1m_tokens = 10.0
  WHERE input_price_per_1m_tokens = 0.0
    AND output_price_per_1m_tokens = 0.0
    AND model_id LIKE 'gpt-4%';

-- DeepSeek
UPDATE model_configs SET input_price_per_1m_tokens = 0.27,
                         output_price_per_1m_tokens = 1.10
  WHERE input_price_per_1m_tokens = 0.0
    AND output_price_per_1m_tokens = 0.0
    AND model_id LIKE 'deepseek%';

-- Local Ollama — always free.
UPDATE model_configs SET input_price_per_1m_tokens = 0.0,
                         output_price_per_1m_tokens = 0.0
  WHERE provider = 'ollama';
