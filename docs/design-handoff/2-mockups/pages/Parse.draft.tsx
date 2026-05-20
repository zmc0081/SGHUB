/**
 * Parse.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for /parse (AI 解析 / AI Parse).
 *
 * Layout: 2-region (history sidebar + main column)
 *   ┌─────────────────────┬─────────────────────────────────────┐
 *   │ History list        │  Config block                       │
 *   │ (w-parse-history)   │    ├ Paper picker + upload          │
 *   │ 256px               │    ├ Model select + Run button       │
 *   │                     │    └ Skill select (+ description)    │
 *   │                     │                                      │
 *   │                     │  Upload banner (when applicable)     │
 *   │                     │                                      │
 *   │                     │  Output region                       │
 *   │                     │    - DimensionCard grid (when skill  │
 *   │                     │      has output_dimensions)          │
 *   │                     │    - RawOutput block (fallback)      │
 *   │                     │                                      │
 *   │                     │  Status bar (in/out tokens, cost…)   │
 *   └─────────────────────┴─────────────────────────────────────┘
 *
 * Streaming cursor: <span class="inline-block w-1 h-4 bg-indigo align-middle
 *   ml-0.5 animate-pulse" aria-hidden /> appended at the end of streaming
 *   text. Color changed from V2.1 primary/60 to indigo for visibility.
 *
 * Upload banner has 4 visual states: uploading / done-success /
 *   done-partial-failed / done-all-failed. Implemented as <UploadBanner state="...">.
 */

