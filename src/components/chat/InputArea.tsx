import { useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api, type ModelConfig, type SkillSummary } from "../../lib/tauri";
import { useChatStore } from "../../stores/chatStore";

// ============================================================
// Pending upload tracking — keeps chip visible from "user picked
// the file" through "backend finished extracting text". Without this
// the chip only pops in when the round-trip completes (often several
// seconds for large PDFs), which feels broken.
// ============================================================

interface PendingUpload {
  tempId: string;
  fileName: string;
  kind: string;
  status: "uploading" | "error";
  errorMsg?: string;
}

function inferKind(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "txt") return "txt";
  if (ext === "docx") return "docx";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  return "file";
}

function iconFor(kind: string): string {
  switch (kind) {
    case "pdf":
      return "📄";
    case "md":
    case "txt":
      return "📝";
    case "image":
      return "🖼";
    case "paper_ref":
      return "📚";
    case "url":
      return "🔗";
    default:
      return "📎";
  }
}

/** Indeterminate progress ring — Claude-style 270° arc, spinning. */
function SpinnerRing({
  size = 14,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  const stroke = size <= 14 ? 2.5 : 3;
  return (
    <svg
      className="animate-spin shrink-0"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeOpacity="0.25"
        strokeWidth={stroke}
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray="50 100"
      />
    </svg>
  );
}

/**
 * Visible banner row for in-flight / failed uploads. Bigger than a chip so
 * the user definitely sees that something is happening, even for sub-second
 * uploads (we also enforce a min 400ms display below).
 */
function PendingChip({
  item,
  onDismiss,
}: {
  item: PendingUpload;
  onDismiss: () => void;
}) {
  const isError = item.status === "error";
  // Using Tailwind built-in palette (amber / red) instead of theme tokens
  // because our `--accent` CSS var is hex, not the rgb-triplet form that
  // Tailwind's `/15` alpha-modifier requires.
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md border-2 shadow-sm ${
        isError
          ? "border-red-400 bg-red-50"
          : "border-amber-500 bg-amber-100"
      }`}
      title={isError ? item.errorMsg : "正在读取并提取文本…"}
    >
      <div className="shrink-0">
        {isError ? (
          <span className="text-lg leading-none">⚠</span>
        ) : (
          <SpinnerRing size={22} color="#D97706" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-app-fg truncate">
          {item.fileName}
        </div>
        <div
          className={`text-[11px] mt-0.5 ${
            isError ? "text-red-600" : "text-amber-800"
          }`}
        >
          {isError
            ? `失败: ${item.errorMsg ?? "未知错误"}`
            : "⏳ 上传中 — 正在提取文本"}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-app-fg/50 hover:text-app-fg/80 px-1.5"
        title="移除"
      >
        ✕
      </button>
    </div>
  );
}

export function InputArea() {
  const {
    currentInput,
    currentAttachments,
    currentSkill,
    currentModel,
    currentSessionId,
    streamingMessageId,
    setInput,
    addAttachment,
    removeAttachment,
    setSkill,
    setModel,
    sendMessage,
  } = useChatStore();

  const [models, setModels] = useState<ModelConfig[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [composing, setComposing] = useState(false); // IME state
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.getModelConfigs().then((ms) => {
      setModels(ms);
      // Default model fallback if none chosen yet
      if (!currentModel && ms.length > 0) {
        const def = ms.find((m) => m.is_default) ?? ms[0];
        setModel(def.id);
      }
    });
    api.getSkills().then(setSkills);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(200, Math.max(44, ta.scrollHeight))}px`;
  }, [currentInput]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (composing) return; // IME conversion in progress
    if (e.shiftKey) return; // Allow newline
    e.preventDefault();
    if (!streamingMessageId) void sendMessage();
  };

  /**
   * Open the Tauri native file dialog (bypasses WebView2's file-input
   * security restrictions which were silently dropping our clicks),
   * then upload each picked path through the backend.
   */
  const handlePickAndUpload = async () => {
    setMenuOpen(false);

    let picked: string | string[] | null;
    try {
      picked = await openDialog({
        multiple: true,
        filters: [
          {
            name: "Documents",
            extensions: ["pdf", "md", "txt", "docx"],
          },
        ],
      });
    } catch (e) {
      useChatStore.getState().setError(`打开文件选择器失败: ${e}`);
      return;
    }
    if (!picked) return; // user cancelled
    const paths = Array.isArray(picked) ? picked : [picked];
    await processFilePaths(paths);
  };

  const processFilePaths = async (paths: string[]) => {
    if (paths.length === 0) return;

    // STEP 1: Show pending banners IMMEDIATELY — before any await.
    const pendingItems: PendingUpload[] = paths.map((p) => {
      const fileName = p.split(/[/\\]/).pop() ?? "file";
      return {
        tempId:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `temp-${Math.random().toString(36).slice(2)}-${Date.now()}`,
        fileName,
        kind: inferKind(fileName),
        status: "uploading",
      };
    });
    setPending((p) => [...p, ...pendingItems]);

    // STEP 2: Ensure a session exists (attachments need session_id)
    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const sess = await api.createChatSession(null, currentModel);
        sessionId = sess.id;
        useChatStore.setState({ currentSessionId: sessionId });
        useChatStore.getState().loadSessions();
      } catch (e) {
        const msg = `创建会话失败: ${e}`;
        setPending((p) =>
          p.map((x) =>
            pendingItems.some((pi) => pi.tempId === x.tempId)
              ? { ...x, status: "error", errorMsg: msg }
              : x,
          ),
        );
        return;
      }
    }

    // STEP 3: Upload each in parallel
    const MIN_VISIBLE_MS = 400;
    await Promise.all(
      paths.map(async (path, i) => {
        const tempId = pendingItems[i].tempId;
        const started = Date.now();
        try {
          const att = await api.uploadChatAttachment({
            session_id: sessionId!,
            file_path: path,
          });
          const elapsed = Date.now() - started;
          if (elapsed < MIN_VISIBLE_MS) {
            await new Promise((r) => setTimeout(r, MIN_VISIBLE_MS - elapsed));
          }
          setPending((p) => p.filter((x) => x.tempId !== tempId));
          addAttachment(att);
        } catch (e) {
          const elapsed = Date.now() - started;
          if (elapsed < MIN_VISIBLE_MS) {
            await new Promise((r) => setTimeout(r, MIN_VISIBLE_MS - elapsed));
          }
          setPending((p) =>
            p.map((x) =>
              x.tempId === tempId
                ? { ...x, status: "error", errorMsg: String(e) }
                : x,
            ),
          );
        }
      }),
    );
  };

  const dismissPending = (tempId: string) =>
    setPending((p) => p.filter((x) => x.tempId !== tempId));

  return (
    <div className="border-t border-black/10 bg-white/60 px-4 py-3">
      {/* Pending banners (full-width rows during upload) */}
      {pending.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          {pending.map((p) => (
            <PendingChip
              key={p.tempId}
              item={p}
              onDismiss={() => dismissPending(p.tempId)}
            />
          ))}
        </div>
      )}

      {/* Ready attachment chips (compact horizontal row) */}
      {currentAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {currentAttachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-primary/10 text-primary border border-primary/30 max-w-[260px]"
              title={a.file_name}
            >
              <span className="shrink-0">{iconFor(a.type)}</span>
              <span className="truncate font-medium">{a.file_name}</span>
              {a.file_size != null && (
                <span className="text-primary/50 shrink-0">
                  · {formatSize(a.file_size)}
                </span>
              )}
              {a.extracted_text && (
                <span
                  className="text-emerald-600 shrink-0"
                  title="文本已提取"
                >
                  ✓
                </span>
              )}
              <button
                onClick={() => removeAttachment(a.id)}
                className="hover:text-red-600 ml-0.5 shrink-0"
                title="移除"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* + menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full border border-black/10 text-app-fg/60 hover:border-primary hover:text-primary"
            title="附件 / Skill"
          >
            +
          </button>
          {menuOpen && (
            <div
              className="absolute bottom-10 left-0 bg-white border border-black/10 rounded shadow-md min-w-44 py-1 z-20"
              onMouseLeave={() => setMenuOpen(false)}
            >
              {/* Native Tauri file dialog — WebView2 silently swallows
                  programmatic clicks on `<input type="file">` (and even
                  on label-associated clicks in some builds), so we go
                  through the dialog plugin instead. Always reliable. */}
              <button
                onClick={handlePickAndUpload}
                className="block w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5"
              >
                📎 上传附件 (.pdf/.md/.txt)
              </button>
              <div className="border-t border-black/5 my-1" />
              <div className="px-3 py-1 text-[10px] text-app-fg/50 uppercase tracking-wider">
                Skill
              </div>
              <button
                onClick={() => {
                  setSkill(null);
                  setMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-1 text-xs hover:bg-primary/5 ${
                  currentSkill === null ? "text-primary font-medium" : ""
                }`}
              >
                {currentSkill === null ? "✓ " : ""}无 Skill (普通聊天)
              </button>
              {skills.map((s) => (
                <button
                  key={s.name}
                  onClick={() => {
                    setSkill(s.name);
                    setMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-1 text-xs hover:bg-primary/5 ${
                    currentSkill === s.name ? "text-primary font-medium" : ""
                  }`}
                >
                  {currentSkill === s.name ? "✓ " : ""}
                  {s.icon ? s.icon + " " : ""}
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={currentInput}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          placeholder={
            currentSkill
              ? `[Skill: ${currentSkill}] 提问…(Enter 发送 / Shift+Enter 换行)`
              : "提问…(Enter 发送 / Shift+Enter 换行)"
          }
          rows={1}
          className="flex-1 px-3 py-2 text-sm bg-white border border-black/10 rounded resize-none focus:outline-none focus:border-primary"
          style={{ maxHeight: 200, minHeight: 44 }}
        />

        {/* Model picker */}
        <select
          value={currentModel ?? ""}
          onChange={(e) => setModel(e.target.value || null)}
          className="text-xs bg-white border border-black/10 rounded px-2 py-1 max-w-[160px]"
          title="切换模型"
        >
          {models.length === 0 && <option value="">(无模型)</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.is_default ? "★" : ""}
            </option>
          ))}
        </select>

        {/* Send / Stop */}
        <button
          onClick={() => sendMessage()}
          disabled={
            !!streamingMessageId ||
            pending.some((p) => p.status === "uploading") ||
            (!currentInput.trim() && currentAttachments.length === 0)
          }
          className={`w-9 h-9 rounded-full shrink-0 text-white flex items-center justify-center ${
            streamingMessageId
              ? "bg-app-fg/30 cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 disabled:opacity-40"
          }`}
          title={
            streamingMessageId
              ? "正在生成…"
              : pending.some((p) => p.status === "uploading")
                ? "等附件处理完成"
                : "发送"
          }
        >
          {streamingMessageId ? (
            <SpinnerRing size={14} />
          ) : pending.some((p) => p.status === "uploading") ? (
            <SpinnerRing size={14} />
          ) : (
            "↑"
          )}
        </button>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
