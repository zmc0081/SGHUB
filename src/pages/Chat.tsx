// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { MessageSquare, X } from "lucide-react";
import EmptyChatArt from "../assets/illustrations/empty-chat.svg?react";
import type { ChatTokenPayload } from "../lib/tauri";
import { useChatStore } from "../stores/chatStore";
import { Message } from "../components/chat/Message";
import { InputArea } from "../components/chat/InputArea";
import { SessionList } from "../components/chat/SessionList";
import { Icon } from "../components/Icon";
import { Stage } from "../components/Stage";
import {
  InsufficientBalanceDialog,
  isInsufficientBalanceError,
} from "../components/InsufficientBalanceDialog";
import { useT } from "../hooks/useT";

export default function Chat() {
  const t = useT();
  const {
    currentSessionId,
    messages,
    streamingMessageId,
    streamingSessionId,
    loadSessions,
    appendStreamToken,
    finalizeStream,
    regenerateMessage,
    editAndResend,
    previousVersions,
    lastError,
    setError,
  } = useChatStore();

  // V2.2.1 Session 29 — auto-pop recharge dialog when the AI call
  // is gated by SG AI Store balance pre-flight.
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  useEffect(() => {
    if (lastError && isInsufficientBalanceError(lastError)) {
      setInsufficientOpen(true);
    }
  }, [lastError]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const pendingBufferRef = useRef<
    Map<string, { sessionId: string; text: string }>
  >(new Map());
  const flushHandleRef = useRef<number | null>(null);

  useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<ChatTokenPayload>("chat:token", (event) => {
      const p = event.payload;
      if (p.done) {
        flushNow();
        finalizeStream(
          p.session_id,
          p.message_id,
          p.tokens_in,
          p.tokens_out,
          p.model_name,
        );
        return;
      }
      if (!p.text) return;
      const key = `${p.session_id}|${p.message_id}`;
      const existing = pendingBufferRef.current.get(key);
      if (existing) {
        existing.text += p.text;
      } else {
        pendingBufferRef.current.set(key, {
          sessionId: p.session_id,
          text: p.text,
        });
      }
      if (flushHandleRef.current === null) {
        flushHandleRef.current = window.setTimeout(flushNow, 50);
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
      if (flushHandleRef.current !== null) {
        window.clearTimeout(flushHandleRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flushNow() {
    flushHandleRef.current = null;
    if (pendingBufferRef.current.size === 0) return;
    const entries = Array.from(pendingBufferRef.current.entries());
    pendingBufferRef.current.clear();
    for (const [key, value] of entries) {
      const messageId = key.split("|")[1];
      appendStreamToken(value.sessionId, messageId, value.text);
    }
  }

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoScrollRef.current = dist < 50;
  };

  useEffect(() => {
    if (!autoScrollRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [currentSessionId, messages, streamingMessageId]);

  const currentMessages = currentSessionId
    ? (messages[currentSessionId] ?? [])
    : [];

  // The freshest assistant reply is the only one that can show "previous
  // version" (we keep at most one undo step per session).
  const lastAssistantId = [...currentMessages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  return (
    <div className="flex h-full bg-page text-fg-1">
      <SessionList />
      <div className="flex-1 flex flex-col min-w-0 bg-page">
        <header className="border-b border-border-default bg-card px-6 py-3 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-h3 font-semibold text-fg-1 truncate">
              {currentSessionId
                ? useChatStore
                    .getState()
                    .sessions.find((s) => s.id === currentSessionId)?.title ||
                  t("chat.title_fallback")
                : t("chat.new_session_title")}
            </div>
            <div className="text-meta text-fg-3">
              {t("chat.messages_count", { count: currentMessages.length })}
              {streamingMessageId && ` · ${t("chat.generating_inline")}`}
            </div>
          </div>
        </header>

        {lastError && (
          <div
            role="alert"
            className="mx-6 my-3 px-4 py-3 text-caption text-danger-fg bg-danger-bg border border-danger-border rounded-card-sm flex items-start gap-2"
          >
            <span className="flex-1">{lastError}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="text-fg-3 hover:text-danger-fg transition-colors duration-fast ease-khx"
            >
              <Icon icon={X} size="xs" />
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-6 py-6 bg-page"
        >
          {currentMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Stage
                intensity="full"
                className="rounded-card p-12 text-center max-w-md"
              >
                <EmptyChatArt
                  width={160}
                  height={120}
                  aria-hidden="true"
                  className="mx-auto text-indigo opacity-80"
                />
                <h2 className="text-h2 font-semibold text-fg-1 mt-6">
                  {currentSessionId
                    ? t("chat.empty_session_title")
                    : t("chat.empty_main_title")}
                </h2>
                <p className="text-caption text-fg-2 mt-2">
                  {currentSessionId
                    ? t("chat.empty_session_hint")
                    : t("chat.empty_main_hint")}
                </p>
                {!currentSessionId && (
                  <div className="mt-4 inline-flex items-center gap-1.5 text-meta text-fg-3">
                    <Icon icon={MessageSquare} size="xs" />
                    <span>{t("chat.empty_kbd_hint")}</span>
                  </div>
                )}
              </Stage>
            </div>
          ) : (
            currentMessages.map((m) => (
              <Message
                key={m.id}
                message={m}
                streaming={
                  streamingMessageId === m.id &&
                  streamingSessionId === m.session_id
                }
                onRegenerate={
                  m.role === "assistant"
                    ? (modelId) => void regenerateMessage(m.id, modelId)
                    : undefined
                }
                onEdit={
                  m.role === "user"
                    ? (content) => void editAndResend(m.id, content)
                    : undefined
                }
                previousVersion={
                  currentSessionId && m.id === lastAssistantId
                    ? (previousVersions[currentSessionId] ?? null)
                    : null
                }
              />
            ))
          )}
        </div>

        <InputArea />
      </div>
      <InsufficientBalanceDialog
        open={insufficientOpen}
        onClose={() => {
          setInsufficientOpen(false);
          setError(null);
        }}
        onSwitchModel={() => {
          // No deep-link to focus the model picker yet — just clear
          // the error so the InputArea remains usable.
          setError(null);
        }}
      />
    </div>
  );
}
