/**
 * libraryStore — shared paper-folder mapping cache.
 *
 * Why a store and not per-component state? The same paper can appear on
 * Search, Feed, Library and Chat simultaneously. When the user favorites it
 * in one place we need every other open view to flip its ⭐ state without
 * round-tripping the backend per component. The store subscribes once to
 * `library:paper_folder_changed` and patches its internal map; components
 * read from the map via the selector hooks below.
 */

import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  api,
  type Folder,
  type FolderNode,
  type PaperFolderChangedPayload,
} from "../lib/tauri";

// Stable empty-array sentinel — handed out by usePaperFolders when a
// paper has no entry yet, so subscribers don't re-render on every
// unrelated store mutation. (`[] !== []` by Object.is, the default
// Zustand selector equality.)
const EMPTY_FOLDERS: readonly string[] = Object.freeze([]) as readonly string[];

interface LibraryState {
  /** paper_id → folder_id[] (sorted, empty array if known-not-favorited). */
  paperFolders: Record<string, string[]>;
  folders: Folder[];
  folderTree: FolderNode[];
  /** Tracks which paper_ids we've already fetched so we don't re-fire. */
  loadedFor: Set<string>;
  /** Lifecycle: set once when the event listener is wired. */
  listenerActive: boolean;
  /** De-dupes concurrent `loadFolders` calls: many FavoriteButtons mount
   *  simultaneously and would otherwise all fire the same two IPCs. */
  _foldersInFlight: Promise<void> | null;
  /** De-dupes concurrent `loadPaperFolders` calls per paperId. */
  _paperFoldersInFlight: Map<string, Promise<string[]>>;

  // Mutations
  loadFolders: () => Promise<void>;
  loadPaperFolders: (paperId: string) => Promise<string[]>;
  ensureLoaded: (paperId: string) => Promise<void>;
  addToFolder: (paperId: string, folderId: string) => Promise<void>;
  removeFromFolder: (paperId: string, folderId: string) => Promise<void>;
  moveToFolder: (
    paperId: string,
    fromFolderId: string,
    toFolderId: string,
  ) => Promise<void>;
  createQuickFolder: (name: string, parentId: string | null) => Promise<Folder>;

  // Internal
  _onChange: (p: PaperFolderChangedPayload) => void;
  _initListener: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  paperFolders: {},
  folders: [],
  folderTree: [],
  loadedFor: new Set(),
  listenerActive: false,
  _foldersInFlight: null,
  _paperFoldersInFlight: new Map(),

  loadFolders: async () => {
    // Coalesce parallel callers onto the same promise — otherwise N
    // FavoriteButtons mounting at once each fire `getFolders` +
    // `getFolderTree` and each `set` triggers cascading re-renders.
    const inflight = get()._foldersInFlight;
    if (inflight) return inflight;
    const p = (async () => {
      try {
        const [folders, folderTree] = await Promise.all([
          api.getFolders(),
          api.getFolderTree(),
        ]);
        set({ folders, folderTree });
      } finally {
        set({ _foldersInFlight: null });
      }
    })();
    set({ _foldersInFlight: p });
    return p;
  },

  loadPaperFolders: async (paperId) => {
    const map = get()._paperFoldersInFlight;
    const existing = map.get(paperId);
    if (existing) return existing;
    const p = (async () => {
      try {
        const ids = await api.getPaperFolders(paperId);
        set((s) => {
          const next = new Set(s.loadedFor);
          next.add(paperId);
          return {
            paperFolders: { ...s.paperFolders, [paperId]: ids },
            loadedFor: next,
          };
        });
        return ids;
      } finally {
        // Always clear so a later call can refetch (e.g. after an event).
        get()._paperFoldersInFlight.delete(paperId);
      }
    })();
    map.set(paperId, p);
    return p;
  },

  ensureLoaded: async (paperId) => {
    if (get().loadedFor.has(paperId)) return;
    // Initialize event listener on first ensure call — keeps the wiring
    // lazy so apps that never use FavoriteButton don't subscribe.
    if (!get().listenerActive) {
      await get()._initListener();
    }
    await get().loadPaperFolders(paperId);
  },

  addToFolder: async (paperId, folderId) => {
    await api.addToFolder(folderId, paperId);
    // Event fires from the backend → _onChange patches the map. We also
    // patch optimistically so the chip flips immediately even if the
    // event handler is briefly slower.
    set((s) => {
      const cur = s.paperFolders[paperId] ?? [];
      if (cur.includes(folderId)) return s;
      return {
        paperFolders: {
          ...s.paperFolders,
          [paperId]: [...cur, folderId].sort(),
        },
      };
    });
  },

  removeFromFolder: async (paperId, folderId) => {
    await api.removeFromFolder(folderId, paperId);
    set((s) => {
      const cur = s.paperFolders[paperId] ?? [];
      return {
        paperFolders: {
          ...s.paperFolders,
          [paperId]: cur.filter((f) => f !== folderId),
        },
      };
    });
  },

  moveToFolder: async (paperId, fromFolderId, toFolderId) => {
    await api.movePaperToFolder(paperId, fromFolderId, toFolderId);
    set((s) => {
      const cur = s.paperFolders[paperId] ?? [];
      const next = cur.filter((f) => f !== fromFolderId);
      if (!next.includes(toFolderId)) next.push(toFolderId);
      next.sort();
      return { paperFolders: { ...s.paperFolders, [paperId]: next } };
    });
  },

  createQuickFolder: async (name, parentId) => {
    const f = await api.createQuickFolder(name, parentId);
    set((s) => ({
      folders: [...s.folders, f],
    }));
    // Refresh tree to keep the picker hierarchy correct.
    void get().loadFolders();
    return f;
  },

  _onChange: (p) => {
    set((s) => {
      const cur = s.paperFolders[p.paper_id] ?? [];
      let next = cur;
      if (p.kind === "added" && p.folder_id) {
        if (!cur.includes(p.folder_id)) next = [...cur, p.folder_id].sort();
      } else if (p.kind === "removed" && p.folder_id) {
        next = cur.filter((f) => f !== p.folder_id);
      } else if (p.kind === "moved" && p.from_folder_id && p.to_folder_id) {
        next = cur.filter((f) => f !== p.from_folder_id);
        if (!next.includes(p.to_folder_id)) next.push(p.to_folder_id);
        next.sort();
      } else {
        return s;
      }
      return { paperFolders: { ...s.paperFolders, [p.paper_id]: next } };
    });
  },

  _initListener: async () => {
    if (get().listenerActive) return;
    set({ listenerActive: true });
    // We deliberately never unsubscribe — the store lives for the entire
    // session and the listener is cheap. Tauri auto-cleans on window close.
    const _unlisten: UnlistenFn = await listen<PaperFolderChangedPayload>(
      "library:paper_folder_changed",
      (event) => get()._onChange(event.payload),
    );
    void _unlisten;
  },
}));

// ============================================================
// Selector hooks — components read these instead of touching the
// store directly, so unused refs don't cause re-renders.
// ============================================================

export function usePaperFolders(paperId: string): string[] {
  // Cast away the readonly — callers only iterate / index; never mutate.
  return useLibraryStore(
    (s) => (s.paperFolders[paperId] ?? EMPTY_FOLDERS) as string[],
  );
}

export function useIsFavorited(paperId: string): boolean {
  return useLibraryStore((s) => (s.paperFolders[paperId]?.length ?? 0) > 0);
}
