// V2.2.9 (Session 45, R4) — global AI-parse task state.
//
// The parse task itself always ran to completion in the backend (results are
// saved to ai_parse_results on `done` regardless of the UI); what used to be
// lost on navigation was the FRONTEND state — the `parse:token` listener and
// the streaming buffer lived inside the Parse page component. This store
// lifts all of it to app scope:
//   - `ParseListener` (mounted once in App) writes every `parse:token` event
//     here, so streaming survives page switches;
//   - the Parse page only subscribes and renders;
//   - the sidebar reads `running` for its in-progress indicator.
// The current picker selection (paper/skill/model) also lives here so
// returning to the page restores the task context.
import { create } from "zustand";
import { api } from "../lib/tauri";

interface ParseState {
  // Picker selection (restored when returning to the page)
  paperId: string;
  skillName: string;
  modelId: string;

  // Task state
  running: boolean;
  output: string;
  tokensOut: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  /** Display name of the model that produced `output` (for the HTML export
   *  filename). Set by the page on start / history load. */
  resultModelName: string;
  /** V2.2.9 — which paper `output` belongs to. The page only shows the
   *  output when the current picker selection matches, so switching papers
   *  doesn't leak another paper's result (and switching back restores it). */
  taskPaperId: string;

  setPaperId: (id: string) => void;
  setSkillName: (name: string) => void;
  setModelId: (id: string) => void;
  setResultModelName: (name: string) => void;

  /** Kick off a parse. The invoke lives here (not in the component) so its
   *  completion/failure updates the store even after the page unmounts. */
  startParse: () => Promise<void>;
  /** Streaming feed — called by the app-level ParseListener. */
  appendToken: (text: string) => void;
  finishStream: () => void;
  /** Load a persisted history row into the output view. */
  loadResult: (
    text: string,
    tokensOut: number,
    modelName?: string,
    paperId?: string,
  ) => void;
  setError: (e: string | null) => void;
}

export const useParseStore = create<ParseState>((set, get) => ({
  paperId: "",
  skillName: "",
  modelId: "",

  running: false,
  output: "",
  tokensOut: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
  resultModelName: "",
  taskPaperId: "",

  setPaperId: (paperId) => set({ paperId }),
  setSkillName: (skillName) => set({ skillName }),
  setModelId: (modelId) => set({ modelId }),
  setResultModelName: (resultModelName) => set({ resultModelName }),

  startParse: async () => {
    const { paperId, skillName, modelId, running } = get();
    if (running || !paperId || !skillName || !modelId) return;
    set({
      running: true,
      output: "",
      tokensOut: 0,
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
      taskPaperId: paperId,
    });
    try {
      await api.startParse(paperId, skillName, modelId);
      // Terminal state is normally set by the `done` token via ParseListener;
      // this is a safety net in case the event was dropped.
      if (get().running) {
        set({ running: false, finishedAt: Date.now() });
      }
    } catch (e) {
      set({
        error: String(e),
        running: false,
        finishedAt: Date.now(),
      });
    }
  },

  appendToken: (text) =>
    set((s) => ({
      output: s.output + text,
      tokensOut: s.tokensOut + Math.ceil(text.length / 4),
      // A token implies a task is streaming (covers reload-mid-task edges).
      running: true,
      finishedAt: null,
    })),

  finishStream: () => set({ running: false, finishedAt: Date.now() }),

  loadResult: (text, tokensOut, modelName, paperId) =>
    set((s) => ({
      output: text,
      tokensOut,
      running: false,
      startedAt: null,
      finishedAt: null,
      error: null,
      resultModelName: modelName ?? s.resultModelName,
      taskPaperId: paperId ?? s.taskPaperId,
    })),

  setError: (error) => set({ error }),
}));
