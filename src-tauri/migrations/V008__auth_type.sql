-- V2.2.8 — authentication-method dimension for model configs.
-- auth_type: 'api_key' (default, existing behaviour) | 'adc'
--   (Google Application Default Credentials — no key stored in keychain).
-- gcp_project_id / gcp_region: Vertex AI routing (region defaults to 'global').
-- proxy_url: optional per-model HTTP/SOCKS proxy for corporate networks
--   (used for both token exchange and model calls).
ALTER TABLE model_configs ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'api_key';
ALTER TABLE model_configs ADD COLUMN gcp_project_id TEXT;
ALTER TABLE model_configs ADD COLUMN gcp_region TEXT DEFAULT 'global';
ALTER TABLE model_configs ADD COLUMN proxy_url TEXT;
