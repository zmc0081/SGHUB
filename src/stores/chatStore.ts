import { create } from "zustand";
import {
  api,
  type ChatAttachment,
  type ChatMessage,
  type ChatSessionSummary,
} from "../lib/tauri";

interface ChatState {
  // Server state
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  /** keyed by session_id → messages in ASC order */
  messages: Record<string, ChatMessage[]>;

  // Composer state (per current session)
  currentInput: string;
  currentAttachments: ChatAttachment[];
  currentSkill: string | null;
  currentModel: string | null;

  // Streaming state
  streamingMessageId: string | null;
  streamingSessionId: string | null;

  // Errors
  lastError: string | null;

  // V2.2.7 — last replaced assistant content, keyed by session_id, so the
  // freshest assistant reply can offer "view previous version" after a
  // regenerate. In-memory only (cleared on reload / session switch).
  previousVersions: Record<string, string>;

  // V2.2.10 (Session 48, R4) — "Thinking…" timer. Set when a turn is sent,
  // cleared on first finalize; the bubble shows until the first token
  // arrives (streamingMessageId takes over). thinkingSessionId may be null
  // for a brand-new session (no id until the backend creates it).
  thinkingStartedAt: number | null;
  thinkingSessionId: string | null;
  /** Total turn duration (seconds), keyed by assistant message id.
   *  In-memory only — shown as "耗时 …" on the finished message. */
  elapsedByMessage: Record<string, number>;

