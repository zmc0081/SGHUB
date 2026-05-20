/**
 * Chat.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for /chat (对话 / Chat).
 *
 * Layout: 3-region (session list + main message scroll + bottom-pinned input)
 *   ┌─────────────────┬───────────────────────────────────────┐
 *   │ SessionList     │  Chat header (title + meta)            │
 *   │ w-session-list  │  ────────────────────────────────────  │
 *   │ 240px           │                                        │
 *   │                 │  Messages (scroll)                     │
 *   │                 │                                        │
 *   │                 │  ────────────────────────────────────  │
 *   │                 │  InputArea (bottom-pinned)             │
 *   └─────────────────┴───────────────────────────────────────┘
 *
 * Key visuals:
 *   - User bubble: bg-navy text-text-inverse, right-aligned
 *   - AI bubble:   shadow-card-sm bg-card border, left-aligned, markdown renders inside
 *   - SpinnerRing: 270° gap rotating ring (Claude-style), inline SVG
 *   - + button popover: anchored above the + button, contains "📎 Upload attachment" + skill list
 *   - Attachment chip three states: uploading / done / failed
 *
 * Streaming cursor: <span class="inline-block w-1 h-4 bg-indigo align-middle
 *   ml-0.5 animate-pulse" aria-hidden /> — same convention as Parse.
 */

