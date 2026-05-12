import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ChatTokenPayload } from "../lib/tauri";
import { useChatStore } from "../stores/chatStore";
import { Message } from "../components/chat/Message";
import { InputArea } from "../components/chat/InputArea";
import { SessionList } from "../components/chat/SessionList";

export default function Chat() {
  const {
    currentSessionId,
    messages,
    streamingMessageId,
    streamingSessionId,
    loadSessions,
    appendStreamToken,
    finalizeStream,
    lastError,
    setError,
  } = useChatStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  // Batch token bursts at 50ms cadence to avoid one React render per token
  const pendingBufferRef = useRef<Map<string, { sessionId: string; text: string }>>(
    new Map(),
  );
  const flushHandleRef = useRef<number | null>(null);

  // ----- Load sessions once on mount -----
  useEffect(() => {
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Subscribe to chat:token events -----
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<ChatTokenPayload>("chat:token", (event) => {
      const p = event.payload;
      if (p.done) {
        // Flush any pending tokens first
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
      // Batch by (sessionId, messageId)
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

  // ----- Auto-scroll only when user is already at the bottom -----
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

  return (
    <div className="flex h-full">
      <SessionList />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-black/10 bg-white/40 px-4 py-2 flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-primary truncate">
              {currentSessionId
                ? useChatStore
                    .getState()
                    .sessions.find((s) => s.id === currentSessionId)?.title ||
                  "对话"
                : "新对话"}
            </div>
            <div className="text-[10px] text-app-fg/50">
              {currentMessages.length} 条消息
              {streamingMessageId && " · 正在生成…"}
            </div>
          </div>
        </header>

        {lastError && (
          <div className="mx-3 my-2 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded flex items-start gap-2">
            <span className="flex-1">{lastError}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto px-4 py-4 bg-app-bg"
        >
          {currentMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-app-fg/40">
              {currentSessionId
                ? "(会话为空 — 在下方输入开始)"
                : "选好模型 / Skill / 附件,在下方输入开始对话"}
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
              />
            ))
          )}
        </div>

        <InputArea />
      </div>
    </div>
  );
}
