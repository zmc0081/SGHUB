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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FolderClosed,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import EmptyLibraryArt from "../assets/illustrations/empty-library.svg?react";
import {
  api,
  type FolderNode,
  type Paper,
  type PartialMetadata,
  type Tag,
} from "../lib/tauri";
import { PaperActions } from "../components/PaperActions";
import { PaperMetadataEditor } from "../components/PaperMetadataEditor";
import { Icon } from "../components/Icon";
import { Stage } from "../components/Stage";
import { confirmAsync, promptAsync } from "../components/DialogProvider";
import { useToast } from "../hooks/useToast";
import { useT } from "../hooks/useT";

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
          className="inline-flex items-center gap-1 text-indigo hover:text-indigo-hover normal-case tracking-normal text-meta transition-colors duration-fast ease-khx"
        >
          <Icon icon={Plus} size="xs" />
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
  onChange,
  onReExtract,
}: {
  paper: Paper;
  currentFolderId?: string | null;
  onChange: () => void;
  onReExtract?: (paperId: string) => void;
}) {
  const t = useT();
  const toast = useToast();
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

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group bg-card rounded-card shadow-card flex overflow-hidden transition-shadow duration-base ease-khx ${
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
        className={`w-read-bar self-stretch shrink-0 cursor-pointer transition-opacity duration-fast ease-khx hover:opacity-75 ${
          READ_STATUS_BAR[paper.read_status] ?? "bg-read-unread"
        }`}
      />
      <div className="flex-1 p-5 flex flex-col gap-3">
        <div
          className="cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span
              className={`shrink-0 text-micro uppercase tracking-wide-brand px-2 py-0.5 rounded-pill font-semibold ${sourceCls}`}
            >
              {paper.source}
            </span>
            {paper.published_at && (
              <span className="text-meta text-fg-3 tabular-nums">
                {paper.published_at.slice(0, 10)}
              </span>
            )}
          </div>
          <h3 className="text-h3 font-semibold text-fg-1 leading-snug">
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
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 flex-wrap"
        >
          <PaperActions paper={paper} size="sm" />
          {paper.source === "local" && onReExtract && (
            <button
              type="button"
              onClick={() => onReExtract(paper.id)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border border-border-default text-meta text-fg-2 hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted transition-colors duration-fast ease-khx"
              title={t("library.re_extract_btn_title")}
            >
              {t("library.re_extract_btn")}
            </button>
          )}
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
  const [error, setError] = useState<string | null>(null);
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
      toast.danger(t("library.error_re_extract_failed", { detail: String(e) }));
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refreshTree, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
                className="inline-flex items-center gap-1 text-indigo hover:text-indigo-hover normal-case tracking-normal transition-colors duration-fast ease-khx"
              >
                <Icon icon={Plus} size="xs" />
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

          <div className="flex-1 overflow-y-auto p-8 max-w-5xl">
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
                    currentFolderId={selectedId}
                    onChange={refreshAll}
                    onReExtract={handleReExtract}
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
