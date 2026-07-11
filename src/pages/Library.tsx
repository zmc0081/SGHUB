// i18n: 本组件文案已国际化 (V2.1.0)
// V2.2.2 — 本地 PDF 上传入口 + 本地/在线统一管理(批量移动/标签/删除、
//          来源筛选、待完善标记、存储用量 + 孤儿清理)。
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  FolderClosed,
  FolderInput,
  FolderPlus,
  HardDrive,
  Loader2,
  Pencil,
  Square,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import EmptyLibraryArt from "../assets/illustrations/empty-library.svg?react";
import {
  api,
  type FolderNode,
  type Paper,
  type PartialMetadata,
  type StorageUsage,
  type Tag,
  type UploadProgressPayload,
} from "../lib/tauri";
import { PaperActions } from "../components/PaperActions";
import { PaperMetadataEditor } from "../components/PaperMetadataEditor";
import { Icon } from "../components/Icon";
import { Stage } from "../components/Stage";
import { confirmAsync, promptAsync } from "../components/DialogProvider";
import { useToast } from "../hooks/useToast";
import { useT } from "../hooks/useT";
import { useOpenPaperView } from "../hooks/useOpenPaperView";

const READ_STATUS_BAR: Record<string, string> = {
  unread: "bg-read-unread",
  reading: "bg-read-reading",
  read: "bg-read-read",
  parsed: "bg-read-parsed",
};

const READ_STATUS_KEY: Record<string, string> = {
  unread: "library.read_status_unread",
  reading: "library.read_status_reading",
  read: "library.read_status_read",
  parsed: "library.read_status_parsed",
};

const READ_STATUS_CYCLE: Record<string, string> = {
  unread: "reading",
  reading: "read",
  read: "parsed",
  parsed: "unread",
};

const SOURCE_BADGE: Record<string, string> = {
  arxiv: "bg-src-arxiv text-src-arxiv-fg",
  semantic_scholar: "bg-src-ss text-src-ss-fg",
  pubmed: "bg-src-pubmed text-src-pubmed-fg",
  openalex: "bg-src-openalex text-src-openalex-fg",
  local: "bg-src-local text-src-local-fg",
};

// Display labels for known sources. `local` is localized via i18n; the rest
// are proper nouns kept verbatim across all locales.
const SOURCE_DISPLAY: Record<string, string> = {
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
  pubmed: "PubMed",
  openalex: "OpenAlex",
};

// Order of the source filter dropdown. `all` first, then `local`, then the
// online providers.
const SOURCE_FILTER_ORDER = [
  "all",
  "local",
  "arxiv",
  "pubmed",
  "openalex",
  "semantic_scholar",
];

// 8-slot tag palette resolved at render time via CSS variables so dark mode
// auto-adjusts. Cycle index = tags.length % 8.
const TAG_VAR_PALETTE = [
  "var(--tag-0)",
  "var(--tag-1)",
  "var(--tag-2)",
  "var(--tag-3)",
  "var(--tag-4)",
  "var(--tag-5)",
  "var(--tag-6)",
  "var(--tag-7)",
];

const PAGE_SIZE = 50;

const UNCATEGORIZED_ID = "00000000-0000-0000-0000-000000000001";

/** Human-readable byte size, locale-neutral (e.g. "1.2 MB"). */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

/** Recursive depth-first search for a folder by exact name. */
function findFolderByName(nodes: FolderNode[], name: string): FolderNode | null {
  for (const n of nodes) {
    if (n.name === name) return n;
    const inChild = findFolderByName(n.children, name);
    if (inChild) return inChild;
  }
  return null;
}

function FolderTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  onChange,
}: {
  node: FolderNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const isSelected = node.id === selectedId;
  const { isOver, setNodeRef } = useDroppable({ id: `folder:${node.id}` });

  const rename = async () => {
    const next = await promptAsync({
      title: t("library.rename_folder_title"),
      description: t("library.rename_folder_prompt"),
      initialValue: node.name,
      label: t("library.folder_name_label"),
      confirmLabel: t("common.save"),
      cancelLabel: t("common.cancel"),
    });
    if (next && next !== node.name) {
      try {
        await api.renameFolder(node.id, next);
        onChange();
      } catch (e) {
        toast.danger(t("library.error_rename_failed", { detail: String(e) }));
      }
    }
  };

  const remove = async () => {
    if (node.id === UNCATEGORIZED_ID) {
      toast.warning(t("library.uncategorized_undeletable"));
      return;
    }
    const ok = await confirmAsync({
      title: t("library.confirm_delete_folder_title"),
      description: t("library.confirm_delete_folder", { name: node.name }),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await api.deleteFolder(node.id);
      onChange();
    } catch (e) {
      toast.danger(t("library.error_delete_failed", { detail: String(e) }));
    }
  };

  const baseClass = isSelected
    ? "bg-navy-soft text-indigo font-medium"
    : "text-fg-2 hover:bg-navy-faint hover:text-fg-1";
  const overlayClass = isOver
    ? "ring-2 ring-indigo-muted ring-inset bg-indigo-soft"
    : "";

  return (
    <>
      <div
        ref={setNodeRef}
        onClick={() => onSelect(node.id)}
        role="button"
        tabIndex={0}
        className={`group flex items-center gap-1.5 pr-2 py-1.5 text-caption rounded-pill cursor-pointer transition-colors duration-fast ease-khx ${baseClass} ${overlayClass}`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
      >
        <Icon
          icon={node.children.length > 0 ? ChevronRight : FolderClosed}
          size="xs"
          className="shrink-0"
        />
        <span className="truncate flex-1">{node.name}</span>
        <span className="text-micro text-fg-3 shrink-0 tabular-nums">
          {node.paper_count}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            rename();
          }}
          className="opacity-0 group-hover:opacity-100 text-fg-3 hover:text-indigo px-1 transition-opacity duration-fast ease-khx"
          aria-label={t("library.rename_btn_title")}
          title={t("library.rename_btn_title")}
        >
          <Icon icon={Pencil} size="xs" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
          className="opacity-0 group-hover:opacity-100 text-fg-3 hover:text-danger-fg px-1 transition-opacity duration-fast ease-khx"
          aria-label={t("library.delete_btn_title")}
          title={t("library.delete_btn_title")}
        >
          <Icon icon={Trash2} size="xs" />
        </button>
      </div>
      {node.children.map((c) => (
        <FolderTreeItem
          key={c.id}
          node={c}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onChange={onChange}
        />
      ))}
    </>
  );
}

