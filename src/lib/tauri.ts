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
  author: string | null;
  version: string | null;
  source: string; // "builtin" | "user"
}

export interface SkillSummary {
  name: string;
  display_name: string;
  description: string;
  icon: string;
  is_builtin: boolean;
  recommended_models: string[];
  author: string | null;
  version: string | null;
}

export interface SkillSpec {
  name: string;
  display_name: string;
  description: string;
  prompt_template: string;
  output_dimensions: OutputDimension[];
  recommended_models: string[];
  author: string | null;
  version: string | null;
  icon: string;
  category: string;
}

export interface SkillUploadResult {
  filename: string;
  success: boolean;
  skill: SkillSpec | null;
  errors: string[];
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
  /** `null` / undefined → follow OS locale (V2.1.0). */
  language?: string | null;
  theme: string;
  data_dir: string;
  /** Legacy v2.0 toggle (kept for back-compat). Use `updater.enabled`
   *  as the source of truth. */
  auto_update: boolean;
  auto_backup: boolean;
  backup_retention_days: number;
  default_model_id: string | null;
  log_level: string;
  /** V2.1.0 — fine-grained auto-updater schedule. */
  updater: UpdaterConfig;
}

// ============================================================
// Auto-updater (V2.1.0)
// ============================================================

export interface UpdaterConfig {
  enabled: boolean;
  /** "daily" | "weekly" */
  frequency_type: string;
  /** daily: every N days (1-30); weekly: weekday bitmask Mon=1..Sun=64 */
  frequency_value: number;
  /** "HH:MM" 24-hour local time. */
  check_time: string;
  /** "notify" | "silent_download" | "check_only" */
  action: string;
  /** ISO 8601, null = never checked. */
  last_check_at?: string | null;
}

export interface PendingUpdate {
  version: string;
  notes: string | null;
  detected_at: string;
}

export interface UpdaterStatus {
  current_version: string;
  last_check_at: string | null;
  /** Active cron expression; frontend uses it to estimate next-check time. */
  cron_expression: string | null;
  has_pending_update: boolean;
  pending: PendingUpdate | null;
}

export interface CheckResult {
  had_update: boolean;
  pending: PendingUpdate | null;
  last_check_at: string;
}

// ============================================================
// Data-directory management (V2.1.0)
// ============================================================

export interface CurrentDataDir {
  path: string;
  is_custom: boolean;
  size_mb: number;
}

export interface DataDirValidation {
  valid: boolean;
  has_existing_sghub_data: boolean;
  free_space_mb: number;
  error: string | null;
}

export type MigrationMode = "migrate" | "fresh" | "use_existing";

export interface MigrationResult {
  success: boolean;
  migrated_files: number;
  total_size_mb: number;
  errors: string[];
}

export interface DataMigrationProgress {
  current_file: string;
  percent: number;
  bytes_copied: number;
  total_bytes: number;
}

// ============================================================
// Chat module types (V2.0.1)
// ============================================================

export interface ChatSession {
  id: string;
  title: string;
  model_config_id: string | null;
  system_prompt: string | null;
  skill_name: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  last_message_preview: string | null;
  message_count: number;
  pinned: boolean;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments_json: string | null;
  tokens_in: number;
  tokens_out: number;
  model_name: string | null;
  created_at: string;
  /** Hydrated from attachments_json by backend (empty if none). */
  attachments: ChatAttachment[];
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}

export interface ChatAttachment {
  id: string;
  session_id: string;
  message_id: string | null;
  type: string; // 'pdf' | 'md' | 'txt' | 'docx' | 'image' | 'paper_ref' | 'url'
  file_name: string;
  file_path: string | null;
  file_size: number | null;
  extracted_text: string | null;
  paper_id: string | null;
  created_at: string;
}

export interface ChatTokenPayload {
  session_id: string;
  message_id: string;
  text: string;
  done: boolean;
  tokens_in?: number;
  tokens_out?: number;
  model_name?: string;
}

export interface ChatStreamInput {
  session_id: string | null;
  content: string;
  attachments: string[];
  skill_name: string | null;
  model_config_id: string | null;
}

export interface ChatStreamResult {
  session_id: string;
  assistant_message_id: string;
  content: string;
  tokens_in: number;
  tokens_out: number;
  model_name: string;
}

export interface UploadAttachmentInput {
  session_id: string;
  /** Absolute path from the Tauri native file dialog */
  file_path: string;
}

// ============================================================
// Local paper upload + FTS search (V2.0.3)
// ============================================================

