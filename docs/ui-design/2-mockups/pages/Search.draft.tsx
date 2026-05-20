/**
 * Search.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for the Search page (/search).
 * - All data is mocked at top-level `const`. No React hooks, no store calls.
 * - State variants (empty/loading/error/streaming/main) are exposed as
 *   separate named exports for design-time preview and review.
 * - TODOs marked where Step 3 hands off to Step (logic implementation).
 *
 * Common header pattern (used by all batch-A pages):
 *   <h1 className="text-h2 font-semibold text-fg-1">…</h1>
 *   <p  className="text-meta text-fg-2 mt-1">…</p>
 *
 * Page-wide layout convention:
 *   <main role="main" className="p-8 max-w-5xl">
 *     <PageHeader />
 *     <Toolbar />     ← page-specific
 *     <Results />     ← scroll lives here (eventually virtualized)
 *   </main>
 *
 * NOTE on virtualization: when results > 100, the <Results /> container is
 * the virtualization root. Items render as absolute-positioned children.
 * This draft uses normal flow for design preview; Step (logic) swaps in
 * @tanstack/react-virtual.
 */

import {
  Search as SearchIcon,
  ChevronDown,
  AlertTriangle,
  Loader2,
  Brain,
  FileText,
  Download,
  FolderOpen,
  X,
  Star,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';   // TODO: wire i18n
// import { useSearchStore } from '@/stores/searchStore';
// import { SourceBadge } from '@/components/SourceBadge';
// import { PaperActions } from '@/components/PaperActions';
// import { FavoriteButton } from '@/components/FavoriteButton';
// import { Skeleton } from '@/components/Skeleton';
// import { Stage } from '@/components/Stage';

// ───────────────────────────────────────────────────────────────────────────────
// Types (local to draft; real types in @/types/paper.ts)
// ───────────────────────────────────────────────────────────────────────────────

type PaperSource = 'arxiv' | 'semantic_scholar' | 'pubmed' | 'openalex' | 'local';

interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  source: PaperSource;
  doi?: string;
  abstract: string;
  isOpenAccess: boolean;
  hasLocalPdf: boolean;
}

