// i18n: 本组件文案已国际化 (V2.1.0; composer reworked V2.2.7).
// Claude-web-style composer: attachment/Skill chips on top, an auto-growing
// textarea, and a bottom toolbar (attach / Skill / model picker / send-stop).
// V2.2.7 Session 41: image attachments (vision) + "/" slash Skill palette.
import { useEffect, useRef, useState, ComponentType } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  ArrowUp,
  BookMarked,
  Check,
  Command,
  CornerDownLeft,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Paperclip,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { api, type ModelConfig, type SkillSummary } from "../../lib/tauri";
import { useChatStore } from "../../stores/chatStore";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import { Icon } from "../Icon";
import { ModelPicker } from "./ModelPicker";

const ENTER_TO_SEND_KEY = "chat.enterToSend";
const IMG_RE = /\.(png|jpe?g|gif|webp)$/i;

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

/** Heuristic: can this model accept image input? Anthropic (Claude 3+) and
 *  SG AI Store always; Ollama no (most local models are text-only); OpenAI /
 *  custom by model-id keyword. */
function modelSupportsVision(m?: ModelConfig): boolean {
  if (!m) return false;
  if (m.is_sg_ai_store || m.provider === "anthropic") return true;
  if (m.provider === "ollama") return false;
  return /4o|gpt-4|gpt-5|vision|o1|o3|claude|gemini|llava|pixtral/i.test(
    m.model_id,
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
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
          {isError ? item.errorMsg ?? "" : t("chat.uploading")}
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
  const toast = useToast();
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
    stopStreaming,
  } = useChatStore();

  const [models, setModels] = useState<ModelConfig[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [enterToSend, setEnterToSend] = useState(
    () => localStorage.getItem(ENTER_TO_SEND_KEY) !== "false",
  );
  // "/" slash palette
  const [slashIndex, setSlashIndex] = useState(0);
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

  const currentModelObj = models.find((m) => m.id === currentModel);
  const visionOk = modelSupportsVision(currentModelObj);

  // Slash palette is active when the input is a single "/word" token.
  const slashActive =
    currentInput.startsWith("/") &&
    !currentInput.includes(" ") &&
    !currentInput.includes("\n");
  const slashQuery = slashActive ? currentInput.slice(1).toLowerCase() : "";
  const slashSkills = slashActive
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(slashQuery) ||
          s.display_name.toLowerCase().includes(slashQuery),
      )
    : [];

  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery, slashActive]);

  const pickSlashSkill = (name: string) => {
    setSkill(name);
    setInput("");
  };

  const uploadingNow = pending.some((p) => p.status === "uploading");
  const canSend =
    !streamingMessageId &&
    !uploadingNow &&
    (currentInput.trim().length > 0 || currentAttachments.length > 0);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (composing) return;
    // Slash palette keyboard nav takes priority.
    if (slashActive && slashSkills.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashSkills.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashSkills.length) % slashSkills.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        pickSlashSkill(slashSkills[slashIndex].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInput("");
        return;
      }
    }
    if (e.key !== "Enter") return;
    const shouldSend = enterToSend ? !e.shiftKey : e.metaKey || e.ctrlKey;
    if (!shouldSend) return;
    e.preventDefault();
    if (canSend) void sendMessage();
  };

  const toggleEnter = () => {
    const next = !enterToSend;
    setEnterToSend(next);
    localStorage.setItem(ENTER_TO_SEND_KEY, String(next));
  };

  const onModelChange = (id: string) => {
    setModel(id);
    if (currentSessionId) {
      void api.setChatSessionModel(currentSessionId, id).catch(() => {});
    }
  };

  const handlePickAndUpload = async () => {
    let picked: string | string[] | null;
    try {
      picked = await openDialog({
        multiple: true,
        filters: [
          {
            name: "Documents & Images",
            extensions: ["pdf", "md", "txt", "docx", "png", "jpg", "jpeg", "gif", "webp"],
          },
        ],
      });
    } catch (e) {
      useChatStore.getState().setError(t("chat.error_open_picker", { detail: String(e) }));
      return;
    }
    if (!picked) return;
    let paths = Array.isArray(picked) ? picked : [picked];
    // Drop images when the current model can't see them, with a heads-up.
    if (!visionOk && paths.some((p) => IMG_RE.test(p))) {
      paths = paths.filter((p) => !IMG_RE.test(p));
      toast.info(t("chat.image_not_supported"));
    }
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

  const iconBtn =
    "w-8 h-8 rounded-pill border border-border-default bg-card text-fg-2 hover:text-indigo hover:border-indigo flex items-center justify-center transition-colors duration-fast ease-khx";

  return (
    <div className="px-6 py-4 border-t border-border-default bg-page">
      <div className="relative rounded-card border border-border-default bg-card shadow-card-sm focus-within:border-border-focus focus-within:shadow-focus transition-[border-color,box-shadow] duration-fast ease-khx">
        {/* "/" slash Skill palette */}
        {slashActive && slashSkills.length > 0 && (
          <div className="absolute bottom-full mb-2 left-0 right-0 z-dropdown max-h-[260px] overflow-y-auto rounded-card-sm border border-border-default bg-card shadow-nav py-1.5">
            <div className="px-3 py-1 text-micro uppercase tracking-wide-brand text-fg-3">
              {t("chat.slash_pick_skill")}
            </div>
            {slashSkills.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onMouseEnter={() => setSlashIndex(i)}
                onClick={() => pickSlashSkill(s.name)}
                className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-meta transition-colors duration-fast ease-khx ${
                  i === slashIndex
                    ? "bg-navy-faint text-indigo font-medium"
                    : "text-fg-1 hover:bg-navy-faint"
                }`}
              >
                <Icon icon={Sparkles} size="xs" className="shrink-0 text-indigo" />
                <span className="truncate">{s.display_name}</span>
                <span className="ml-auto shrink-0 text-fg-3 font-mono text-micro">
                  /{s.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Pending uploads */}
        {pending.length > 0 && (
          <div className="flex flex-col gap-2 px-3 pt-3">
            {pending.map((p) => (
              <PendingChip
                key={p.tempId}
                item={p}
                onDismiss={() => dismissPending(p.tempId)}
              />
            ))}
          </div>
        )}

        {/* Attachment chips + active skill tag */}
        {(currentAttachments.length > 0 || currentSkill) && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {currentSkill && (
              <span className="inline-flex items-center gap-1.5 text-meta px-2 py-1 rounded-pill bg-indigo-soft text-indigo border border-indigo-muted">
                <Icon icon={Sparkles} size="xs" className="shrink-0" />
                <span className="font-medium">
                  {t("chat.skill_tag", { skill: currentSkill })}
                </span>
                <button
                  type="button"
                  onClick={() => setSkill(null)}
                  aria-label={t("common.remove")}
                  className="hover:text-danger-fg shrink-0 transition-colors duration-fast ease-khx"
                >
                  <Icon icon={X} size={12} />
                </button>
              </span>
            )}
            {currentAttachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 text-meta px-2 py-1 rounded-pill bg-soft text-fg-2 border border-border-default max-w-[260px]"
                title={a.file_name}
              >
                <Icon icon={iconFor(a.type)} size="xs" className="shrink-0" />
                <span className="truncate font-medium">{a.file_name}</span>
                {a.file_size != null && (
                  <span className="text-fg-3 shrink-0">· {formatSize(a.file_size)}</span>
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

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={currentInput}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          placeholder={t("chat.input_placeholder")}
          rows={1}
          className="w-full px-4 pt-3 pb-2 bg-transparent text-caption text-fg-1 placeholder:text-fg-3 resize-none focus:outline-none"
          style={{ maxHeight: 200, minHeight: 44, fontSize: "13px" }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePickAndUpload}
              aria-label={t("chat.upload_attachment")}
              title={t("chat.upload_attachment")}
              className={iconBtn}
            >
              <Icon icon={Paperclip} size="sm" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSkillMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={skillMenuOpen}
                aria-label="Skill"
                title={t("chat.slash_hint")}
                className={`${iconBtn} ${currentSkill ? "text-indigo border-indigo" : ""}`}
              >
                <Icon icon={Command} size="sm" />
              </button>
              {skillMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-dropdown"
                    onClick={() => setSkillMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    className="absolute bottom-full mb-1 left-0 z-dropdown min-w-[200px] max-h-[300px] overflow-y-auto rounded-card-sm border border-border-default bg-card shadow-nav py-1.5"
                  >
                    <div className="px-3 py-1 text-micro uppercase tracking-wide-brand text-fg-3">
                      Skill
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSkill(null);
                        setSkillMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-meta hover:bg-navy-faint transition-colors duration-fast ease-khx ${
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
                          setSkillMenuOpen(false);
                        }}
                        className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-meta hover:bg-navy-faint transition-colors duration-fast ease-khx ${
                          currentSkill === s.name ? "text-indigo font-medium" : "text-fg-1"
                        }`}
                      >
                        {currentSkill === s.name ? (
                          <Icon icon={Check} size="xs" className="text-indigo" />
                        ) : (
                          <span className="w-3.5" aria-hidden />
                        )}
                        <span className="truncate">{s.display_name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <ModelPicker value={currentModel} onChange={onModelChange} />

            <button
              type="button"
              onClick={toggleEnter}
              aria-label={t(enterToSend ? "chat.enter_sends_on" : "chat.enter_sends_off")}
              title={t(enterToSend ? "chat.enter_sends_on" : "chat.enter_sends_off")}
              className={`${iconBtn} ${enterToSend ? "text-indigo border-indigo" : ""}`}
            >
              <Icon icon={CornerDownLeft} size="sm" />
            </button>
          </div>

          {streamingMessageId ? (
            <button
              type="button"
              onClick={() => void stopStreaming()}
              aria-label={t("chat.stop")}
              title={t("chat.stop")}
              className="w-8 h-8 rounded-pill shrink-0 bg-navy text-fg-inverse shadow-btn hover:bg-navy-hover transition-colors duration-fast ease-khx flex items-center justify-center"
            >
              <Icon icon={Square} size="xs" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!canSend}
              aria-label={uploadingNow ? t("chat.wait_for_attachment") : t("chat.send")}
              title={uploadingNow ? t("chat.wait_for_attachment") : t("chat.send")}
              className="w-8 h-8 rounded-pill shrink-0 bg-navy text-fg-inverse shadow-btn hover:bg-navy-hover hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-[background,box-shadow,transform] duration-fast ease-khx flex items-center justify-center"
            >
              {uploadingNow ? (
                <Icon icon={Loader2} size="sm" className="animate-spin" />
              ) : (
                <Icon icon={ArrowUp} size="sm" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
