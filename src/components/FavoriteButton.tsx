/**
 * FavoriteButton — unified ⭐ / ☆ control with folder picker.
 *
 * Replaces the per-page ad-hoc favorite logic in Search / Feed / Library
 * with a single source of truth backed by `libraryStore`. Two visual
 * variants:
 *   - "compact": icon-only chip used in dense paper cards.
 *   - "full"   : icon + label, used in list / detail views.
 *
 * On mount it triggers a one-shot `getPaperFolders` fetch via
 * `useLibraryStore.ensureLoaded` so the chip flips to ⭐ immediately if
 * the paper is already collected.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useLibraryStore, usePaperFolders } from "../stores/libraryStore";
import type { Folder, FolderNode } from "../lib/tauri";

const UNCATEGORIZED_ID = "00000000-0000-0000-0000-000000000001";

type Variant = "compact" | "full";

interface Props {
  paperId: string;
  variant?: Variant;
  /** Fires after every successful add / remove / move — folderId is the
   *  primary affected folder (the destination for adds/moves, the removed
   *  folder for removes). `null` when the last folder was removed. */
  onChange?: (folderId: string | null) => void;
}

// ============================================================
// Toast (intentionally inline — no global toaster yet, and this avoids a
// dependency. Lives ~2s in the bottom-right of the viewport, stacked.)
// ============================================================

