/**
 * Models.draft.tsx — V2.2 SGHUB Capsule
 *
 * Static structural draft for /models (模型配置 / Model BYOK).
 *
 * Layout: single column, p-8 max-w-5xl
 *   1. PageHeader (title + "重建统计" link)
 *   2. Stats cards (4 cards in grid)
 *   3. 7-day usage chart (Recharts placeholder)
 *   4. Model list / empty state
 *   5. (When adding) Inline add-model form card
 *
 * Note on chart: <ChartPlaceholder> mimics a 7-bar histogram visually so the
 * design intent is clear. Real chart is Recharts <BarChart>, swapped in by
 * Step 6.
 */

import {
  Bot,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  TestTube2,
  Star,
  CheckCircle2,
  XCircle,
  KeyRound,
  AlertTriangle,
  Loader2,
  ChevronDown,
  X,
  Info,
} from 'lucide-react';
// import { useTranslation } from 'react-i18next';
// import { useModelsStore } from '@/stores/modelsStore';
// import { Skeleton } from '@/components/Skeleton';

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

type Provider = 'anthropic' | 'openai' | 'ollama' | 'custom';
type KeyStatus = 'ok' | 'missing' | 'invalid';

interface ModelConfig {
  id: string;
  name: string;
  provider: Provider;
  endpoint: string;
  modelId: string;
  maxTokens: number;
  pricePerMTokIn: number;  // USD per 1M input tokens
  pricePerMTokOut: number;
  keyStatus: KeyStatus;
  isDefault: boolean;
  usage7d: {
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  };
}

