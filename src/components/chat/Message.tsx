import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import type {
  ChatAttachment,
  ChatMessage as ChatMessageType,
} from "../../lib/tauri";

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
  const previewLen = attachment.extracted_text?.length ?? 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border max-w-[280px] ${
        isUser
          ? "bg-white text-primary border-primary/30"
          : "bg-slate-50 text-app-fg/80 border-black/10"
      }`}
      title={
        previewLen > 0
          ? `${attachment.file_name} · 已提取 ${previewLen.toLocaleString()} 字符内容供模型参考`
          : attachment.file_name
      }
    >
      <span className="shrink-0">{iconFor(attachment.type)}</span>
      <span className="truncate font-medium">{attachment.file_name}</span>
      {attachment.file_size != null && (
        <span className="text-app-fg/40 shrink-0">
          · {formatSize(attachment.file_size)}
        </span>
      )}
      {previewLen > 0 && (
        <span className="text-emerald-600 shrink-0" title="文本内容已提取并发送给模型">
          ✓
        </span>
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
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore — clipboard API might not be available in some webview configs
    }
  };

  return (
    <div
      className={`flex gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      } mb-4`}
    >
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
          isUser
            ? "bg-primary text-white"
            : "bg-accent/20 text-app-fg"
        }`}
      >
        {isUser ? "我" : "🤖"}
      </div>

      {/* Bubble */}
      <div className={`flex-1 min-w-0 max-w-[calc(100%-3.5rem)]`}>
        <div
          className={`group rounded-lg px-3 py-2 inline-block max-w-full ${
            isUser
              ? "bg-primary/10 text-app-fg"
              : "bg-white border border-black/10 text-app-fg"
          }`}
        >
          {/* Attachment chips (above content) */}
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
                <span className="inline-block w-1 h-3 bg-primary/60 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          ) : streaming ? (
            <span className="text-xs text-app-fg/50 animate-pulse">
              正在生成…
            </span>
          ) : (
            <span className="text-xs text-app-fg/40 italic">(空消息)</span>
          )}
        </div>

        {/* Action bar */}
        {!streaming && message.content && (
          <div
            className={`flex gap-1 mt-1 text-[10px] text-app-fg/40 opacity-0 group-hover:opacity-100 transition-opacity ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            <button onClick={copy} className="hover:text-primary px-1">
              {copied ? "✓ 已复制" : "复制"}
            </button>
            {!isUser && onRegenerate && (
              <button onClick={onRegenerate} className="hover:text-primary px-1">
                重新生成
              </button>
            )}
            {message.model_name && (
              <span className="ml-1 text-app-fg/30">
                · {message.model_name}
              </span>
            )}
            {message.tokens_out > 0 && (
              <span className="text-app-fg/30">
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
