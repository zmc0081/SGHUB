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

    set({
      currentInput: "",
      lastError: null,
    });

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
      set({ lastError: String(e), streamingMessageId: null });
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
      };
    });
  },

  finalizeStream: (_sessionId, _messageId, _tokensIn, _tokensOut, _modelName) => {
    set({ streamingMessageId: null, streamingSessionId: null });
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

  setError: (e) => set({ lastError: e }),
}));