import {
  Plus,
  ArrowUp,
  Loader2,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Copy,
  RefreshCw,
  Paperclip,
  Sparkles,
  X,
  Check,
  Bot,
  User,
  FileText,
  AlertTriangle,
  MessageSquarePlus,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';
// import { useChatStore } from '@/stores/chatStore';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

interface ChatSession {
  id: string;
  title: string;
  pinned: boolean;
  messageCount: number;
  lastUpdatedRelative: string;
}

interface Attachment {
  id: string;
  filename: string;
  sizeBytes: number;
  /** Upload lifecycle state */
  state: 'uploading' | 'done' | 'failed';
  errorMessage?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: Attachment[];
  modelUsed?: string;
  tokenCount?: number;
  isStreaming?: boolean;
}

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_SESSIONS: ChatSession[] = [
  { id: 's1', title: 'Transformer 架构讨论', pinned: true, messageCount: 14, lastUpdatedRelative: '10 分钟前' },
  { id: 's2', title: '实验设计建议', pinned: true, messageCount: 8, lastUpdatedRelative: '昨天' },
  { id: 's3', title: 'CRISPR-Cas13d 综述', pinned: false, messageCount: 22, lastUpdatedRelative: '2 天前' },
  { id: 's4', title: 'BERT vs T5 对比', pinned: false, messageCount: 6, lastUpdatedRelative: '上周' },
  { id: 's5', title: '研究方法论梳理', pinned: false, messageCount: 11, lastUpdatedRelative: '3 周前' },
];

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    content: '帮我对比一下 Transformer 与 RNN 在长序列建模上的差异。',
  },
  {
    id: 'm2',
    role: 'assistant',
    content: `好的,主要差异可以分三个维度看:

**1. 计算复杂度**
- RNN: 顺序计算,O(n) 时间,但每步依赖前一步,无法并行
- Transformer: self-attention 是 O(n²),但所有位置可并行计算

**2. 长距离依赖**
- RNN: 信息要通过 hidden state 一步步传递,长距离梯度容易消失
- Transformer: 任意两个位置直接 attention,长距离依赖天然友好

**3. 上下文长度**
- RNN: 理论无限,但实际受梯度消失限制
- Transformer: 受 O(n²) 复杂度限制,通常 ≤ 几千 tokens(除非用 sparse 等技巧)

需要我深入讲哪一点?`,
    modelUsed: 'claude-opus-4-7',
    tokenCount: 312,
  },
  {
    id: 'm3',
    role: 'user',
    content: '深入讲计算复杂度,顺便结合这两篇论文的实验数据。',
    attachments: [
      { id: 'a1', filename: 'attention-is-all-you-need.pdf', sizeBytes: 2_400_000, state: 'done' },
      { id: 'a2', filename: 'efficient-transformers-survey.pdf', sizeBytes: 3_100_000, state: 'done' },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// SpinnerRing (Claude-style 270° rotating ring)
// SVG approach so width/height/stroke are precisely controllable.
// ───────────────────────────────────────────────────────────────────────────────

/**
 * SpinnerRing — minimum 400ms visible enforced in Step (logic).
 * Width 12px, color inherits from currentColor.
 */
function SpinnerRing({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="42 18"
      />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)}KB`;
  return `${bytes}B`;
}

// ───────────────────────────────────────────────────────────────────────────────
// Session list (left sidebar)
// ───────────────────────────────────────────────────────────────────────────────

function SessionListItem({
  session,
  selected,
}: {
  session: ChatSession;
  selected: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        className={`
          group w-full text-left px-3 py-2 rounded-card-sm
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
          ${selected
            ? 'bg-navy-soft'
            : 'hover:bg-navy-faint'}
        `}
      >
        <div className="flex items-start gap-2">
          <MessageSquare size={14} strokeWidth={1.5} aria-hidden className="text-fg-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-caption text-fg-1 truncate font-medium">{session.title}</p>
            <p className="text-micro text-fg-3 mt-0.5 tabular-nums">
              {session.messageCount} 条 · {session.lastUpdatedRelative}
            </p>
          </div>
        </div>

        {/* Hover-revealed actions */}
        <div className="
          flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100
          transition-opacity duration-fast ease-khx
        ">
          <button
            type="button"
            aria-label={session.pinned ? 'Unpin session' : 'Pin session'}
            className="
              p-1 rounded-pill text-fg-2
              hover:text-indigo hover:bg-indigo-soft
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            {session.pinned ? (
              <PinOff size={11} strokeWidth={1.5} aria-hidden />
            ) : (
              <Pin size={11} strokeWidth={1.5} aria-hidden />
            )}
          </button>
          <button
            type="button"
            aria-label="Rename"
            className="
              p-1 rounded-pill text-fg-2
              hover:text-indigo hover:bg-indigo-soft
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <Pencil size={11} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Delete"
            className="
              p-1 rounded-pill text-fg-2
              hover:text-danger-fg hover:bg-danger-bg
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <Trash2 size={11} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </button>
    </li>
  );
}

function SessionList({
  sessions,
  selectedId,
}: {
  sessions: ChatSession[];
  selectedId: string | null;
}) {
  const pinned = sessions.filter((s) => s.pinned);
  const recent = sessions.filter((s) => !s.pinned);

  return (
    <aside
      aria-label="Chat sessions"
      className="
        w-session-list border-r border-border-default
        flex flex-col bg-card
      "
    >
      {/* New chat button */}
      <div className="px-3 pt-4 pb-3 border-b border-border-default">
        <button
          type="button"
          className="
            w-full inline-flex items-center justify-center gap-2 px-btn-x py-btn-y rounded-pill
            bg-navy text-text-inverse text-caption font-medium
            shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
            active:bg-navy-active active:translate-y-0
            transition-[background,box-shadow,transform] duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
          "
        >
          <MessageSquarePlus size={16} strokeWidth={1.5} aria-hidden />
          <span>新建对话</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sessions.length === 0 ? (
          <p className="text-meta text-fg-3 italic px-3 py-4 text-center">
            还没有对话
          </p>
        ) : (
          <>
            {pinned.length > 0 && (
              <section className="mb-4">
                <h3 className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3 px-3 mb-2">
                  置顶
                </h3>
                <ul className="space-y-0.5">
                  {pinned.map((s) => (
                    <SessionListItem key={s.id} session={s} selected={s.id === selectedId} />
                  ))}
                </ul>
              </section>
            )}

            {recent.length > 0 && (
              <section>
                <h3 className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3 px-3 mb-2">
                  最近
                </h3>
                <ul className="space-y-0.5">
                  {recent.map((s) => (
                    <SessionListItem key={s.id} session={s} selected={s.id === selectedId} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </nav>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Message bubbles
// ───────────────────────────────────────────────────────────────────────────────

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const stateClasses = {
    uploading: 'border-warning-border bg-warning-bg text-warning-fg-strong',
    done:      'border-border-default bg-card text-fg-1',
    failed:    'border-danger-border bg-danger-bg text-danger-fg',
  }[attachment.state];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill border
        text-meta font-medium ${stateClasses}
        transition-colors duration-fast ease-khx
      `}
    >
      {attachment.state === 'uploading' && <SpinnerRing size={12} />}
      {attachment.state === 'done' && (
        <Check size={12} strokeWidth={2} aria-hidden className="text-success-fg" />
      )}
      {attachment.state === 'failed' && (
        <X size={12} strokeWidth={2} aria-hidden />
      )}
      <FileText size={12} strokeWidth={1.5} aria-hidden />
      <span className="font-mono truncate max-w-[180px]">{attachment.filename}</span>
      <span className="text-fg-3 tabular-nums">{formatSize(attachment.sizeBytes)}</span>
    </span>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="flex-1 max-w-[640px]">
        <div className="
          inline-block bg-navy text-text-inverse rounded-card
          px-5 py-3.5
          max-w-full
        ">
          <p className="text-body leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Attachments below the bubble */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 justify-end">
            {message.attachments.map((att) => (
              <AttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        )}
      </div>

      <div className="
        flex-shrink-0 w-7 h-7 rounded-full
        bg-navy flex items-center justify-center
        text-text-inverse
      ">
        <User size={14} strokeWidth={1.5} aria-hidden />
      </div>
    </div>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3">
      <div className="
        flex-shrink-0 w-7 h-7 rounded-full
        bg-indigo-soft text-indigo
        flex items-center justify-center
      ">
        <Bot size={14} strokeWidth={1.5} aria-hidden />
      </div>

      <div className="flex-1 max-w-[640px]">
        <article className="
          group rounded-card bg-card shadow-card-sm border border-border-default
          px-5 py-3.5
        ">
          {/* TODO: replace with <ReactMarkdown> + remark-gfm + rehype-highlight.
              For draft, content rendered as plain text with paragraph breaks. */}
          <div className="text-body text-fg-1 leading-relaxed whitespace-pre-wrap">
            {message.content}
            {message.isStreaming && (
              <span
                aria-hidden
                className="inline-block w-1 h-4 bg-indigo align-middle ml-0.5 animate-pulse"
              />
            )}
          </div>

          {/* Hover-revealed actions */}
          {!message.isStreaming && (
            <div className="
              flex items-center gap-3 mt-3 pt-3 border-t border-border-subtle
              opacity-0 group-hover:opacity-100
              transition-opacity duration-fast ease-khx
            ">
              <button
                type="button"
                aria-label="Copy"
                className="
                  inline-flex items-center gap-1 text-meta text-fg-2
                  hover:text-indigo
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:underline
                "
              >
                <Copy size={12} strokeWidth={1.5} aria-hidden />
                <span>复制</span>
              </button>
              <button
                type="button"
                aria-label="Regenerate"
                className="
                  inline-flex items-center gap-1 text-meta text-fg-2
                  hover:text-indigo
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:underline
                "
              >
                <RefreshCw size={12} strokeWidth={1.5} aria-hidden />
                <span>重新生成</span>
              </button>
              {message.modelUsed && message.tokenCount && (
                <span className="ml-auto text-micro text-fg-3 font-mono tabular-nums">
                  {message.modelUsed} · {message.tokenCount} tok
                </span>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Chat header
// ───────────────────────────────────────────────────────────────────────────────

function ChatHeader({
  title,
  messageCount,
  isStreaming,
}: {
  title: string;
  messageCount: number;
  isStreaming?: boolean;
}) {
  return (
    <header className="
      flex-shrink-0 h-9 flex items-center justify-between
      px-6 border-b border-border-default
    ">
      <h1 className="text-caption font-semibold text-fg-1 truncate">{title}</h1>
      <p className="text-meta text-fg-3 tabular-nums flex items-center gap-2">
        <span>{messageCount} 条消息</span>
        {isStreaming && (
          <>
            <span className="text-fg-3">·</span>
            <span className="inline-flex items-center gap-1 text-indigo font-medium">
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full bg-indigo animate-pulse"
              />
              <span>正在生成…</span>
            </span>
          </>
        )}
      </p>
    </header>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Input area (bottom-pinned)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * + button popover content:
 *   - Upload attachment (Paperclip)
 *   - Skill list (Sparkles)
 */
function PlusMenu() {
  return (
    <div
      role="menu"
      aria-label="Insert content"
      className="
        absolute bottom-full left-0 mb-2
        w-60 rounded-card-sm bg-card shadow-nav
        border border-border-default
        py-2 z-popover
      "
    >
      <button
        type="button"
        role="menuitem"
        className="
          w-full flex items-center gap-3 px-4 py-2 text-left
          text-caption text-fg-1
          hover:bg-navy-faint
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:bg-navy-faint
        "
      >
        <Paperclip size={14} strokeWidth={1.5} aria-hidden className="text-fg-2" />
        <span>上传附件</span>
      </button>
      <div className="border-t border-border-default my-1" />
      <p className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3 px-4 py-1.5">
        使用 Skill
      </p>
      {['paper-deep-read', 'methodology-extractor', 'quick-summary'].map((s) => (
        <button
          key={s}
          type="button"
          role="menuitem"
          className="
            w-full flex items-center gap-3 px-4 py-2 text-left
            text-caption text-fg-1
            hover:bg-navy-faint
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:bg-navy-faint
          "
        >
          <Sparkles size={14} strokeWidth={1.5} aria-hidden className="text-indigo" />
          <span className="font-mono">{s}</span>
        </button>
      ))}
    </div>
  );
}

function InputArea({
  pendingAttachments,
  isPlusMenuOpen,
  isStreaming,
  isUploading,
  selectedModel,
}: {
  pendingAttachments: Attachment[];
  isPlusMenuOpen?: boolean;
  isStreaming?: boolean;
  isUploading?: boolean;
  selectedModel: string;
}) {
  return (
    <div className="
      flex-shrink-0 border-t border-border-default
      bg-card
      px-6 py-4
    ">
      <div className="max-w-[800px] mx-auto">
        {/* Pending attachments row */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {pendingAttachments.map((att) => (
              <AttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        )}

        {/* Main input row */}
        <div className="flex items-end gap-3">
          {/* + button (with optional popover) */}
          <div className="relative flex-shrink-0">
            {isPlusMenuOpen && <PlusMenu />}
            <button
              type="button"
              aria-label="Insert content"
              aria-expanded={isPlusMenuOpen}
              className={`
                w-8 h-8 rounded-full border border-border-default
                bg-card text-fg-2
                flex items-center justify-center flex-shrink-0
                hover:border-navy-muted hover:bg-navy-faint hover:text-fg-1
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
                ${isPlusMenuOpen ? 'bg-navy-faint border-navy-muted text-fg-1' : ''}
              `}
            >
              <Plus size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              aria-label="Message"
              placeholder="输入消息(Enter 发送 / Shift+Enter 换行)"
              rows={1}
              className="
                w-full pl-textarea-x pr-textarea-x py-textarea-y rounded-card-sm border border-border-default
                bg-card text-body text-fg-1 placeholder:text-fg-3
                resize-none min-h-[44px] max-h-[200px]
                focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                transition-shadow duration-fast ease-khx
              "
            />
          </div>

          {/* Model select */}
          <div className="relative flex-shrink-0">
            <div className="
              inline-flex items-center gap-1.5 pl-3 pr-7 py-2 rounded-pill border border-border-default
              bg-card text-meta text-fg-1 font-mono w-[160px]
              cursor-pointer hover:border-navy-muted hover:bg-navy-faint
              transition-colors duration-fast ease-khx
            ">
              <Bot size={12} strokeWidth={1.5} aria-hidden className="text-indigo flex-shrink-0" />
              <span className="truncate">{selectedModel}</span>
            </div>
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              aria-hidden
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
            />
          </div>

          {/* Send button — three states: idle / streaming / uploading */}
          <button
            type="button"
            aria-label={isStreaming ? 'Streaming…' : isUploading ? 'Uploading…' : 'Send message'}
            disabled={isStreaming || isUploading}
            className="
              w-9 h-9 rounded-full
              bg-navy text-text-inverse
              flex items-center justify-center flex-shrink-0
              shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
              active:bg-navy-active active:translate-y-0
              disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-navy disabled:hover:shadow-btn disabled:hover:translate-y-0
              transition-[background,box-shadow,transform] duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
            "
          >
            {isStreaming || isUploading ? (
              <Loader2 size={16} strokeWidth={1.5} aria-hidden className="animate-spin" />
            ) : (
              <ArrowUp size={16} strokeWidth={1.5} aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — happy path: session selected, 3 messages, idle input
// ═══════════════════════════════════════════════════════════════════════════════

export default function ChatPage() {
  // TODO: from useChatStore()
  const sessions = MOCK_SESSIONS;
  const selectedSessionId = 's1';
  const session = sessions.find((s) => s.id === selectedSessionId);
  const messages = MOCK_MESSAGES;

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SessionList sessions={sessions} selectedId={selectedSessionId} />

      <section className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          title={session?.title ?? '对话'}
          messageCount={messages.length}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[800px] mx-auto flex flex-col gap-6">
            {messages.map((m) =>
              m.role === 'user' ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AssistantMessage key={m.id} message={m} />
              ),
            )}
          </div>
        </div>

        <InputArea
          pendingAttachments={[]}
          selectedModel="claude-opus-4-7"
        />
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY — no session selected (or first run, no sessions exist)
// ═══════════════════════════════════════════════════════════════════════════════

export function ChatPageEmptyNoSession() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SessionList sessions={[]} selectedId={null} />

      <section className="flex-1 flex flex-col min-w-0">
        {/* No ChatHeader since no session selected */}

        <div className="flex-1 overflow-y-auto px-6 py-12 flex items-center justify-center">
          <div className="
            relative overflow-hidden rounded-card bg-stage-gradient
            py-16 px-12 text-center w-full max-w-2xl
          ">
            <div
              aria-hidden
              className="absolute -top-20 -right-20 w-96 h-96 rounded-full pointer-events-none"
              style={{ background: 'var(--glow-purple)' }}
            />
            <div
              aria-hidden
              className="absolute -bottom-20 -left-16 w-96 h-96 rounded-full pointer-events-none"
              style={{ background: 'var(--glow-blue)' }}
            />

            <div className="relative z-10">
              <MessageSquarePlus
                size={64}
                strokeWidth={1.5}
                aria-hidden
                className="mx-auto text-indigo opacity-60"
              />
              <h2 className="text-h3 font-semibold text-fg-1 mt-6">
                选好模型 / Skill / 附件,在下方输入开始对话
              </h2>
              <p className="text-caption text-fg-2 mt-2 max-w-md mx-auto leading-relaxed">
                Chat 对话与 Skill 解析、文献库打通 —— 可以让 AI 直接基于你已收藏的文献回答问题。
              </p>
            </div>
          </div>
        </div>

        <InputArea
          pendingAttachments={[]}
          selectedModel="claude-opus-4-7"
        />
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY SESSION — session selected but has zero messages yet
// ═══════════════════════════════════════════════════════════════════════════════

export function ChatPageEmptySession() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SessionList sessions={MOCK_SESSIONS} selectedId="s1" />

      <section className="flex-1 flex flex-col min-w-0">
        <ChatHeader title="Transformer 架构讨论" messageCount={0} />

        <div className="flex-1 overflow-y-auto px-6 py-12 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Bot size={48} strokeWidth={1.5} aria-hidden className="mx-auto text-fg-3" />
            <p className="text-caption text-fg-2 mt-4 italic">
              (会话为空 — 在下方输入开始)
            </p>
          </div>
        </div>

        <InputArea
          pendingAttachments={[]}
          selectedModel="claude-opus-4-7"
        />
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING — assistant is typing
// ═══════════════════════════════════════════════════════════════════════════════

export function ChatPageStreaming() {
  const messagesWithStreaming: ChatMessage[] = [
    MOCK_MESSAGES[0],
    MOCK_MESSAGES[1],
    MOCK_MESSAGES[2],
    {
      id: 'm4',
      role: 'assistant',
      content: `好的,我们重点看计算复杂度这个维度,结合两篇论文的实验数据。

**注意力机制的复杂度本质**

self-attention 的核心运算是 query × key^T,矩阵尺寸都是 (n, d_model),其中 n 是序列长度`,
      isStreaming: true,
    },
  ];

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SessionList sessions={MOCK_SESSIONS} selectedId="s1" />

      <section className="flex-1 flex flex-col min-w-0">
        <ChatHeader title="Transformer 架构讨论" messageCount={4} isStreaming />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[800px] mx-auto flex flex-col gap-6">
            {messagesWithStreaming.map((m) =>
              m.role === 'user' ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AssistantMessage key={m.id} message={m} />
              ),
            )}
          </div>
        </div>

        <InputArea
          pendingAttachments={[]}
          isStreaming
          selectedModel="claude-opus-4-7"
        />
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOADING ATTACHMENT — user dragged a PDF, SpinnerRing visible in chip
// ═══════════════════════════════════════════════════════════════════════════════

export function ChatPageUploadingAttachment() {
  const pendingAttachments: Attachment[] = [
    { id: 'pa1', filename: 'attention-is-all-you-need.pdf', sizeBytes: 2_400_000, state: 'done' },
    { id: 'pa2', filename: 'sparse-attention-2026.pdf',     sizeBytes: 3_800_000, state: 'uploading' },
  ];

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SessionList sessions={MOCK_SESSIONS} selectedId="s1" />

      <section className="flex-1 flex flex-col min-w-0">
        <ChatHeader title="Transformer 架构讨论" messageCount={MOCK_MESSAGES.length} />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[800px] mx-auto flex flex-col gap-6">
            {MOCK_MESSAGES.map((m) =>
              m.role === 'user' ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AssistantMessage key={m.id} message={m} />
              ),
            )}
          </div>
        </div>

        <InputArea
          pendingAttachments={pendingAttachments}
          isUploading
          selectedModel="claude-opus-4-7"
        />
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLUS MENU OPEN — + button popover is expanded
// ═══════════════════════════════════════════════════════════════════════════════

export function ChatPagePlusMenuOpen() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SessionList sessions={MOCK_SESSIONS} selectedId="s1" />

      <section className="flex-1 flex flex-col min-w-0">
        <ChatHeader title="Transformer 架构讨论" messageCount={MOCK_MESSAGES.length} />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[800px] mx-auto flex flex-col gap-6">
            {MOCK_MESSAGES.map((m) =>
              m.role === 'user' ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AssistantMessage key={m.id} message={m} />
              ),
            )}
          </div>
        </div>

        <InputArea
          pendingAttachments={[]}
          isPlusMenuOpen
          selectedModel="claude-opus-4-7"
        />
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATTACHMENT FAILED — one upload failed, error chip shown
// ═══════════════════════════════════════════════════════════════════════════════

export function ChatPageAttachmentFailed() {
  const pendingAttachments: Attachment[] = [
    { id: 'fa1', filename: 'paper-good.pdf',         sizeBytes: 2_100_000, state: 'done' },
    {
      id: 'fa2',
      filename: 'paper-too-large.pdf',
      sizeBytes: 78_400_000,
      state: 'failed',
      errorMessage: '超过 50MB 限制',
    },
  ];

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SessionList sessions={MOCK_SESSIONS} selectedId="s1" />

      <section className="flex-1 flex flex-col min-w-0">
        <ChatHeader title="Transformer 架构讨论" messageCount={MOCK_MESSAGES.length} />

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[800px] mx-auto flex flex-col gap-6">
            {MOCK_MESSAGES.map((m) =>
              m.role === 'user' ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AssistantMessage key={m.id} message={m} />
              ),
            )}

            {/* Inline error message below conversation, above input */}
            <div
              role="alert"
              className="
                flex items-start gap-3 rounded-card-sm border border-danger-border bg-danger-bg
                px-4 py-3
              "
            >
              <AlertTriangle
                size={16}
                strokeWidth={1.5}
                aria-hidden
                className="text-danger-fg flex-shrink-0 mt-0.5"
              />
              <p className="text-meta text-fg-1 flex-1">
                附件{' '}
                <span className="font-mono">paper-too-large.pdf</span>{' '}
                上传失败:超过 50MB 限制。请压缩或拆分后重试。
              </p>
              <button
                type="button"
                aria-label="Dismiss"
                className="
                  p-1 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:shadow-focus
                "
              >
                <X size={12} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <InputArea
          pendingAttachments={pendingAttachments}
          selectedModel="claude-opus-4-7"
        />
      </section>
    </main>
  );
}
