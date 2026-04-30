import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export const windowControls = {
  minimize: () => appWindow.minimize(),
  toggleMaximize: () => appWindow.toggleMaximize(),
  close: () => appWindow.close(),
  isMaximized: () => appWindow.isMaximized(),
};

// ============================================================
// Types — keep in sync with src-tauri/src/{search,library,ai_client,config}/mod.rs
// Rust `Option<T>` serializes to `T | null`, not `T | undefined`.
// ============================================================

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  doi: string | null;
  source: string;
  source_id: string | null;
  source_url: string | null;
  published_at: string | null;
  pdf_path: string | null;
  read_status: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_smart: boolean;
  smart_rule: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  model_id: string;
  max_tokens: number;
  is_default: boolean;
  keychain_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  success: boolean;
  latency_ms: number;
  message: string;
  model_response: string | null;
}

export interface AppConfig {
  language: string;
  theme: string;
  data_dir: string;
  auto_update: boolean;
  auto_backup: boolean;
  backup_retention_days: number;
  default_model_id: string | null;
  log_level: string;
}

// ============================================================
// API — typed wrappers around invoke().
// Tauri converts JS camelCase keys → Rust snake_case automatically.
// ============================================================

export const api = {
  searchPapers: (query: string, source: string, limit: number) =>
    invoke<Paper[]>("search_papers", { query, source, limit }),

  getFolders: () => invoke<Folder[]>("get_folders"),

  getPapersByFolder: (folderId: string) =>
    invoke<Paper[]>("get_papers_by_folder", { folderId }),

  getModelConfigs: () => invoke<ModelConfig[]>("get_model_configs"),

  testModelConnection: (modelId: string) =>
    invoke<TestResult>("test_model_connection", { modelId }),

  getAppConfig: () => invoke<AppConfig>("get_app_config"),

  saveAppConfig: (config: AppConfig) =>
    invoke<void>("save_app_config", { config }),
};