  // Actions
  loadSessions: () => Promise<void>;
  selectSession: (id: string | null) => Promise<void>;
  setInput: (s: string) => void;
  addAttachment: (a: ChatAttachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setSkill: (s: string | null) => void;
  setModel: (m: string | null) => void;
  sendMessage: () => Promise<void>;
  appendStreamToken: (sessionId: string, messageId: string, text: string) => void;
  finalizeStream: (
    sessionId: string,
    messageId: string,
    tokensIn?: number,
    tokensOut?: number,
    modelName?: string,
  ) => void;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  pinSession: (id: string, pinned: boolean) => Promise<void>;
  /** Stop the in-flight assistant stream (keeps generated content). */
  stopStreaming: () => Promise<void>;
  /** Regenerate an assistant reply; pass modelId to use a different model. */
  regenerateMessage: (assistantId: string, modelId?: string | null) => Promise<void>;
  /** Edit a user message and resend, truncating everything after it. */
  editAndResend: (userId: string, content: string, modelId?: string | null) => Promise<void>;
  setError: (e: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: {},
  currentInput: "",
  currentAttachments: [],
  currentSkill: null,
  currentModel: null,
  streamingMessageId: null,
  streamingSessionId: null,
  lastError: null,
  previousVersions: {},
  thinkingStartedAt: null,
  thinkingSessionId: null,
  elapsedByMessage: {},

  loadSessions: async () => {
    try {
      const sessions = await api.listChatSessions();
      set({ sessions });
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  selectSession: async (id) => {
    set({ currentSessionId: id, currentAttachments: [], currentInput: "" });
    if (!id) return;
    try {
      const detail = await api.getSessionDetail(id);
      if (detail) {
        set((s) => ({
          messages: { ...s.messages, [id]: detail.messages },
          currentSkill: detail.skill_name ?? null,
          currentModel: detail.model_config_id ?? s.currentModel,
        }));
      }
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  setInput: (s) => set({ currentInput: s }),
  addAttachment: (a) =>
    set((s) => ({ currentAttachments: [...s.currentAttachments, a] })),
  removeAttachment: (id) =>
    set((s) => ({
      currentAttachments: s.currentAttachments.filter((a) => a.id !== id),
    })),
  clearAttachments: () => set({ currentAttachments: [] }),
  setSkill: (s) => set({ currentSkill: s }),
  setModel: (m) => set({ currentModel: m }),

  sendMessage: async () => {
    const s = get();
    const content = s.currentInput.trim();
    if (!content && s.currentAttachments.length === 0) return;
    if (s.streamingMessageId) return; // already streaming

    // V2.2.10 (Session 48, R4) — show the user's message immediately
    // (optimistic; reconciled from DB on finish) and start the Thinking
    // timer so the wait before the first token is visible.
    const pendingId = `pending-${Date.now()}`;
    set((state) => ({
      currentInput: "",
      lastError: null,
      thinkingStartedAt: Date.now(),
      thinkingSessionId: state.currentSessionId,
      messages: state.currentSessionId
        ? {
            ...state.messages,
            [state.currentSessionId]: [
              ...(state.messages[state.currentSessionId] ?? []),
              {
                id: pendingId,
                session_id: state.currentSessionId,
                role: "user",
                content,
                attachments_json: null,
                tokens_in: 0,
                tokens_out: 0,
                model_name: null,
                created_at: new Date().toISOString(),
                attachments: state.currentAttachments,
              },
            ],
          }
        : state.messages,
    }));

    try {
      const result = await api.sendChatMessage({
        session_id: s.currentSessionId,
        content,
        attachments: s.currentAttachments.map((a) => a.id),
        skill_name: s.currentSkill,
        model_config_id: s.currentModel,
      });
      // After streaming completes, reload that session's messages from DB to
      // pick up the persisted user + assistant rows in case any tokens were
      // dropped between event emissions.
      const detail = await api.getSessionDetail(result.session_id);
      if (detail) {
        set((state) => ({
          messages: { ...state.messages, [result.session_id]: detail.messages },
          currentSessionId: result.session_id,
          currentAttachments: [],
        }));
        // Also refresh the sidebar list (new session might've been created)
        get().loadSessions();
      }
    } catch (e) {
      // Drop the optimistic row and stop the Thinking bubble on failure.
      set((state) => ({
        lastError: String(e),
        streamingMessageId: null,
        thinkingStartedAt: null,
        thinkingSessionId: null,
        messages: s.currentSessionId
          ? {
              ...state.messages,
              [s.currentSessionId]: (
                state.messages[s.currentSessionId] ?? []
              ).filter((m) => m.id !== pendingId),
            }
          : state.messages,
      }));
    }
  },

  appendStreamToken: (sessionId, messageId, text) => {
    set((state) => {
      const prev = state.messages[sessionId] ?? [];
      const idx = prev.findIndex((m) => m.id === messageId);
      let next: ChatMessage[];
      if (idx >= 0) {
        next = prev.slice();
        next[idx] = { ...next[idx], content: next[idx].content + text };
      } else {
        // First chunk for a brand-new assistant message we haven't seen yet —
        // create a placeholder row. We'll patch it up from getSessionDetail
        // after the stream ends.
        next = [
          ...prev,
          {
            id: messageId,
            session_id: sessionId,
            role: "assistant",
            content: text,
            attachments_json: null,
            tokens_in: 0,
            tokens_out: 0,
            model_name: null,
            created_at: new Date().toISOString(),
            attachments: [],
          },
        ];
      }
      return {
        messages: { ...state.messages, [sessionId]: next },
        streamingMessageId: messageId,
        streamingSessionId: sessionId,
        // V2.2.10 — a brand-new session has no id until the backend creates
        // it; adopt it on the first token so the stream is visible live.
        currentSessionId: state.currentSessionId ?? sessionId,
      };
    });
  },

  finalizeStream: (_sessionId, messageId, _tokensIn, _tokensOut, _modelName) => {
    set((state) => ({
      streamingMessageId: null,
      streamingSessionId: null,
      // V2.2.10 (R4) — record the turn's total duration for "耗时 …".
      elapsedByMessage: state.thinkingStartedAt
        ? {
            ...state.elapsedByMessage,
            [messageId]: Math.max(
              1,
              Math.round((Date.now() - state.thinkingStartedAt) / 1000),
            ),
          }
        : state.elapsedByMessage,
      thinkingStartedAt: null,
      thinkingSessionId: null,
    }));
  },

  deleteSession: async (id) => {
    try {
      await api.deleteChatSession(id);
      set((s) => {
        const messages = { ...s.messages };
        delete messages[id];
        return {
          sessions: s.sessions.filter((x) => x.id !== id),
          currentSessionId: s.currentSessionId === id ? null : s.currentSessionId,
          messages,
        };
      });
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  renameSession: async (id, title) => {
    try {
      await api.renameChatSession(id, title);
      set((s) => ({
        sessions: s.sessions.map((x) => (x.id === id ? { ...x, title } : x)),
      }));
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  pinSession: async (id, pinned) => {
    try {
      await api.pinChatSession(id, pinned);
      // Reload to get correct sort order
      get().loadSessions();
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  stopStreaming: async () => {
    const mid = get().streamingMessageId;
    if (!mid) return;
    try {
      await api.cancelChatStream(mid);
    } catch (e) {
      // best-effort; the backend may have already finished
      console.warn("cancelChatStream failed", e);
    }
  },

  regenerateMessage: async (assistantId, modelId) => {
    const s = get();
    const sid = s.currentSessionId;
    if (!sid || s.streamingMessageId) return;
    const list = s.messages[sid] ?? [];
    const idx = list.findIndex((m) => m.id === assistantId);
    const old = idx >= 0 ? list[idx] : null;
    set((st) => ({
      lastError: null,
      // V2.2.10 (R4) — regenerating waits on the model too: show Thinking.
      thinkingStartedAt: Date.now(),
      thinkingSessionId: sid,
      // Remember the replaced reply so the UI can show "previous version".
      previousVersions: old
        ? { ...st.previousVersions, [sid]: old.content }
        : st.previousVersions,
      // Optimistically drop the old assistant reply (+ anything after) so the
      // streaming placeholder appends cleanly; reconciled from DB on finish.
      messages:
        idx >= 0
          ? { ...st.messages, [sid]: list.slice(0, idx) }
          : st.messages,
    }));
    try {
      const result = await api.regenerateMessage({
        sessionId: sid,
        assistantMessageId: assistantId,
        modelConfigId: modelId ?? s.currentModel,
      });
      const detail = await api.getSessionDetail(result.session_id);
      if (detail) {
        set((st) => ({
          messages: { ...st.messages, [result.session_id]: detail.messages },
        }));
      }
    } catch (e) {
      set({
        lastError: String(e),
        streamingMessageId: null,
        thinkingStartedAt: null,
        thinkingSessionId: null,
      });
    }
  },

  editAndResend: async (userId, content, modelId) => {
    const s = get();
    const sid = s.currentSessionId;
    if (!sid || s.streamingMessageId) return;
    const list = s.messages[sid] ?? [];
    const idx = list.findIndex((m) => m.id === userId);
    set((st) => ({
      lastError: null,
      // V2.2.10 (R4) — resending waits on the model: show Thinking.
      thinkingStartedAt: Date.now(),
      thinkingSessionId: sid,
      // Optimistically apply the edit + truncate everything after this user msg.
      messages:
        idx >= 0
          ? {
              ...st.messages,
              [sid]: list
                .slice(0, idx + 1)
                .map((m) => (m.id === userId ? { ...m, content } : m)),
            }
          : st.messages,
    }));
    try {
      const result = await api.editAndResend({
        sessionId: sid,
        userMessageId: userId,
        newContent: content,
        modelConfigId: modelId ?? s.currentModel,
      });
      const detail = await api.getSessionDetail(result.session_id);
      if (detail) {
        set((st) => ({
          messages: { ...st.messages, [result.session_id]: detail.messages },
        }));
      }
    } catch (e) {
      set({
        lastError: String(e),
        streamingMessageId: null,
        thinkingStartedAt: null,
        thinkingSessionId: null,
      });
    }
  },

  setError: (e) => set({ lastError: e }),
}));
