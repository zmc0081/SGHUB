/**
 * Library.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for /library (收藏夹 / Library).
 *
 * Layout: three-region
 *   ┌──────────────────────┬───────────────────────────────────┐
 *   │  Folder tree         │  Header + Toolbar                  │
 *   │  (top of w-side-     │                                    │
 *   │   panel = 288px)     │  Paper card list (scrolls)         │
 *   │  ────────────────    │                                    │
 *   │  Tag cloud           │                                    │
 *   │  (bottom)            │                                    │
 *   └──────────────────────┴───────────────────────────────────┘
 *
 * DnD: drag-over visual is rendered statically here (target folder shows
 * ring + bg). The dragging ghost is mocked as a floating div for design
 * preview in <LibraryPageDragOver>. Real implementation uses @dnd-kit/core
 * pointerSensor with 5px activation distance.
 *
 * Constants worth knowing:
 *   - UNCLASSIFIED_FOLDER_ID is fixed by spec, not deletable in UI.
 */

import {
  Folder,
  FolderOpen,
  Plus,
  Search,
  ChevronDown,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Star,
  Brain,
  FileText,
  Download,
  RefreshCw,
  Tag,
  ChevronRight,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';
// import { useLibraryStore } from '@/stores/libraryStore';
// import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor } from '@dnd-kit/core';
// import { PaperMetadataEditor } from '@/components/PaperMetadataEditor';

// ───────────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────────

const UNCLASSIFIED_FOLDER_ID = '00000000-0000-0000-0000-000000000001';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

type PaperSource = 'arxiv' | 'semantic_scholar' | 'pubmed' | 'openalex' | 'local';
type ReadStatus = 'unread' | 'reading' | 'read' | 'parsed';

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  paperCount: number;
  children?: Folder[];
}

interface LibraryTag {
  id: string;
  name: string;
  paletteIndex: number;  // 0-7, cycles through 8-color palette
  paperCount: number;
}

interface LibraryPaper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  source: PaperSource;
  doi?: string;
  abstract: string;
  isOpenAccess: boolean;
  hasLocalPdf: boolean;
  readStatus: ReadStatus;
  folderId: string;
  tagIds: string[];
  /** local source has additional "re-extract" affordance */
  isLocalUpload: boolean;
}

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_FOLDERS: Folder[] = [
  {
    id: UNCLASSIFIED_FOLDER_ID,
    name: '未分类',
    parentId: null,
    paperCount: 12,
  },
  {
    id: 'f-nlp',
    name: 'NLP',
    parentId: null,
    paperCount: 28,
    children: [
      { id: 'f-transformers', name: 'Transformers', parentId: 'f-nlp', paperCount: 14 },
      { id: 'f-llms',         name: 'LLMs',         parentId: 'f-nlp', paperCount: 9 },
    ],
  },
  {
    id: 'f-cv',
    name: 'Computer Vision',
    parentId: null,
    paperCount: 16,
  },
  {
    id: 'f-bio',
    name: 'Biology',
    parentId: null,
    paperCount: 7,
  },
];

const MOCK_TAGS: LibraryTag[] = [
  { id: 't1', name: 'must-read',   paletteIndex: 0, paperCount: 8 },
  { id: 't2', name: 'review',      paletteIndex: 1, paperCount: 12 },
  { id: 't3', name: 'cited',       paletteIndex: 2, paperCount: 5 },
  { id: 't4', name: 'controversial', paletteIndex: 3, paperCount: 3 },
  { id: 't5', name: 'methodology', paletteIndex: 4, paperCount: 18 },
  { id: 't6', name: 'survey',      paletteIndex: 5, paperCount: 6 },
  { id: 't7', name: 'benchmarks',  paletteIndex: 6, paperCount: 9 },
  { id: 't8', name: 'notable',     paletteIndex: 7, paperCount: 4 },
];

