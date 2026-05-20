// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useRef, useState, ComponentType } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  ArrowUp,
  BookMarked,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import { api, type ModelConfig, type SkillSummary } from "../../lib/tauri";
import { useChatStore } from "../../stores/chatStore";
import { useT } from "../../hooks/useT";
import { Icon } from "../Icon";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iconFor(kind: string): ComponentType<any> {
  switch (kind) {
    case "pdf":
    case "md":
    case "txt":
    case "docx":
      return FileText;
    case "image":
      return ImageIcon;
    case "paper_ref":
      return BookMarked;
    case "url":
      return LinkIcon;
    default:
      return Paperclip;
  }
}

function PendingChip({
  item,
  onDismiss,
}: {
  item: PendingUpload;
  onDismiss: () => void;
}) {
  const t = useT();
  const isError = item.status === "error";
  const containerCls = isError
    ? "border-danger-border bg-danger-bg"
    : "border-warning-border bg-warning-bg";
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-card-sm border ${containerCls}`}
      title={isError ? item.errorMsg : t("chat.uploading")}
    >
      <div className="shrink-0">
        {isError ? (
          <Icon icon={AlertTriangle} size="sm" className="text-danger-fg" />
        ) : (
          <Icon icon={Loader2} size="sm" className="animate-spin text-warning-fg-strong" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-caption font-semibold text-fg-1 truncate">
          {item.fileName}
        </div>
        <div
          className={`text-meta mt-0.5 ${
            isError ? "text-danger-fg" : "text-warning-fg-strong"
          }`}
        >
          {isError
            ? `${item.errorMsg ?? t("errors.unknown", { detail: "" })}`
            : t("chat.uploading")}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.remove")}
        title={t("common.remove")}
        className="shrink-0 text-fg-3 hover:text-fg-1 transition-colors duration-fast ease-khx"
      >
        <Icon icon={X} size="xs" />
      </button>
    </div>
  );
}

export function InputArea() {
  const t = useT();
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
  const [composing, setComposing] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.getModelConfigs().then((ms) => {
      setModels(ms);
      if (!currentModel && ms.length > 0) {
        const def = ms.find((m) => m.is_default) ?? ms[0];
        setModel(def.id);
      }
    });
    api.getSkills().then(setSkills);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(200, Math.max(44, ta.scrollHeight))}px`;
  }, [currentInput]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;
    if (composing) return;
    if (e.shiftKey) return;
    e.preventDefault();
    if (!streamingMessageId) void sendMessage();
  };

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
      useChatStore.getState().setError(t("chat.error_open_picker", { detail: String(e) }));
      return;
    }
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    await processFilePaths(paths);
  };

  const processFilePaths = async (paths: string[]) => {
    if (paths.length === 0) return;

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

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const sess = await api.createChatSession(null, currentModel);
        sessionId = sess.id;
        useChatStore.setState({ currentSessionId: sessionId });
        useChatStore.getState().loadSessions();
      } catch (e) {
        const msg = t("chat.error_create_session", { detail: String(e) });
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
    <div className="border-t border-border-default bg-card px-6 py-4">
      {pending.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {pending.map((p) => (
            <PendingChip
              key={p.tempId}
              item={p}
              onDismiss={() => dismissPending(p.tempId)}
            />
          ))}
        </div>
      )}

      {currentAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {currentAttachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 text-meta px-2 py-1 rounded-pill bg-indigo-soft text-indigo border border-indigo-muted max-w-[260px]"
              title={a.file_name}
            >
              <Icon icon={iconFor(a.type)} size="xs" className="shrink-0" />
              <span className="truncate font-medium">{a.file_name}</span>
              {a.file_size != null && (
                <span className="text-fg-3 shrink-0">
                  · {formatSize(a.file_size)}
                </span>
              )}
              {a.extracted_text && (
                <Icon
                  icon={Check}
                  size={12}
                  className="shrink-0 text-success-fg"
                  aria-label={t("chat.attachment_text_extracted_title")}
                />
              )}
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                aria-label={t("common.remove")}
                className="hover:text-danger-fg shrink-0 transition-colors duration-fast ease-khx"
              >
                <Icon icon={X} size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("chat.menu_attachment_skill")}
            title={t("chat.menu_attachment_skill")}
            className="w-9 h-9 rounded-pill bg-card border border-border-default shadow-card-sm text-fg-2 hover:text-fg-1 hover:bg-navy-faint hover:-translate-y-px transition-[background,box-shadow,transform] duration-fast ease-khx flex items-center justify-center"
          >
            <Icon icon={Plus} size="sm" />
          </button>
          {menuOpen && (
            <div
              className="absolute bottom-12 left-0 bg-card rounded-card-sm shadow-nav min-w-48 py-2 z-popover"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                onClick={handlePickAndUpload}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-caption text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx"
              >
                <Icon icon={Paperclip} size="xs" />
                <span>{t("chat.upload_attachment")}</span>
              </button>
              <div className="border-t border-border-subtle my-1" />
              <div className="px-3 py-1 text-meta uppercase tracking-wide-brand text-fg-3">
                Skill
              </div>
              <button
                type="button"
                onClick={() => {
                  setSkill(null);
                  setMenuOpen(false);
                }}
                className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-caption hover:bg-navy-faint transition-colors duration-fast ease-khx ${
                  currentSkill === null ? "text-indigo font-medium" : "text-fg-1"
                }`}
              >
                {currentSkill === null ? (
                  <Icon icon={Check} size="xs" className="text-indigo" />
                ) : (
                  <span className="w-3.5" aria-hidden />
                )}
                <span>{t("chat.no_skill")}</span>
              </button>
              {skills.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => {
                    setSkill(s.name);
                    setMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-caption hover:bg-navy-faint transition-colors duration-fast ease-khx ${
                    currentSkill === s.name
                      ? "text-indigo font-medium"
                      : "text-fg-1"
                  }`}
                >
                  {currentSkill === s.name ? (
                    <Icon icon={Check} size="xs" className="text-indigo" />
                  ) : (
                    <span className="w-3.5" aria-hidden />
                  )}
                  {s.icon ? <span>{s.icon}</span> : null}
                  <span>{s.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={currentInput}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          placeholder={
            currentSkill
              ? t("chat.input_with_skill", { skill: currentSkill })
              : t("chat.input_placeholder")
          }
          rows={1}
          className="flex-1 px-textarea-x py-textarea-y rounded-card-sm border border-border-default bg-card text-caption text-fg-1 placeholder:text-fg-3 resize-none focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          style={{ maxHeight: 200, minHeight: 44, fontSize: "13px" }}
        />

        <div className="relative">
          <select
            value={currentModel ?? ""}
            onChange={(e) => setModel(e.target.value || null)}
            aria-label={t("chat.switch_model")}
            title={t("chat.switch_model")}
            className="appearance-none pr-8 pl-3 py-2 text-meta rounded-pill border border-border-default bg-card text-fg-1 max-w-[160px] focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          >
            {models.length === 0 && (
              <option value="">{t("chat.no_models")}</option>
            )}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.is_default ? t("chat.model_default_suffix") : ""}
              </option>
            ))}
          </select>
          <Icon
            icon={ChevronDown}
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
          />
        </div>

        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={
            !!streamingMessageId ||
            pending.some((p) => p.status === "uploading") ||
            (!currentInput.trim() && currentAttachments.length === 0)
          }
          aria-label={
            streamingMessageId
              ? t("chat.generating")
              : pending.some((p) => p.status === "uploading")
                ? t("chat.wait_for_attachment")
                : t("chat.send")
          }
          title={
            streamingMessageId
              ? t("chat.generating")
              : pending.some((p) => p.status === "uploading")
                ? t("chat.wait_for_attachment")
                : t("chat.send")
          }
          className="w-10 h-10 rounded-pill shrink-0 bg-navy text-fg-inverse shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-btn disabled:cursor-not-allowed transition-[background,box-shadow,transform] duration-fast ease-khx flex items-center justify-center"
        >
          {streamingMessageId ||
          pending.some((p) => p.status === "uploading") ? (
            <Icon icon={Loader2} size="sm" className="animate-spin" />
          ) : (
            <Icon icon={ArrowUp} size="sm" />
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