export interface PartialMetadata {
  title: string;
  authors: string[];
  abstract: string | null;
  doi: string | null;
  /** 0..=1; UI forces a review modal when < 0.5 */
  confidence: number;
  /** "pdf_info" | "first_page" | "filename" */
  source: string;
}

export interface UploadResult {
  paper_id: string;
  partial_metadata: PartialMetadata;
  needs_user_review: boolean;
}

export interface BatchUploadItem {
  file_path: string;
  success: boolean;
  paper_id: string | null;
  needs_user_review: boolean;
  error: string | null;
}

export interface UploadProgressPayload {
  current: number;
  total: number;
  current_file: string;
}

export interface PaperSearchResult {
  id: string;
  title: string;
  /** HTML snippet with `<mark>…</mark>` around hits. */
  title_highlight: string;
  authors: string[];
  source: string;
  abstract: string | null;
  doi: string | null;
  pdf_path: string | null;
  current_folder_path: string | null;
  rank: number;
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

  getSkills: () => invoke<SkillSummary[]>("get_skills"),

  getSkillDetail: (name: string) =>
    invoke<Skill | null>("get_skill_detail", { name }),

  uploadSkillFile: (content: string, filename: string) =>
    invoke<SkillSpec>("upload_skill_file", { content, filename }),

  uploadSkillZip: (zipBytes: number[]) =>
    invoke<SkillUploadResult[]>("upload_skill_zip", { zipBytes }),

  deleteCustomSkill: (name: string) =>
    invoke<void>("delete_custom_skill", { name }),

  /**
   * Save a Skill from the editor.
   * - originalName=null: create new
   * - originalName=builtin name: auto-suffixed to {name}-custom if name unchanged
   * - originalName=user skill: overwrite (or rename + delete old)
   */
  saveSkill: (yamlContent: string, originalName: string | null) =>
    invoke<SkillSpec>("save_skill", { yamlContent, originalName }),

  /** Raw YAML for editor load. Builtin → embedded const, user → disk file. */
  getSkillYaml: (name: string) =>
    invoke<string>("get_skill_yaml", { name }),

  /** Same content as getSkillYaml — semantic alias for download flow. */
  exportSkill: (name: string) =>
    invoke<string>("export_skill", { name }),

  /**
   * Test-run a skill against a paper without writing it. Returns full result;
   * subscribe to "skill_test:token" event for streaming chunks. max_tokens
   * capped at 1500 server-side to limit cost.
   */
  testSkillWithPaper: (
    yamlContent: string,
    paperId: string,
    modelConfigId: string,
  ) =>
    invoke<TestResult>("test_skill_with_paper", {
      yamlContent,
      paperId,
      modelConfigId,
    }),

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

  /** Returns one of the 5 supported app locale codes (V2.1.0). */
  getSystemLocale: () => invoke<string>("get_system_locale"),

  // ============================================================
  // Auto-updater (V2.1.0)
  // ============================================================
  getUpdaterStatus: () => invoke<UpdaterStatus>("get_updater_status"),
  checkUpdateNow: () => invoke<CheckResult>("check_update_now"),
  installPendingUpdate: () => invoke<void>("install_pending_update"),
  /** Saves the updater config AND live-reschedules the cron job in one
   *  IPC, so the Settings panel can save-on-change without an extra
   *  round-trip. */
  setUpdaterConfig: (config: UpdaterConfig) =>
    invoke<void>("set_updater_config", { config }),

  // ============================================================
  // Data directory management (V2.1.0)
  // ============================================================
  getCurrentDataDir: () => invoke<CurrentDataDir>("get_current_data_dir"),
  selectNewDataDir: () =>
    invoke<string | null>("select_new_data_dir"),
  validateDataDir: (path: string) =>
    invoke<DataDirValidation>("validate_data_dir", { path }),
  migrateDataDir: (newPath: string, mode: MigrationMode) =>
    invoke<MigrationResult>("migrate_data_dir", { newPath, mode }),
  resetDataDirToDefault: () =>
    invoke<void>("reset_data_dir_to_default"),
  deleteOldDataDir: (path: string) =>
    invoke<void>("delete_old_data_dir", { path }),

  // ============================================================
  // Chat (V2.0.1)
  // ============================================================

  createChatSession: (
    title: string | null,
    modelConfigId: string | null,
  ) =>
    invoke<ChatSession>("create_chat_session", {
      title,
      modelConfigId,
    }),

  listChatSessions: (limit?: number) =>
    invoke<ChatSessionSummary[]>("list_chat_sessions", {
      limit: limit ?? null,
    }),