const MOCK_PAPERS: LibraryPaper[] = [
  {
    id: 'p1',
    title: 'Attention Is All You Need',
    authors: ['Vaswani', 'Shazeer', 'Parmar', 'Uszkoreit'],
    year: 2017,
    source: 'arxiv',
    doi: '10.48550/arXiv.1706.03762',
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer, based solely on attention mechanisms.',
    isOpenAccess: true,
    hasLocalPdf: true,
    readStatus: 'parsed',
    folderId: 'f-transformers',
    tagIds: ['t1', 't5'],
    isLocalUpload: false,
  },
  {
    id: 'p2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: ['Devlin', 'Chang', 'Lee', 'Toutanova'],
    year: 2019,
    source: 'arxiv',
    doi: '10.48550/arXiv.1810.04805',
    abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers.',
    isOpenAccess: true,
    hasLocalPdf: false,
    readStatus: 'read',
    folderId: 'f-transformers',
    tagIds: ['t5', 't6'],
    isLocalUpload: false,
  },
  {
    id: 'p3',
    title: 'Sparse Attention Improvements via Learned Routing',
    authors: ['Alice Chen', 'Bob Lin'],
    year: 2026,
    source: 'arxiv',
    abstract: 'We propose a new sparse attention mechanism that reduces compute by 40% while preserving model quality.',
    isOpenAccess: true,
    hasLocalPdf: false,
    readStatus: 'reading',
    folderId: 'f-transformers',
    tagIds: ['t1'],
    isLocalUpload: false,
  },
  {
    id: 'p4',
    title: '(Locally uploaded) experiment-2025-Q4-results.pdf',
    authors: ['Internal Team'],
    year: 2026,
    source: 'local',
    abstract: 'Experimental results from Q4 2025 internal benchmarks. Includes raw data tables.',
    isOpenAccess: true,
    hasLocalPdf: true,
    readStatus: 'unread',
    folderId: 'f-transformers',
    tagIds: [],
    isLocalUpload: true,
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// Shared inline pieces
// ───────────────────────────────────────────────────────────────────────────────

function SourceBadgeInline({ source }: { source: PaperSource }) {
  const styles: Record<PaperSource, { label: string; classes: string }> = {
    arxiv:            { label: 'arXiv',    classes: 'bg-src-arxiv text-src-arxiv-fg' },
    semantic_scholar: { label: 'SS',       classes: 'bg-src-ss text-src-ss-fg' },
    pubmed:           { label: 'PubMed',   classes: 'bg-src-pubmed text-src-pubmed-fg' },
    openalex:         { label: 'OpenAlex', classes: 'bg-src-openalex text-src-openalex-fg' },
    local:            { label: 'Local',    classes: 'bg-src-local text-src-local-fg' },
  };
  const s = styles[source];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-micro font-medium ${s.classes}`}>
      {s.label}
    </span>
  );
}

/**
 * Read-status color bar (10px wide, left edge of card).
 * Token aliases per Step 1:
 *   unread  → border-strong
 *   reading → warning-fg
 *   read    → success-fg
 *   parsed  → indigo
 */
function ReadStatusBar({ status }: { status: ReadStatus }) {
  const colorClass = {
    unread:  'bg-read-unread',
    reading: 'bg-read-reading',
    read:    'bg-read-read',
    parsed:  'bg-read-parsed',
  }[status];
  const labelText = {
    unread:  '未读 (点击切换为「在读」)',
    reading: '在读 (点击切换为「已读」)',
    read:    '已读 (点击切换为「已解析」)',
    parsed:  '已解析 (点击循环回「未读」)',
  }[status];
  return (
    <button
      type="button"
      aria-label={labelText}
      title={labelText}
      className={`
        absolute top-0 left-0 bottom-0 w-read-bar
        rounded-l-card cursor-pointer
        ${colorClass}
        hover:opacity-80 transition-opacity duration-fast ease-khx
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-muted focus-visible:ring-inset
      `}
    />
  );
}

function TagChip({ tag }: { tag: LibraryTag }) {
  // tagPalette token classes (Step 1 补丁): bg-tag-0 ... bg-tag-7
  // Each emits the corresponding palette color, theme-aware via CSS var.
  const bgClasses = [
    'bg-tag-0', 'bg-tag-1', 'bg-tag-2', 'bg-tag-3',
    'bg-tag-4', 'bg-tag-5', 'bg-tag-6', 'bg-tag-7',
  ];
  return (
    <button
      type="button"
      aria-label={`Filter by tag ${tag.name}`}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill
        ${bgClasses[tag.paletteIndex]} text-white text-meta font-medium
        hover:opacity-90 transition-opacity duration-fast ease-khx
        focus-visible:outline-none focus-visible:shadow-focus
      `}
    >
      <Tag size={11} strokeWidth={2} aria-hidden />
      <span>{tag.name}</span>
      <span className="opacity-75 tabular-nums">{tag.paperCount}</span>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Left panel — Folder tree + Tag cloud
// ───────────────────────────────────────────────────────────────────────────────

function FolderTreeItem({
  folder,
  depth,
  selectedId,
  dragOverFolderId,
}: {
  folder: Folder;
  depth: number;
  selectedId: string | null;
  dragOverFolderId?: string | null;
}) {
  const isSelected = folder.id === selectedId;
  const isUnclassified = folder.id === UNCLASSIFIED_FOLDER_ID;
  const isDragOver = dragOverFolderId === folder.id;

  return (
    <li>
      <div
        className={`
          group relative flex items-center gap-2 px-2 py-1.5 rounded-card-sm
          cursor-pointer
          transition-colors duration-fast ease-khx
          ${isSelected ? 'bg-navy-soft text-fg-1' : 'text-fg-2 hover:bg-navy-faint hover:text-fg-1'}
          ${isDragOver ? 'ring-2 ring-indigo ring-inset bg-indigo-soft' : ''}
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={folder.children ? true : undefined}
      >
        {folder.children && folder.children.length > 0 ? (
          <FolderOpen size={14} strokeWidth={1.5} aria-hidden className="flex-shrink-0" />
        ) : (
          <Folder size={14} strokeWidth={1.5} aria-hidden className="flex-shrink-0" />
        )}

        <span className="flex-1 text-caption truncate">{folder.name}</span>

        <span className="text-micro text-fg-3 tabular-nums">{folder.paperCount}</span>

        {/* Hover-revealed actions (hidden for unclassified) */}
        {!isUnclassified && (
          <div className="
            flex items-center gap-0.5 opacity-0 group-hover:opacity-100
            transition-opacity duration-fast ease-khx
          ">
            <button
              type="button"
              aria-label="Rename folder"
              className="
                p-0.5 rounded-pill text-fg-2
                hover:text-indigo hover:bg-indigo-soft
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              <Pencil size={11} strokeWidth={1.5} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Delete folder"
              className="
                p-0.5 rounded-pill text-fg-2
                hover:text-danger-fg hover:bg-danger-bg
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              <Trash2 size={11} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {folder.children && folder.children.length > 0 && (
        <ul role="group">
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedId={selectedId}
              dragOverFolderId={dragOverFolderId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function LeftPanel({
  folders,
  tags,
  selectedFolderId,
  dragOverFolderId,
}: {
  folders: Folder[];
  tags: LibraryTag[];
  selectedFolderId: string | null;
  dragOverFolderId?: string | null;
}) {
  return (
    <aside
      aria-label="Folders and tags"
      className="
        w-side-panel border-r border-border-default
        flex flex-col bg-card
      "
    >
      {/* Folders header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <h2 className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3">
          文件夹
        </h2>
        <button
          type="button"
          aria-label="New folder"
          className="
            inline-flex items-center gap-1 text-meta font-medium text-indigo
            hover:text-indigo-hover
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:underline
          "
        >
          <Plus size={14} strokeWidth={1.5} aria-hidden />
          <span>新建</span>
        </button>
      </div>

      {/* Folder tree (scrollable) */}
      <nav className="flex-1 overflow-y-auto px-2 pb-3" role="tree" aria-label="Folder tree">
        <ul>
          {folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              depth={0}
              selectedId={selectedFolderId}
              dragOverFolderId={dragOverFolderId}
            />
          ))}
        </ul>
      </nav>

      {/* Divider */}
      <div className="border-t border-border-default" />

      {/* Tag cloud */}
      <div className="flex-shrink-0 max-h-72 overflow-y-auto px-4 pt-4 pb-5">
        <h2 className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3 mb-2">
          标签
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>
      </div>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Main area pieces
// ───────────────────────────────────────────────────────────────────────────────

function MainHeader({
  folderName,
  paperCount,
}: {
  folderName: string;
  paperCount: number;
}) {
  return (
    <header className="px-8 pt-8 pb-4 border-b border-border-default">
      <h1 className="text-h2 font-semibold text-fg-1">{folderName}</h1>
      <p className="text-meta text-fg-2 mt-1 tabular-nums">
        共 <span className="text-fg-1 font-medium">{paperCount}</span> 条文献
      </p>
    </header>
  );
}

function Toolbar({
  search,
  statusFilter,
}: {
  search: string;
  statusFilter: 'all' | ReadStatus;
}) {
  return (
    <div className="flex items-center gap-3 px-8 py-4 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[240px] max-w-md">
        <Search
          size={14}
          strokeWidth={1.5}
          aria-hidden
          className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-3"
        />
        <input
          type="search"
          defaultValue={search}
          placeholder="文件夹内搜索…"
          aria-label="Search within folder"
          className="
            w-full pl-9 pr-input-x py-input-y rounded-pill border border-border-default
            bg-card text-caption text-fg-1 placeholder:text-fg-3
            focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
            transition-shadow duration-fast ease-khx
          "
        />
      </div>

      {/* Status filter */}
      <div className="relative">
        <select
          aria-label="Read status filter"
          defaultValue={statusFilter}
          className="
            appearance-none pl-input-x pr-9 py-input-y rounded-pill border border-border-default
            bg-card text-caption text-fg-1
            focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
            transition-shadow duration-fast ease-khx
          "
        >
          <option value="all">全部状态</option>
          <option value="unread">未读</option>
          <option value="reading">在读</option>
          <option value="read">已读</option>
          <option value="parsed">已解析</option>
        </select>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          aria-hidden
          className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
        />
      </div>

      {/* Export BibTeX */}
      <button
        type="button"
        className="
          ml-auto inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
          text-caption font-medium text-fg-1 border-border-default bg-card
          hover:border-navy-muted hover:bg-navy-faint
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
        "
      >
        <Download size={14} strokeWidth={1.5} aria-hidden />
        <span>导出 BibTeX</span>
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Paper card (library variant — left status bar + draggable affordance)
// ───────────────────────────────────────────────────────────────────────────────

function LibraryPaperCard({
  paper,
  isDragging,
}: {
  paper: LibraryPaper;
  isDragging?: boolean;
}) {
  const authorPreview =
    paper.authors.length > 4
      ? `${paper.authors.slice(0, 4).join(', ')} 等`
      : paper.authors.join(', ');

  return (
    <article
      // TODO: useDraggable({ id: paper.id }) via @dnd-kit/core
      // 5px activation distance via PointerSensor.
      aria-label={`Paper card: ${paper.title}`}
      className={`
        relative rounded-card bg-card shadow-card pl-6 pr-6 py-6
        transition-shadow duration-base ease-khx
        ${isDragging ? 'shadow-card-hover opacity-60 cursor-grabbing' : 'hover:shadow-card-hover cursor-grab'}
      `}
    >
      <ReadStatusBar status={paper.readStatus} />

      <div className="ml-3">
        <div className="flex items-center gap-3 mb-2">
          <SourceBadgeInline source={paper.source} />
          <span className="text-meta text-fg-3 tabular-nums">{paper.year}</span>
          {paper.tagIds.length > 0 && (
            <span className="text-meta text-fg-3 ml-auto">
              {paper.tagIds.length} 个标签
            </span>
          )}
        </div>

        <h3 className="text-h3 font-semibold text-fg-1">{paper.title}</h3>

        <p className="text-meta text-fg-2 mt-2">{authorPreview}</p>

        <p className="text-caption text-fg-2 mt-2 line-clamp-2 leading-relaxed">
          {paper.abstract}
        </p>

        {/* Action row */}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <button
            type="button"
            aria-label="Add to favorites"
            className="
              inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border
              text-meta text-fg-2 border-border-default bg-card
              hover:text-warning-fg-strong hover:bg-warning-bg hover:border-warning-border
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <Star size={12} strokeWidth={1.5} aria-hidden />
            <span>已收藏</span>
          </button>
          <button
            type="button"
            aria-label="AI parse"
            className="
              inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border
              text-meta text-fg-2 border-border-default bg-card
              hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <Brain size={12} strokeWidth={1.5} aria-hidden />
            <span>AI 精读</span>
          </button>
          <button
            type="button"
            aria-label="Open source"
            className="
              inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border
              text-meta text-fg-2 border-border-default bg-card
              hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <FileText size={12} strokeWidth={1.5} aria-hidden />
            <span>原文</span>
          </button>
          {paper.hasLocalPdf && (
            <button
              type="button"
              aria-label="Open PDF"
              className="
                inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border
                text-meta text-fg-2 border-border-default bg-card
                hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              <FolderOpen size={12} strokeWidth={1.5} aria-hidden />
              <span>打开 PDF</span>
            </button>
          )}
          {/* Local upload — re-extract affordance */}
          {paper.isLocalUpload && (
            <button
              type="button"
              aria-label="Re-extract metadata"
              className="
                inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border
                text-meta text-fg-2 border-border-default bg-card
                hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              <RefreshCw size={12} strokeWidth={1.5} aria-hidden />
              <span>重新提取</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Pagination footer
// ───────────────────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-3 py-6"
    >
      <button
        type="button"
        disabled={page === 1}
        aria-label="Previous page"
        className="
          inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
          text-caption font-medium text-fg-1 border-border-default bg-card
          hover:border-navy-muted hover:bg-navy-faint
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border-default disabled:hover:bg-card
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
        "
      >
        <ChevronRight size={14} strokeWidth={1.5} aria-hidden className="rotate-180" />
        <span>上一页</span>
      </button>

      <span className="text-meta text-fg-2 tabular-nums">
        第 <span className="text-fg-1 font-medium">{page}</span> / {totalPages} 页
      </span>

      <button
        type="button"
        disabled={page === totalPages}
        aria-label="Next page"
        className="
          inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border
          text-caption font-medium text-fg-1 border-border-default bg-card
          hover:border-navy-muted hover:bg-navy-faint
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border-default disabled:hover:bg-card
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
        "
      >
        <span>下一页</span>
        <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
      </button>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — happy path: "Transformers" folder selected, 4 papers visible
// ═══════════════════════════════════════════════════════════════════════════════

export default function LibraryPage() {
  // TODO: from useLibraryStore()
  const folders = MOCK_FOLDERS;
  const tags = MOCK_TAGS;
  const selectedFolderId = 'f-transformers';
  const folderName = 'Transformers';
  const papers = MOCK_PAPERS;

  return (
    // TODO: <DndContext sensors={[useSensor(PointerSensor, { activationConstraint: { distance: 5 } })]}>
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <LeftPanel
        folders={folders}
        tags={tags}
        selectedFolderId={selectedFolderId}
      />

      <section className="flex-1 flex flex-col min-w-0">
        <MainHeader folderName={folderName} paperCount={papers.length} />
        <Toolbar search="" statusFilter="all" />

        <div className="flex-1 overflow-y-auto px-8 pb-2">
          <div className="flex flex-col gap-4 max-w-3xl">
            {papers.map((p) => (
              <LibraryPaperCard key={p.id} paper={p} />
            ))}
          </div>
          {/* Pagination only when total > 50 */}
          {/* <Pagination page={1} totalPages={1} /> */}
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY — entire library empty (first run)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LibraryPageEmptyAll — fresh install, no folders/tags/papers at all.
 * Shows the unclassified folder (always present) with 0 count + tag area empty.
 */
export function LibraryPageEmptyAll() {
  const emptyFolders: Folder[] = [
    { id: UNCLASSIFIED_FOLDER_ID, name: '未分类', parentId: null, paperCount: 0 },
  ];

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <LeftPanel folders={emptyFolders} tags={[]} selectedFolderId={UNCLASSIFIED_FOLDER_ID} />

      <section className="flex-1 flex flex-col min-w-0">
        <MainHeader folderName="收藏夹" paperCount={0} />

        <div className="flex-1 overflow-y-auto px-8 py-12 flex items-center justify-center">
          {/* Stage with ambient glow */}
          <div className="
            relative overflow-hidden rounded-card bg-stage-gradient
            py-16 px-12 text-center w-full max-w-2xl
          ">
            <div
              aria-hidden
              className="absolute -top-20 -right-20 w-96 h-96 rounded-full pointer-events-none"
              style={{ background: 'var(--glow-purple)' }}
            />
            <div
              aria-hidden
              className="absolute -bottom-20 -left-16 w-96 h-96 rounded-full pointer-events-none"
              style={{ background: 'var(--glow-blue)' }}
            />

            <div className="relative z-10">
              <Star
                size={64}
                strokeWidth={1.5}
                aria-hidden
                className="mx-auto text-indigo opacity-60"
              />
              <h2 className="text-h3 font-semibold text-fg-1 mt-6">
                收藏夹空空如也
              </h2>
              <p className="text-caption text-fg-2 mt-2 max-w-md mx-auto leading-relaxed">
                在「文献检索」搜到论文后,点击收藏按钮,或者直接把卡片拖到左侧文件夹。
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY — selected folder has 0 papers (but library overall has content)
// ═══════════════════════════════════════════════════════════════════════════════

export function LibraryPageEmptyFolder() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <LeftPanel
        folders={MOCK_FOLDERS}
        tags={MOCK_TAGS}
        selectedFolderId="f-bio"
      />

      <section className="flex-1 flex flex-col min-w-0">
        <MainHeader folderName="Biology" paperCount={0} />
        <Toolbar search="" statusFilter="all" />

        <div className="flex-1 overflow-y-auto px-8 py-12 flex items-center justify-center">
          <div className="
            rounded-card border border-dashed border-border-default
            py-12 px-8 text-center bg-card max-w-md
          ">
            <Folder size={48} strokeWidth={1.5} aria-hidden className="mx-auto text-fg-3" />
            <h3 className="text-h3 font-semibold text-fg-1 mt-4">
              该文件夹暂无文献
            </h3>
            <p className="text-caption text-fg-2 mt-2 leading-relaxed">
              在「文献检索」搜到论文后,把卡片拖到左侧文件夹即可入库。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTERED EMPTY — folder has papers, but current filter matches none
// ═══════════════════════════════════════════════════════════════════════════════

export function LibraryPageFilteredEmpty() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <LeftPanel
        folders={MOCK_FOLDERS}
        tags={MOCK_TAGS}
        selectedFolderId="f-transformers"
      />

      <section className="flex-1 flex flex-col min-w-0">
        <MainHeader folderName="Transformers" paperCount={14} />
        <Toolbar search="quantum entanglement" statusFilter="parsed" />

        <div className="flex-1 overflow-y-auto px-8 py-12 flex items-center justify-center">
          <div className="
            rounded-card border border-dashed border-border-default
            py-10 px-8 text-center bg-card max-w-md
          ">
            <Search size={40} strokeWidth={1.5} aria-hidden className="mx-auto text-fg-3" />
            <h3 className="text-h3 font-semibold text-fg-1 mt-4">
              无匹配过滤条件的文献
            </h3>
            <p className="text-caption text-fg-2 mt-2 leading-relaxed">
              试试清除搜索关键词或切换阅读状态。
            </p>
            <button
              type="button"
              className="
                inline-flex items-center mt-4 px-3 py-1.5 rounded-pill
                text-meta font-medium text-indigo
                hover:text-indigo-hover hover:bg-indigo-soft
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:underline
              "
            >
              清除所有过滤
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG-OVER — paper card being dragged onto "NLP" folder
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LibraryPageDragOver — snapshot of mid-drag state.
 *   - First paper card shows isDragging visual (opacity-60, no shadow lift)
 *   - "NLP" folder shows drag-over ring + bg-indigo-soft
 *   - A floating ghost preview is overlaid for design reference (the real
 *     ghost is rendered by @dnd-kit's DragOverlay at the cursor; this fake
 *     position is just for screenshot purposes — remove if it interferes).
 */
export function LibraryPageDragOver() {
  return (
    <main role="main" className="relative flex h-[calc(100vh-36px)] bg-page">
      <LeftPanel
        folders={MOCK_FOLDERS}
        tags={MOCK_TAGS}
        selectedFolderId="f-transformers"
        dragOverFolderId="f-nlp"
      />

      <section className="flex-1 flex flex-col min-w-0">
        <MainHeader folderName="Transformers" paperCount={MOCK_PAPERS.length} />
        <Toolbar search="" statusFilter="all" />

        <div className="flex-1 overflow-y-auto px-8 pb-2">
          <div className="flex flex-col gap-4 max-w-3xl">
            {MOCK_PAPERS.map((p, i) => (
              <LibraryPaperCard
                key={p.id}
                paper={p}
                isDragging={i === 0}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Floating ghost preview — design-time only.
          Real dnd-kit DragOverlay positions this at the cursor; the
          coordinate here is purely for static screenshot reference. */}
      <div
        aria-hidden
        className="
          fixed top-72 left-1/2 -translate-x-1/2 z-popover
          w-96 rounded-card bg-card shadow-card-hover opacity-60 p-4
          pointer-events-none
          rotate-1
        "
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-micro font-medium bg-src-arxiv text-src-arxiv-fg">
            arXiv
          </span>
          <span className="text-meta text-fg-3 tabular-nums">2017</span>
        </div>
        <p className="text-caption font-semibold text-fg-1 truncate">
          Attention Is All You Need
        </p>
        <p className="text-micro text-fg-3 mt-1">Vaswani 等 · 拖入 NLP 文件夹</p>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// METADATA EDITOR OPEN — clicked "Re-extract" on a local paper, modal is open
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LibraryPageMetadataEditorOpen — main page rendered with PaperMetadataEditor
 * modal layered on top. Modal contents are abbreviated here; full spec is
 * in Step 2 §A.6.
 */
export function LibraryPageMetadataEditorOpen() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <LeftPanel
        folders={MOCK_FOLDERS}
        tags={MOCK_TAGS}
        selectedFolderId="f-transformers"
      />

      <section className="flex-1 flex flex-col min-w-0">
        <MainHeader folderName="Transformers" paperCount={MOCK_PAPERS.length} />
        <Toolbar search="" statusFilter="all" />

        <div className="flex-1 overflow-y-auto px-8 pb-2">
          <div className="flex flex-col gap-4 max-w-3xl">
            {MOCK_PAPERS.map((p) => (
              <LibraryPaperCard key={p.id} paper={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Modal overlay — full spec at Step 2 §A.6 PaperMetadataEditor.
          This is a structural placeholder so the visual relationship to the
          underlying page is preview-able. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="metadata-editor-title"
        className="
          fixed inset-0 z-modal flex items-center justify-center
        "
        style={{ background: 'var(--overlay-modal-backdrop)' }}
      >
        <div className="
          w-full max-w-2xl max-h-[90vh] flex flex-col
          rounded-card bg-card shadow-modal
        ">
          {/* Header */}
          <header className="px-6 py-4 border-b border-border-default flex items-start justify-between gap-4">
            <div>
              <h2 id="metadata-editor-title" className="text-h3 font-semibold text-fg-1">
                完善文献信息
              </h2>
              <p className="text-meta text-fg-2 mt-1">
                提取来源:首页 · 置信度:65%
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="
                p-1 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              <X size={16} strokeWidth={1.5} aria-hidden />
            </button>
          </header>

          {/* Body — abbreviated. See Step 2 §A.6 for full content. */}
          <div className="px-6 py-5 overflow-y-auto flex-1">
            <div className="space-y-5">
              <div>
                <label className="block text-caption font-medium text-fg-1 mb-2">
                  标题 <span className="text-danger-fg">*</span>
                </label>
                <input
                  type="text"
                  defaultValue="(Locally uploaded) experiment-2025-Q4-results.pdf"
                  className="
                    w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
                    bg-card text-caption text-fg-1
                    focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                    transition-shadow duration-fast ease-khx
                  "
                />
              </div>

              <div>
                <label className="block text-caption font-medium text-fg-1 mb-2">作者</label>
                <p className="text-meta text-fg-3 italic">暂无 — 点击「+ 添加」录入</p>
              </div>

              <div>
                <label className="block text-caption font-medium text-fg-1 mb-2">摘要</label>
                <textarea
                  rows={5}
                  defaultValue=""
                  placeholder="摘要内容…"
                  className="
                    w-full pl-textarea-x pr-textarea-x py-textarea-y rounded-card-sm border border-border-default
                    bg-card text-caption text-fg-1 placeholder:text-fg-3 resize-y
                    focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                    transition-shadow duration-fast ease-khx
                  "
                />
              </div>

              <div>
                <label className="block text-caption font-medium text-fg-1 mb-2">DOI</label>
                <input
                  type="text"
                  placeholder="10.1234/example"
                  className="
                    w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
                    bg-card text-caption text-fg-1 placeholder:text-fg-3 font-mono
                    focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                    transition-shadow duration-fast ease-khx
                  "
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="px-6 py-4 border-t border-border-default flex justify-end gap-3">
            <button
              type="button"
              className="
                inline-flex items-center px-btn-x py-btn-y rounded-pill border
                text-caption font-medium text-fg-1 border-border-default bg-card
                hover:border-navy-muted hover:bg-navy-faint
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              跳过(保留原提取)
            </button>
            <button
              type="button"
              className="
                inline-flex items-center px-btn-x py-btn-y rounded-pill
                bg-navy text-text-inverse text-caption font-medium
                shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
                active:bg-navy-active active:translate-y-0
                transition-[background,box-shadow,transform] duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
              "
            >
              保存
            </button>
          </footer>
        </div>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR — bulk action failure (e.g. BibTeX export crashed)
// ═══════════════════════════════════════════════════════════════════════════════

export function LibraryPageError() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <LeftPanel
        folders={MOCK_FOLDERS}
        tags={MOCK_TAGS}
        selectedFolderId="f-transformers"
      />

      <section className="flex-1 flex flex-col min-w-0">
        <MainHeader folderName="Transformers" paperCount={MOCK_PAPERS.length} />
        <Toolbar search="" statusFilter="all" />

        <div className="px-8 pt-2">
          <div
            role="alert"
            className="
              flex items-start gap-3 rounded-card-sm border border-danger-border bg-danger-bg
              px-4 py-3 mb-4 max-w-3xl
            "
          >
            <AlertTriangle
              size={18}
              strokeWidth={1.5}
              aria-hidden
              className="text-danger-fg flex-shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <p className="text-caption font-medium text-fg-1">导出 BibTeX 失败</p>
              <p className="text-meta text-fg-2 mt-1">
                有 1 条文献的 DOI 字段为空,无法生成完整 BibTeX。请补全后重试,或导出部分结果。
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              className="
                p-1 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              <X size={14} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-2">
          <div className="flex flex-col gap-4 max-w-3xl">
            {MOCK_PAPERS.map((p) => (
              <LibraryPaperCard key={p.id} paper={p} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
