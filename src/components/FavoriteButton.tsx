/**
 * FavoriteButton — unified favorite control with folder picker.
 *
 * Replaces the per-page ad-hoc favorite logic in Search / Feed / Library
 * with a single source of truth backed by `libraryStore`. Two visual
 * variants:
 *   - "compact": icon-only chip used in dense paper cards.
 *   - "full"   : icon + label, used in list / detail views.
 *
 * On mount it triggers a one-shot `getPaperFolders` fetch via
 * `useLibraryStore.ensureLoaded` so the chip flips to the favorited
 * state immediately if the paper is already collected.
 */

// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  FolderClosed,
  Plus,
  Star,
  X,
} from "lucide-react";
import { useLibraryStore, usePaperFolders } from "../stores/libraryStore";
import type { Folder, FolderNode } from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";
import { Icon } from "./Icon";
import { confirmAsync } from "./DialogProvider";

const UNCATEGORIZED_ID = "00000000-0000-0000-0000-000000000001";

type Variant = "compact" | "full";

interface Props {
  paperId: string;
  variant?: Variant;
  size?: "sm" | "md";
  /** Fires after every successful add / remove / move. */
  onChange?: (folderId: string | null) => void;
}

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
        type="button"
        role="menuitemcheckbox"
        aria-checked={isCurrent}
        onClick={() => onPick(node)}
        className={`flex items-center gap-2 w-full text-left px-3 py-2 text-caption transition-colors duration-fast ease-khx ${
          isCurrent
            ? "bg-indigo-soft text-indigo font-medium"
            : "text-fg-2 hover:bg-navy-faint hover:text-fg-1"
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <Icon icon={FolderClosed} size="xs" />
        <span className="truncate flex-1">{node.name}</span>
        {isCurrent ? (
          <Icon icon={Check} size="xs" />
        ) : (
          <span className="text-micro text-fg-3 shrink-0 tabular-nums">
            {node.paper_count}
          </span>
        )}
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

export function FavoriteButton({
  paperId,
  variant = "compact",
  size = "sm",
  onChange,
}: Props) {
  const t = useT();
  const toast = useToast();
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void ensureLoaded(paperId);
    if (folderTree.length === 0) {
      void loadFolders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

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

  const quickFavoriteUncategorized = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await addToFolder(paperId, UNCATEGORIZED_ID);
      toast.success(
        t("favorite_button.toast_added", { name: t("library.uncategorized") }),
      );
      onChange?.(UNCATEGORIZED_ID);
      setOpen(false);
    } catch (e) {
      toast.danger(t("favorite_button.toast_failed", { detail: String(e) }));
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
        toast.success(
          t("favorite_button.toast_removed", { name: folder.name }),
        );
        onChange?.(null);
      } else {
        await addToFolder(paperId, folder.id);
        toast.success(
          t("favorite_button.toast_added", { name: folder.name }),
        );
        onChange?.(folder.id);
      }
    } catch (e) {
      toast.danger(t("favorite_button.toast_failed", { detail: String(e) }));
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
      toast.success(t("favorite_button.toast_added", { name: f.name }));
      onChange?.(f.id);
      setNewName("");
      setCreating(false);
      setOpen(false);
    } catch (e) {
      toast.danger(t("favorite_button.toast_failed", { detail: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const unfavoriteAll = async () => {
    if (busy || currentFolders.length === 0) return;
    const ok = await confirmAsync({
      title: t("favorite_button.unfavorite"),
      description: t("favorite_button.unfavorite_confirm"),
      variant: "danger",
      confirmLabel: t("common.confirm"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      for (const fid of [...currentFolders]) {
        await removeFromFolder(paperId, fid);
      }
      toast.success(t("favorite_button.toast_unfavorited"));
      onChange?.(null);
      setOpen(false);
    } catch (e) {
      toast.danger(t("favorite_button.toast_failed", { detail: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  // Sizing
  const isSm = size === "sm";
  const iconSize = isSm ? "xs" : "sm";
  const btnHeight = isSm ? "h-7" : "h-8";
  const btnPadX = isSm ? "px-2.5" : "px-3";
  const btnText = isSm ? "text-meta" : "text-caption";

  const stateClass = isFavorited
    ? "border-warning-border bg-warning-bg text-warning-fg-strong"
    : "border-border-default text-fg-2 hover:text-warning-fg-strong hover:bg-warning-bg hover:border-warning-border";

  const triggerCommonClass = `inline-flex items-center gap-1.5 ${btnHeight} ${btnPadX} rounded-pill border ${btnText} transition-colors duration-fast ease-khx`;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${triggerCommonClass} ${stateClass}`}
        title={
          isFavorited
            ? `${t("favorite_button.favorited")} — ${currentNames.join(" · ")}`
            : t("favorite_button.favorite")
        }
        disabled={busy}
      >
        <Icon
          icon={Star}
          size={iconSize}
          fill={isFavorited ? "currentColor" : "none"}
        />
        {variant === "full" && (
          <span>
            {isFavorited
              ? t("favorite_button.favorited")
              : t("favorite_button.favorite")}
          </span>
        )}
        <Icon icon={ChevronDown} size={12} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-popover left-0 mt-1 w-60 bg-card rounded-card-sm shadow-nav overflow-hidden"
        >
          <button
            type="button"
            onClick={quickFavoriteUncategorized}
            disabled={busy || currentFolders.includes(UNCATEGORIZED_ID)}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-caption font-medium text-indigo bg-indigo-soft hover:bg-indigo-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast ease-khx"
          >
            <Icon icon={Star} size="xs" />
            <span>{t("favorite_button.quick_collect")}</span>
          </button>

          <div className="max-h-60 overflow-y-auto border-t border-border-subtle">
            {folderTree.length === 0 && (
              <div className="px-3 py-2 text-caption text-fg-3">
                {t("library.empty_folder_hint")}
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

          <div className="border-t border-border-subtle">
            {creating ? (
              <div className="p-2 flex gap-2">
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
                  placeholder={t("favorite_button.new_folder_placeholder")}
                  className="flex-1 px-3 py-1 text-meta rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
                />
                <button
                  type="button"
                  onClick={submitNewFolder}
                  disabled={busy || !newName.trim()}
                  className="px-3 py-1 text-meta rounded-pill bg-navy text-fg-inverse shadow-btn hover:bg-navy-hover disabled:opacity-50 transition-colors duration-fast ease-khx"
                >
                  {t("favorite_button.create_btn")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-caption text-fg-2 hover:text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx"
              >
                <Icon icon={Plus} size="xs" />
                <span>{t("favorite_button.new_folder")}</span>
              </button>
            )}
          </div>

          {isFavorited && (
            <button
              type="button"
              onClick={unfavoriteAll}
              disabled={busy}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-caption text-danger-fg hover:bg-danger-bg border-t border-border-subtle disabled:opacity-40 transition-colors duration-fast ease-khx"
            >
              <Icon icon={X} size="xs" />
              <span>{t("favorite_button.unfavorite")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