type TimeFilter = 'any' | '7d' | '30d' | '1y';
type SortOrder = 'relevance' | 'newest' | 'citations';
type SourceFilter = 'all' | PaperSource;

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_PAPERS: Paper[] = [
  {
    id: 'arxiv-1706.03762',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones', 'Aidan N. Gomez', 'Łukasz Kaiser', 'Illia Polosukhin'],
    year: 2017,
    source: 'arxiv',
    doi: '10.48550/arXiv.1706.03762',
    abstract:
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    isOpenAccess: true,
    hasLocalPdf: true,
  },
  {
    id: 'ss-2204.02311',
    title: 'PaLM: Scaling Language Modeling with Pathways',
    authors: ['Aakanksha Chowdhery', 'Sharan Narang', 'Jacob Devlin', 'Maarten Bosma', 'Gaurav Mishra'],
    year: 2022,
    source: 'semantic_scholar',
    doi: '10.48550/arXiv.2204.02311',
    abstract:
      'Large language models have been shown to achieve remarkable performance across a variety of natural language tasks using few-shot learning, which drastically reduces the number of task-specific training examples needed to adapt the model to a particular application.',
    isOpenAccess: true,
    hasLocalPdf: false,
  },
  {
    id: 'pm-37234567',
    title: 'CRISPR-Cas9 mediated genome editing in human cells',
    authors: ['Le Cong', 'F. Ann Ran', 'David Cox'],
    year: 2023,
    source: 'pubmed',
    doi: '10.1038/s41586-023-12345-6',
    abstract:
      'Targeted genome editing using engineered nucleases has rapidly progressed in recent years. Here, we describe a set of tools for Cas9-mediated genome editing via nonhomologous end joining (NHEJ) or homology-directed repair (HDR) in mammalian cells.',
    isOpenAccess: false,
    hasLocalPdf: false,
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// Reusable inline pieces (NOT extracted; they're part of the page draft)
// ───────────────────────────────────────────────────────────────────────────────

/** Source badge (inline, real version is shared in @/components/SourceBadge) */
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

/** Paper actions row (inline preview; real version at @/components/PaperActions) */
function PaperActionsInline({ paper }: { paper: Paper }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mt-4">
      {/* Favorite */}
      <button
        type="button"
        aria-label="Add to favorites"
        className="
          inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border
          text-meta text-fg-2 border-border-default bg-card
          hover:text-warning-fg-strong hover:bg-warning-bg hover:border-warning-border
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
        "
      >
        <Star size={14} strokeWidth={1.5} aria-hidden />
        <span>收藏</span>
        <ChevronDown size={12} strokeWidth={1.5} aria-hidden />
      </button>

      {/* AI parse */}
      <button
        type="button"
        aria-label="AI parse"
        className="
          inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border
          text-meta text-fg-2 border-border-default bg-card
          hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
        "
      >
        <Brain size={14} strokeWidth={1.5} aria-hidden />
        <span>AI 精读</span>
      </button>

      {/* Open source link */}
      <button
        type="button"
        aria-label="Open source"
        className="
          inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border
          text-meta text-fg-2 border-border-default bg-card
          hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
        "
      >
        <FileText size={14} strokeWidth={1.5} aria-hidden />
        <span>原文</span>
      </button>

      {/* PDF slot — three states */}
      {paper.hasLocalPdf ? (
        <button
          type="button"
          aria-label="Open local PDF"
          className="
            inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border
            text-meta text-fg-2 border-border-default bg-card
            hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-focus
          "
        >
          <FolderOpen size={14} strokeWidth={1.5} aria-hidden />
          <span>打开 PDF</span>
        </button>
      ) : (
        <button
          type="button"
          aria-label="Download PDF"
          disabled={!paper.isOpenAccess}
          title={!paper.isOpenAccess ? '非开放获取,无法下载' : undefined}
          className="
            inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border
            text-meta text-fg-2 border-border-default bg-card
            hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted
            disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:text-fg-2 disabled:hover:bg-card disabled:hover:border-border-default
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-focus
          "
        >
          <Download size={14} strokeWidth={1.5} aria-hidden />
          <span>下载 PDF</span>
        </button>
      )}
    </div>
  );
}

/** Paper result card */
function PaperCard({ paper }: { paper: Paper }) {
  const authorPreview =
    paper.authors.length > 5
      ? `${paper.authors.slice(0, 5).join(', ')} 等 ${paper.authors.length} 人`
      : paper.authors.join(', ');

  return (
    <article
      className="
        rounded-card bg-card shadow-card p-6
        transition-shadow duration-base ease-khx hover:shadow-card-hover
      "
    >
      <div className="flex items-start gap-3 mb-3">
        <SourceBadgeInline source={paper.source} />
        <span className="text-meta text-fg-3 tabular-nums">{paper.year}</span>
      </div>

      <h3 className="text-h3 font-semibold text-fg-1 truncate">{paper.title}</h3>

      <p className="text-meta text-fg-2 mt-2">{authorPreview}</p>

      {paper.doi && (
        <p className="text-meta text-fg-3 mt-1 font-mono truncate">DOI: {paper.doi}</p>
      )}

      <p className="text-caption text-fg-2 mt-3 line-clamp-3 leading-relaxed">
        {paper.abstract}
      </p>

      <PaperActionsInline paper={paper} />
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Toolbar / Filter / Header
// ───────────────────────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <header className="mb-6">
      <h1 className="text-h2 font-semibold text-fg-1">文献检索</h1>
      <p className="text-meta text-fg-2 mt-1">
        多源聚合检索 · arXiv / Semantic Scholar / PubMed / OpenAlex
      </p>
    </header>
  );
}

function SearchBar({
  query,
  source,
  onSubmit,
}: {
  query: string;
  source: SourceFilter;
  onSubmit?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Query input (pill) */}
      <div className="relative flex-1">
        <SearchIcon
          size={16}
          strokeWidth={1.5}
          aria-hidden
          className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-3"
        />
        <input
          type="search"
          aria-label="Search query"
          defaultValue={query}
          placeholder="输入关键词、DOI、作者或标题"
          className="
            w-full pl-10 pr-input-x py-input-y rounded-pill border border-border-default
            bg-card text-caption text-fg-1 placeholder:text-fg-3
            focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
            transition-shadow duration-fast ease-khx
          "
        />
      </div>

      {/* Source select (pill) */}
      <div className="relative">
        <select
          aria-label="Source filter"
          defaultValue={source}
          className="
            appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default
            bg-card text-caption text-fg-1
            focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
            transition-shadow duration-fast ease-khx
          "
        >
          <option value="all">全部源</option>
          <option value="arxiv">arXiv</option>
          <option value="semantic_scholar">Semantic Scholar</option>
          <option value="pubmed">PubMed</option>
          <option value="openalex">OpenAlex</option>
          <option value="local">本地</option>
        </select>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          aria-hidden
          className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
        />
      </div>

      {/* Submit (primary navy) */}
      <button
        type="button"
        onClick={onSubmit}
        className="
          inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill
          bg-navy text-text-inverse text-caption font-medium
          shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
          active:bg-navy-active active:translate-y-0
          transition-[background,box-shadow,transform] duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
        "
      >
        <SearchIcon size={16} strokeWidth={1.5} aria-hidden />
        <span>检索</span>
      </button>
    </div>
  );
}