function TagCloud({ tags, onChange }: { tags: Tag[]; onChange: () => void }) {
  const t = useT();
  const toast = useToast();
  const newTag = async () => {
    const name = await promptAsync({
      title: t("library.new_tag_title"),
      description: t("library.new_tag_prompt"),
      label: t("library.tag_name_label"),
      confirmLabel: t("common.create"),
      cancelLabel: t("common.cancel"),
    });
    if (!name) return;
    const color = TAG_VAR_PALETTE[tags.length % TAG_VAR_PALETTE.length];
    try {
      // Backend still expects a CSS color string — `var(--tag-N)` is valid
      // CSS, so dark mode auto-derives. We pass it through as-is.
      await api.createTag(name, color);
      onChange();
    } catch (e) {
      toast.danger(t("library.error_create_failed", { detail: String(e) }));
    }
  };

  const removeTag = async (tag: Tag) => {
    const ok = await confirmAsync({
      title: t("library.confirm_delete_tag_title"),
      description: t("library.confirm_delete_tag", { name: tag.name }),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    try {
      await api.deleteTag(tag.id);
      onChange();
    } catch (e) {
      toast.danger(t("library.error_delete_failed", { detail: String(e) }));
    }
  };

  return (
    <div className="px-3">
      <div className="text-meta uppercase tracking-wide-brand text-fg-3 mb-2 flex items-center justify-between">
        <span>{t("library.tags_section")}</span>
        <button
          type="button"
          onClick={newTag}
          className="inline-flex items-center gap-1.5 px-btn-x-sm py-btn-y-sm rounded-pill border border-border-default bg-card text-fg-1 text-meta font-medium normal-case tracking-normal hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
        >
          <Icon icon={Tags} size="xs" />
          <span>{t("library.new_tag_btn")}</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && (
          <div className="text-meta text-fg-3">{t("library.no_tags")}</div>
        )}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="group inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <span className="opacity-75 tabular-nums">{tag.paper_count}</span>
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="opacity-0 group-hover:opacity-100 hover:bg-black/20 rounded-full p-0.5 transition-opacity duration-fast ease-khx"
              aria-label={t("library.delete_tag_title")}
            >
              <Icon icon={X} size={10} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function PaperRow({
  paper,
  selected,
  needsReview,
  onToggleSelect,
  onChange,
  onReExtract,
  onMove,
  onEdit,
  onDelete,
}: {
  paper: Paper;
  selected: boolean;
  needsReview: boolean;
  onToggleSelect: (id: string) => void;
  onChange: () => void;
  onReExtract: (paperId: string) => void;
  onMove: (paper: Paper) => void;
  onEdit: (paper: Paper) => void;
  onDelete: (paper: Paper) => void;
}) {
  const t = useT();
  const toast = useToast();
  // V2.2.10 (Session 48, R2) — title click → built-in reader; the timer
  // disambiguates single click (view) from double click (edit metadata).
  const { openPaper } = useOpenPaperView();
  const titleClickTimer = useRef<number | null>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `paper:${paper.id}`, data: { paper } });

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : {};

  const cycleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = READ_STATUS_CYCLE[paper.read_status] ?? "unread";
    try {
      await api.setReadStatus(paper.id, next);
      onChange();
    } catch (err) {
      toast.danger(t("library.error_update_failed", { detail: String(err) }));
    }
  };

  const sourceCls =
    SOURCE_BADGE[paper.source] ?? "bg-badge-default-bg text-badge-default-fg";
  const sourceLabel =
    paper.source === "local"
      ? t("library.source_local")
      : (SOURCE_DISPLAY[paper.source] ?? paper.source);

  const actionBtn =
    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border border-border-default text-meta text-fg-2 hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted transition-colors duration-fast ease-khx";

  return (
    <article
      ref={setNodeRef}
      style={style}
      // V2.2.1 fix: dropped `overflow-hidden` so the FavoriteButton
      // popover inside PaperActions can escape the card boundary.
      // The left-edge read-status bar now carries `rounded-l-card`
      // itself to keep the card's rounded left corners clean.
      className={`group bg-card rounded-card shadow-card flex transition-shadow duration-base ease-khx ${
        selected ? "ring-2 ring-indigo-muted ring-inset" : ""
      } ${
        isDragging
          ? "shadow-card-hover opacity-60"
          : "hover:shadow-card-hover"
      }`}
    >
      <button
        type="button"
        onClick={cycleStatus}
        title={t("library.status_tooltip", {
          label: t(
            READ_STATUS_KEY[paper.read_status] ?? "library.read_status_unread",
          ),
        })}
        aria-label={t("library.aria_toggle_status")}
        className={`w-read-bar self-stretch shrink-0 cursor-pointer rounded-l-card transition-opacity duration-fast ease-khx hover:opacity-75 ${
          READ_STATUS_BAR[paper.read_status] ?? "bg-read-unread"
        }`}
      />
      <div className="flex-1 p-5 flex flex-col gap-3">
        {/* Meta row — NOT draggable: selection checkbox + source + flags + date */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onToggleSelect(paper.id)}
            aria-pressed={selected}
            aria-label={t("library.select_paper")}
            className={`shrink-0 transition-colors duration-fast ease-khx ${
              selected
                ? "text-indigo"
                : "text-fg-3 hover:text-indigo"
            }`}
          >
            <Icon icon={selected ? CheckSquare : Square} size="sm" />
          </button>
          <span
            className={`inline-flex items-center gap-1 shrink-0 text-micro uppercase tracking-wide-brand px-2 py-0.5 rounded-pill font-semibold ${sourceCls}`}
          >
            {paper.source === "local" && <Icon icon={HardDrive} size={10} />}
            {sourceLabel}
          </span>
          {needsReview && (
            <button
              type="button"
              onClick={() => onReExtract(paper.id)}
              title={t("library.needs_review_hint")}
              className="inline-flex items-center gap-1 shrink-0 text-micro px-2 py-0.5 rounded-pill font-medium bg-warning-bg text-warning-fg border border-warning-border hover:opacity-80 transition-opacity duration-fast ease-khx"
            >
              <Icon icon={AlertTriangle} size={10} />
              {t("library.needs_review_badge")}
            </button>
          )}
          {paper.published_at && (
            <span className="text-meta text-fg-3 tabular-nums">
              {paper.published_at.slice(0, 10)}
            </span>
          )}
        </div>

        {/* Draggable body — the title/author/abstract block is the drag handle.
            V2.2.9 (Session 46) — metadata editing moved off the button row;
            double-click the title to open the editor.
            V2.2.10 (Session 48, R2) — SINGLE click on the title opens the
            built-in reader. Deferred by 250ms so a double-click (edit) can
            cancel it — the classic single/double click disambiguation. */}
        <div
          className="cursor-grab active:cursor-grabbing"
          onDoubleClick={() => {
            if (titleClickTimer.current !== null) {
              window.clearTimeout(titleClickTimer.current);
              titleClickTimer.current = null;
            }
            onEdit(paper);
          }}
          title={t("library.dblclick_edit_hint")}
          {...listeners}
          {...attributes}
        >
          <h3
            onClick={() => {
              if (titleClickTimer.current !== null) return;
              titleClickTimer.current = window.setTimeout(() => {
                titleClickTimer.current = null;
                void openPaper(paper);
              }, 250);
            }}
            title={t("paper_actions.view_title")}
            className="text-h3 font-semibold text-fg-1 leading-snug cursor-pointer hover:text-indigo transition-colors duration-fast ease-khx"
          >
            {paper.title}
          </h3>
          <p className="mt-1 text-meta text-fg-2">
            {paper.authors.slice(0, 4).join(", ")}
            {paper.authors.length > 4 && t("library.et_al")}
          </p>
          {paper.abstract && (
            <p className="mt-2 text-caption text-fg-2 line-clamp-2 leading-relaxed">
              {paper.abstract}
            </p>
          )}
        </div>

        {/* Actions row */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 flex-wrap"
        >
          {/* V2.2.9 (Session 46) — final order:
              收藏 · 查看 · AI 精读 · 翻译 · 文件 · 来源 · 移动 · 删除.
              Metadata editing moved to double-click on the title. */}
          <PaperActions paper={paper} size="sm" variant="library" />
          <button
            type="button"
            onClick={() => onMove(paper)}
            className={actionBtn}
            title={t("library.move_btn")}
          >
            <Icon icon={FolderInput} size="xs" />
            <span>{t("library.move_btn")}</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(paper)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border border-border-default text-meta text-fg-2 hover:text-danger-fg hover:bg-danger-bg hover:border-danger-border transition-colors duration-fast ease-khx"
            title={t("common.delete")}
          >
            <Icon icon={Trash2} size="xs" />
            <span>{t("common.delete")}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Library() {
  const t = useT();
  const toast = useToast();
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<{
    paperId: string;
    initial: PartialMetadata;
    pdfPath: string | null;
  } | null>(null);

  // ── Local-PDF upload / management state ──────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgressPayload | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [storage, setStorage] = useState<StorageUsage | null>(null);

  const handleReExtract = async (paperId: string) => {
    try {
      const fresh = await api.reExtractPaperMetadata(paperId);
      const paper = papers.find((p) => p.id === paperId);
      setEditorData({
        paperId,
        initial: fresh,
        pdfPath: paper?.pdf_path ?? null,
      });
    } catch (e) {
      toast.danger(t("library.error_re_extract_failed", { detail: String(e) }));
    }
  };

  const handleEdit = (paper: Paper) => {
    setEditorData({
      paperId: paper.id,
      initial: {
        title: paper.title,
        authors: paper.authors,
        abstract: paper.abstract,
        doi: paper.doi,
        confidence: 1,
        source: "pdf_info",
      },
      pdfPath: paper.pdf_path,
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const refreshTree = () => {
    api
      .getFolderTree()
      .then((nodes) => {
        setTree(nodes);
        if (!selectedId && nodes.length > 0) {
          setSelectedId(nodes[0].id);
        }
      })
      .catch((e) => setError(String(e)));
    api
      .getTags()
      .then(setTags)
      .catch((e) => console.warn("getTags", e));
  };

  const refreshPapers = () => {
    if (!selectedId) {
      setPapers([]);
      setTotal(0);
      return;
    }
    api
      .getPapersByFolder(selectedId, page, PAGE_SIZE)
      .then((res) => {
        setPapers(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(String(e)));
  };

  const refreshStorage = () => {
    api
      .getUploadedPdfsSize()
      .then(setStorage)
      .catch((e) => console.warn("getUploadedPdfsSize", e));
  };

  // refreshTree runs once on mount; it reads selectedId only to pick a
  // default folder when none is selected yet, so the missing dep is
  // intentional — we don't want to re-fetch the tree on every selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshTree, []);
  useEffect(refreshPapers, [selectedId, page]);
  useEffect(refreshStorage, []);

  // Clear the multi-select whenever the folder or page changes so stale
  // ids don't carry over into a different view.
  useEffect(() => {
    setSelected(new Set());
  }, [selectedId, page]);

  const refreshAll = () => {
    refreshTree();
    refreshPapers();
  };

  const findOrCreateFolderId = async (name: string): Promise<string> => {
    const existing = findFolderByName(tree, name);
    if (existing) return existing.id;
    const folder = await api.createFolder(name, null);
    return folder.id;
  };

  // ── Upload pipeline (button + OS drag-drop share this) ───────────
  const doUpload = async (rawPaths: string[]) => {
    const pdfPaths = rawPaths.filter((p) => p.toLowerCase().endsWith(".pdf"));
    const skipped = rawPaths.length - pdfPaths.length;
    if (skipped > 0) {
      toast.warning(t("library.upload_non_pdf_skipped", { count: skipped }));
    }
    if (pdfPaths.length === 0) return;

    // Duplicate detection (byte-identical to an already-imported PDF).
    let toImport = pdfPaths;
    try {
      const dups = await api.checkDuplicatePdfs(pdfPaths);
      if (dups.length > 0) {
        const importAnyway = await confirmAsync({
          title: t("library.dup_title"),
          description: t("library.dup_desc", { count: dups.length }),
          confirmLabel: t("library.dup_import_anyway"),
          cancelLabel: t("library.dup_skip"),
        });
        if (!importAnyway) {
          const dupSet = new Set(dups.map((d) => d.file_path));
          toImport = pdfPaths.filter((p) => !dupSet.has(p));
        }
      }
    } catch (e) {
      console.warn("checkDuplicatePdfs failed", e);
    }

    if (toImport.length === 0) {
      toast.info(t("library.upload_all_skipped"));
      return;
    }

    const targetFolder = selectedId ?? UNCATEGORIZED_ID;
    setIsUploading(true);
    setUploadProgress({ current: 0, total: toImport.length, current_file: "" });

    try {
      const results = await api.uploadLocalPapersBatch(toImport);
      const okItems = results.filter((r) => r.success && r.paper_id);
      const okIds = okItems.map((r) => r.paper_id as string);
      const failCount = results.length - okItems.length;

      if (okIds.length > 0) {
        try {
          await api.batchAddToFolder(targetFolder, okIds);
        } catch (e) {
          console.warn("batchAddToFolder failed", e);
        }
      }

      const newReview = okItems
        .filter((r) => r.needs_user_review)
        .map((r) => r.paper_id as string);
      if (newReview.length > 0) {
        setReviewIds((prev) => {
          const next = new Set(prev);
          newReview.forEach((id) => next.add(id));
          return next;
        });
      }

      if (failCount === 0) {
        toast.success(t("library.upload_success", { count: okIds.length }));
      } else if (okIds.length > 0) {
        toast.warning(
          t("library.upload_partial", { ok: okIds.length, fail: failCount }),
        );
      } else {
        toast.danger(t("library.upload_all_failed"));
      }

      refreshAll();
      refreshStorage();

      // Open the metadata editor for the first low-confidence import so the
      // user can complete it immediately.
      if (newReview.length > 0) {
        await handleReExtract(newReview[0]);
      }
    } catch (e) {
      toast.danger(t("library.error_upload_failed", { detail: String(e) }));
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Keep the latest doUpload in a ref so the once-registered OS drag-drop
  // listener always calls the current closure (avoids stale state).
  const doUploadRef = useRef(doUpload);
  doUploadRef.current = doUpload;

  const handleUploadClick = async () => {
    let picked: string | string[] | null;
    try {
      picked = await openDialog({
        multiple: true,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    } catch (e) {
      toast.danger(t("library.error_picker", { detail: String(e) }));
      return;
    }
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    if (paths.length > 0) await doUpload(paths);
  };

  // OS-level upload progress events emitted by the backend batch importer.
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<UploadProgressPayload>("upload:progress", (event) => {
      setUploadProgress(event.payload);
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  // OS file drag-and-drop onto the window (default-enabled in Tauri 2).
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const p = event.payload;
        if (p.type === "enter" || p.type === "over") {
          setDragActive(true);
        } else if (p.type === "leave") {
          setDragActive(false);
        } else if (p.type === "drop") {
          setDragActive(false);
          if (p.paths && p.paths.length > 0) {
            void doUploadRef.current(p.paths);
          }
        }
      })
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const visiblePapers = useMemo(() => {
    let v = papers;
    if (statusFilter !== "all") {
      v = v.filter((p) => p.read_status === statusFilter);
    }
    if (sourceFilter !== "all") {
      v = v.filter((p) => p.source === sourceFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      v = v.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authors.some((a) => a.toLowerCase().includes(q)),
      );
    }
    return v;
  }, [papers, statusFilter, sourceFilter, search]);

  const selectedFolder = useMemo(() => {
    const find = (nodes: FolderNode[]): FolderNode | null => {
      for (const n of nodes) {
        if (n.id === selectedId) return n;
        const inChild = find(n.children);
        if (inChild) return inChild;
      }
      return null;
    };
    return find(tree);
  }, [tree, selectedId]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const folderTarget = String(event.over?.id ?? "");
    const paperSource = String(event.active.id);
    if (
      !folderTarget.startsWith("folder:") ||
      !paperSource.startsWith("paper:")
    )
      return;
    const folderId = folderTarget.slice("folder:".length);
    const paperId = paperSource.slice("paper:".length);
    try {
      await api.addToFolder(folderId, paperId);
      refreshAll();
    } catch (e) {
      toast.danger(t("library.error_add_failed", { detail: String(e) }));
    }
  };

  const newRootFolder = async () => {
    const name = await promptAsync({
      title: t("library.new_top_folder_title"),
      description: t("library.new_top_folder_prompt"),
      label: t("library.folder_name_label"),
      confirmLabel: t("common.create"),
      cancelLabel: t("common.cancel"),
    });
    if (!name) return;
    try {
      await api.createFolder(name, null);
      refreshTree();
    } catch (e) {
      toast.danger(t("library.error_create_failed", { detail: String(e) }));
    }
  };

  // ── Per-row move / delete ────────────────────────────────────────
  const handleMoveOne = async (paper: Paper) => {
    const name = await promptAsync({
      title: t("library.move_to_folder_title"),
      description: t("library.move_to_folder_prompt"),
      label: t("library.folder_name_label"),
      confirmLabel: t("common.confirm"),
      cancelLabel: t("common.cancel"),
    });
    if (!name) return;
    const from = selectedId ?? UNCATEGORIZED_ID;
    try {
      const targetId = await findOrCreateFolderId(name);
      if (targetId === from) {
        toast.info(t("library.move_same_folder"));
        return;
      }
      await api.movePaperToFolder(paper.id, from, targetId);
      toast.success(t("library.move_done", { count: 1 }));
      refreshAll();
    } catch (e) {
      toast.danger(t("library.error_move_failed", { detail: String(e) }));
    }
  };

  const handleDeleteOne = async (paper: Paper) => {
    const ok = await confirmAsync({
      title: t("library.confirm_delete_paper_title"),
      description: t("library.confirm_delete_paper", { title: paper.title }),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    let deleteFile = false;
    if (paper.source === "local" && paper.pdf_path) {
      deleteFile = await confirmAsync({
        title: t("library.delete_file_title"),
        description: t("library.delete_file_desc"),
        confirmLabel: t("library.delete_file_yes"),
        cancelLabel: t("library.delete_file_keep"),
      });
    }
    try {
      await api.deletePaper(paper.id, deleteFile);
      toast.success(t("library.delete_done_one"));
      setReviewIds((prev) => {
        const next = new Set(prev);
        next.delete(paper.id);
        return next;
      });
      refreshAll();
      refreshStorage();
    } catch (e) {
      toast.danger(t("library.error_delete_failed", { detail: String(e) }));
    }
  };

  // ── Batch operations on the multi-selection ──────────────────────
  const batchMove = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const name = await promptAsync({
      title: t("library.move_to_folder_title"),
      description: t("library.move_to_folder_prompt"),
      label: t("library.folder_name_label"),
      confirmLabel: t("common.confirm"),
      cancelLabel: t("common.cancel"),
    });
    if (!name) return;
    const from = selectedId ?? UNCATEGORIZED_ID;
    try {
      const targetId = await findOrCreateFolderId(name);
      if (targetId === from) {
        toast.info(t("library.move_same_folder"));
        return;
      }
      let ok = 0;
      for (const id of ids) {
        try {
          await api.movePaperToFolder(id, from, targetId);
          ok += 1;
        } catch (e) {
          console.warn("movePaperToFolder failed", id, e);
        }
      }
      toast.success(t("library.move_done", { count: ok }));
      setSelected(new Set());
      refreshAll();
    } catch (e) {
      toast.danger(t("library.error_move_failed", { detail: String(e) }));
    }
  };

  const batchTagSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const name = await promptAsync({
      title: t("library.batch_tag_title"),
      description: t("library.batch_tag_prompt"),
      label: t("library.tag_name_label"),
      confirmLabel: t("common.confirm"),
      cancelLabel: t("common.cancel"),
    });
    if (!name) return;
    try {
      let tagId: string;
      const existing = tags.find((tg) => tg.name === name);
      if (existing) {
        tagId = existing.id;
      } else {
        const color = TAG_VAR_PALETTE[tags.length % TAG_VAR_PALETTE.length];
        const created = await api.createTag(name, color);
        tagId = created.id;
      }
      const n = await api.batchTag(tagId, ids);
      toast.success(t("library.batch_tag_done", { count: n }));
      setSelected(new Set());
      refreshAll();
    } catch (e) {
      toast.danger(t("library.error_tag_failed", { detail: String(e) }));
    }
  };

  const batchDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirmAsync({
      title: t("library.confirm_delete_papers_title"),
      description: t("library.confirm_delete_papers", { count: ids.length }),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    const idSet = new Set(ids);
    const hasLocal = papers.some(
      (p) => idSet.has(p.id) && p.source === "local" && p.pdf_path,
    );
    let deleteFiles = false;
    if (hasLocal) {
      deleteFiles = await confirmAsync({
        title: t("library.delete_file_title"),
        description: t("library.delete_file_desc"),
        confirmLabel: t("library.delete_file_yes"),
        cancelLabel: t("library.delete_file_keep"),
      });
    }
    try {
      const n = await api.deletePapersBatch(ids, deleteFiles);
      toast.success(t("library.delete_done", { count: n }));
      setReviewIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setSelected(new Set());
      refreshAll();
      refreshStorage();
    } catch (e) {
      toast.danger(t("library.error_delete_failed", { detail: String(e) }));
    }
  };

  const handleCleanup = async () => {
    const ok = await confirmAsync({
      title: t("library.cleanup_title"),
      description: t("library.cleanup_desc"),
      variant: "danger",
      confirmLabel: t("library.cleanup_confirm"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    try {
      const res = await api.cleanupOrphanPdfs();
      if (res.removed_count === 0) {
        toast.info(t("library.cleanup_none"));
      } else {
        toast.success(
          t("library.cleanup_done", {
            count: res.removed_count,
            size: formatBytes(res.freed_bytes),
          }),
        );
      }
      refreshStorage();
    } catch (e) {
      toast.danger(t("library.error_cleanup_failed", { detail: String(e) }));
    }
  };

  const exportBibtex = async () => {
    if (papers.length === 0) {
      toast.info(t("library.alert_no_papers_to_export"));
      return;
    }
    const entries = papers
      .map((p) => {
        const key = p.id.replace(/[^A-Za-z0-9]/g, "");
        const author = p.authors.join(" and ");
        const year = p.published_at?.slice(0, 4) ?? "";
        const lines = [
          `  title = {${p.title}}`,
          author && `  author = {${author}}`,
          year && `  year = {${year}}`,
          p.doi && `  doi = {${p.doi}}`,
          p.source_url && `  url = {${p.source_url}}`,
        ].filter(Boolean);
        return `@article{${key},\n${lines.join(",\n")}\n}`;
      })
      .join("\n\n");
    const filename = `${selectedFolder?.name ?? "library"}.bib`;
    try {
      const path = await api.exportTextFile(filename, entries);
      toast.success(
        t("library.toast_export_success", {
          count: papers.length,
          path,
        }),
      );
    } catch (e) {
      toast.danger(t("library.error_export_failed", { detail: String(e) }));
    }
  };

  const progressPct =
    uploadProgress && uploadProgress.total > 0
      ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
      : 0;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full bg-page text-fg-1">
        <aside
          aria-label="Library folders and tags"
          className="w-side-panel border-r border-border-default bg-soft flex flex-col"
        >
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="text-meta uppercase tracking-wide-brand text-fg-3 px-3 mb-3 flex items-center justify-between">
              <span>{t("library.folders_section")}</span>
              <button
                type="button"
                onClick={newRootFolder}
                className="inline-flex items-center gap-1.5 px-btn-x-sm py-btn-y-sm rounded-pill border border-border-default bg-card text-fg-1 text-meta font-medium normal-case tracking-normal hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
              >
                <Icon icon={FolderPlus} size="xs" />
                <span>{t("library.new_folder_btn")}</span>
              </button>
            </div>
            {tree.map((n) => (
              <FolderTreeItem
                key={n.id}
                node={n}
                depth={0}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={refreshAll}
              />
            ))}
          </div>
          <div className="border-t border-border-default py-3 max-h-48 overflow-y-auto">
            <TagCloud tags={tags} onChange={refreshTree} />
          </div>

          {/* Local-PDF storage usage + orphan cleanup */}
          <div className="border-t border-border-default px-3 py-3">
            <div className="text-meta uppercase tracking-wide-brand text-fg-3 mb-2 px-3 flex items-center gap-1.5">
              <Icon icon={HardDrive} size="xs" />
              <span>{t("library.storage_section")}</span>
            </div>
            <div className="px-3 text-meta text-fg-2 tabular-nums">
              {storage && storage.file_count > 0
                ? t("library.storage_usage", {
                    count: storage.file_count,
                    size: formatBytes(storage.total_bytes),
                  })
                : t("library.storage_empty")}
            </div>
            <button
              type="button"
              onClick={handleCleanup}
              className="mt-2 ml-3 inline-flex items-center gap-1.5 px-btn-x-sm py-btn-y-sm rounded-pill border border-border-default bg-card text-fg-2 text-meta font-medium hover:text-danger-fg hover:border-danger-border transition-colors duration-fast ease-khx"
            >
              <Icon icon={Trash2} size="xs" />
              <span>{t("library.cleanup_btn")}</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-page">
          <div className="border-b border-border-default px-8 py-4 bg-card">
            <div className="flex items-baseline gap-3">
              <h1 className="text-h2 font-semibold text-fg-1">
                {selectedFolder?.name ?? t("library.default_title")}
              </h1>
              <span className="text-meta text-fg-3">
                {t("library.count_papers", { count: total })}
              </span>
            </div>
            <div className="flex gap-3 mt-4 items-center flex-wrap">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("library.search_in_folder")}
                className="flex-1 min-w-[200px] px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
                style={{ fontSize: "13px" }}
              />
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
                >
                  <option value="all">{t("library.status_filter_all")}</option>
                  <option value="unread">{t("library.read_status_unread")}</option>
                  <option value="reading">{t("library.read_status_reading")}</option>
                  <option value="read">{t("library.read_status_read")}</option>
                  <option value="parsed">{t("library.read_status_parsed")}</option>
                </select>
                <Icon
                  icon={ChevronDown}
                  size="sm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
                />
              </div>
              <div className="relative">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
                >
                  {SOURCE_FILTER_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {s === "all"
                        ? t("library.source_filter_all")
                        : s === "local"
                          ? t("library.source_local")
                          : (SOURCE_DISPLAY[s] ?? s)}
                    </option>
                  ))}
                </select>
                <Icon
                  icon={ChevronDown}
                  size="sm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
                />
              </div>
              <button
                type="button"
                onClick={handleUploadClick}
                title={t("library.upload_pdf_title")}
                className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover transition-colors duration-fast ease-khx text-caption font-medium"
              >
                <Icon icon={Upload} size="sm" />
                <span>{t("library.upload_pdf_btn")}</span>
              </button>
              <button
                type="button"
                onClick={exportBibtex}
                className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
              >
                <Icon icon={Download} size="sm" />
                <span>{t("library.export_bibtex")}</span>
              </button>
            </div>
          </div>

          {/* Contextual batch-action bar for the multi-selection */}
          {selected.size > 0 && (
            <div className="border-b border-border-default px-8 py-2.5 bg-soft flex items-center gap-3 flex-wrap">
              <span className="text-caption text-fg-1 font-medium tabular-nums">
                {t("library.selected_count", { count: selected.size })}
              </span>
              <button
                type="button"
                onClick={batchMove}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default bg-card text-meta text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
              >
                <Icon icon={FolderInput} size="xs" />
                <span>{t("library.batch_move_btn")}</span>
              </button>
              <button
                type="button"
                onClick={batchTagSelected}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default bg-card text-meta text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
              >
                <Icon icon={Tags} size="xs" />
                <span>{t("library.batch_tag_btn")}</span>
              </button>
              <button
                type="button"
                onClick={batchDelete}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default bg-card text-meta text-fg-1 hover:text-danger-fg hover:border-danger-border transition-colors duration-fast ease-khx"
              >
                <Icon icon={Trash2} size="xs" />
                <span>{t("common.delete")}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-pill text-meta text-fg-2 hover:text-fg-1 transition-colors duration-fast ease-khx"
              >
                <Icon icon={X} size="xs" />
                <span>{t("library.clear_selection")}</span>
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-8 max-w-5xl">
            {isUploading && (
              <div className="mb-4 rounded-card-sm border border-border-default bg-card px-4 py-3 flex items-center gap-3">
                <Icon
                  icon={Loader2}
                  size="sm"
                  className="animate-spin text-indigo shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-caption text-fg-1">
                    {t("library.uploading_progress", {
                      current: uploadProgress?.current ?? 0,
                      total: uploadProgress?.total ?? 0,
                    })}
                  </div>
                  {uploadProgress?.current_file && (
                    <div className="text-meta text-fg-3 truncate">
                      {uploadProgress.current_file}
                    </div>
                  )}
                  <div className="mt-1.5 h-1.5 rounded-pill bg-border-default overflow-hidden">
                    <div
                      className="h-full bg-indigo transition-[width] duration-base ease-khx"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption mb-4"
              >
                <Icon
                  icon={AlertTriangle}
                  size="sm"
                  className="flex-shrink-0 mt-0.5"
                />
                <span>{t("search.error_prefix", { detail: error })}</span>
              </div>
            )}
            {visiblePapers.length === 0 ? (
              papers.length === 0 ? (
                <Stage
                  intensity="soft"
                  className="rounded-card p-12 text-center"
                >
                  <EmptyLibraryArt
                    width={160}
                    height={120}
                    aria-hidden="true"
                    className="mx-auto text-indigo opacity-80"
                  />
                  <p className="text-caption text-fg-2 mt-4">
                    {t("library.empty_folder_hint")}
                  </p>
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="mt-4 inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover transition-colors duration-fast ease-khx text-caption font-medium"
                  >
                    <Icon icon={Upload} size="sm" />
                    <span>{t("library.upload_pdf_btn")}</span>
                  </button>
                </Stage>
              ) : (
                <div className="text-caption text-fg-3 text-center py-12">
                  {t("library.empty_filter_hint")}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-3">
                {visiblePapers.map((p) => (
                  <PaperRow
                    key={p.id}
                    paper={p}
                    selected={selected.has(p.id)}
                    needsReview={reviewIds.has(p.id)}
                    onToggleSelect={toggleSelect}
                    onChange={refreshAll}
                    onReExtract={handleReExtract}
                    onMove={handleMoveOne}
                    onEdit={handleEdit}
                    onDelete={handleDeleteOne}
                  />
                ))}
              </div>
            )}

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 mt-6 text-meta">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill border border-border-default text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 transition-colors duration-fast ease-khx"
                >
                  <Icon icon={ChevronRight} size="xs" className="rotate-180" />
                  <span>{t("library.prev_page")}</span>
                </button>
                <span className="text-fg-2 tabular-nums">
                  {t("library.page_x_of_y", {
                    cur: page + 1,
                    total: Math.ceil(total / PAGE_SIZE),
                  })}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) =>
                      (p + 1) * PAGE_SIZE >= total ? p : p + 1,
                    )
                  }
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill border border-border-default text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 transition-colors duration-fast ease-khx"
                >
                  <span>{t("library.next_page")}</span>
                  <Icon icon={ChevronRight} size="xs" />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* OS file-drop overlay — visual only; the webview delivers the paths. */}
      {dragActive && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
          <div className="rounded-card border-2 border-dashed border-indigo bg-card px-8 py-6 flex flex-col items-center gap-3 shadow-card-hover">
            <Icon icon={Upload} size={32} className="text-indigo" />
            <p className="text-caption text-fg-1">
              {t("library.drop_hint", {
                folder: selectedFolder?.name ?? t("library.uncategorized"),
              })}
            </p>
          </div>
        </div>
      )}

      {editorData && (
        <PaperMetadataEditor
          paperId={editorData.paperId}
          initial={editorData.initial}
          pdfPath={editorData.pdfPath}
          onClose={() => setEditorData(null)}
          onSaved={() => {
            const savedId = editorData.paperId;
            setEditorData(null);
            setReviewIds((prev) => {
              const next = new Set(prev);
              next.delete(savedId);
              return next;
            });
            refreshPapers();
          }}
        />
      )}
    </DndContext>
  );
}