  deleteChatSession: (id: string) =>
    invoke<void>("delete_chat_session", { id }),

  renameChatSession: (id: string, title: string) =>
    invoke<void>("rename_chat_session", { id, title }),

  pinChatSession: (id: string, pinned: boolean) =>
    invoke<void>("pin_chat_session", { id, pinned }),

  getSessionDetail: (id: string) =>
    invoke<ChatSessionDetail | null>("get_session_detail", { id }),

  setChatSessionModel: (id: string, modelConfigId: string | null) =>
    invoke<void>("set_chat_session_model", { id, modelConfigId }),

  getMessagesBySession: (
    sessionId: string,
    limit?: number,
    beforeId?: string,
  ) =>
    invoke<ChatMessage[]>("get_messages_by_session", {
      sessionId,
      limit: limit ?? null,
      beforeId: beforeId ?? null,
    }),

  uploadChatAttachment: (input: UploadAttachmentInput) =>
    invoke<ChatAttachment>("upload_chat_attachment", { input }),

  referencePaperAsAttachment: (sessionId: string, paperId: string) =>
    invoke<ChatAttachment>("reference_paper_as_attachment", {
      sessionId,
      paperId,
    }),

  /**
   * Send one chat turn. Streams tokens via "chat:token" event;
   * resolves with the final assembled result.
   */
  sendChatMessage: (input: ChatStreamInput) =>
    invoke<ChatStreamResult>("send_chat_message", { input }),

  // ============================================================
  // Library helpers — favorites + external URL + PDF download
  // ============================================================

  /** Folder IDs a paper currently belongs to (empty → not yet favorited). */
  getPaperFolders: (paperId: string) =>
    invoke<string[]>("get_paper_folders", { paperId }),

  /** Convenience for the FavoriteButton "+ new folder" path. */
  createQuickFolder: (name: string, parentId: string | null) =>
    invoke<Folder>("create_quick_folder", { name, parentId }),

  /** Resolve a paper to its best external URL (doi → source_url → arxiv abs → pubmed). */
  resolvePaperUrl: (paperId: string) =>
    invoke<string | null>("resolve_paper_url", { paperId }),

  /** Open a URL in the OS-default browser. http(s) only. */
  openExternalUrl: (url: string) =>
    invoke<void>("open_external_url", { url }),

  /** Open a local PDF in the OS-default viewer. */
  openLocalPdf: (path: string) => invoke<void>("open_local_pdf", { path }),

  /**
   * Download an OA paper's PDF; emits `download:progress` events keyed by paper_id.
   * Returns the absolute path on success.
   */
  downloadPaperPdf: (paperId: string) =>
    invoke<string>("download_paper_pdf", { paperId }),

  /** Cooperative cancel — the active download polls this flag per chunk. */
  cancelDownload: (paperId: string) =>
    invoke<void>("cancel_download", { paperId }),

  // ============================================================
  // Local PDF upload + FTS search (V2.0.3)
  // ============================================================

  uploadLocalPaper: (filePath: string) =>
    invoke<UploadResult>("upload_local_paper", { filePath }),

  uploadLocalPapersBatch: (filePaths: string[]) =>
    invoke<BatchUploadItem[]>("upload_local_papers_batch", { filePaths }),

  updatePaperMetadata: (
    paperId: string,
    title: string,
    authors: string[],
    abstractText: string | null,
    doi: string | null,
  ) =>
    invoke<void>("update_paper_metadata", {
      paperId,
      title,
      authors,
      abstractText,
      doi,
    }),

  searchLocalPapers: (keyword: string, limit?: number) =>
    invoke<PaperSearchResult[]>("search_local_papers", {
      keyword,
      limit: limit ?? null,
    }),

  reExtractPaperMetadata: (paperId: string) =>
    invoke<PartialMetadata>("re_extract_paper_metadata", { paperId }),
};

// ============================================================
// Event payload types — match Rust serde structs in library/
// ============================================================

export interface PaperFolderChangedPayload {
  paper_id: string;
  /** "added" | "removed" | "moved" */
  kind: "added" | "removed" | "moved";
  folder_id: string | null;
  from_folder_id: string | null;
  to_folder_id: string | null;
}

export interface DownloadProgressPayload {
  paper_id: string;
  /** 0..=100, or -1 when Content-Length unknown. */
  percent: number;
  received: number;
  total: number | null;
  /** "downloading" | "done" | "error" | "cancelled" */
  status: "downloading" | "done" | "error" | "cancelled";
  error: string | null;
  /** Absolute path on `status: "done"`. */
  path: string | null;
}