function FilterRow({
  time,
  sort,
}: {
  time: TimeFilter;
  sort: SortOrder;
}) {
  const timeChips: Array<{ value: TimeFilter; label: string }> = [
    { value: 'any', label: '不限' },
    { value: '7d',  label: '近 7 天' },
    { value: '30d', label: '近 30 天' },
    { value: '1y',  label: '近 1 年' },
  ];

  return (
    <div className="flex items-center gap-4 mb-6 flex-wrap">
      {/* Time chips (toggle) — V2.2: pill chips, deviates from V2.1 plain select */}
      <div className="flex items-center gap-2">
        <span className="text-meta text-fg-2">时间</span>
        <div role="radiogroup" aria-label="Time filter" className="flex gap-1.5">
          {timeChips.map((chip) => {
            const isActive = chip.value === time;
            return (
              <button
                key={chip.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={`
                  inline-flex items-center px-3 py-1 rounded-pill text-meta border
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:shadow-focus
                  ${isActive
                    ? 'bg-indigo-soft border-indigo-muted text-indigo font-medium'
                    : 'bg-card border-border-default text-fg-2 hover:text-fg-1 hover:bg-navy-faint'}
                `}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort select */}
      <div className="flex items-center gap-2">
        <span className="text-meta text-fg-2">排序</span>
        <div className="relative">
          <select
            aria-label="Sort order"
            defaultValue={sort}
            className="
              appearance-none pr-8 pl-3 py-1 rounded-pill border border-border-default
              bg-card text-meta text-fg-1
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          >
            <option value="relevance">相关性</option>
            <option value="newest">最新</option>
            <option value="citations">引用(待支持)</option>
          </select>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            aria-hidden
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}

function ResultsCount({
  total,
  filtered,
  durationMs,
  virtualized,
}: {
  total: number;
  filtered?: number;
  durationMs: number;
  virtualized?: boolean;
}) {
  return (
    <p className="text-meta text-fg-2 mb-4 tabular-nums">
      <span className="font-medium text-fg-1">{filtered ?? total}</span> 条结果
      {filtered !== undefined && filtered !== total && (
        <span> (从 {total} 条中筛选)</span>
      )}
      <span className="mx-1.5">·</span>
      <span>{durationMs}ms</span>
      {virtualized && (
        <>
          <span className="mx-1.5">·</span>
          <span>已启用虚拟滚动</span>
        </>
      )}
    </p>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — happy path (results loaded)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SearchPage — main rendered state with 3 mock results.
 */
export default function SearchPage() {
  // TODO: from useSearchStore()
  const query = 'transformer attention';
  const source: SourceFilter = 'all';
  const time: TimeFilter = 'any';
  const sort: SortOrder = 'relevance';
  const results = MOCK_PAPERS;
  const total = 3;
  const durationMs = 247;

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />

      <SearchBar query={query} source={source} />
      <FilterRow time={time} sort={sort} />

      <ResultsCount total={total} durationMs={durationMs} />

      {/* TODO: when total > 100, wrap in react-virtual.
                The container becomes the virtualization root; result <article> elements
                render as absolute-positioned children. For draft preview, normal flow. */}
      <div className="flex flex-col gap-4">
        {results.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY — no query yet (initial visit) and post-search no-results
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SearchPageEmptyInitial — user has not yet entered a query.
 * Uses <Stage> ambient background for inviting first-time feel.
 */
export function SearchPageEmptyInitial() {
  const query = '';
  const source: SourceFilter = 'all';
  const time: TimeFilter = 'any';
  const sort: SortOrder = 'relevance';

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />
      <SearchBar query={query} source={source} />
      <FilterRow time={time} sort={sort} />

      {/* Stage with ambient glow — TODO: replace with <Stage intensity="soft"> */}
      <div className="
        relative overflow-hidden rounded-card bg-stage-gradient
        py-16 px-8 text-center
      ">
        {/* Purple glow */}
        <div
          aria-hidden
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'var(--glow-purple)' }}
        />
        {/* Blue glow */}
        <div
          aria-hidden
          className="absolute -bottom-20 -left-16 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'var(--glow-blue)' }}
        />

        <div className="relative z-10">
          <SearchIcon
            size={64}
            strokeWidth={1.5}
            aria-hidden
            className="mx-auto text-indigo opacity-60"
          />
          <h2 className="text-h3 font-semibold text-fg-1 mt-6">
            输入关键词后回车开始检索
          </h2>
          <p className="text-caption text-fg-2 mt-2 max-w-md mx-auto leading-relaxed">
            支持自然语言、DOI、作者、标题。结果聚合自多个学术源,可在上方筛选时间与排序。
          </p>
        </div>
      </div>
    </main>
  );
}

/**
 * SearchPageEmptyNoResults — query submitted, but zero matches.
 */
export function SearchPageEmptyNoResults() {
  const query = 'quantum entanglement on the moon';
  const source: SourceFilter = 'all';
  const time: TimeFilter = '7d';
  const sort: SortOrder = 'relevance';

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />
      <SearchBar query={query} source={source} />
      <FilterRow time={time} sort={sort} />

      <ResultsCount total={0} durationMs={189} />

      <div className="
        rounded-card border border-dashed border-border-default
        py-12 px-8 text-center bg-card
      ">
        <SearchIcon size={48} strokeWidth={1.5} aria-hidden className="mx-auto text-fg-3" />
        <h3 className="text-h3 font-semibold text-fg-1 mt-4">暂无结果</h3>
        <p className="text-caption text-fg-2 mt-2 max-w-sm mx-auto">
          试试放宽筛选条件、缩短关键词,或切换其他数据源。
        </p>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING — query submitted, awaiting upstream response
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SearchPageLoading — concurrent requests in flight.
 * Shows skeleton cards (3 placeholder rows) + status text below search bar.
 */
export function SearchPageLoading() {
  const query = 'attention is all you need';
  const source: SourceFilter = 'all';
  const time: TimeFilter = 'any';
  const sort: SortOrder = 'relevance';

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />
      <SearchBar query={query} source={source} />
      <FilterRow time={time} sort={sort} />

      {/* Loading status */}
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading search results"
        className="flex items-center gap-2 text-meta text-fg-2 mb-4"
      >
        <Loader2
          size={14}
          strokeWidth={1.5}
          aria-hidden
          className="animate-spin text-indigo"
        />
        <span>正在并发请求 arXiv 与 Semantic Scholar…</span>
      </div>

      {/* Skeleton cards — TODO: replace with <Skeleton variant="paper-card" /> */}
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            aria-hidden
            className="rounded-card bg-card shadow-card p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-5 w-14 rounded-pill bg-navy-soft animate-pulse" />
              <div className="h-3 w-10 rounded-pill bg-navy-soft animate-pulse" />
            </div>
            <div className="h-5 w-3/4 rounded-pill bg-navy-soft animate-pulse mb-3" />
            <div className="h-3 w-1/2 rounded-pill bg-navy-soft animate-pulse mb-4" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded-pill bg-navy-soft animate-pulse" />
              <div className="h-3 w-full rounded-pill bg-navy-soft animate-pulse" />
              <div className="h-3 w-2/3 rounded-pill bg-navy-soft animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR — upstream failure (network / API down / rate-limited)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SearchPageError — inline danger banner above results area.
 * Partial results are shown if some sources succeeded; this draft assumes total failure.
 */
export function SearchPageError() {
  const query = 'crispr cas9';
  const source: SourceFilter = 'pubmed';
  const time: TimeFilter = 'any';
  const sort: SortOrder = 'relevance';

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />
      <SearchBar query={query} source={source} />
      <FilterRow time={time} sort={sort} />

      {/* Inline error banner */}
      <div
        role="alert"
        className="
          flex items-start gap-3 rounded-card-sm border border-danger-border bg-danger-bg
          px-4 py-3 mb-4
        "
      >
        <AlertTriangle
          size={18}
          strokeWidth={1.5}
          aria-hidden
          className="text-danger-fg flex-shrink-0 mt-0.5"
        />
        <div className="flex-1">
          <p className="text-caption font-medium text-fg-1">检索失败</p>
          <p className="text-meta text-fg-2 mt-1">
            PubMed API 暂时不可用(HTTP 503)。可稍后重试,或切换其他数据源继续检索。
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
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING — results arriving incrementally from a long-running source
// (Not in V2.1 but architecturally future-friendly; left as a sketch.)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SearchPageStreaming — 2 results loaded, 1 still streaming from upstream.
 * Visible affordance: progress indicator at top of results area.
 */
export function SearchPageStreaming() {
  const query = 'attention transformer';
  const source: SourceFilter = 'all';
  const time: TimeFilter = 'any';
  const sort: SortOrder = 'relevance';
  const partialResults = MOCK_PAPERS.slice(0, 2);

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />
      <SearchBar query={query} source={source} />
      <FilterRow time={time} sort={sort} />

      {/* Streaming indicator */}
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 text-meta text-fg-2 mb-4"
      >
        <span
          aria-hidden
          className="inline-block w-2 h-2 rounded-full bg-indigo animate-pulse"
        />
        <span>已收到 2 条 · PubMed 仍在响应…</span>
      </div>

      <div className="flex flex-col gap-4">
        {partialResults.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
        {/* Inline skeleton placeholder for incoming card */}
        <div
          aria-hidden
          className="rounded-card bg-card shadow-card p-6 opacity-70"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-5 w-16 rounded-pill bg-navy-soft animate-pulse" />
          </div>
          <div className="h-5 w-2/3 rounded-pill bg-navy-soft animate-pulse mb-3" />
          <div className="h-3 w-full rounded-pill bg-navy-soft animate-pulse" />
        </div>
      </div>
    </main>
  );
}
