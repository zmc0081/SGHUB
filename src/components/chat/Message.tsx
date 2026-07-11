// i18n: 本组件文案已国际化 (V2.1.0; actions reworked V2.2.7)
import { memo, useState, type ComponentType, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import {
  Bot,
  BookMarked,
  Check,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Paperclip,
  Pencil,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import type {
  ChatAttachment,
  ChatMessage as ChatMessageType,
} from "../../lib/tauri";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import { confirmAsync } from "../DialogProvider";
import { Icon } from "../Icon";
import { CodeBlock } from "./CodeBlock";
import { ModelPicker } from "./ModelPicker";
import { formatDuration } from "./ThinkingIndicator";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iconFor(kind: string): ComponentType<any> {
  switch (kind) {
    case "pdf":
    case "md":
    case "txt":
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

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// react-markdown renderers: route fenced blocks through CodeBlock (own copy btn).
const MD_COMPONENTS = {
  pre: ({ children }: { children?: ReactNode }) => (
    <CodeBlock>{children}</CodeBlock>
  ),
};

function AttachmentChip({
  attachment,
  isUser,
}: {
  attachment: ChatAttachment;
  isUser: boolean;
}) {
  const t = useT();
  const previewLen = attachment.extracted_text?.length ?? 0;
  const baseCls = isUser
    ? "bg-card text-indigo border-indigo-muted"
    : "bg-soft text-fg-2 border-border-default";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-meta px-2 py-1 rounded-pill border max-w-[280px] ${baseCls}`}
      title={
        previewLen > 0
          ? t("chat.attachment_extracted_chars", {
              name: attachment.file_name,
              chars: previewLen.toLocaleString(),
            })
          : attachment.file_name
      }
    >
      <Icon icon={iconFor(attachment.type)} size="xs" className="shrink-0" />
      <span className="truncate font-medium">{attachment.file_name}</span>
      {attachment.file_size != null && (
        <span className="text-fg-3 shrink-0">
          · {formatSize(attachment.file_size)}
        </span>
      )}
      {previewLen > 0 && (
        <Icon
          icon={Check}
          size={12}
          className="shrink-0 text-success-fg"
          aria-label={t("chat.attachment_text_extracted_title")}
        />
      )}
    </span>
  );
}

interface Props {
  message: ChatMessageType;
  streaming?: boolean;
  /** AI reply: regenerate with the session model, or a different one. */
  onRegenerate?: (modelId?: string | null) => void;
  /** User message: resend after editing. */
  onEdit?: (newContent: string) => void;
  /** When set, the AI reply can toggle back to the pre-regenerate version. */
  previousVersion?: string | null;
  /** V2.2.10 (R4) — total turn duration in seconds ("耗时 …" in the meta row). */
  elapsedSec?: number;
}

function MessageImpl({
  message,
  streaming,
  onRegenerate,
  onEdit,
  previousVersion,
  elapsedSec,
}: Props) {
  const t = useT();
  const toast = useToast();
  const isUser = message.role === "user";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [showPrev, setShowPrev] = useState(false);

  const displayContent =
    showPrev && previousVersion != null ? previousVersion : message.content;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      toast.success(t("chat.msg_copied"));
    } catch {
      toast.danger(t("chat.copy_failed"));
    }
  };

  const startEdit = () => {
    setDraft(message.content);
    setEditing(true);
  };

  const submitEdit = async () => {
    const next = draft.trim();
    if (!next || next === message.content.trim()) {
      setEditing(false);
      return;
    }
    const ok = await confirmAsync({
      title: t("chat.edit_resend_confirm_title"),
      description: t("chat.edit_resend_confirm"),
      confirmLabel: t("chat.edit_resend_button"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    setEditing(false);
    onEdit?.(next);
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-5`}>
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isUser ? "bg-navy text-fg-inverse" : "bg-indigo-soft text-indigo"
        }`}
      >
        <Icon icon={isUser ? User : Bot} size="xs" />
      </div>

      <div className="flex-1 min-w-0 max-w-[calc(100%-3.5rem)] group">
        {editing ? (
          <div className="rounded-card-sm border border-border-focus bg-card p-3 shadow-card-sm">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="w-full px-2 py-1.5 rounded-sm border border-border-default bg-card text-caption text-fg-1 resize-y focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
              style={{ fontSize: "13px", minHeight: 64 }}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 h-7 px-3 rounded-pill border border-border-default text-meta text-fg-2 hover:bg-navy-faint transition-colors duration-fast ease-khx"
              >
                <Icon icon={X} size="xs" />
                <span>{t("common.cancel")}</span>
              </button>
              <button
                type="button"
                onClick={submitEdit}
                className="inline-flex items-center gap-1 h-7 px-3 rounded-pill bg-navy text-fg-inverse text-meta font-medium shadow-btn hover:bg-navy-hover transition-colors duration-fast ease-khx"
              >
                <Icon icon={RefreshCw} size="xs" />
                <span>{t("chat.edit_resend_button")}</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-card-sm px-4 py-3 inline-block max-w-full ${
              isUser
                ? "bg-indigo-soft text-fg-1 border border-indigo-muted"
                : "bg-card border border-border-default text-fg-1 shadow-card-sm"
            }`}
          >
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {message.attachments.map((a) => (
                  <AttachmentChip key={a.id} attachment={a} isUser={isUser} />
                ))}
              </div>
            )}
            {displayContent ? (
              <div className="chat-md prose-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={MD_COMPONENTS}
                >
                  {displayContent}
                </ReactMarkdown>
                {streaming && (
                  <span
                    aria-hidden="true"
                    className="inline-block w-1 h-4 bg-indigo ml-0.5 animate-pulse align-middle"
                  />
                )}
              </div>
            ) : streaming ? (
              <span className="inline-flex items-center gap-1.5 text-caption text-fg-3">
                <span>{t("chat.msg_generating")}</span>
                <span className="inline-flex gap-0.5" aria-hidden="true">
                  <span className="w-1 h-1 rounded-full bg-fg-3 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1 h-1 rounded-full bg-fg-3 animate-bounce" style={{ animationDelay: "120ms" }} />
                  <span className="w-1 h-1 rounded-full bg-fg-3 animate-bounce" style={{ animationDelay: "240ms" }} />
                </span>
              </span>
            ) : (
              <span className="text-meta text-fg-3 italic">
                {t("chat.empty_message")}
              </span>
            )}
          </div>
        )}

        {!editing && !streaming && message.content && (
          <div
            className={`flex items-center gap-3 mt-1.5 text-meta text-fg-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-fast ease-khx ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 hover:text-indigo transition-colors duration-fast ease-khx"
            >
              <span>{t("chat.msg_copy")}</span>
            </button>

            {isUser && onEdit && (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1 hover:text-indigo transition-colors duration-fast ease-khx"
              >
                <Icon icon={Pencil} size={12} />
                <span>{t("chat.msg_edit_resend")}</span>
              </button>
            )}

            {!isUser && onRegenerate && (
              <>
                <button
                  type="button"
                  onClick={() => onRegenerate()}
                  className="inline-flex items-center gap-1 hover:text-indigo transition-colors duration-fast ease-khx"
                >
                  <Icon icon={RefreshCw} size={12} />
                  <span>{t("chat.msg_regenerate")}</span>
                </button>
                <ModelPicker
                  value={null}
                  placeholder={t("chat.msg_regenerate_with")}
                  size="sm"
                  placement="down"
                  onChange={(id) => onRegenerate(id)}
                />
                {previousVersion != null && (
                  <button
                    type="button"
                    onClick={() => setShowPrev((v) => !v)}
                    className="hover:text-indigo transition-colors duration-fast ease-khx"
                  >
                    {showPrev
                      ? t("chat.msg_show_current")
                      : t("chat.msg_show_previous")}
                  </button>
                )}
              </>
            )}

            {message.model_name && (
              <span className="text-fg-3">· {message.model_name}</span>
            )}
            {message.tokens_out > 0 && (
              <span className="text-fg-3 tabular-nums">
                · {message.tokens_out} tok
              </span>
            )}
            {/* V2.2.10 (R4) — total turn duration. */}
            {!isUser && elapsedSec != null && (
              <span className="text-fg-3 tabular-nums">
                · {t("chat.msg_elapsed", { duration: formatDuration(elapsedSec, t) })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const Message = memo(MessageImpl);
