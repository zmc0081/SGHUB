/**
 * Feed.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for /feed (今日推送 / Today).
 *
 * Layout:
 *   <main>
 *     <SubscriptionList />   ← left w-side-panel (288px), independently scrolls
 *     <ResultsArea />        ← right flex-1, independently scrolls
 *   </main>
 *
 * Per spec §4.2, the new/edit subscription form is INLINE (a card injected
 * into the main area), not a Modal. Decision rationale recorded in Step 3
 * setup notes.
 */

import {
  Newspaper,
  Plus,
  RefreshCw,
  Pause,
  Play,
  Pencil,
  Trash2,
  ChevronDown,
  AlertTriangle,
  X,
  Loader2,
  Star,
  Brain,
  FileText,
  Download,
  Check,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';
// import { useFeedStore } from '@/stores/feedStore';
// import { confirmAsync } from '@/lib/dialog';
// import { useToast } from '@/components/ToastProvider';
// import { Skeleton } from '@/components/Skeleton';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

type PaperSource = 'arxiv' | 'semantic_scholar' | 'pubmed' | 'openalex' | 'local';

type SubscriptionStatus = 'active' | 'paused';
type Frequency = 'daily' | 'weekly' | 'monthly';

interface Subscription {
  id: string;
  keyword: string;
  sources: PaperSource[];
  frequency: Frequency;
  maxResults: number;
  status: SubscriptionStatus;
  unreadCount: number;
  lastRunAt?: string;
  createdAt: string;
}

interface FeedResult {
  id: string;
  paperId: string;
  subscriptionId: string;
  title: string;
  authors: string[];
  year: number;
  source: PaperSource;
  doi?: string;
  abstract: string;
  isOpenAccess: boolean;
  hasLocalPdf: boolean;
  unread: boolean;
  receivedAt: string;
}

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-1',
    keyword: 'transformer attention',
    sources: ['arxiv', 'semantic_scholar'],
    frequency: 'daily',
    maxResults: 20,
    status: 'active',
    unreadCount: 7,
    lastRunAt: '2 小时前',
    createdAt: '2026-04-12',
  },
  {
    id: 'sub-2',
    keyword: 'crispr gene editing',
    sources: ['pubmed'],
    frequency: 'weekly',
    maxResults: 10,
    status: 'active',
    unreadCount: 3,
    lastRunAt: '昨天',
    createdAt: '2026-03-20',
  },
  {
    id: 'sub-3',
    keyword: 'quantum computing benchmarks',
    sources: ['arxiv'],
    frequency: 'weekly',
    maxResults: 15,
    status: 'paused',
    unreadCount: 0,
    lastRunAt: '上周',
    createdAt: '2026-02-08',
  },
];

