// V2.2.10 (Session 50, R7) — "Ask 大模型" popup for a PDF text selection.
//
// Centered, draggable dialog that answers questions about the selected text
// WITHOUT leaving the reader: quote block (collapsible) → question input +
// model picker + send → Thinking timer (Session 48 component) → streamed
// Markdown answer → copy / follow-up (multi-turn) / "continue in Chat"
// (assembles the quote + Q&A into a brand-new chat session and navigates).
// Streams via `ai_chat_stream` → "ai:token" (single active consumer).
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useNavigate } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Copy,
  MessageCircle,
  MessagesSquare,
  X,
} from "lucide-react";
import { api, type TokenPayload } from "../../lib/tauri";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import { useChatStore } from "../../stores/chatStore";
import { usePdfReaderStore } from "../../stores/pdfReaderStore";
import { confirmAsync } from "../DialogProvider";
import { Icon } from "../Icon";
import { ModelPicker } from "../chat/ModelPicker";
import { ThinkingIndicator } from "../chat/ThinkingIndicator";

interface Turn {
  q: string;
  a: string;
  pending: boolean;
  startedAt: number;
}

const QUOTE_COLLAPSE_LEN = 220;

export function AskDialog({
  text,
  paperTitle,
  onClose,
}: {
  text: string;
  paperTitle?: string;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [modelId, setModelId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: Math.max(12, window.innerWidth / 2 - 260),
    y: Math.max(12, window.innerHeight / 2 - 240),
  }));
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const runRef = useRef(0);

  // Default model on open.
  useEffect(() => {
    api
      .getModelConfigs()
      .then((ms) => {
        const def = ms.find((m) => m.is_default) ?? ms[0];
        if (def) setModelId((cur) => cur ?? def.id);
      })
      .catch(() => {});
  }, []);

  // Auto-scroll the answer area as turns stream.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const streamingNow = turns.some((v) => v.pending);

  const requestClose = useCallback(async () => {
    if (streamingNow) {
      const ok = await confirmAsync({
        title: t("pdf_viewer.ask_close_confirm_title"),
        description: t("pdf_viewer.ask_close_confirm"),
        confirmLabel: t("common.close"),
        cancelLabel: t("common.cancel"),
      });
      if (!ok) return;
    }
    runRef.current++; // stop consuming any in-flight stream
    onClose();
  }, [streamingNow, onClose, t]);

  // Escape → (confirmed) close.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") void requestClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [requestClose]);

  // Header drag.
  const onDragStart = (e: React.PointerEvent) => {
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(0, ev.clientX - dragRef.current.dx),
        y: Math.max(0, ev.clientY - dragRef.current.dy),
      });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const buildMessages = (allTurns: Turn[], newQ: string) => {
    const sys = paperTitle
      ? t("pdf_viewer.ask_system_with_title", { title: paperTitle })
      : t("pdf_viewer.ask_system");
    const messages: {
      role: "system" | "user" | "assistant";
      content: string;
    }[] = [{ role: "system", content: sys }];
    allTurns.forEach((turn, i) => {
      messages.push({
        role: "user",
        content:
          i === 0
            ? `${t("pdf_viewer.ask_quote_label")}\n"""\n${text}\n"""\n\n${turn.q}`
            : turn.q,
      });
      messages.push({ role: "assistant", content: turn.a });
    });
    messages.push({
      role: "user",
      content:
        allTurns.length === 0
          ? `${t("pdf_viewer.ask_quote_label")}\n"""\n${text}\n"""\n\n${newQ}`
          : newQ,
    });
    return messages;
  };

  const send = async () => {
    if (streamingNow || !modelId) return;
    const q = question.trim() || t("pdf_viewer.ask_placeholder");
    setQuestion("");
    const runId = ++runRef.current;
    const prev = turns;
    setTurns([...prev, { q, a: "", pending: true, startedAt: Date.now() }]);
    let unlisten: UnlistenFn | undefined;
    try {
      unlisten = await listen<TokenPayload>("ai:token", (e) => {
        if (runRef.current !== runId) return;
        if (e.payload.text) {
          setTurns((cur) =>
            cur.map((v, i) =>
              i === cur.length - 1 ? { ...v, a: v.a + e.payload.text } : v,
            ),
          );
        }
      });
      await api.aiChatStream(modelId, buildMessages(prev, q));
    } catch (err) {
      if (runRef.current === runId) {
        setTurns((cur) =>
          cur.map((v, i) =>
            i === cur.length - 1
              ? { ...v, a: v.a || `[${String(err)}]` }
              : v,
          ),
        );
        toast.danger(String(err));
      }
    } finally {
      unlisten?.();
      if (runRef.current === runId) {
        setTurns((cur) =>
          cur.map((v, i) =>
            i === cur.length - 1 ? { ...v, pending: false } : v,
          ),
        );
      }
    }
  };

  const copyLastAnswer = async () => {
    const last = [...turns].reverse().find((v) => v.a);
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.a);
      toast.success(t("chat.msg_copied"));
    } catch {
      toast.danger(t("chat.copy_failed"));
    }
  };

  // Assemble quote + Q&A into a fresh chat session and jump to /chat.
  const continueInChat = () => {
    const lines: string[] = [t("pdf_viewer.ask_chat_context_header")];
    if (paperTitle) {
      lines.push(t("pdf_viewer.ask_chat_context_paper", { title: paperTitle }));
    }
    lines.push(`${t("pdf_viewer.ask_quote_label")}\n"""\n${text}\n"""`);
    for (const turn of turns) {
      if (!turn.a) continue;
      lines.push(`Q: ${turn.q}\nA: ${turn.a}`);
    }
    lines.push(t("pdf_viewer.ask_chat_context_footer"));

    const chat = useChatStore.getState();
    useChatStore.setState({ currentSessionId: null });
    if (modelId) chat.setModel(modelId);
    chat.setInput(lines.join("\n\n"));
    void chat.sendMessage();
    runRef.current++;
    onClose();
    usePdfReaderStore.getState().close();
    void navigate({ to: "/chat" });
  };

  const quoteTooLong = text.length > QUOTE_COLLAPSE_LEN;
  const quoteShown =
    quoteExpanded || !quoteTooLong ? text : text.slice(0, QUOTE_COLLAPSE_LEN);

  return (
    <div
      role="dialog"
      aria-label={t("pdf_viewer.ask_title")}
      className="fixed z-modal w-[520px] max-w-[92vw] rounded-card border border-border-strong bg-card shadow-modal flex flex-col"
      style={{ left: pos.x, top: pos.y, maxHeight: "78vh" }}
    >
      {/* Header (drag handle) */}
      <div
        onPointerDown={onDragStart}
        className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle cursor-move select-none shrink-0"
      >
        <Icon icon={MessageCircle} size="sm" className="text-indigo shrink-0" />
        <span className="text-caption font-semibold text-fg-1 flex-1">
          {t("pdf_viewer.ask_title")}
        </span>
        <button
          type="button"
          onClick={() => void requestClose()}
          aria-label={t("common.close")}
          className="text-fg-3 hover:text-fg-1 transition-colors duration-fast ease-khx"
        >
          <Icon icon={X} size="sm" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {/* Quote block — 3px accent bar, collapsible when long */}
        <blockquote className="border-l-[3px] border-indigo bg-indigo-soft rounded-r-card-sm px-3 py-2 text-meta text-fg-2 whitespace-pre-wrap break-words">
          {quoteShown}
          {quoteTooLong && (
            <button
              type="button"
              onClick={() => setQuoteExpanded((v) => !v)}
              className="ml-1 text-indigo hover:underline"
            >
              {quoteExpanded
                ? t("pdf_viewer.ask_collapse")
                : t("pdf_viewer.ask_expand")}
            </button>
          )}
        </blockquote>

        {/* Turns */}
        {turns.map((turn, i) => (
          <div key={i} className="mt-3">
            <div className="text-caption font-medium text-fg-1">
              {turn.q}
            </div>
            {turn.pending && !turn.a ? (
              <div className="mt-2">
                <ThinkingIndicator startedAt={turn.startedAt} />
              </div>
            ) : (
              <div className="chat-md prose-sm mt-1.5 text-caption text-fg-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {turn.a}
                </ReactMarkdown>
                {turn.pending && (
                  <span
                    aria-hidden="true"
                    className="inline-block w-1 h-4 bg-indigo ml-0.5 animate-pulse align-middle"
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {/* Answer actions */}
        {turns.some((v) => v.a && !v.pending) && (
          <div className="flex items-center gap-3 mt-3 text-meta text-fg-3">
            <button
              type="button"
              onClick={() => void copyLastAnswer()}
              className="inline-flex items-center gap-1 hover:text-indigo transition-colors duration-fast ease-khx"
            >
              <Icon icon={Copy} size={12} />
              <span>{t("pdf_viewer.ask_copy_answer")}</span>
            </button>
            <span className="text-fg-3">·</span>
            <span>{t("pdf_viewer.ask_followup_hint")}</span>
            <button
              type="button"
              onClick={continueInChat}
              className="ml-auto inline-flex items-center gap-1.5 text-indigo font-medium hover:underline"
            >
              <Icon icon={MessagesSquare} size={12} />
              <span>{t("pdf_viewer.ask_continue_chat")}</span>
            </button>
          </div>
        )}
      </div>

      {/* Input row: question + model picker + send */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border-subtle shrink-0">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={t("pdf_viewer.ask_placeholder")}
          className="flex-1 min-w-0 px-3 py-2 rounded-pill border border-border-default bg-card text-caption text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          style={{ fontSize: "13px" }}
        />
        <ModelPicker
          value={modelId}
          onChange={setModelId}
          size="sm"
          placement="up"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={streamingNow || !modelId}
          aria-label={t("chat.send")}
          title={t("chat.send")}
          className="w-8 h-8 rounded-pill shrink-0 bg-navy text-fg-inverse shadow-btn hover:bg-navy-hover disabled:opacity-40 disabled:cursor-not-allowed transition-[background,box-shadow] duration-fast ease-khx flex items-center justify-center"
        >
          <Icon icon={ArrowUp} size="sm" />
        </button>
      </div>
    </div>
  );
}
