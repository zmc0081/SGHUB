// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  api,
  type FolderNode,
  type Paper,
  type PartialMetadata,
  type Tag,
} from "../lib/tauri";
import { PaperActions } from "../components/PaperActions";
import { PaperMetadataEditor } from "../components/PaperMetadataEditor";
import { useT } from "../hooks/useT";

const READ_STATUS_BAR: Record<string, string> = {
  unread: "bg-gray-300",
  reading: "bg-amber-400",
  read: "bg-emerald-500",
  parsed: "bg-indigo-500",
};

// Map status code → i18n key; resolved at render time so values stay
// in sync with the active language.
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
  arxiv: "bg-[#B31B1B] text-white",
  semantic_scholar: "bg-[#1857B6] text-white",
  pubmed: "bg-[#00897B] text-white",
  openalex: "bg-[#7B3FBF] text-white",
  local: "bg-gray-500 text-white",
};

const TAG_PALETTE = [
  "#1F3864",
  "#D4A017",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
  "#EC4899",
];

const PAGE_SIZE = 50;

// ============================================================
// Folder tree
// ============================================================

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
  const isSelected = node.id === selectedId;
  const { isOver, setNodeRef } = useDroppable({ id: `folder:${node.id}` });

  const rename = async () => {
    const next = prompt(t("library.rename_folder_prompt"), node.name);
    if (next && next !== node.name) {
      try {
        await api.renameFolder(node.id, next);
        onChange();
      } catch (e) {
        alert(t("library.error_rename_failed", { detail: String(e) }));
      }
    }
  };

  const remove = async () => {
    if (
      node.id === "00000000-0000-0000-0000-000000000001"
    ) {
      alert(t("library.uncategorized_undeletable"));
      return;
    }
    if (!confirm(t("library.confirm_delete_folder", { name: node.name })))
      return;
    try {
      await api.deleteFolder(node.id);
      onChange();
    } catch (e) {
      alert(t("library.error_delete_failed", { detail: String(e) }));
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        onClick={() => onSelect(node.id)}
        className={`group flex items-center gap-1.5 pr-2 py-1.5 text-sm rounded cursor-pointer transition-colors ${
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-black/5 text-app-fg/80"
        } ${isOver ? "ring-2 ring-accent ring-inset bg-accent/10" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className="shrink-0">📁</span>
        <span className="truncate flex-1">{node.name}</span>
        <span className="text-[10px] text-app-fg/50 shrink-0">
          {node.paper_count}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            rename();
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-app-fg/50 hover:text-primary px-1"
          title={t("library.rename_btn_title")}
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-app-fg/50 hover:text-red-600 px-1"
          title={t("library.delete_btn_title")}
        >
          🗑
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

// ============================================================
// Tag cloud
// ============================================================

function TagCloud({ tags, onChange }: { tags: Tag[]; onChange: () => void }) {
  const t = useT();
  const newTag = async () => {
    const name = prompt(t("library.new_tag_prompt"));
    if (!name) return;
    const color = TAG_PALETTE[tags.length % TAG_PALETTE.length];
    try {
      await api.createTag(name, color);
      onChange();
    } catch (e) {
      alert(t("library.error_create_failed", { detail: String(e) }));
    }
  };

  const removeTag = async (tag: Tag) => {
    if (!confirm(t("library.confirm_delete_tag", { name: tag.name }))) return;
    try {
      await api.deleteTag(tag.id);
      onChange();
    } catch (e) {
      alert(t("library.error_delete_failed", { detail: String(e) }));
    }
  };

  return (
    <div className="px-2">
      <div className="text-[10px] uppercase tracking-wider text-app-fg/50 mb-2 flex items-center justify-between">
        <span>{t("library.tags_section")}</span>
        <button
          onClick={newTag}
          className="text-[10px] text-primary hover:underline"
        >
          {t("library.new_tag_btn")}
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {tags.length === 0 && (
          <div className="text-[10px] text-app-fg/40">{t("library.no_tags")}</div>
        )}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="group inline-flex items-center text-[11px] px-1.5 py-0.5 rounded text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <span className="ml-1 opacity-60 text-[9px]">{tag.paper_count}</span>
            <button
              onClick={() => removeTag(tag)}
              className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-black/20 rounded px-0.5"
              title={t("library.delete_tag_title")}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Paper card (draggable)
// ============================================================

function PaperRow({
  paper,
  onChange,
  onReExtract,
}: {
  paper: Paper;
  /** Kept for backward-compat callers; FavoriteButton + PaperActions now
   *  handle folder membership directly via libraryStore events. */
  currentFolderId?: string | null;
  onChange: () => void;
  /** Only invoked for local papers — re-runs PDF metadata extraction
   *  and opens the editor with the fresh result. */
  onReExtract?: (paperId: string) => void;
}) {
  const t = useT();
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
      alert(t("library.error_update_failed", { detail: String(err) }));
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-white rounded border border-black/10 flex overflow-hidden transition-all ${
        isDragging ? "shadow-lg opacity-60" : "hover:border-primary/30"
      }`}
    >
      <button
        onClick={cycleStatus}
        title={t("library.status_tooltip", {
          label: t(
            READ_STATUS_KEY[paper.read_status] ?? "library.read_status_unread",
          ),
        })}
        aria-label={t("library.aria_toggle_status")}
        className={`w-2.5 self-stretch shrink-0 cursor-pointer transition-opacity hover:opacity-70 ${
          READ_STATUS_BAR[paper.read_status] ?? "bg-gray-300"
        }`}
      />
      <div className="flex-1 p-3 flex flex-col gap-2">
        {/* Top half — drag handle on title block, action row separately so
            clicks don't initiate a drag. */}
        <div
          className="cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <div className="flex items-start gap-2">
            <span
              className={`shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${
                SOURCE_BADGE[paper.source] ?? "bg-app-fg/20 text-app-fg"
              }`}
            >
              {paper.source}
            </span>
            <span className="text-sm font-semibold text-primary leading-snug truncate">
              {paper.title}
            </span>
          </div>
          <div className="mt-1 text-xs text-app-fg/70">
            {paper.authors.slice(0, 4).join(", ")}
            {paper.authors.length > 4 && t("library.et_al")}
            {paper.published_at && ` · ${paper.published_at.slice(0, 10)}`}
          </div>
          {paper.abstract && (
            <p className="mt-1.5 text-xs text-app-fg/70 line-clamp-2">
              {paper.abstract}
            </p>
          )}
        </div>
        {/* Bottom half — actions (PaperActions handles fav / parse / pdf).
            currentFolderId is implicitly tracked via the FavoriteButton's
            folder picker; the Library-specific "remove from this folder"
            is now done by clicking ⭐ → toggling the current folder off. */}
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 flex-wrap">
          <PaperActions paper={paper} />
          {paper.source === "local" && onReExtract && (
            <button
              onClick={() => onReExtract(paper.id)}
              className="px-2 py-1 rounded border border-black/10 hover:border-primary/30 hover:bg-primary/5 text-xs text-app-fg/70"
              title={t("library.re_extract_btn_title")}
            >
              {t("library.re_extract_btn")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main page
// ============================================================

export default function Library() {
  const t = useT();
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  // Re-extract metadata flow — opens editor with freshly-extracted result.
  const [editorData, setEditorData] = useState<{
    paperId: string;
    initial: PartialMetadata;
    pdfPath: string | null;
  } | null>(null);

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
      alert(t("library.error_re_extract_failed", { detail: String(e) }));
    }
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
    api.getTags().then(setTags).catch((e) => console.warn("getTags", e));
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshTree, []);
   
  useEffect(refreshPapers, [selectedId, page]);

  const refreshAll = () => {
    refreshTree();
    refreshPapers();
  };

  const visiblePapers = useMemo(() => {
    let v = papers;
    if (statusFilter !== "all") {
      v = v.filter((p) => p.read_status === statusFilter);
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
  }, [papers, statusFilter, search]);

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const folderTarget = String(event.over?.id ?? "");
    const paperSource = String(event.active.id);
    if (!folderTarget.startsWith("folder:") || !paperSource.startsWith("paper:"))
      return;
    const folderId = folderTarget.slice("folder:".length);
    const paperId = paperSource.slice("paper:".length);
    try {
      await api.addToFolder(folderId, paperId);
      refreshAll();
    } catch (e) {
      alert(t("library.error_add_failed", { detail: String(e) }));
    }
  };

  const newRootFolder = async () => {
    const name = prompt(t("library.new_top_folder_prompt"));
    if (!name) return;
    try {
      await api.createFolder(name, null);
      refreshTree();
    } catch (e) {
      alert(t("library.error_create_failed", { detail: String(e) }));
    }
  };

  const exportBibtex = async () => {
    if (papers.length === 0) {
      alert(t("library.alert_no_papers_to_export"));
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
      alert(
        t("library.alert_export_success", { count: papers.length, path }),
      );
    } catch (e) {
      alert(t("library.error_export_failed", { detail: String(e) }));
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        {/* LEFT: folder tree + tag cloud */}
        <aside className="w-72 border-r border-black/10 bg-white/40 flex flex-col">
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="text-[10px] uppercase tracking-wider text-app-fg/50 px-2 mb-2 flex items-center justify-between">
              <span>{t("library.folders_section")}</span>
              <button
                onClick={newRootFolder}
                className="text-[10px] text-primary hover:underline"
              >
                {t("library.new_folder_btn")}
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
          <div className="border-t border-black/10 py-3 max-h-48 overflow-y-auto">
            <TagCloud tags={tags} onChange={refreshTree} />
          </div>
        </aside>

        {/* RIGHT: paper list */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-black/10 p-4 bg-white/30">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold text-primary">
                {selectedFolder?.name ?? t("library.default_title")}
              </h1>
              <span className="text-xs text-app-fg/50">
                {t("library.count_papers", { count: total })}
              </span>
            </div>
            <div className="flex gap-2 mt-3 items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("library.search_in_folder")}
                className="flex-1 px-2.5 py-1.5 text-sm bg-white border border-black/10 rounded focus:outline-none focus:border-primary"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-sm bg-white border border-black/10 rounded"
              >
                <option value="all">{t("library.status_filter_all")}</option>
                <option value="unread">{t("library.read_status_unread")}</option>
                <option value="reading">{t("library.read_status_reading")}</option>
                <option value="read">{t("library.read_status_read")}</option>
                <option value="parsed">{t("library.read_status_parsed")}</option>
              </select>
              <button
                onClick={exportBibtex}
                className="px-3 py-1.5 text-sm rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
              >
                {t("library.export_bibtex")}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded mb-3">
                {t("search.error_prefix", { detail: error })}
              </div>
            )}
            {visiblePapers.length === 0 ? (
              <div className="text-sm text-app-fg/60 text-center py-12">
                {papers.length === 0
                  ? t("library.empty_folder_hint")
                  : t("library.empty_filter_hint")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visiblePapers.map((p) => (
                  <PaperRow
                    key={p.id}
                    paper={p}
                    currentFolderId={selectedId}
                    onChange={refreshAll}
                    onReExtract={handleReExtract}
                  />
                ))}
              </div>
            )}

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 mt-4 text-xs">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-2 py-1 rounded border border-black/10 disabled:opacity-50"
                >
                  {t("library.prev_page")}
                </button>
                <span className="text-app-fg/60">
                  {t("library.page_x_of_y", {
                    cur: page + 1,
                    total: Math.ceil(total / PAGE_SIZE),
                  })}
                </span>
                <button
                  onClick={() =>
                    setPage((p) =>
                      (p + 1) * PAGE_SIZE >= total ? p : p + 1,
                    )
                  }
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="px-2 py-1 rounded border border-black/10 disabled:opacity-50"
                >
                  {t("library.next_page")}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Re-extract metadata editor modal */}
      {editorData && (
        <PaperMetadataEditor
          paperId={editorData.paperId}
          initial={editorData.initial}
          pdfPath={editorData.pdfPath}
          onClose={() => setEditorData(null)}
          onSaved={() => {
            setEditorData(null);
            refreshPapers();
          }}
        />
      )}
    </DndContext>
  );
}