interface DailyUsage {
  date: string;   // "MM/DD"
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

// ───────────────────────────────────────────────────────────────────────────────
// Mock data
// ───────────────────────────────────────────────────────────────────────────────

const MOCK_MODELS: ModelConfig[] = [
  {
    id: 'm1',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    modelId: 'claude-opus-4-7',
    maxTokens: 8192,
    pricePerMTokIn: 15.0,
    pricePerMTokOut: 75.0,
    keyStatus: 'ok',
    isDefault: true,
    usage7d: { calls: 142, tokensIn: 287_400, tokensOut: 91_200, costUsd: 11.15 },
  },
  {
    id: 'm2',
    name: 'GPT-4o',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1',
    modelId: 'gpt-4o-2024-11-20',
    maxTokens: 4096,
    pricePerMTokIn: 2.5,
    pricePerMTokOut: 10.0,
    keyStatus: 'ok',
    isDefault: false,
    usage7d: { calls: 38, tokensIn: 91_300, tokensOut: 24_800, costUsd: 0.48 },
  },
  {
    id: 'm3',
    name: 'Llama 3.3 70B (local)',
    provider: 'ollama',
    endpoint: 'http://localhost:11434',
    modelId: 'llama3.3:70b',
    maxTokens: 4096,
    pricePerMTokIn: 0,
    pricePerMTokOut: 0,
    keyStatus: 'ok',
    isDefault: false,
    usage7d: { calls: 12, tokensIn: 18_900, tokensOut: 6_400, costUsd: 0.0 },
  },
];

const MOCK_DAILY_USAGE: DailyUsage[] = [
  { date: '05/13', calls: 28, tokensIn: 52_100, tokensOut: 18_400, costUsd: 2.21 },
  { date: '05/14', calls: 19, tokensIn: 31_800, tokensOut: 9_200, costUsd: 1.18 },
  { date: '05/15', calls: 35, tokensIn: 78_400, tokensOut: 24_600, costUsd: 3.02 },
  { date: '05/16', calls: 22, tokensIn: 45_200, tokensOut: 12_900, costUsd: 1.65 },
  { date: '05/17', calls: 41, tokensIn: 91_700, tokensOut: 29_100, costUsd: 3.55 },
  { date: '05/18', calls: 31, tokensIn: 62_400, tokensOut: 20_300, costUsd: 2.42 },
  { date: '05/19', calls: 16, tokensIn: 35_600, tokensOut: 8_900, costUsd: 1.27 },
];

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function formatTokensCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function formatUsd(n: number): string {
  return n.toFixed(2);
}

// Provider icon helper (returns Lucide element + indigo-soft icon box)
function ProviderIcon({ provider }: { provider: Provider }) {
  // For now all four providers share the icon-box treatment + a generic Bot icon.
  // Step 4 produces dedicated SVGs (anthropic / openai / llama / custom wrench).
  // TODO: replace with brand-specific SVG icons from Step 4
  return (
    <div className="
      w-7 h-7 rounded-icon flex-shrink-0
      bg-indigo-soft text-indigo
      flex items-center justify-center
    ">
      <Bot size={16} strokeWidth={1.5} aria-hidden />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Stats cards (4)
// ───────────────────────────────────────────────────────────────────────────────

function StatsCards({
  modelCount,
  totalCalls,
  totalTokens,
  totalCostUsd,
}: {
  modelCount: number;
  totalCalls: number;
  totalTokens: number;
  totalCostUsd: number;
}) {
  const cards = [
    { label: '已配置模型', value: modelCount.toString(),         hint: '已启用 BYOK 配置' },
    { label: '近 7 天调用', value: totalCalls.toString(),         hint: '总请求次数' },
    { label: '近 7 天 Token', value: formatTokensCompact(totalTokens), hint: '输入 + 输出' },
    { label: '近 7 天成本', value: `$${formatUsd(totalCostUsd)}`,  hint: '基于自填定价估算' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="
            rounded-card bg-card shadow-card p-5
            transition-shadow duration-base ease-khx hover:shadow-card-hover
          "
        >
          <p className="text-meta text-fg-2 uppercase tracking-wide-brand font-medium">
            {c.label}
          </p>
          <p className="text-h2 font-bold text-fg-1 mt-2 tabular-nums">
            {c.value}
          </p>
          <p className="text-micro text-fg-3 mt-1">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// 7-day usage chart placeholder
// ───────────────────────────────────────────────────────────────────────────────

/**
 * ChartPlaceholder — visual stand-in for Recharts BarChart.
 * Real version uses 'recharts' BarChart with bg-indigo bars, custom tooltip
 * showing { calls, tokensIn, tokensOut, costUsd } on hover.
 */
function ChartPlaceholder({ data }: { data: DailyUsage[] }) {
  const maxTokens = Math.max(...data.map((d) => d.tokensIn + d.tokensOut));
  return (
    <div className="rounded-card bg-card shadow-card p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-h3 font-semibold text-fg-1">近 7 天 Token 用量</h2>
          <p className="text-meta text-fg-2 mt-1">输入 + 输出,按天聚合</p>
        </div>
        <p className="text-meta text-fg-3">
          {/* TODO: replace with <BarChart /> from recharts */}
          <span aria-hidden>— 图表预览 —</span>
        </p>
      </div>

      {/* Bar chart placeholder — 7 vertical bars, 120px tall area */}
      <div
        role="img"
        aria-label="7-day token usage histogram"
        className="flex items-end justify-between gap-2 h-[120px] px-2"
      >
        {data.map((d) => {
          const total = d.tokensIn + d.tokensOut;
          const ratio = maxTokens > 0 ? total / maxTokens : 0;
          const heightPct = Math.max(8, ratio * 100); // min 8% so empty days still show
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="
                  w-full rounded-t-card-sm bg-indigo
                  transition-[height] duration-base ease-khx
                  hover:bg-indigo-hover
                "
                style={{ height: `${heightPct}%` }}
                title={`${d.date}: ${d.calls} 次调用 / 输入 ${formatTokensCompact(d.tokensIn)} / 输出 ${formatTokensCompact(d.tokensOut)} / 成本 $${formatUsd(d.costUsd)}`}
                aria-hidden
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex items-center justify-between gap-2 px-2 mt-2">
        {data.map((d) => (
          <span key={d.date} className="flex-1 text-center text-micro text-fg-3 tabular-nums">
            {d.date}
          </span>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Model card
// ───────────────────────────────────────────────────────────────────────────────

function ModelCard({ model }: { model: ModelConfig }) {
  const keyStatusConfig: Record<KeyStatus, { icon: React.ElementType; classes: string; label: string }> = {
    ok:      { icon: CheckCircle2, classes: 'text-success-fg',     label: 'Key 有效' },
    missing: { icon: KeyRound,     classes: 'text-fg-3',           label: 'Key 缺失' },
    invalid: { icon: XCircle,      classes: 'text-warning-fg-strong', label: 'Key 待验证' },
  };
  const KS = keyStatusConfig[model.keyStatus];

  return (
    <article
      className="
        rounded-card bg-card shadow-card p-6
        transition-shadow duration-base ease-khx hover:shadow-card-hover
      "
    >
      <div className="flex items-start gap-4">
        <ProviderIcon provider={model.provider} />

        {/* Main column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-h3 font-semibold text-fg-1">{model.name}</h3>

            {model.isDefault && (
              <span
                aria-label="Default model"
                className="
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-pill
                  bg-badge-update-bg text-badge-update-fg
                  text-micro font-medium
                "
              >
                <Star size={10} strokeWidth={2} aria-hidden />
                <span>默认</span>
              </span>
            )}

            <span className="
              inline-flex items-center px-2 py-0.5 rounded-pill
              bg-badge-default-bg text-badge-default-fg
              text-micro font-medium
            ">
              {model.provider}
            </span>
          </div>

          {/* Endpoint / model_id / max_tokens — mono row */}
          <p className="text-meta text-fg-2 mt-2 font-mono truncate">
            {model.endpoint}
            <span className="text-fg-3 mx-1.5">·</span>
            {model.modelId}
            <span className="text-fg-3 mx-1.5">·</span>
            max {model.maxTokens.toLocaleString()}
          </p>

          {/* Key status + usage */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-meta ${KS.classes}`}>
              <KS.icon size={14} strokeWidth={1.5} aria-hidden />
              <span>{KS.label}</span>
            </span>

            <span className="text-meta text-fg-2 tabular-nums">
              近 7 天:
              <span className="text-fg-1 font-medium mx-1">{model.usage7d.calls}</span>
              次 · 输入
              <span className="text-fg-1 font-medium mx-1">
                {formatTokensCompact(model.usage7d.tokensIn)}
              </span>
              · 输出
              <span className="text-fg-1 font-medium mx-1">
                {formatTokensCompact(model.usage7d.tokensOut)}
              </span>
              · 成本
              <span className="text-fg-1 font-medium mx-1">
                ${formatUsd(model.usage7d.costUsd)}
              </span>
            </span>
          </div>
        </div>

        {/* Right action column */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            aria-label="Test connection"
            className="
              p-2 rounded-pill text-fg-2
              hover:text-indigo hover:bg-indigo-soft
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
            title="测试连接"
          >
            <TestTube2 size={16} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Set as default"
            disabled={model.isDefault}
            className="
              p-2 rounded-pill text-fg-2
              hover:text-warning-fg-strong hover:bg-warning-bg
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-fg-2 disabled:hover:bg-transparent
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
            title={model.isDefault ? '已是默认' : '设为默认'}
          >
            <Star size={16} strokeWidth={1.5} aria-hidden fill={model.isDefault ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            aria-label="Edit"
            className="
              p-2 rounded-pill text-fg-2
              hover:text-indigo hover:bg-indigo-soft
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
            title="编辑"
          >
            <Pencil size={16} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Delete"
            className="
              p-2 rounded-pill text-fg-2
              hover:text-danger-fg hover:bg-danger-bg
              transition-colors duration-fast ease-khx
              focus-visible:outline-none focus-visible:shadow-focus
            "
            title="删除"
          >
            <Trash2 size={16} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Add model form (inline card, NOT modal — per V2.1 convention preserved)
// ───────────────────────────────────────────────────────────────────────────────

function AddModelForm({
  onCancel,
  onSave,
}: {
  onCancel?: () => void;
  onSave?: () => void;
}) {
  const presets: Array<{ id: Provider; label: string }> = [
    { id: 'anthropic', label: 'Anthropic' },
    { id: 'openai',    label: 'OpenAI' },
    { id: 'ollama',    label: 'Ollama (local)' },
    { id: 'custom',    label: '自定义' },
  ];

  return (
    <section
      aria-label="Add model"
      className="
        rounded-card bg-card border border-indigo-muted shadow-card
        p-6 mb-4
      "
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-h3 font-semibold text-fg-1">添加模型</h2>
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

      {/* Preset chips */}
      <div className="mb-5">
        <label className="block text-caption font-medium text-fg-1 mb-2">预设</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="
                inline-flex items-center px-3 py-1.5 rounded-pill text-meta border
                bg-card border-border-default text-fg-2
                hover:text-fg-1 hover:bg-navy-faint hover:border-navy-muted
                transition-colors duration-fast ease-khx
                focus-visible:outline-none focus-visible:shadow-focus
              "
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <div>
          <label className="block text-caption font-medium text-fg-1 mb-2">名称</label>
          <input
            type="text"
            placeholder="例如:Claude Opus 4.7"
            className="
              w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1 placeholder:text-fg-3
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          />
        </div>

        <div>
          <label className="block text-caption font-medium text-fg-1 mb-2">Provider</label>
          <div className="relative">
            <select
              defaultValue="anthropic"
              className="
                w-full appearance-none pl-input-x pr-9 py-input-y rounded-pill border border-border-default
                bg-card text-caption text-fg-1
                focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
                transition-shadow duration-fast ease-khx
              "
            >
              <option value="anthropic">anthropic</option>
              <option value="openai">openai</option>
              <option value="ollama">ollama</option>
              <option value="custom">custom</option>
            </select>
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              aria-hidden
              className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-2 pointer-events-none"
            />
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-caption font-medium text-fg-1 mb-2">Endpoint</label>
          <input
            type="url"
            placeholder="https://api.anthropic.com"
            className="
              w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1 placeholder:text-fg-3 font-mono
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          />
        </div>

        <div>
          <label className="block text-caption font-medium text-fg-1 mb-2">Model ID</label>
          <input
            type="text"
            placeholder="claude-opus-4-7"
            className="
              w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1 placeholder:text-fg-3 font-mono
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          />
        </div>

        <div>
          <label className="block text-caption font-medium text-fg-1 mb-2">Max Tokens</label>
          <input
            type="number"
            min={1}
            defaultValue={8192}
            className="
              w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1 tabular-nums
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          />
        </div>

        <div>
          <label className="block text-caption font-medium text-fg-1 mb-2">
            输入价格 <span className="text-fg-3 font-normal">($/1M tok)</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            defaultValue={0}
            title="用于成本估算,可在模型提供商官网查询定价"
            className="
              w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1 tabular-nums
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          />
        </div>

        <div>
          <label className="block text-caption font-medium text-fg-1 mb-2">
            输出价格 <span className="text-fg-3 font-normal">($/1M tok)</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            defaultValue={0}
            title="用于成本估算,可在模型提供商官网查询定价"
            className="
              w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1 tabular-nums
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          />
        </div>

        <div className="col-span-2">
          <label className="block text-caption font-medium text-fg-1 mb-2">
            API Key
            <span className="text-fg-3 font-normal ml-1">(本地加密存储,不上传)</span>
          </label>
          <input
            type="password"
            placeholder="sk-ant-..."
            className="
              w-full pl-input-x pr-input-x py-input-y rounded-pill border border-border-default
              bg-card text-caption text-fg-1 placeholder:text-fg-3 font-mono
              focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus
              transition-shadow duration-fast ease-khx
            "
          />
        </div>
      </div>

      {/* Inline hint */}
      <div className="
        flex items-start gap-2 mt-5 px-3 py-2 rounded-card-sm
        bg-info-bg text-info-fg
      ">
        <Info size={14} strokeWidth={1.5} aria-hidden className="flex-shrink-0 mt-0.5" />
        <p className="text-meta">
          API Key 通过系统 Keychain 加密保存,不会随同步或导出被泄露。
        </p>
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
          保存模型
        </button>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Page header (shared)
// ───────────────────────────────────────────────────────────────────────────────

function PageHeader({ onRebuild }: { onRebuild?: () => void }) {
  return (
    <header className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-h2 font-semibold text-fg-1">模型配置</h1>
        <p className="text-meta text-fg-2 mt-1">
          自带模型(BYOK)· 所有 API Key 本地加密保存
        </p>
      </div>

      <button
        type="button"
        onClick={onRebuild}
        className="
          inline-flex items-center gap-1.5 text-meta text-fg-3
          hover:text-fg-2
          transition-colors duration-fast ease-khx
          focus-visible:outline-none focus-visible:underline
        "
      >
        <RefreshCw size={12} strokeWidth={1.5} aria-hidden />
        <span>重建统计</span>
      </button>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — happy path
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ModelsPage — main rendered state with 3 mock models + 7-day chart.
 */
export default function ModelsPage() {
  // TODO: from useModelsStore()
  const models = MOCK_MODELS;
  const totalCalls = models.reduce((sum, m) => sum + m.usage7d.calls, 0);
  const totalTokens = models.reduce(
    (sum, m) => sum + m.usage7d.tokensIn + m.usage7d.tokensOut,
    0,
  );
  const totalCost = models.reduce((sum, m) => sum + m.usage7d.costUsd, 0);

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />

      <StatsCards
        modelCount={models.length}
        totalCalls={totalCalls}
        totalTokens={totalTokens}
        totalCostUsd={totalCost}
      />

      <ChartPlaceholder data={MOCK_DAILY_USAGE} />

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-h3 font-semibold text-fg-1">已配置模型</h2>
        <button
          type="button"
          className="
            inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill
            bg-navy text-text-inverse text-caption font-medium
            shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px
            active:bg-navy-active active:translate-y-0
            transition-[background,box-shadow,transform] duration-fast ease-khx
            focus-visible:outline-none focus-visible:shadow-[var(--shadow-btn),var(--shadow-focus)]
          "
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden />
          <span>添加模型</span>
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {models.map((m) => (
          <ModelCard key={m.id} model={m} />
        ))}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY — no models configured yet
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ModelsPageEmpty — first run, no models configured.
 */
export function ModelsPageEmpty() {
  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />

      <StatsCards
        modelCount={0}
        totalCalls={0}
        totalTokens={0}
        totalCostUsd={0}
      />

      {/* Empty chart card */}
      <div className="rounded-card bg-card shadow-card p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-h3 font-semibold text-fg-1">近 7 天 Token 用量</h2>
            <p className="text-meta text-fg-2 mt-1">输入 + 输出,按天聚合</p>
          </div>
        </div>
        <div className="h-[120px] flex items-center justify-center text-meta text-fg-3">
          暂无数据 — 配置模型后开始记录用量
        </div>
      </div>

      {/* Dashed empty card */}
      <div className="
        rounded-card border border-dashed border-border-default
        py-12 px-8 text-center bg-card
      ">
        <Bot size={48} strokeWidth={1.5} aria-hidden className="mx-auto text-fg-3" />
        <h3 className="text-h3 font-semibold text-fg-1 mt-4">
          还没配置任何模型
        </h3>
        <p className="text-caption text-fg-2 mt-2 max-w-md mx-auto leading-relaxed">
          点击下方按钮添加你的第一个模型。
          支持 Anthropic、OpenAI、Ollama 本地模型,以及任何 OpenAI 兼容端点。
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
          <span>添加模型</span>
        </button>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING — stats rebuilding
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ModelsPageLoading — user clicked "重建统计", stats and chart are recalculating.
 */
export function ModelsPageLoading() {
  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />

      {/* Stats cards as skeletons */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden
            className="rounded-card bg-card shadow-card p-5"
          >
            <div className="h-3 w-20 rounded-pill bg-navy-soft animate-pulse mb-3" />
            <div className="h-7 w-16 rounded-pill bg-navy-soft animate-pulse mb-2" />
            <div className="h-2 w-24 rounded-pill bg-navy-soft animate-pulse" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-card bg-card shadow-card p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="h-5 w-32 rounded-pill bg-navy-soft animate-pulse mb-2" />
            <div className="h-3 w-40 rounded-pill bg-navy-soft animate-pulse" />
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 h-[120px] px-2">
          {[35, 22, 58, 30, 70, 45, 28].map((h, i) => (
            <div key={i} className="flex-1">
              <div
                className="w-full rounded-t-card-sm bg-navy-soft animate-pulse"
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Loading status */}
      <div
        role="status"
        aria-busy="true"
        aria-label="Rebuilding statistics"
        className="flex items-center gap-2 text-meta text-fg-2"
      >
        <Loader2 size={14} strokeWidth={1.5} aria-hidden className="animate-spin text-indigo" />
        <span>正在重建近 7 天的调用与成本统计…</span>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR — test connection failed for one model
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ModelsPageError — banner shown when a "test connection" action failed.
 * The failing model card highlights its keyStatus accordingly.
 */
export function ModelsPageError() {
  const modelsWithError: ModelConfig[] = MOCK_MODELS.map((m) =>
    m.id === 'm2' ? { ...m, keyStatus: 'invalid' as KeyStatus } : m,
  );

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />

      <StatsCards
        modelCount={modelsWithError.length}
        totalCalls={192}
        totalTokens={519_200}
        totalCostUsd={11.63}
      />

      <ChartPlaceholder data={MOCK_DAILY_USAGE} />

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
          <p className="text-caption font-medium text-fg-1">连接测试失败:GPT-4o</p>
          <p className="text-meta text-fg-2 mt-1">
            <span className="font-mono">HTTP 401 Unauthorized</span> · API Key 无效或已过期。
            请前往该模型的「编辑」更新 Key,或参考{' '}
            <a
              href="#"
              className="
                text-indigo font-medium hover:text-indigo-hover hover:underline
                transition-colors duration-fast ease-khx
              "
            >
              排错指南
            </a>
            。
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

      <div className="flex flex-col gap-4">
        {modelsWithError.map((m) => (
          <ModelCard key={m.id} model={m} />
        ))}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADDING — inline add-model form expanded above list
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ModelsPageAdding — add-model form expanded inline above existing models.
 */
export function ModelsPageAdding() {
  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <PageHeader />

      <StatsCards
        modelCount={MOCK_MODELS.length}
        totalCalls={192}
        totalTokens={519_200}
        totalCostUsd={11.63}
      />

      <ChartPlaceholder data={MOCK_DAILY_USAGE} />

      <h2 className="text-h3 font-semibold text-fg-1 mb-4">已配置模型</h2>

      <AddModelForm />

      <div className="flex flex-col gap-4">
        {MOCK_MODELS.map((m) => (
          <ModelCard key={m.id} model={m} />
        ))}
      </div>
    </main>
  );
}