interface Toast {
  id: string;
  text: string;
  kind: "ok" | "err";
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (text: string, kind: "ok" | "err" = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2200,
    );
  };
  return { toasts, push };
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-1.5 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-3 py-1.5 rounded text-xs shadow-md border ${
            t.kind === "ok"
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "bg-red-50 border-red-300 text-red-700"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Folder tree row (recursive, with indent + selection highlight)
// ============================================================

function FolderRow({
  node,
  depth,
  currentFolders,
  onPick,
}: {
  node: FolderNode;
  depth: number;
  currentFolders: string[];
  onPick: (folder: Folder) => void;
}) {
  const isCurrent = currentFolders.includes(node.id);
  return (
    <>
      <button
        onClick={() => onPick(node)}
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-xs transition-colors ${
          isCurrent
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-primary/5 text-app-fg/80"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="shrink-0">{isCurrent ? "✓" : "📁"}</span>
        <span className="truncate flex-1">{node.name}</span>
        <span className="text-[10px] text-app-fg/40 shrink-0">
          {node.paper_count}
        </span>
      </button>
      {node.children.map((c) => (
        <FolderRow
          key={c.id}
          node={c}
          depth={depth + 1}
          currentFolders={currentFolders}
          onPick={onPick}
        />
      ))}
    </>
  );
}

// ============================================================
// Main component
// ============================================================

export function FavoriteButton({
  paperId,
  variant = "compact",
  onChange,
}: Props) {
  const currentFolders = usePaperFolders(paperId);
  const folderTree = useLibraryStore((s) => s.folderTree);
  const folders = useLibraryStore((s) => s.folders);
  const ensureLoaded = useLibraryStore((s) => s.ensureLoaded);
  const loadFolders = useLibraryStore((s) => s.loadFolders);
  const addToFolder = useLibraryStore((s) => s.addToFolder);
  const removeFromFolder = useLibraryStore((s) => s.removeFromFolder);
  const createQuickFolder = useLibraryStore((s) => s.createQuickFolder);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const { toasts, push } = useToasts();
  const containerRef = useRef<HTMLDivElement>(null);

  // Pull paper-folder mapping (and folder tree) once on first render.
  useEffect(() => {
    void ensureLoaded(paperId);
    if (folderTree.length === 0) {
      void loadFolders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isFavorited = currentFolders.length > 0;

  const currentNames = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f.name]));
    return currentFolders.map((id) => byId.get(id) ?? id);
  }, [folders, currentFolders]);

  // ============================================================
  // Actions
  // ============================================================

  const quickFavoriteUncategorized = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await addToFolder(paperId, UNCATEGORIZED_ID);
      push("✓ 已收藏到「未分类」");
      onChange?.(UNCATEGORIZED_ID);
      setOpen(false);
    } catch (e) {
      push(`收藏失败: ${e}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const pickFolder = async (folder: Folder) => {
    if (busy) return;
    setBusy(true);
    try {
      if (currentFolders.includes(folder.id)) {
        await removeFromFolder(paperId, folder.id);
        push(`已从「${folder.name}」移除`);
        onChange?.(null);
      } else {
        await addToFolder(paperId, folder.id);
        push(`✓ 已加入「${folder.name}」`);
        onChange?.(folder.id);
      }
      setOpen(false);
    } catch (e) {
      push(`操作失败: ${e}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const submitNewFolder = async () => {
    const name = newName.trim();
    if (!name) return;
    if (busy) return;
    setBusy(true);
    try {
      const f = await createQuickFolder(name, null);
      await addToFolder(paperId, f.id);
      push(`✓ 新建并加入「${f.name}」`);
      onChange?.(f.id);
      setNewName("");
      setCreating(false);
      setOpen(false);
    } catch (e) {
      push(`创建失败: ${e}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const unfavoriteAll = async () => {
    if (busy || currentFolders.length === 0) return;
    if (!confirm("从所有收藏夹中移除这篇文献?")) return;
    setBusy(true);
    try {
      // Iterate sequentially so each removal emits its own event reliably.
      for (const fid of [...currentFolders]) {
        await removeFromFolder(paperId, fid);
      }
      push("已取消收藏");
      onChange?.(null);
      setOpen(false);
    } catch (e) {
      push(`操作失败: ${e}`, "err");
    } finally {
      setBusy(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  const triggerClass =
    variant === "compact"
      ? "inline-flex items-center gap-1 px-2 py-1 rounded border text-xs transition-colors"
      : "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-sm transition-colors";

  const stateClass = isFavorited
    ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
    : "border-black/10 hover:border-primary/30 hover:bg-primary/5 text-app-fg/80";

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${triggerClass} ${stateClass}`}
        title={
          isFavorited
            ? `已收藏 — ${currentNames.join(" · ")}`
            : "收藏到文件夹"
        }
        disabled={busy}
      >
        <span className="shrink-0">{isFavorited ? "⭐" : "☆"}</span>
        <span>{isFavorited ? "已收藏" : "收藏"}</span>
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 left-0 mt-1 w-60 bg-white border border-black/10 rounded shadow-lg overflow-hidden">
          {/* Quick-favorite header */}
          <button
            onClick={quickFavoriteUncategorized}
            disabled={busy || currentFolders.includes(UNCATEGORIZED_ID)}
            className="block w-full text-left px-3 py-2 text-xs font-medium bg-primary/5 hover:bg-primary/10 text-primary disabled:opacity-40 border-b border-black/5"
          >
            ⭐ 快速收藏到「未分类」
          </button>

          {/* Folder tree (scrollable) */}
          <div className="max-h-60 overflow-y-auto">
            {folderTree.length === 0 && (
              <div className="px-3 py-2 text-xs text-app-fg/50">
                还没有文件夹 — 用下方的按钮新建一个
              </div>
            )}
            {folderTree.map((n) => (
              <FolderRow
                key={n.id}
                node={n}
                depth={0}
                currentFolders={currentFolders}
                onPick={pickFolder}
              />
            ))}
          </div>

          {/* New folder row */}
          <div className="border-t border-black/5">
            {creating ? (
              <div className="p-2 flex gap-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitNewFolder();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  placeholder="文件夹名称"
                  className="flex-1 px-2 py-1 text-xs border border-black/10 rounded focus:outline-none focus:border-primary"
                />
                <button
                  onClick={submitNewFolder}
                  disabled={busy || !newName.trim()}
                  className="px-2 py-1 text-xs bg-primary text-white rounded disabled:opacity-50"
                >
                  确定
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="block w-full text-left px-3 py-2 text-xs text-app-fg/70 hover:bg-primary/5"
              >
                + 新建文件夹
              </button>
            )}
          </div>

          {/* Unfavorite action (only when currently collected) */}
          {isFavorited && (
            <button
              onClick={unfavoriteAll}
              disabled={busy}
              className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 border-t border-black/5 disabled:opacity-40"
            >
              ✕ 取消收藏
            </button>
          )}
        </div>
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}
