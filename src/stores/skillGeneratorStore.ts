/**
 * Skill generator store (V2.1.0).
 *
 * The "chat" maintained here is a thin shell over the backend's
 * `generate_skill_from_description` / `refine_skill_from_chat`
 * commands. Each user message corresponds to one round-trip; the AI
 * reply is the validated YAML wrapped in a friendly "Skill generated"
 * confirmation card.
 *
 * Token streaming via `skill_gen:token` is handled at the page level
 * (the store only persists the final yaml/spec so component re-mounts
 * don't lose progress). A localStorage draft survives page reloads.
 */

import { create } from "zustand";
import { api, type SkillGenResult, type SkillSpec } from "../lib/tauri";

export type GenMessageRole = "user" | "assistant";

export interface GenMessage {
  id: string;
  role: GenMessageRole;
  /** User text OR — for assistant messages — a short confirmation
   *  string. The actual YAML lives on `currentYaml` so we don't dump
   *  raw config into the chat bubble. */
  text: string;
  /** Streamed partial text for in-flight assistant messages. */
  streaming?: boolean;
  /** True if this assistant turn required the auto-retry to validate. */
  retried?: boolean;
}

interface DraftPayload {
  messages: GenMessage[];
  currentYaml: string;
  currentSpec: SkillSpec | null;
}

const DRAFT_KEY = "sghub.skill-gen-draft.v1";

function loadDraft(): DraftPayload | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload;
  } catch {
    return null;
  }
}

function saveDraft(p: DraftPayload) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota */
  }
}

interface SkillGenState {
  messages: GenMessage[];
  currentYaml: string;
  currentSpec: SkillSpec | null;
  selectedModel: string | null;
  isStreaming: boolean;
  /** Last error message (network / validation). Cleared on next send. */
  lastError: string | null;

  setSelectedModel: (id: string | null) => void;
  /** First message starts a generation; subsequent messages refine. */
  sendUserMessage: (text: string) => Promise<void>;
  reset: () => void;
  /** Edit the YAML directly (from the YAML tab) — keeps spec in sync
   *  best-effort; if the new YAML doesn't parse the spec stays. */
  setYamlInPlace: (yaml: string, spec: SkillSpec | null) => void;
  hydrateFromDraft: () => void;
}

export const useSkillGenStore = create<SkillGenState>((set, get) => ({
  messages: [],
  currentYaml: "",
  currentSpec: null,
  selectedModel: null,
  isStreaming: false,
  lastError: null,

  setSelectedModel: (id) => set({ selectedModel: id }),

  setYamlInPlace: (yaml, spec) => {
    set({ currentYaml: yaml, currentSpec: spec });
    persist();
  },

  hydrateFromDraft: () => {
    const d = loadDraft();
    if (!d) return;
    set({
      messages: d.messages,
      currentYaml: d.currentYaml,
      currentSpec: d.currentSpec,
    });
  },

  reset: () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    set({
      messages: [],
      currentYaml: "",
      currentSpec: null,
      lastError: null,
    });
  },

  sendUserMessage: async (text) => {
    if (!text.trim() || get().isStreaming) return;
    const userMsg: GenMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    const aiPlaceholder: GenMessage = {
      id: `a-${Date.now() + 1}`,
      role: "assistant",
      text: "",
      streaming: true,
    };
    set({
      messages: [...get().messages, userMsg, aiPlaceholder],
      isStreaming: true,
      lastError: null,
    });

    const isFirstGen = !get().currentYaml;
    try {
      const result: SkillGenResult = isFirstGen
        ? await api.generateSkillFromDescription(text, get().selectedModel)
        : await api.refineSkillFromChat(
            get().currentYaml,
            text,
            get().selectedModel,
          );
      const summary = isFirstGen
        ? "(first-skill-ready)"
        : "(refined)";
      set({
        currentYaml: result.yaml,
        currentSpec: result.spec,
        messages: get().messages.map((m) =>
          m.id === aiPlaceholder.id
            ? {
                ...m,
                text: summary,
                streaming: false,
                retried: result.retried,
              }
            : m,
        ),
        isStreaming: false,
      });
      persist();
    } catch (e) {
      set({
        messages: get().messages.map((m) =>
          m.id === aiPlaceholder.id
            ? { ...m, text: `(error)`, streaming: false }
            : m,
        ),
        isStreaming: false,
        lastError: String(e),
      });
    }
  },
}));

function persist() {
  const s = useSkillGenStore.getState();
  saveDraft({
    messages: s.messages,
    currentYaml: s.currentYaml,
    currentSpec: s.currentSpec,
  });
}
