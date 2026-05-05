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

export interface FolderNode extends Folder {
  paper_count: number;
  children: FolderNode[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  paper_count: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
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

export interface ModelConfigInput {
  name: string;
  provider: string;
  endpoint: string;
  model_id: string;
  max_tokens: number;
  api_key: string | null;
}

export interface TestResult {
  success: boolean;
  latency_ms: number;
  message: string;
  model_response: string | null;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenPayload {
  text: string;
  done: boolean;
}

export interface OutputDimension {
  key: string;
  title: string;
  title_en: string | null;
}

export interface EstimatedTokens {
  input: number;
  output: number;
}

export interface Skill {
  name: string;
  display_name: string;
  display_name_en: string | null;
  description: string;
  icon: string;
  category: string;
  prompt_template: string;
  output_dimensions: OutputDimension[];
  recommended_models: string[];
  estimated_tokens: EstimatedTokens | null;
  source: string; // "builtin" | "user"
}

export interface ParseResult {
  id: string;
  paper_id: string;
  skill_name: string;
  model_name: string;
  result_json: string;
  tokens_in: number;
  tokens_out: number;
  cost_est: number;
  duration_ms: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  keyword_expr: string;
  sources: string[];
  frequency: string; // "daily" | "weekly"
  max_results: number;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInput {
  keyword_expr: string;
  sources: string[];
  frequency: string;
  max_results: number;
}

export interface SubscriptionResult {
  subscription_id: string;
  subscription_keyword: string;
  paper: Paper;
  found_at: string;
  is_read: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
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

  getFolderTree: () => invoke<FolderNode[]>("get_folder_tree"),

  createFolder: (name: string, parentId: string | null) =>
    invoke<Folder>("create_folder", { name, parentId }),

  renameFolder: (id: string, name: string) =>
    invoke<void>("rename_folder", { id, name }),

  moveFolder: (id: string, newParentId: string | null) =>
    invoke<void>("move_folder", { id, newParentId }),

  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),

  reorderFolders: (parentId: string | null, orderedIds: string[]) =>
    invoke<void>("reorder_folders", { parentId, orderedIds }),

  addToFolder: (folderId: string, paperId: string) =>
    invoke<void>("add_to_folder", { folderId, paperId }),

  removeFromFolder: (folderId: string, paperId: string) =>
    invoke<void>("remove_from_folder", { folderId, paperId }),

  movePaperToFolder: (
    paperId: string,
    fromFolderId: string,
    toFolderId: string,
  ) =>
    invoke<void>("move_paper_to_folder", {
      paperId,
      fromFolderId,
      toFolderId,
    }),

  batchAddToFolder: (folderId: string, paperIds: string[]) =>
    invoke<number>("batch_add_to_folder", { folderId, paperIds }),

  createTag: (name: string, color: string) =>
    invoke<Tag>("create_tag", { name, color }),

  deleteTag: (id: string) => invoke<void>("delete_tag", { id }),

  getTags: () => invoke<Tag[]>("get_tags"),

  addTagToPaper: (tagId: string, paperId: string) =>
    invoke<void>("add_tag_to_paper", { tagId, paperId }),

  removeTagFromPaper: (tagId: string, paperId: string) =>
    invoke<void>("remove_tag_from_paper", { tagId, paperId }),

  batchTag: (tagId: string, paperIds: string[]) =>
    invoke<number>("batch_tag", { tagId, paperIds }),

  getPapersByFolder: (folderId: string, page: number, pageSize: number) =>
    invoke<PageResult<Paper>>("get_papers_by_folder", {
      folderId,
      page,
      pageSize,
    }),

  getPapersByTag: (tagId: string) =>
    invoke<Paper[]>("get_papers_by_tag", { tagId }),

  setReadStatus: (paperId: string, status: string) =>
    invoke<void>("set_read_status", { paperId, status }),

  exportTextFile: (suggestedName: string, content: string) =>
    invoke<string>("export_text_file", { suggestedName, content }),

  getRecentPapers: (limit: number) =>
    invoke<Paper[]>("get_recent_papers", { limit }),

  getPaper: (id: string) => invoke<Paper | null>("get_paper", { id }),

  getSkills: () => invoke<Skill[]>("get_skills"),

  /**
   * Run a skill on a paper through a model. Returns full text on completion.
   * Subscribe to "parse:token" event for incremental streaming.
   */
  startParse: (paperId: string, skillName: string, modelConfigId: string) =>
    invoke<string>("start_parse", {
      paperId,
      skillName,
      modelConfigId,
    }),

  getParseHistory: (paperId: string) =>
    invoke<ParseResult[]>("get_parse_history", { paperId }),

  // Subscriptions
  createSubscription: (input: SubscriptionInput) =>
    invoke<Subscription>("create_subscription", { input }),

  updateSubscription: (id: string, input: SubscriptionInput) =>
    invoke<void>("update_subscription", { id, input }),

  deleteSubscription: (id: string) =>
    invoke<void>("delete_subscription", { id }),

  toggleSubscriptionActive: (id: string) =>
    invoke<void>("toggle_subscription_active", { id }),

  getSubscriptions: () => invoke<Subscription[]>("get_subscriptions"),

  getSubscriptionResults: (subscriptionId: string | null) =>
    invoke<SubscriptionResult[]>("get_subscription_results", { subscriptionId }),

  markSubscriptionPaperRead: (subscriptionId: string, paperId: string) =>
    invoke<void>("mark_subscription_paper_read", { subscriptionId, paperId }),

  getUnreadSubscriptionCount: () =>
    invoke<number>("get_unread_subscription_count"),

  getNotifications: (unreadOnly: boolean) =>
    invoke<Notification[]>("get_notifications", { unreadOnly }),

  markNotificationRead: (id: string) =>
    invoke<void>("mark_notification_read", { id }),

  runSubscriptionsNow: () => invoke<void>("run_subscriptions_now"),

  getModelConfigs: () => invoke<ModelConfig[]>("get_model_configs"),

  addModelConfig: (input: ModelConfigInput) =>
    invoke<ModelConfig>("add_model_config", { input }),

  updateModelConfig: (id: string, input: ModelConfigInput) =>
    invoke<ModelConfig>("update_model_config", { id, input }),

  deleteModelConfig: (id: string) =>
    invoke<void>("delete_model_config", { id }),

  setDefaultModel: (id: string) =>
    invoke<void>("set_default_model", { id }),

  getModelPresets: () =>
    invoke<ModelConfigInput[]>("get_model_presets"),

  testModelConnection: (modelId: string) =>
    invoke<TestResult>("test_model_connection", { modelId }),

  /**
   * Streaming chat. Returns the full response when done.
   * Subscribe to "ai:token" event (via @tauri-apps/api/event listen) to
   * receive incremental TokenPayload chunks during the call.
   */
  aiChatStream: (modelId: string, messages: Message[]) =>
    invoke<string>("ai_chat_stream", { modelId, messages }),

  getAppConfig: () => invoke<AppConfig>("get_app_config"),

  saveAppConfig: (config: AppConfig) =>
    invoke<void>("save_app_config", { config }),
};