const MOCK_RESULTS: FeedResult[] = [
  {
    id: 'fr-1',
    paperId: 'arxiv-2511.01234',
    subscriptionId: 'sub-1',
    title: 'Sparse Attention Improvements via Learned Routing',
    authors: ['Alice Chen', 'Bob Lin', 'Carol Wang'],
    year: 2026,
    source: 'arxiv',
    doi: '10.48550/arXiv.2511.01234',
    abstract:
      'We propose a new sparse attention mechanism that uses learned routing to dynamically select which token pairs to attend to, reducing compute by 40% while preserving model quality.',
    isOpenAccess: true,
    hasLocalPdf: false,
    unread: true,
    receivedAt: '2 小时前',
  },
  {
    id: 'fr-2',
    paperId: 'ss-2511.05678',
    subscriptionId: 'sub-1',
    title: 'Revisiting Attention Patterns in Long-Context Models',
    authors: ['David Kim', 'Eve Rodriguez'],
    year: 2026,
    source: 'semantic_scholar',
    abstract:
      'A systematic study of how attention patterns evolve across very long contexts (>1M tokens), revealing surprising structure in the learned attention maps.',
    isOpenAccess: true,
    hasLocalPdf: false,
    unread: true,
    receivedAt: '5 小时前',
  },
  {
    id: 'fr-3',
    paperId: 'pm-37999888',
    subscriptionId: 'sub-2',
    title: 'CRISPR-Cas13d for RNA-level gene regulation in vivo',
    authors: ['Frank Müller', 'Grace Park'],
    year: 2026,
    source: 'pubmed',
    doi: '10.1038/s41586-026-09999-8',
    abstract:
      'Cas13d-based RNA targeting enables transient gene knockdown without altering the genome. We demonstrate efficacy in murine models with minimal off-target effects.',
    isOpenAccess: false,
    hasLocalPdf: false,
    unread: false,
    receivedAt: '昨天 14:30',
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// Inline shared components
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

/** Compact result actions (smaller than Search's row — Feed cards are denser) */
function FeedResultActions({ result }: { result: FeedResult }) {
  const btnBase = `
    inline-flex items-center gap-1.5 h-7 px-2.5 rounded-pill border
    text-meta text-fg-2 border-border-default bg-card
    transition-colors duration-fast ease-khx
    focus-visible:outline-none focus-visible:shadow-focus
  `;
  return (
    <div className="flex items-center gap-2 flex-wrap mt-3">
      <button
        type="button"
        aria-label="Add to favorites"
        className={`${btnBase} hover:text-warning-fg-strong hover:bg-warning-bg hover:border-warning-border`}
      >
        <Star size={12} strokeWidth={1.5} aria-hidden />
        <span>收藏</span>
      </button>
      <button
        type="button"
        aria-label="AI parse"
        className={`${btnBase} hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted`}
      >
        <Brain size={12} strokeWidth={1.5} aria-hidden />
        <span>AI 精读</span>
      </button>
      <button
        type="button"
        aria-label="Open source"
        className={`${btnBase} hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted`}
      >
        <FileText size={12} strokeWidth={1.5} aria-hidden />
        <span>原文</span>
      </button>
      {result.isOpenAccess && !result.hasLocalPdf && (
        <button
          type="button"
          aria-label="Download PDF"
          className={`${btnBase} hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted`}
        >
          <Download size={12} strokeWidth={1.5} aria-hidden />
          <span>PDF</span>
        </button>
      )}

      {/* Right-aligned "mark read" link */}
      {result.unread && (
        <button
          type="button"
          className="
            ml-auto inline-flex items-center gap-1 text-meta text-indigo font-medium
            hover:text-indigo-hover
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:underline
          "
        >
          <Check size={12} strokeWidth={1.5} aria-hidden />
          <span>标为已读</span>
        </button>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Left subscription list
// ───────────────────────────────────────────────────────────────────────────────

function SubscriptionListItem({
  sub,
  selected,
}: {
  sub: Subscription;
  selected: boolean;
}) {
  const sourceText = sub.sources
    .map((s) => (s === 'semantic_scholar' ? 'SS' : s))
    .join(' · ');
  const freqText = { daily: '每日', weekly: '每周', monthly: '每月' }[sub.frequency];

  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        className={`
          group w-full text-left px-3 py-3 rounded-card-sm
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
          ${selected
            ? 'bg-navy-soft'
            : 'hover:bg-navy-faint'}
        `}
      >
        <div className="flex items-start gap-2">
          {/* Status dot */}
          <span
            aria-hidden
            className={`
              flex-shrink-0 mt-1.5 w-2 h-2 rounded-full
              ${sub.status === 'active' ? 'bg-success-fg' : 'bg-border-strong'}
            `}
          />

          {/* Keyword + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-caption font-mono text-fg-1 truncate">
                {sub.keyword}
              </span>
              {sub.unreadCount > 0 && (
                <span
                  aria-label={`${sub.unreadCount} unread`}
                  className="
                    flex-shrink-0 inline-flex items-center px-1.5 py-0
                    rounded-pill bg-badge-improve-bg text-badge-improve-fg
                    text-micro font-medium tabular-nums
                  "
                >
                  {sub.unreadCount > 99 ? '99+' : sub.unreadCount}
                </span>
              )}
            </div>
            <p className="text-micro text-fg-3 mt-1 truncate">
              {sourceText} · {freqText} · {sub.lastRunAt}
            </p>
          </div>
        </div>

        {/* Hover-revealed actions */}
        <div className="
          flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100
          transition-opacity duration-fast ease-khx
        ">
          <button
            type="button"
            aria-label={sub.status === 'active' ? 'Pause' : 'Resume'}
            className="
              p-1 rounded-pill text-fg-2 hover:text-indigo hover:bg-indigo-soft
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            {sub.status === 'active' ? (
              <Pause size={12} strokeWidth={1.5} aria-hidden />
            ) : (
              <Play size={12} strokeWidth={1.5} aria-hidden />
            )}
          </button>
          <button
            type="button"
            aria-label="Edit"
            className="
              p-1 rounded-pill text-fg-2 hover:text-indigo hover:bg-indigo-soft
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <Pencil size={12} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Delete"
            className="
              p-1 rounded-pill text-fg-2 hover:text-danger-fg hover:bg-danger-bg
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <Trash2 size={12} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </button>
    </li>
  );
}

function SubscriptionList({
  subscriptions,
  selectedId,
  onNewClick,
}: {
  subscriptions: Subscription[];
  selectedId: string;
  onNewClick?: () => void;
}) {
  return (
    <aside
      aria-label="Subscriptions"
      className="
        w-side-panel border-r border-border-default
        flex flex-col bg-card
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h2 className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3">
          订阅
        </h2>
        <button
          type="button"
          onClick={onNewClick}
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

      {/* "All feeds" pseudo-item */}
      <button
        type="button"
        aria-current={selectedId === 'all' ? 'true' : undefined}
        className={`
          mx-2 px-3 py-2 rounded-card-sm flex items-center gap-2
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
          ${selectedId === 'all'
            ? 'bg-navy-soft text-fg-1'
            : 'text-fg-2 hover:bg-navy-faint hover:text-fg-1'}
        `}
      >
        <Newspaper size={14} strokeWidth={1.5} aria-hidden />
        <span className="text-caption">全部推送</span>
      </button>

      {/* List */}
      <nav className="flex-1 overflow-y-auto mt-2 px-2 pb-4">
        <ul className="space-y-1">
          {subscriptions.map((sub) => (
            <SubscriptionListItem
              key={sub.id}
              sub={sub}
              selected={selectedId === sub.id}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Right results area pieces
// ───────────────────────────────────────────────────────────────────────────────

function ResultsHeader({
  title,
  unreadCount,
  totalCount,
  onRefresh,
  isRefreshing,
}: {
  title: string;
  unreadCount: number;
  totalCount: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  return (
    <header className="px-8 pt-8 pb-4 border-b border-border-default flex items-center justify-between gap-4">
      <div>
        <h1 className="text-h2 font-semibold text-fg-1">{title}</h1>
        <p className="text-meta text-fg-2 mt-1 tabular-nums">
          <span className="text-indigo font-medium">{unreadCount}</span> 条未读
          <span className="mx-1.5">·</span>
          共 {totalCount} 条
        </p>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="
          inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border
          text-caption font-medium text-fg-1 border-border-default bg-card
          hover:border-navy-muted hover:bg-navy-faint
          disabled:opacity-60 disabled:cursor-not-allowed
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
        "
      >
        {isRefreshing ? (
          <Loader2 size={16} strokeWidth={1.5} aria-hidden className="animate-spin" />
        ) : (
          <RefreshCw size={16} strokeWidth={1.5} aria-hidden />
        )}
        <span>{isRefreshing ? '刷新中…' : '立即刷新'}</span>
      </button>
    </header>
  );
}

function FeedResultCard({ result }: { result: FeedResult }) {
  const authorPreview =
    result.authors.length > 4
      ? `${result.authors.slice(0, 4).join(', ')} 等`
      : result.authors.join(', ');

  return (
    <article
      className={`
        relative rounded-card bg-card shadow-card p-6
        transition-shadow duration-base ease-khx hover:shadow-card-hover
        ${result.unread ? '' : 'opacity-75'}
      `}
    >
      {/* Unread dot — top-left corner */}
      {result.unread && (
        <span
          aria-label="Unread"
          className="absolute top-5 left-2 w-2 h-2 rounded-full bg-indigo"
        />
      )}

      <div className={`flex items-center gap-3 mb-2 ${result.unread ? 'pl-3' : ''}`}>
        <SourceBadgeInline source={result.source} />
        <span className="text-meta text-fg-3 tabular-nums">{result.year}</span>
        <span className="text-meta text-fg-3 ml-auto">{result.receivedAt}</span>
      </div>

      <h3 className={`text-h3 font-semibold text-fg-1 ${result.unread ? 'pl-3' : ''}`}>
        {result.title}
      </h3>

      <p className={`text-meta text-fg-2 mt-2 ${result.unread ? 'pl-3' : ''}`}>
        {authorPreview}
      </p>

      <p className={`text-caption text-fg-2 mt-2 line-clamp-2 leading-relaxed ${result.unread ? 'pl-3' : ''}`}>
        {result.abstract}
      </p>

      <div className={result.unread ? 'pl-3' : ''}>
        <FeedResultActions result={result} />
      </div>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Subscription edit form (INLINE, not Modal — per spec §4.2)
// ───────────────────────────────────────────────────────────────────────────────

function SubscriptionEditForm({
  mode,
  initial,
  onCancel,
  onSave,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<Subscription>;
  onCancel?: () => void;
  onSave?: () => void;
}) {
  const allSources: PaperSource[] = ['arxiv', 'semantic_scholar', 'pubmed', 'openalex'];

  return (
    <section
      aria-label={mode === 'create' ? 'New subscription' : 'Edit subscription'}
      className="
        rounded-card bg-card border border-indigo-muted shadow-card
        p-6 mb-6
      "
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-h3 font-semibold text-fg-1">
          {mode === 'create' ? '新建订阅' : '编辑订阅'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="
            p-1 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-focus
          "
        >
          <X size={16} strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <div className="space-y-5">
        {/* Keyword */}
        <div>
          <label className="block text-caption font-medium text-fg-1 mb-2">
            关键词
          </label>
          <input
            type="text"
            defaultValue={initial?.keyword ?? ''}
            placeholder="例如:transformer attention"
            className="
              w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1 placeholder:text-fg-3 font-mono
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          />
          <p className="text-meta text-fg-3 mt-1.5">
            支持多关键词,用空格分隔。按 AND 逻辑组合。
          </p>
        </div>

        {/* Sources — chip group (≥1 required) */}
        <div>
          <label className="block text-caption font-medium text-fg-1 mb-2">
            数据源 <span className="text-fg-3 font-normal">(至少选 1 个)</span>
          </label>
          <div role="group" className="flex flex-wrap gap-2">
            {allSources.map((src) => {
              const selected = (initial?.sources ?? ['arxiv']).includes(src);
              const labels: Record<PaperSource, string> = {
                arxiv: 'arXiv',
                semantic_scholar: 'Semantic Scholar',
                pubmed: 'PubMed',
                openalex: 'OpenAlex',
                local: 'Local',
              };
              return (
                <button
                  key={src}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-meta border
                    transition-colors duration-fast ease-khx
                    focus-visible:outline-none focus-visible:shadow-focus
                    ${selected
                      ? 'bg-indigo-soft border-indigo-muted text-indigo font-medium'
                      : 'bg-card border-border-default text-fg-2 hover:text-fg-1 hover:bg-navy-faint'}
                  `}
                >
                  {selected && <Check size={12} strokeWidth={2} aria-hidden />}
                  <span>{labels[src]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Frequency + maxResults — two columns */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-caption font-medium text-fg-1 mb-2">
              频率
            </label>
            <div className="relative">
              <select
                defaultValue={initial?.frequency ?? 'daily'}
                className="
                  w-full appearance-none pl-input-x pr-9 py-input-y rounded-pill border border-border-default
                  bg-card text-caption text-fg-1
                  focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                  transition-shadow duration-fast ease-khx
                "
              >
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                aria-hidden
                className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-caption font-medium text-fg-1 mb-2">
              单次最多
            </label>
            <input
              type="number"
              min={1}
              max={100}
              defaultValue={initial?.maxResults ?? 20}
              className="
                w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
                bg-card text-caption text-fg-1 tabular-nums
                focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                transition-shadow duration-fast ease-khx
              "
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-border-default">
        <button
          type="button"
          onClick={onCancel}
          className="
            inline-flex items-center px-btn-x py-btn-y rounded-pill border
            text-caption font-medium text-fg-1 border-border-default bg-card
            hover:border-navy-muted hover:bg-navy-faint
            transition-colors duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-focus
          "
        >
          取消
        </button>
        <button
          type="button"
          onClick={onSave}
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
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — happy path
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FeedPage — main rendered state, "All feeds" selected, 3 results visible.
 */
export default function FeedPage() {
  // TODO: from useFeedStore()
  const subscriptions = MOCK_SUBSCRIPTIONS;
  const selectedId = 'all';
  const results = MOCK_RESULTS;
  const unreadCount = results.filter((r) => r.unread).length;

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SubscriptionList subscriptions={subscriptions} selectedId={selectedId} />

      <section className="flex-1 flex flex-col min-w-0">
        <ResultsHeader
          title="今日推送"
          unreadCount={unreadCount}
          totalCount={results.length}
        />

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="flex flex-col gap-4 max-w-3xl">
            {results.map((r) => (
              <FeedResultCard key={r.id} result={r} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY — no subscriptions yet
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FeedPageEmptyNoSubs — first-time visit, no subscriptions exist.
 */
export function FeedPageEmptyNoSubs() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SubscriptionList subscriptions={[]} selectedId="all" />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">今日推送</h1>
          <p className="text-meta text-fg-2 mt-1">
            订阅关键词,SGHUB 会定时为你聚合最新文献
          </p>
        </header>

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
              <Newspaper size={64} strokeWidth={1.5} aria-hidden className="mx-auto text-indigo opacity-60" />
              <h2 className="text-h3 font-semibold text-fg-1 mt-6">
                还没有订阅
              </h2>
              <p className="text-caption text-fg-2 mt-2 max-w-md mx-auto leading-relaxed">
                点击左侧「+ 新建」开始你的第一个关键词订阅。
                每个订阅可指定数据源、频率和单次结果上限。
              </p>
              <button
                type="button"
                className="
                  inline-flex items-center gap-2 mt-6 px-btn-x py-btn-y rounded-pill
                  bg-navy text-text-inverse text-caption font-medium
                  shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
                  active:bg-navy-active active:translate-y-0
                  transition-[background,box-shadow,transform] duration-fast ease-khx
                  focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
                "
              >
                <Plus size={16} strokeWidth={1.5} aria-hidden />
                <span>创建第一个订阅</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * FeedPageEmptyNoResults — has subscriptions, but none have produced results yet.
 */
export function FeedPageEmptyNoResults() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SubscriptionList subscriptions={MOCK_SUBSCRIPTIONS} selectedId="all" />

      <section className="flex-1 flex flex-col min-w-0">
        <ResultsHeader title="今日推送" unreadCount={0} totalCount={0} />

        <div className="flex-1 overflow-y-auto px-8 py-12 flex items-center justify-center">
          <div className="
            rounded-card border border-dashed border-border-default
            py-12 px-8 text-center bg-card max-w-md
          ">
            <RefreshCw size={48} strokeWidth={1.5} aria-hidden className="mx-auto text-fg-3" />
            <h3 className="text-h3 font-semibold text-fg-1 mt-4">
              暂无推送结果
            </h3>
            <p className="text-caption text-fg-2 mt-2 leading-relaxed">
              订阅已创建,但尚未抓取到结果。点击右上「立即刷新」立即跑一次活跃订阅。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING — refresh in flight
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FeedPageLoading — user clicked "Refresh now", awaiting results.
 */
export function FeedPageLoading() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SubscriptionList subscriptions={MOCK_SUBSCRIPTIONS} selectedId="all" />

      <section className="flex-1 flex flex-col min-w-0">
        <ResultsHeader
          title="今日推送"
          unreadCount={0}
          totalCount={0}
          isRefreshing
        />

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div
            role="status"
            aria-busy="true"
            aria-label="Loading feed results"
            className="flex items-center gap-2 text-meta text-fg-2 mb-4"
          >
            <Loader2 size={14} strokeWidth={1.5} aria-hidden className="animate-spin text-indigo" />
            <span>正在抓取 3 个活跃订阅…</span>
          </div>

          {/* Skeleton cards */}
          <div className="flex flex-col gap-4 max-w-3xl">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className="rounded-card bg-card shadow-card p-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-5 w-14 rounded-pill bg-navy-soft animate-pulse" />
                  <div className="h-3 w-10 rounded-pill bg-navy-soft animate-pulse" />
                </div>
                <div className="h-5 w-3/4 rounded-pill bg-navy-soft animate-pulse mb-3" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded-pill bg-navy-soft animate-pulse" />
                  <div className="h-3 w-2/3 rounded-pill bg-navy-soft animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR — refresh failed for one or more subscriptions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FeedPageError — one subscription failed; others succeeded.
 * Inline danger banner above results.
 */
export function FeedPageError() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SubscriptionList subscriptions={MOCK_SUBSCRIPTIONS} selectedId="all" />

      <section className="flex-1 flex flex-col min-w-0">
        <ResultsHeader
          title="今日推送"
          unreadCount={2}
          totalCount={MOCK_RESULTS.length}
        />

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Partial error banner */}
          <div
            role="alert"
            className="
              flex items-start gap-3 rounded-card-sm border border-warning-border bg-warning-bg
              px-4 py-3 mb-4 max-w-3xl
            "
          >
            <AlertTriangle
              size={18}
              strokeWidth={1.5}
              aria-hidden
              className="text-warning-fg-strong flex-shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <p className="text-caption font-medium text-fg-1">部分订阅刷新失败</p>
              <p className="text-meta text-fg-2 mt-1">
                <span className="font-mono">crispr gene editing</span>{' '}
                的 PubMed 抓取超时,其他订阅已成功。可在左侧重试该订阅。
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

          <div className="flex flex-col gap-4 max-w-3xl">
            {MOCK_RESULTS.map((r) => (
              <FeedResultCard key={r.id} result={r} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITING — inline subscription edit form is open
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FeedPageEditingSubscription — new subscription form expanded inline above results.
 */
export function FeedPageEditingSubscription() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <SubscriptionList subscriptions={MOCK_SUBSCRIPTIONS} selectedId="all" />

      <section className="flex-1 flex flex-col min-w-0">
        <ResultsHeader title="今日推送" unreadCount={2} totalCount={3} />

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl">
            <SubscriptionEditForm mode="create" />

            {/* Results below form */}
            <div className="flex flex-col gap-4">
              {MOCK_RESULTS.map((r) => (
                <FeedResultCard key={r.id} result={r} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
