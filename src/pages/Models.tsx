// i18n: 本组件文案已国际化 (V2.1.0)
import { useCallback, useEffect, useState, ComponentType } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bot,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Star,
  Store,
  TestTube,
  Trash2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import ProviderAnthropic from "../assets/icons/provider-anthropic.svg?react";
import ProviderOpenAI from "../assets/icons/provider-openai.svg?react";
import ProviderOllama from "../assets/icons/provider-ollama.svg?react";
import EmptyModelsArt from "../assets/illustrations/empty-models.svg?react";
import {
  api,
  type ModelConfig,
  type ModelConfigInput,
  type ModelUsage,
  type SgStoreBalanceSnapshot,
  type TestResult,
  type UsageStats7Days,
} from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";
import { confirmAsync } from "../components/DialogProvider";
import { Icon } from "../components/Icon";
import { Skeleton } from "../components/Skeleton";
import { Stage } from "../components/Stage";

const PROVIDER_LABEL_KEY: Record<string, string> = {
  anthropic: "models.provider_label_anthropic",
  openai: "models.provider_label_openai",
  ollama: "models.provider_label_ollama",
  custom: "models.provider_label_custom",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PROVIDER_ICON: Record<string, ComponentType<any>> = {
  anthropic: ProviderAnthropic,
  openai: ProviderOpenAI,
  ollama: ProviderOllama,
  custom: Wrench,
};

const PROVIDERS = ["anthropic", "openai", "ollama", "custom"];

const EMPTY_INPUT: ModelConfigInput = {
  name: "",
  provider: "openai",
  endpoint: "",
  model_id: "",
  max_tokens: 8192,
  api_key: null,
};

// ════════════════════════════════════════════════════════════════
// V2.2.1 Session 29 — SG AI Store helpers
// ════════════════════════════════════════════════════════════════

const SG_AI_STORE_DASHBOARD_URL = "https://sgaistore.com/dashboard";
const SG_AI_STORE_TOPUP_URL = "https://sgaistore.com/topup";

/**
 * Balance tier thresholds. Mirrors the user spec:
 *   green   ≥ 20% of a "comfortable" balance (>=¥20)
 *   amber   <20%, >=10%  (¥2 – ¥20)
 *   red     <10%, >0     (>¥0, <¥2)
 *   gray    exhausted    (==0 OR null/unknown)
 */
type BalanceTier = "green" | "amber" | "red" | "gray";

function balanceTier(balance_cny: number | null): BalanceTier {
  if (balance_cny == null || balance_cny <= 0) return "gray";
  if (balance_cny < 2) return "red";
  if (balance_cny < 20) return "amber";
  return "green";
}

function BalanceBadge({ balance_cny }: { balance_cny: number | null }) {
  const { t } = useTranslationLite();
  const tier = balanceTier(balance_cny);
  const palette: Record<BalanceTier, string> = {
    green: "bg-badge-improve-bg text-badge-improve-fg",
    amber: "bg-badge-new-bg text-badge-new-fg",
    red: "bg-badge-bug-bg text-badge-bug-fg",
    gray: "bg-badge-default-bg text-badge-default-fg",
  };
  const label =
    balance_cny == null
      ? t("models.balance_unknown")
      : `¥${balance_cny.toFixed(2)}`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-medium tabular-nums ${palette[tier]}`}
      title={
        balance_cny == null
          ? t("models.balance_unknown_title")
          : t("models.balance_tier_" + tier)
      }
    >
      <span>{label}</span>
    </span>
  );
}

/** Tiny i18n shim so the helpers can call t() without prop drilling. */
function useTranslationLite() {
  return { t: useT() };
}

function SgAiStoreChip() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-medium uppercase tracking-wide-brand bg-indigo-soft text-indigo">
      <Icon icon={Store} size="xs" />
      <span>{t("models.sg_ai_store")}</span>
    </span>
  );
}

function formatExpiry(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ProviderIconBox({ provider }: { provider: string }) {
  const Comp = PROVIDER_ICON[provider] ?? Bot;
  return (
    <span className="shrink-0 w-11 h-11 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center">
      <Icon icon={Comp} size={22} />
    </span>
  );
}

function StatsCards({
  models,
  stats,
  onRebuild,
}: {
  models: ModelConfig[];
  stats: UsageStats7Days | null;
  onRebuild: () => void;
}) {
  const t = useT();
  const totalTokens =
    (stats?.total_tokens_in ?? 0) + (stats?.total_tokens_out ?? 0);
  const cards = [
    {
      label: t("models.stat_configured_models"),
      value: String(models.length),
      hint: t("models.stat_configured_models_hint"),
    },
    {
      label: t("models.stat_calls_7d"),
      value: String(stats?.total_call_count ?? 0),
      hint: t("models.stat_hint_calls"),
    },
    {
      label: t("models.stat_tokens_7d"),
      value: formatTokens(totalTokens),
      hint: t("models.stat_hint_tokens"),
    },
  ];
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-meta uppercase tracking-wide-brand text-fg-3">
          {t("models.stat_subtitle_7d")}
        </span>
        <button
          type="button"
          onClick={onRebuild}
          className="inline-flex items-center gap-1 text-meta text-fg-3 hover:text-indigo transition-colors duration-fast ease-khx"
          title={t("models.stat_rebuild_title")}
        >
          <Icon icon={RefreshCw} size="xs" />
          <span>{t("models.stat_rebuild")}</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-card rounded-card shadow-card p-5 transition-shadow duration-base ease-khx hover:shadow-card-hover"
          >
            <div className="text-meta text-fg-2">{c.label}</div>
            <div className="text-h2 font-semibold text-fg-1 mt-1 tabular-nums">
              {c.value}
            </div>
            <div className="text-micro text-fg-3 mt-1">{c.hint}</div>
          </div>
        ))}
      </div>
      {stats && stats.daily_breakdown.length > 0 && (
        <UsageBarChart stats={stats} />
      )}
    </div>
  );
}

// V2.2.1 fix — chart with range toggle (7d / 30d / custom) and a
// smooth filled area-line. Fetches its own data when range changes;
// the StatsCards above still reflect the 7-day rollup so the headline
// totals stay anchored.
type RangeMode = "7d" | "30d" | "custom";

interface ChartPoint {
  label: string;
  full: string;
  in: number;
  out: number;
  total: number;
  calls: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  try {
    const from = new Date(fromIso + "T00:00:00Z").getTime();
    const to = new Date(toIso + "T00:00:00Z").getTime();
    const diff = Math.floor((to - from) / 86_400_000) + 1;
    return Math.max(1, Math.min(90, diff));
  } catch {
    return 7;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Spread the X-axis labels so they don't overlap. Returns the
 *  recharts `interval` prop value (skip count). */
function tickInterval(n: number): number {
  if (n <= 7) return 0; // every label
  if (n <= 14) return 1;
  if (n <= 30) return 3;
  if (n <= 60) return 6;
  return 9;
}

function UsageChart({ stats: initialStats }: { stats: UsageStats7Days }) {
  const t = useT();
  const [mode, setMode] = useState<RangeMode>("7d");
  const [customFrom, setCustomFrom] = useState<string>(daysAgoIso(30));
  const [customTo, setCustomTo] = useState<string>(todayIso());
  const [stats, setStats] = useState<UsageStats7Days>(initialStats);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    let cancelled = false;
    if (mode === "7d") {
      setStats(initialStats);
      return;
    }
    const n =
      mode === "30d" ? 30 : daysBetween(customFrom, customTo);
    setLoading(true);
    api
      .getUsageStatsNDays(n)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((e) => console.warn("getUsageStatsNDays failed", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, customFrom, customTo, initialStats]);

  const data: ChartPoint[] = stats.daily_breakdown.map((d) => ({
    label: d.date.slice(5).replace("-", "/"),
    full: d.date,
    in: d.tokens_in,
    out: d.tokens_out,
    total: d.tokens_in + d.tokens_out,
    calls: d.call_count,
  }));

  const interval = tickInterval(data.length);

  return (
    <div className="bg-card rounded-card shadow-card p-5 mt-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="text-meta text-fg-2">
          {t("models.stat_chart_title")}
          <span className="mx-1.5 text-fg-3">·</span>
          {mode === "7d" && t("models.chart_range_7d")}
          {mode === "30d" && t("models.chart_range_30d")}
          {mode === "custom" && `${customFrom} — ${customTo}`}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["7d", "30d", "custom"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2.5 py-0.5 rounded-pill text-meta font-medium transition-colors duration-fast ease-khx ${
                  active
                    ? "bg-navy text-fg-inverse"
                    : "bg-navy-faint text-fg-2 hover:bg-navy-soft hover:text-fg-1"
                }`}
              >
                {t("models.chart_range_" + m)}
              </button>
            );
          })}
          {mode === "custom" && (
            <div className="flex items-center gap-1.5 text-meta">
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-0.5 rounded-pill border border-border-default bg-card text-fg-1 text-meta focus:outline-none focus:border-border-focus tabular-nums"
              />
              <span className="text-fg-3">—</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayIso()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-0.5 rounded-pill border border-border-default bg-card text-fg-1 text-meta focus:outline-none focus:border-border-focus tabular-nums"
              />
            </div>
          )}
          {loading && (
            <Icon icon={Loader2} size="xs" className="animate-spin text-fg-3" />
          )}
        </div>
      </div>
      {/* V2.2.1 QA: suppress the browser default focus outline that
          recharts' inner <svg> picks up on click — it rendered as a
          black 2px border around the whole chart. */}
      <div
        style={{ width: "100%", height: 160 }}
        className="outline-none [&_*]:outline-none [&_svg]:focus-visible:outline-none"
      >
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 6, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--indigo)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--indigo)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              interval={interval}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              stroke="var(--border-default)"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              stroke="var(--border-default)"
              tickFormatter={(v: number) => formatTokens(v)}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: "var(--navy-muted)", strokeWidth: 1 }}
              content={({
                active,
                payload,
              }: {
                active?: boolean;
                payload?: unknown;
              }) => {
                if (!active || !Array.isArray(payload) || payload.length === 0) {
                  return null;
                }
                const p = (
                  payload as Array<{ payload: ChartPoint }>
                )[0].payload;
                return (
                  <div className="bg-card rounded-card-sm shadow-nav border border-border-default px-3 py-2 text-meta">
                    <div className="font-semibold text-fg-1">{p.full}</div>
                    <div className="text-fg-2 mt-0.5">
                      {t("models.stat_chart_tooltip_calls", { count: p.calls })}
                    </div>
                    <div className="text-fg-2">
                      {t("models.stat_chart_tooltip_in", {
                        tokens: formatTokens(p.in),
                      })}
                      {" · "}
                      {t("models.stat_chart_tooltip_out", {
                        tokens: formatTokens(p.out),
                      })}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--indigo)"
              strokeWidth={2}
              fill="url(#usageFill)"
              dot={{ r: 2, fill: "var(--indigo)", stroke: "var(--bg-card)", strokeWidth: 1 }}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Alias kept so callsites in Models() compile without rewiring;
// removed once the rename ripples through.
const UsageBarChart = UsageChart;

function ModelRow({
  model,
  onChanged,
  usage,
}: {
  model: ModelConfig;
  onChanged: () => void;
  usage?: ModelUsage;
}) {
  const t = useT();
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [editing, setEditing] = useState(false);

  // V2.2.1 Session 29 — SG AI Store live balance fetch.
  // Headline numbers (balance_cny / remaining_tokens / expires_at)
  // come from model_configs cache; usage_24h needs a fresh query.
  const [snapshot, setSnapshot] = useState<SgStoreBalanceSnapshot | null>(null);
  const [refreshingBalance, setRefreshingBalance] = useState(false);

  useEffect(() => {
    if (!model.is_sg_ai_store) return;
    let cancelled = false;
    api
      .aiStoreGetBalance(model.id)
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((e) => {
        console.warn("ai_store balance fetch failed", e);
      });
    return () => {
      cancelled = true;
    };
  }, [model.id, model.is_sg_ai_store]);

  // Prefer the live snapshot for the badge; fall back to the cached
  // column. Both can be null on first paint.
  const displayBalance = snapshot?.balance_cny ?? model.balance_cny;
  const displayExpiry =
    snapshot?.subscription?.expires_at ?? model.subscription_expires_at;
  const usage24h = snapshot?.usage_24h;

  async function refreshBalance() {
    setRefreshingBalance(true);
    try {
      const s = await api.aiStoreGetBalance(model.id);
      setSnapshot(s);
      toast.success(
        t("models.balance_refreshed", { balance: s.balance_cny.toFixed(2) }),
      );
    } catch (e) {
      toast.danger(String(e));
    } finally {
      setRefreshingBalance(false);
    }
  }

  async function openDashboard() {
    try {
      await api.openExternalUrl(SG_AI_STORE_DASHBOARD_URL);
    } catch (e) {
      toast.danger(String(e));
    }
  }

  async function openTopUp() {
    try {
      await api.openExternalUrl(SG_AI_STORE_TOPUP_URL);
    } catch (e) {
      toast.danger(String(e));
    }
  }

  const test = () => {
    setTesting(true);
    setResult(null);
    api
      .testModelConnection(model.id)
      .then(setResult)
      .catch((e) =>
        setResult({
          success: false,
          latency_ms: 0,
          message: String(e),
          model_response: null,
        }),
      )
      .finally(() => setTesting(false));
  };

  const setAsDefault = () => {
    api
      .setDefaultModel(model.id)
      .then(onChanged)
      .catch((e) => toast.danger(String(e)));
  };

  const remove = async () => {
    const ok = await confirmAsync({
      title: t("models.confirm_delete_title"),
      description: t("models.confirm_delete", { name: model.name }),
      variant: "danger",
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
    });
    if (!ok) return;
    api
      .deleteModelConfig(model.id)
      .then(onChanged)
      .catch((e) => toast.danger(String(e)));
  };

  if (editing) {
    return (
      <ModelEditForm
        model={model}
        onSave={async (input) => {
          await api.updateModelConfig(model.id, input);
          setEditing(false);
          onChanged();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="bg-card rounded-card shadow-card p-5 transition-shadow duration-base ease-khx hover:shadow-card-hover">
      <div className="flex items-start gap-4">
        <ProviderIconBox provider={model.provider} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-h3 font-semibold text-fg-1">{model.name}</div>
            {model.is_default && (
              <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-improve-bg text-badge-improve-fg">
                <Icon
                  icon={Star}
                  size={12}
                  fill="currentColor"
                  strokeWidth={1.5}
                />
                <span>{t("models.default")}</span>
              </span>
            )}
            {model.is_sg_ai_store ? (
              <SgAiStoreChip />
            ) : (
              <span className="rounded-pill px-2 py-0.5 text-micro font-medium uppercase tracking-wide-brand bg-badge-default-bg text-badge-default-fg">
                {PROVIDER_LABEL_KEY[model.provider]
                  ? t(PROVIDER_LABEL_KEY[model.provider])
                  : model.provider}
              </span>
            )}
            {model.is_sg_ai_store && (
              <BalanceBadge balance_cny={displayBalance} />
            )}
          </div>
          <div className="text-meta text-fg-2 mt-1 font-mono truncate">
            {model.endpoint}
            <span className="mx-1.5 text-fg-3">·</span>
            {model.model_id}
            <span className="mx-1.5 text-fg-3">·</span>
            {model.max_tokens.toLocaleString()} tokens
          </div>
          {model.keychain_ref ? (
            <div className="text-meta text-success-fg mt-1 inline-flex items-center gap-1">
              <Icon icon={Check} size="xs" />
              <span>{t("models.key_stored")}</span>
            </div>
          ) : model.provider === "ollama" ? (
            <div className="text-meta text-fg-3 mt-1">
              {t("models.no_key_needed_local")}
            </div>
          ) : (
            <div className="text-meta text-warning-fg-strong mt-1 inline-flex items-center gap-1">
              <Icon icon={AlertTriangle} size="xs" />
              <span>{t("models.key_missing_warn")}</span>
            </div>
          )}
          {usage && usage.call_count > 0 && (
            <div className="text-meta text-fg-3 mt-1 tabular-nums">
              {t("models.row_usage_7d", {
                calls: usage.call_count,
                tokens: formatTokens(usage.tokens_in + usage.tokens_out),
              })}
            </div>
          )}
          {/* V2.2.1 Session 29 — SG AI Store extra strip */}
          {model.is_sg_ai_store && (
            <div className="text-meta text-fg-3 mt-1 tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
              {displayExpiry && (
                <span>
                  {t("models.sg_expires_on", {
                    date: formatExpiry(displayExpiry, t("common.date_locale")),
                  })}
                </span>
              )}
              {usage24h && usage24h.call_count > 0 && (
                <span>
                  {t("models.sg_usage_24h", {
                    cost: (
                      (usage24h.tokens_in + usage24h.tokens_out) /
                      1_000_000
                    ).toFixed(2),
                    calls: usage24h.call_count,
                  })}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {model.is_sg_ai_store && (
            <>
              <button
                type="button"
                onClick={refreshBalance}
                disabled={refreshingBalance}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default text-meta text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 transition-colors duration-fast ease-khx"
                title={t("models.sg_refresh_balance_title")}
              >
                <Icon
                  icon={RefreshCw}
                  size="xs"
                  className={refreshingBalance ? "animate-spin" : ""}
                />
                <span>{t("models.sg_refresh_balance")}</span>
              </button>
              <button
                type="button"
                onClick={openDashboard}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default text-meta text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
              >
                <Icon icon={ExternalLink} size="xs" />
                <span>{t("models.sg_dashboard")}</span>
              </button>
              <button
                type="button"
                onClick={openTopUp}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill bg-navy text-fg-inverse text-meta font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover transition-colors duration-fast ease-khx"
              >
                <Icon icon={ExternalLink} size="xs" />
                <span>{t("models.sg_top_up")}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={test}
            disabled={testing}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default text-meta text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 transition-colors duration-fast ease-khx"
          >
            {testing ? (
              <Icon icon={Loader2} size="xs" className="animate-spin" />
            ) : (
              <Icon icon={TestTube} size="xs" />
            )}
            <span>{testing ? t("models.testing") : t("models.test_connection")}</span>
          </button>
          {!model.is_default && (
            <button
              type="button"
              onClick={setAsDefault}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default text-meta text-fg-1 hover:border-warning-border hover:text-warning-fg-strong transition-colors duration-fast ease-khx"
            >
              <Icon icon={Star} size="xs" />
              <span>{t("models.set_default")}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default text-meta text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
          >
            <Icon icon={Pencil} size="xs" />
            <span>{t("models.edit_model")}</span>
          </button>
          <button
            type="button"
            onClick={remove}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default text-meta text-danger-fg hover:bg-danger-bg hover:border-danger-border transition-colors duration-fast ease-khx"
          >
            <Icon icon={Trash2} size="xs" />
            <span>{t("models.delete_model")}</span>
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`mt-4 px-4 py-3 rounded-card-sm text-meta border flex items-start gap-2 ${
            result.success
              ? "bg-success-bg text-success-fg border-success-border"
              : "bg-danger-bg text-danger-fg border-danger-border"
          }`}
        >
          <Icon
            icon={result.success ? Check : XCircle}
            size="sm"
            className="flex-shrink-0 mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{result.message}</div>
            {result.model_response && (
              <div className="mt-1 text-fg-2 font-mono break-words">
                {t("models.test_response_prefix", {
                  response: result.model_response,
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setResult(null)}
            aria-label="Dismiss"
            className="shrink-0 text-fg-3 hover:text-fg-1"
          >
            <Icon icon={X} size="xs" />
          </button>
        </div>
      )}
    </div>
  );
}

function ModelForm({
  initial,
  presets,
  isEdit,
  onSave,
  onCancel,
}: {
  initial: ModelConfigInput;
  presets: ModelConfigInput[];
  isEdit: boolean;
  onSave: (input: ModelConfigInput) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState<ModelConfigInput>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const update = <K extends keyof ModelConfigInput>(
    k: K,
    v: ModelConfigInput[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  const applyPreset = (presetIndex: number) => {
    if (presetIndex < 0) return;
    const p = presets[presetIndex];
    setForm({ ...p, api_key: form.api_key });
  };

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-card shadow-card p-6">
      <div className="text-h3 font-semibold text-fg-1 mb-4">
        {isEdit ? t("models.form_edit_title") : t("models.form_create_title")}
      </div>

      {!isEdit && presets.length > 0 && (
        <div className="mb-5 pb-5 border-b border-border-subtle">
          <div className="text-caption text-fg-2 mb-2">
            {t("models.form_preset_label")}
          </div>
          <div className="flex gap-2 flex-wrap">
            {presets.map((p, i) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(i)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill border border-border-default text-meta text-fg-1 hover:border-indigo hover:text-indigo hover:bg-indigo-soft transition-colors duration-fast ease-khx"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("models.form_name_label")}>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Claude Opus 4.7"
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          />
        </Field>
        <Field label="Provider">
          <select
            value={form.provider}
            onChange={(e) => update("provider", e.target.value)}
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABEL_KEY[p] ? t(PROVIDER_LABEL_KEY[p]) : p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Endpoint" className="col-span-2">
          <input
            value={form.endpoint}
            onChange={(e) => update("endpoint", e.target.value)}
            placeholder="https://api.anthropic.com"
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 font-mono focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          />
        </Field>
        <Field label="Model ID">
          <input
            value={form.model_id}
            onChange={(e) => update("model_id", e.target.value)}
            placeholder="claude-opus-4-7"
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 font-mono focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          />
        </Field>
        <Field label="Max Tokens">
          <input
            type="number"
            value={form.max_tokens}
            onChange={(e) => update("max_tokens", Number(e.target.value) || 0)}
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          />
        </Field>
        <Field
          label={
            isEdit
              ? t("models.form_api_key_edit_label")
              : t("models.form_api_key_label")
          }
          className="col-span-2"
        >
          <input
            type="password"
            value={form.api_key ?? ""}
            onChange={(e) => update("api_key", e.target.value)}
            placeholder={
              form.provider === "ollama"
                ? t("models.form_local_no_key")
                : "sk-..."
            }
            disabled={form.provider === "ollama"}
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 font-mono focus:outline-none focus:border-border-focus focus:shadow-focus disabled:bg-soft disabled:text-fg-3 disabled:cursor-not-allowed transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          />
          <div className="text-meta text-fg-3 mt-1.5">
            {t("models.key_storage_note")}
          </div>
        </Field>
      </div>

      {err && (
        <div
          role="alert"
          className="mt-4 rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption"
        >
          <Icon icon={AlertTriangle} size="sm" className="flex-shrink-0 mt-0.5" />
          <span>{t("models.error_label", { detail: err })}</span>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx font-medium"
        >
          {t("models.cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !form.name || !form.endpoint || !form.model_id}
          className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
        >
          {saving && <Icon icon={Loader2} size="sm" className="animate-spin" />}
          {saving
            ? t("models.saving")
            : isEdit
              ? t("models.save_changes")
              : t("models.create")}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="text-caption font-medium text-fg-1 mb-2">{label}</div>
      {children}
    </label>
  );
}

const SG_AI_STORE_BUY_URL =
  "https://sgaistore.com/buy?utm_source=sghub_client";

/**
 * V2.2.5 (Opt③) — model entry cards.
 *
 * Information architecture:
 *   - top row: two EQUAL-weight cards for users who already have a key —
 *     "add own model" (BYOK) and "add SG AI Store API key" (paste & go,
 *     no SKU dropdown).
 *   - bottom row: full-width purchase guidance for users without a key.
 * Shown in both empty and populated states.
 */
function ModelEntryCards({
  onAddOwn,
  onAdded,
}: {
  onAddOwn: () => void;
  onAdded: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A — BYOK own model */}
        <section className="bg-card rounded-card shadow-card p-5 flex flex-col">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center flex-shrink-0">
              <Icon icon={Bot} size="lg" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-h3 font-semibold text-fg-1">
                {t("models.entry_own_title")}
              </h2>
              <p className="text-meta text-fg-2 mt-1 leading-relaxed">
                {t("models.entry_own_desc")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAddOwn}
            className="mt-4 self-start inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default bg-card text-fg-1 text-caption font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
          >
            <span>{t("models.entry_own_btn")}</span>
          </button>
        </section>

        {/* Card B — paste SG AI Store key */}
        <SgAiStoreKeyCard onAdded={onAdded} />
      </div>

      {/* Bottom row — purchase guidance (no key yet) */}
      <section className="bg-card rounded-card shadow-card p-5 border border-indigo-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center flex-shrink-0">
            <Icon icon={Store} size="sm" />
          </div>
          <p className="text-meta text-fg-2 leading-relaxed">
            {t("models.entry_buy_desc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void api.openExternalUrl(SG_AI_STORE_BUY_URL).catch(() => {});
          }}
          className="self-start sm:self-auto flex-shrink-0 inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px transition-[background,box-shadow,transform] duration-fast ease-khx"
        >
          <Icon icon={ExternalLink} size="sm" />
          <span>{t("models.entry_buy_btn")}</span>
        </button>
      </section>
    </div>
  );
}

/** Card B body — paste an SG AI Store API key and add (Opt③: no SKU
 *  dropdown; model selection happens per-request at the gateway). */
function SgAiStoreKeyCard({ onAdded }: { onAdded: () => void }) {
  const t = useT();
  const toast = useToast();
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!apiKey.trim()) return;
    setSubmitting(true);
    try {
      const cfg = await api.addModelConfig({
        name: "SG AI Store",
        provider: "openai",
        endpoint: "https://sgaistore.com/v1",
        model_id: "",
        max_tokens: 128000,
        api_key: apiKey.trim(),
      });
      // Fire an initial balance fetch so the new card shows a real number.
      try {
        const snap = await api.aiStoreGetBalance(cfg.id);
        toast.success(
          t("models.sg_onboarding_added", {
            balance: snap.balance_cny.toFixed(2),
          }),
        );
      } catch {
        toast.success(t("models.sg_onboarding_added_no_balance"));
      }
      setApiKey("");
      onAdded();
    } catch (e) {
      toast.danger(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-card rounded-card shadow-card p-5 flex flex-col">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center flex-shrink-0">
          <Icon icon={Store} size="lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-h3 font-semibold text-fg-1">
            {t("models.entry_sg_title")}
          </h2>
          <p className="text-meta text-fg-2 mt-1 leading-relaxed">
            {t("models.entry_sg_desc")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("models.sg_onboarding_key_placeholder")}
          className="flex-1 px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 font-mono text-meta focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
        />
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !apiKey.trim()}
          className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px disabled:opacity-50 disabled:hover:translate-y-0 transition-[background,box-shadow,transform] duration-fast ease-khx"
        >
          {submitting && (
            <Icon icon={Loader2} size="sm" className="animate-spin" />
          )}
          <span>
            {submitting
              ? t("models.sg_onboarding_adding")
              : t("models.entry_sg_add_btn")}
          </span>
        </button>
      </div>
    </section>
  );
}

function ModelEditForm({
  model,
  onSave,
  onCancel,
}: {
  model: ModelConfig;
  onSave: (input: ModelConfigInput) => Promise<void>;
  onCancel: () => void;
}) {
  const initial: ModelConfigInput = {
    name: model.name,
    provider: model.provider,
    endpoint: model.endpoint,
    model_id: model.model_id,
    max_tokens: model.max_tokens,
    api_key: null,
  };
  return (
    <ModelForm
      initial={initial}
      presets={[]}
      isEdit
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

export default function Models() {
  const t = useT();
  const toast = useToast();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [presets, setPresets] = useState<ModelConfigInput[]>([]);
  const [stats, setStats] = useState<UsageStats7Days | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const refreshStats = useCallback(() => {
    api
      .getUsageStats7Days()
      .then(setStats)
      .catch((e) => console.warn("getUsageStats7Days failed", e));
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .getModelConfigs()
      .then(setModels)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    refreshStats();
  }, [refreshStats]);

  const onRebuild = async () => {
    try {
      const n = await api.rebuildUsageStats();
      toast.success(t("models.stat_rebuild_done", { count: n }));
      refreshStats();
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    refresh();
    api
      .getModelPresets()
      .then(setPresets)
      .catch((e) => console.warn("getModelPresets failed", e));
  }, [refresh]);

  const usageByModel: Map<string, ModelUsage> = new Map(
    (stats?.by_model ?? []).map((m) => [m.model_config_id, m]),
  );

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-h2 font-semibold text-fg-1">{t("models.title")}</h1>
        <p className="text-meta text-fg-2 mt-1">{t("models.subtitle")}</p>
      </header>

      <StatsCards models={models} stats={stats} onRebuild={onRebuild} />

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton variant="rect" height={120} />
          <Skeleton variant="rect" height={120} />
        </div>
      )}
      {error && !loading && (
        <div
          role="alert"
          className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption"
        >
          <Icon icon={AlertTriangle} size="sm" className="flex-shrink-0 mt-0.5" />
          <span>{t("models.error_label", { detail: error })}</span>
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-4">
          {/* Entry cards — hidden while the BYOK add-form is open (Opt③). */}
          {!showAddForm && (
            <ModelEntryCards
              onAddOwn={() => setShowAddForm(true)}
              onAdded={refresh}
            />
          )}

          {models.length === 0 && !showAddForm && (
            <Stage
              intensity="soft"
              className="rounded-card p-10 text-center"
            >
              <EmptyModelsArt
                width={160}
                height={120}
                aria-hidden="true"
                className="mx-auto text-indigo opacity-80"
              />
              <p className="text-caption text-fg-2 mt-4">
                {t("models.empty_state_hint")}
              </p>
            </Stage>
          )}

          {models.map((m) => (
            <ModelRow
              key={m.id}
              model={m}
              onChanged={refresh}
              usage={usageByModel.get(m.id)}
            />
          ))}

          {showAddForm && (
            <ModelForm
              initial={EMPTY_INPUT}
              presets={presets}
              isEdit={false}
              onSave={async (input) => {
                await api.addModelConfig(input);
                setShowAddForm(false);
                refresh();
              }}
              onCancel={() => setShowAddForm(false)}
            />
          )}
        </div>
      )}
    </main>
  );
}

