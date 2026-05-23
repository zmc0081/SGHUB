// i18n: 本组件文案已国际化 (V2.1.0)
import { memo, useState, ComponentType } from "react";
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
  User,
} from "lucide-react";
import type {
  ChatAttachment,
  ChatMessage as ChatMessageType,
} from "../../lib/tauri";
import { useT } from "../../hooks/useT";
import { Icon } from "../Icon";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iconFor(kind: string): ComponentType<any> {
  switch (kind) {
    case "pdf":
      return FileText;
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
  onRegenerate?: () => void;
}

function MessageImpl({ message, streaming, onRegenerate }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API may be unavailable in some webview configs */
    }
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-5`}>
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-navy text-fg-inverse"
            : "bg-indigo-soft text-indigo"
        }`}
      >
        <Icon icon={isUser ? User : Bot} size="xs" />
      </div>

      <div className="flex-1 min-w-0 max-w-[calc(100%-3.5rem)] group">
        <div
          className={`rounded-card-sm px-4 py-3 inline-block max-w-full ${
            isUser
              ? "bg-navy text-fg-inverse"
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
          {message.content ? (
            <div className="chat-md prose-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {message.content}
              </ReactMarkdown>
              {streaming && (
                <span
                  aria-hidden="true"
                  className="inline-block w-1 h-4 bg-indigo ml-0.5 animate-pulse align-middle"
                />
              )}
            </div>
          ) : streaming ? (
            // V2.2.1 fix: pre-token "thinking" indicator. Bouncing dots
            // make it visually obvious that the model is busy reasoning
            // (vs. the input bubble just rendering empty).
            <span className="inline-flex items-center gap-1.5 text-caption text-fg-3">
              <span>{t("chat.msg_generating")}</span>
              <span className="inline-flex gap-0.5" aria-hidden="true">
                <span
                  className="w-1 h-1 rounded-full bg-fg-3 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1 h-1 rounded-full bg-fg-3 animate-bounce"
                  style={{ animationDelay: "120ms" }}
                />
                <span
                  className="w-1 h-1 rounded-full bg-fg-3 animate-bounce"
                  style={{ animationDelay: "240ms" }}
                />
              </span>
            </span>
          ) : (
            <span className="text-meta text-fg-3 italic">
              {t("chat.empty_message")}
            </span>
          )}
        </div>

        {!streaming && message.content && (
          <div
            className={`flex gap-3 mt-1.5 text-meta text-fg-3 opacity-0 group-hover:opacity-100 transition-opacity duration-fast ease-khx ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            <button
              type="button"
              onClick={copy}
              className="hover:text-indigo transition-colors duration-fast ease-khx"
            >
              {copied ? t("chat.msg_copied") : t("chat.msg_copy")}
            </button>
            {!isUser && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="hover:text-indigo transition-colors duration-fast ease-khx"
              >
                {t("chat.msg_regenerate")}
              </button>
            )}
            {message.model_name && (
              <span className="text-fg-3">· {message.model_name}</span>
            )}
            {message.tokens_out > 0 && (
              <span className="text-fg-3 tabular-nums">
                · {message.tokens_out} tok
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const Message = memo(MessageImpl);