import {
  Search as SearchIcon,
  Upload,
  Brain,
  ChevronDown,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  X,
  RefreshCw,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';
// import { useParseStore } from '@/stores/parseStore';
// import { PaperPicker } from '@/components/PaperPicker';
// import { PaperMetadataEditor } from '@/components/PaperMetadataEditor';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

interface ParseHistoryItem {
  id: string;
  skillName: string;
  paperId: string;
  paperTitle: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  durationSec: number;
  costUsd: number;
  createdRelative: string;  // "2 分钟前", "1 小时前"
}

interface SkillInfo {
  name: string;
  displayName: string;
  description: string;
  recommendedModels: string[];
  outputDimensions?: Array<{ key: string; label: string }>;
}

interface UploadFileStatus {
  filename: string;
  state: 'pending' | 'uploading' | 'done' | 'failed' | 'needs-review';
  errorMessage?: string;
}

interface DimensionResult {
  key: string;
  label: string;
  content: string;
  isStreaming?: boolean;
}

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_HISTORY: ParseHistoryItem[] = [
  {
    id: 'h1',
    skillName: 'paper-deep-read',
    paperId: 'p1',
    paperTitle: 'Attention Is All You Need',
    model: 'claude-opus-4-7',
    tokensIn: 12_400,
    tokensOut: 3_800,
    durationSec: 22,
    costUsd: 0.47,
    createdRelative: '2 分钟前',
  },
  {
    id: 'h2',
    skillName: 'methodology-extractor',
    paperId: 'p2',
    paperTitle: 'BERT: Pre-training of Deep Bidirectional Transformers',
    model: 'gpt-4o',
    tokensIn: 9_200,
    tokensOut: 2_100,
    durationSec: 14,
    costUsd: 0.04,
    createdRelative: '1 小时前',
  },
  {
    id: 'h3',
    skillName: 'paper-deep-read',
    paperId: 'p1',
    paperTitle: 'Attention Is All You Need',
    model: 'claude-opus-4-7',
    tokensIn: 11_800,
    tokensOut: 3_500,
    durationSec: 19,
    costUsd: 0.44,
    createdRelative: '昨天',
  },
];

const MOCK_SKILL: SkillInfo = {
  name: 'paper-deep-read',
  displayName: '论文深度精读',
  description: '从论文中提取核心贡献、方法、实验结果、局限性,适合科研人员快速建立对论文的全面认识。',
  recommendedModels: ['claude-opus-4-7', 'gpt-4o'],
  outputDimensions: [
    { key: 'contribution', label: '核心贡献' },
    { key: 'method',       label: '研究方法' },
    { key: 'results',      label: '实验结果' },
    { key: 'limitations',  label: '局限性' },
  ],
};

const MOCK_DIMENSIONS_COMPLETE: DimensionResult[] = [
  {
    key: 'contribution',
    label: '核心贡献',
    content: '本文提出 Transformer 架构,完全摒弃 RNN 与 CNN,仅依靠 self-attention 实现序列建模。在机器翻译任务上达到当时的 SOTA,同时训练并行度大幅提升。',
  },
  {
    key: 'method',
    label: '研究方法',
    content: '使用 multi-head scaled dot-product attention 作为核心模块,搭配 position encoding、residual connection、layer normalization。编码器-解码器各 6 层堆叠,每层包含 self-attention + FFN。',
  },
  {
    key: 'results',
    label: '实验结果',
    content: '在 WMT 2014 English-German 翻译任务上达到 28.4 BLEU,刷新 SOTA。English-French 任务 41.0 BLEU。训练速度比 RNN baseline 提升 4-10 倍。',
  },
  {
    key: 'limitations',
    label: '局限性',
    content: '上下文长度有限(实验用 512 tokens),长序列下 O(n²) 复杂度成为瓶颈。固定 position encoding 在外推到训练长度之外的序列时表现不佳。',
  },
];

const MOCK_DIMENSIONS_STREAMING: DimensionResult[] = [
  {
    key: 'contribution',
    label: '核心贡献',
    content: '本文提出 Transformer 架构,完全摒弃 RNN 与 CNN,仅依靠 self-attention 实现序列建模。在机器翻译任务上达到当时的 SOTA,同时训练并行度大幅提升。',
  },
  {
    key: 'method',
    label: '研究方法',
    content: '使用 multi-head scaled dot-product attention 作为核心模块,搭配 position encoding、residual connection、layer normalization。编码器-解码器各 6 层堆叠',
    isStreaming: true,
  },
  // dimensions 3 and 4 not yet started
];

// ───────────────────────────────────────────────────────────────────────────────
// History sidebar
// ───────────────────────────────────────────────────────────────────────────────

function HistoryItem({
  item,
  selected,
}: {
  item: ParseHistoryItem;
  selected: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        className={`
          w-full text-left px-3 py-2.5 rounded-card-sm
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:shadow-focus
          ${selected
            ? 'bg-navy-soft'
            : 'hover:bg-navy-faint'}
        `}
      >
        <p className="text-caption font-medium text-fg-1 truncate">{item.skillName}</p>
        <p className="text-micro text-fg-3 mt-0.5">{item.createdRelative}</p>
        <p className="text-micro text-fg-2 mt-1.5 truncate font-mono tabular-nums">
          {item.model} · in {item.tokensIn.toLocaleString()} · out {item.tokensOut.toLocaleString()} · {item.durationSec}s
        </p>
      </button>
    </li>
  );
}

function HistorySidebar({
  items,
  selectedId,
  emptyMessage,
}: {
  items: ParseHistoryItem[];
  selectedId: string | null;
  emptyMessage?: string;
}) {
  return (
    <aside
      aria-label="Parse history"
      className="
        w-parse-history border-r border-border-default
        flex flex-col bg-card
      "
    >
      <div className="px-4 pt-5 pb-2">
        <h2 className="text-micro font-semibold uppercase tracking-wide-brand text-fg-3">
          解析历史
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {items.length === 0 ? (
          <p className="text-meta text-fg-3 italic px-3 py-4">
            {emptyMessage ?? '选择文献后查看历史'}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <HistoryItem key={item.id} item={item} selected={item.id === selectedId} />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Config block
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Three rows:
 *   Row 1: PaperPicker + Upload button
 *   Row 2: Model select + Run button
 *   Row 3: Skill select (description below)
 */
function ConfigBlock({
  paperLabel,
  modelLabel,
  skillName,
  skillDescription,
  recommendedModels,
  canRun,
  isRunning,
}: {
  paperLabel: string;       // empty = unselected
  modelLabel: string;       // empty = unselected
  skillName: string;
  skillDescription?: string;
  recommendedModels?: string[];
  canRun: boolean;
  isRunning?: boolean;
}) {
  return (
    <section
      aria-label="Parse configuration"
      className="rounded-card bg-card shadow-card p-6 mb-4"
    >
      <div className="space-y-4">
        {/* Row 1: Paper picker + Upload */}
        <div className="flex items-center gap-3">
          {/* TODO: <PaperPicker value={selectedPaperId} onChange={...} /> */}
          <div className="relative flex-1">
            <SearchIcon
              size={14}
              strokeWidth={1.5}
              aria-hidden
              className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-3"
            />
            <div className={`
              w-full pl-10 pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption ${paperLabel ? 'text-fg-1' : 'text-fg-3'}
              flex items-center
              cursor-pointer hover:border-navy-muted
              transition-colors duration-fast ease-khx
            `}>
              {paperLabel || '搜索本地文献(标题/作者/DOI)…'}
            </div>
          </div>

          <button
            type="button"
            aria-label="Upload PDF"
            className="
              inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border
              text-caption font-medium text-fg-1 border-border-default bg-card
              hover:border-navy-muted hover:bg-navy-faint
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
          >
            <Upload size={14} strokeWidth={1.5} aria-hidden />
            <span>上传 PDF</span>
          </button>
        </div>

        {/* Row 2: Model select + Run button */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className={`
              w-full pl-input-x pr-9 py-input-y rounded-pill border border-border-default
              bg-card text-caption ${modelLabel ? 'text-fg-1' : 'text-fg-3'}
              cursor-pointer hover:border-navy-muted
              transition-colors duration-fast ease-khx
            `}>
              {modelLabel || '选择模型…'}
            </div>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              aria-hidden
              className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
            />
          </div>

          <button
            type="button"
            disabled={!canRun || isRunning}
            className="
              inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill
              bg-navy text-text-inverse text-caption font-medium
              shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
              active:bg-navy-active active:translate-y-0
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-navy disabled:hover:shadow-btn disabled:hover:translate-y-0
              transition-[background,box-shadow,transform] duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
            "
          >
            {isRunning ? (
              <>
                <Loader2 size={16} strokeWidth={1.5} aria-hidden className="animate-spin" />
                <span>解析中…</span>
              </>
            ) : (
              <>
                <Play size={16} strokeWidth={1.5} aria-hidden />
                <span>开始解析</span>
              </>
            )}
          </button>
        </div>

        {/* Row 3: Skill select + description */}
        <div>
          <div className="relative">
            <div className="
              w-full pl-input-x pr-9 py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1
              cursor-pointer hover:border-navy-muted
              transition-colors duration-fast ease-khx
              flex items-center gap-2
            ">
              <Brain size={14} strokeWidth={1.5} aria-hidden className="text-indigo" />
              <span className="font-medium">{skillName}</span>
            </div>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              aria-hidden
              className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
            />
          </div>

          {skillDescription && (
            <p className="text-meta text-fg-2 mt-2 leading-relaxed">{skillDescription}</p>
          )}

          {recommendedModels && recommendedModels.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-meta text-fg-3">推荐:</span>
              {recommendedModels.map((m) => (
                <span
                  key={m}
                  className="
                    inline-flex items-center px-2 py-0.5 rounded-pill
                    bg-badge-default-bg text-badge-default-fg
                    text-micro font-mono
                  "
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Upload banner (4 states)
// ───────────────────────────────────────────────────────────────────────────────

type UploadBannerState = 'uploading' | 'done-success' | 'done-partial' | 'done-failed';

function UploadBanner({
  state,
  files,
  progress,
}: {
  state: UploadBannerState;
  files: UploadFileStatus[];
  progress?: { current: number; total: number };
}) {
  const isUploading = state === 'uploading';

  const config = {
    'uploading': {
      bg: 'bg-warning-bg',
      border: 'border-warning-border',
      iconColor: 'text-warning-fg-strong',
      Icon: Loader2,
      title: progress ? `上传中(${progress.current}/${progress.total})…` : '上传中…',
      titleColor: 'text-warning-fg-strong',
    },
    'done-success': {
      bg: 'bg-success-bg',
      border: 'border-success-border',
      iconColor: 'text-success-fg',
      Icon: CheckCircle2,
      title: `已上传 ${files.length} 个文件`,
      titleColor: 'text-success-fg',
    },
    'done-partial': {
      bg: 'bg-warning-bg',
      border: 'border-warning-border',
      iconColor: 'text-warning-fg-strong',
      Icon: AlertTriangle,
      title: `上传完成:${files.filter(f => f.state === 'done').length} 个成功 / ${files.filter(f => f.state === 'failed').length} 个失败`,
      titleColor: 'text-warning-fg-strong',
    },
    'done-failed': {
      bg: 'bg-danger-bg',
      border: 'border-danger-border',
      iconColor: 'text-danger-fg',
      Icon: XCircle,
      title: '所有文件上传失败',
      titleColor: 'text-danger-fg',
    },
  }[state];

  return (
    <section
      role="status"
      aria-live="polite"
      className={`
        rounded-card-sm border ${config.bg} ${config.border}
        p-4 mb-4
      `}
    >
      <div className="flex items-start gap-3">
        <config.Icon
          size={18}
          strokeWidth={1.5}
          aria-hidden
          className={`${config.iconColor} flex-shrink-0 mt-0.5 ${isUploading ? 'animate-spin' : ''}`}
        />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-caption font-medium ${config.titleColor}`}>
              {config.title}
            </p>
            {!isUploading && (
              <button
                type="button"
                aria-label="Dismiss banner"
                className="
                  p-1 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:shadow-focus
                "
              >
                <X size={14} strokeWidth={1.5} aria-hidden />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {isUploading && progress && (
            <div className="mt-2 w-full h-1 rounded-pill bg-card overflow-hidden">
              <div
                className="h-full bg-warning-fg-strong transition-[width] duration-base ease-khx"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                role="progressbar"
                aria-valuenow={progress.current}
                aria-valuemin={0}
                aria-valuemax={progress.total}
              />
            </div>
          )}

          {/* File-by-file list (shown for done states) */}
          {!isUploading && files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((f, i) => {
                const Icon = {
                  pending: Clock,
                  uploading: Loader2,
                  done: CheckCircle2,
                  failed: XCircle,
                  'needs-review': AlertTriangle,
                }[f.state];
                const iconColor = {
                  pending: 'text-fg-3',
                  uploading: 'text-warning-fg-strong',
                  done: 'text-success-fg',
                  failed: 'text-danger-fg',
                  'needs-review': 'text-warning-fg-strong',
                }[f.state];
                return (
                  <li key={i} className="flex items-center gap-2 text-meta">
                    <Icon
                      size={12}
                      strokeWidth={1.5}
                      aria-hidden
                      className={`${iconColor} flex-shrink-0 ${f.state === 'uploading' ? 'animate-spin' : ''}`}
                    />
                    <span className="text-fg-1 font-mono truncate">{f.filename}</span>
                    {f.state === 'failed' && f.errorMessage && (
                      <span className="text-fg-2 text-micro truncate">— {f.errorMessage}</span>
                    )}
                    {f.state === 'needs-review' && (
                      <span className="
                        inline-flex items-center px-2 py-0.5 rounded-pill
                        bg-badge-new-bg text-badge-new-fg
                        text-micro font-medium ml-auto
                      ">
                        待补全元数据
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Dimension cards / Raw output
// ───────────────────────────────────────────────────────────────────────────────

function DimensionCard({ dim }: { dim: DimensionResult }) {
  return (
    <article className="rounded-card bg-card shadow-card p-6">
      <h3 className="text-h3 font-semibold text-fg-1 mb-3">{dim.label}</h3>
      <p className="text-caption text-fg-2 leading-relaxed whitespace-pre-wrap">
        {dim.content}
        {dim.isStreaming && (
          <span
            aria-hidden
            className="inline-block w-1 h-4 bg-indigo align-middle ml-0.5 animate-pulse"
          />
        )}
      </p>
    </article>
  );
}

function DimensionCardEmpty({ label }: { label: string }) {
  return (
    <article className="rounded-card bg-card shadow-card p-6 opacity-50">
      <h3 className="text-h3 font-semibold text-fg-3 mb-3">{label}</h3>
      <p className="text-caption text-fg-3 italic">等待解析…</p>
    </article>
  );
}

function RawOutput({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  return (
    <article className="rounded-card bg-card shadow-card p-6">
      <p className="text-caption text-fg-2 leading-relaxed whitespace-pre-wrap">
        {content}
        {isStreaming && (
          <span
            aria-hidden
            className="inline-block w-1 h-4 bg-indigo align-middle ml-0.5 animate-pulse"
          />
        )}
      </p>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Status bar
// ───────────────────────────────────────────────────────────────────────────────

function StatusBar({
  tokensIn,
  tokensOut,
  durationSec,
  costUsd,
  isStreaming,
}: {
  tokensIn: number;
  tokensOut: number;
  durationSec?: number;
  costUsd?: number;
  isStreaming?: boolean;
}) {
  return (
    <footer className="
      flex items-center gap-4 flex-wrap
      px-4 py-3 rounded-card-sm
      bg-soft text-meta text-fg-2 tabular-nums
      border border-border-default
    ">
      <span>
        in ≈ <span className="text-fg-1 font-medium">{tokensIn.toLocaleString()}</span>
        <span className="mx-1.5 text-fg-3">·</span>
        out ≈ <span className="text-fg-1 font-medium">{tokensOut.toLocaleString()}</span>
      </span>
      {durationSec !== undefined && (
        <span>
          <span className="mr-1 text-fg-3">|</span>
          耗时 <span className="text-fg-1 font-medium">{durationSec}s</span>
        </span>
      )}
      {costUsd !== undefined && (
        <span>
          <span className="mr-1 text-fg-3">|</span>
          预估成本 <span className="text-fg-1 font-medium">${costUsd.toFixed(2)}</span>
        </span>
      )}
      {isStreaming && (
        <span className="ml-auto inline-flex items-center gap-1.5 text-indigo font-medium">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full bg-indigo animate-pulse"
          />
          <span>流式输出中…</span>
        </span>
      )}
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — completed parse, 4-dimension output
// ═══════════════════════════════════════════════════════════════════════════════

export default function ParsePage() {
  // TODO: from useParseStore()
  const history = MOCK_HISTORY;
  const selectedHistoryId = 'h1';
  const skill = MOCK_SKILL;
  const dimensions = MOCK_DIMENSIONS_COMPLETE;

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <HistorySidebar items={history} selectedId={selectedHistoryId} />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">AI 解析</h1>
          <p className="text-meta text-fg-2 mt-1">
            选择文献 + Skill + 模型 → 一键生成结构化解读
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <ConfigBlock
            paperLabel="Attention Is All You Need · arXiv 1706.03762"
            modelLabel="Claude Opus 4.7"
            skillName={skill.displayName}
            skillDescription={skill.description}
            recommendedModels={skill.recommendedModels}
            canRun
          />

          {/* Output region — 2-column dimension grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {dimensions.map((dim) => (
              <DimensionCard key={dim.key} dim={dim} />
            ))}
          </div>

          <StatusBar
            tokensIn={12_400}
            tokensOut={3_800}
            durationSec={22}
            costUsd={0.47}
          />
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY — no paper selected yet
// ═══════════════════════════════════════════════════════════════════════════════

export function ParsePageEmptyNoSelection() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <HistorySidebar items={[]} selectedId={null} />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">AI 解析</h1>
          <p className="text-meta text-fg-2 mt-1">
            选择文献 + Skill + 模型 → 一键生成结构化解读
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <ConfigBlock
            paperLabel=""
            modelLabel=""
            skillName="(未选择 Skill)"
            canRun={false}
          />

          {/* Stage empty hint */}
          <div className="
            relative overflow-hidden rounded-card bg-stage-gradient
            py-16 px-8 text-center
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
              <Brain size={64} strokeWidth={1.5} aria-hidden className="mx-auto text-indigo opacity-60" />
              <h2 className="text-h3 font-semibold text-fg-1 mt-6">
                选好文献 / Skill / 模型,点「开始解析」开始
              </h2>
              <p className="text-caption text-fg-2 mt-2 max-w-md mx-auto leading-relaxed">
                也可以从左侧历史记录恢复以前的解析结果。
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOADING — multiple PDFs being uploaded
// ═══════════════════════════════════════════════════════════════════════════════

export function ParsePageUploading() {
  const uploadingFiles: UploadFileStatus[] = [
    { filename: 'attention-is-all-you-need.pdf', state: 'done' },
    { filename: 'bert-paper.pdf',                state: 'uploading' },
    { filename: 'palm-paper.pdf',                state: 'pending' },
    { filename: 'gpt4-tech-report.pdf',          state: 'pending' },
  ];

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <HistorySidebar items={MOCK_HISTORY} selectedId={null} />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">AI 解析</h1>
          <p className="text-meta text-fg-2 mt-1">
            选择文献 + Skill + 模型 → 一键生成结构化解读
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <ConfigBlock
            paperLabel=""
            modelLabel="Claude Opus 4.7"
            skillName="论文深度精读"
            canRun={false}
          />

          <UploadBanner
            state="uploading"
            files={uploadingFiles}
            progress={{ current: 2, total: 4 }}
          />
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD DONE — all succeeded
// ═══════════════════════════════════════════════════════════════════════════════

export function ParsePageUploadDone() {
  const doneFiles: UploadFileStatus[] = [
    { filename: 'attention-is-all-you-need.pdf', state: 'done' },
    { filename: 'bert-paper.pdf',                state: 'done' },
    { filename: 'palm-paper.pdf',                state: 'done' },
  ];

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <HistorySidebar items={MOCK_HISTORY} selectedId={null} />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">AI 解析</h1>
          <p className="text-meta text-fg-2 mt-1">
            选择文献 + Skill + 模型 → 一键生成结构化解读
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <ConfigBlock
            paperLabel=""
            modelLabel="Claude Opus 4.7"
            skillName="论文深度精读"
            canRun={false}
          />

          <UploadBanner state="done-success" files={doneFiles} />
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD PARTIAL FAILED — some succeeded, some failed, one needs review
// ═══════════════════════════════════════════════════════════════════════════════

export function ParsePageUploadPartialFailed() {
  const mixedFiles: UploadFileStatus[] = [
    { filename: 'attention-is-all-you-need.pdf', state: 'done' },
    { filename: 'corrupted-scan.pdf',            state: 'failed', errorMessage: '无法识别 PDF 内容' },
    { filename: 'noisy-image-only.pdf',          state: 'needs-review' },
    { filename: 'too-large.pdf',                 state: 'failed', errorMessage: '超过 50MB 限制' },
  ];

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <HistorySidebar items={MOCK_HISTORY} selectedId={null} />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">AI 解析</h1>
          <p className="text-meta text-fg-2 mt-1">
            选择文献 + Skill + 模型 → 一键生成结构化解读
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <ConfigBlock
            paperLabel=""
            modelLabel="Claude Opus 4.7"
            skillName="论文深度精读"
            canRun={false}
          />

          <UploadBanner state="done-partial" files={mixedFiles} />
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING — parse running, dimensions filling in incrementally
// ═══════════════════════════════════════════════════════════════════════════════

export function ParsePageStreaming() {
  const skill = MOCK_SKILL;
  const partial = MOCK_DIMENSIONS_STREAMING;
  // Remaining dimensions not yet started
  const remaining = (skill.outputDimensions ?? [])
    .slice(partial.length)
    .map((d) => ({ key: d.key, label: d.label }));

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <HistorySidebar items={MOCK_HISTORY} selectedId={null} />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">AI 解析</h1>
          <p className="text-meta text-fg-2 mt-1">
            选择文献 + Skill + 模型 → 一键生成结构化解读
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <ConfigBlock
            paperLabel="Attention Is All You Need · arXiv 1706.03762"
            modelLabel="Claude Opus 4.7"
            skillName={skill.displayName}
            skillDescription={skill.description}
            recommendedModels={skill.recommendedModels}
            canRun
            isRunning
          />

          {/* Mixed dimension cards: streamed, streaming, waiting */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {partial.map((dim) => (
              <DimensionCard key={dim.key} dim={dim} />
            ))}
            {remaining.map((d) => (
              <DimensionCardEmpty key={d.key} label={d.label} />
            ))}
          </div>

          <StatusBar
            tokensIn={12_400}
            tokensOut={1_240}
            durationSec={11}
            isStreaming
          />
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING RAW — skill has no output_dimensions, single block streaming
// ═══════════════════════════════════════════════════════════════════════════════

export function ParsePageStreamingRaw() {
  const partialRaw = `这篇论文的核心贡献是提出了一种新的稀疏注意力机制,通过可学习的路由策略动态选择需要计算的 token 对,在保持模型质量的同时将计算量减少了 40%。

研究方法上,作者设计了一个轻量级的路由器`;

  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <HistorySidebar items={MOCK_HISTORY} selectedId={null} />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">AI 解析</h1>
          <p className="text-meta text-fg-2 mt-1">
            选择文献 + Skill + 模型 → 一键生成结构化解读
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <ConfigBlock
            paperLabel="Sparse Attention Improvements · arXiv 2511.01234"
            modelLabel="Claude Opus 4.7"
            skillName="快速摘要"
            skillDescription="一段式总结论文核心要点,不分章节。"
            canRun
            isRunning
          />

          <div className="mb-4">
            <RawOutput content={partialRaw} isStreaming />
          </div>

          <StatusBar
            tokensIn={8_200}
            tokensOut={420}
            durationSec={6}
            isStreaming
          />
        </div>
      </section>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR — parse failed mid-way
// ═══════════════════════════════════════════════════════════════════════════════

export function ParsePageError() {
  return (
    <main role="main" className="flex h-[calc(100vh-36px)] bg-page">
      <HistorySidebar items={MOCK_HISTORY} selectedId={null} />

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-8 pt-8 pb-4 border-b border-border-default">
          <h1 className="text-h2 font-semibold text-fg-1">AI 解析</h1>
          <p className="text-meta text-fg-2 mt-1">
            选择文献 + Skill + 模型 → 一键生成结构化解读
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <ConfigBlock
            paperLabel="Attention Is All You Need · arXiv 1706.03762"
            modelLabel="Claude Opus 4.7"
            skillName="论文深度精读"
            skillDescription={MOCK_SKILL.description}
            recommendedModels={MOCK_SKILL.recommendedModels}
            canRun
          />

          {/* Error banner */}
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
              <p className="text-caption font-medium text-fg-1">解析失败</p>
              <p className="text-meta text-fg-2 mt-1">
                <span className="font-mono">HTTP 429 Too Many Requests</span> — Claude API 限流。
                可稍后重试,或切换其他模型继续。
              </p>
              <button
                type="button"
                className="
                  inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-pill border
                  text-meta font-medium text-danger-fg border-danger-border bg-card
                  hover:bg-danger-bg
                  transition-colors duration-fast ease-khx
                  focus-visible:outline-none focus-visible:shadow-focus
                "
              >
                <RefreshCw size={12} strokeWidth={1.5} aria-hidden />
                <span>重试</span>
              </button>
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

          <StatusBar
            tokensIn={12_400}
            tokensOut={620}
            durationSec={4}
          />
        </div>
      </section>
    </main>
  );
}
