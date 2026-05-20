// i18n: 本组件文案已国际化 (V2.1.0)
import { useCallback, useEffect, useState, ComponentType } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Bot,
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
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
  input_price_per_1m_tokens: 0,
  output_price_per_1m_tokens: 0,
};

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
    {
      label: t("models.stat_cost_7d"),
      value: `$${(stats?.total_cost_est ?? 0).toFixed(2)}`,
      hint: t("models.stat_hint_cost"),
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
      <div className="grid grid-cols-4 gap-4">
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

function UsageBarChart({ stats }: { stats: UsageStats7Days }) {
  const t = useT();
  const data = stats.daily_breakdown.map((d) => ({
    label: d.date.slice(5).replace("-", "/"),
    full: d.date,
    in: d.tokens_in,
    out: d.tokens_out,
    total: d.tokens_in + d.tokens_out,
    calls: d.call_count,
    cost: d.cost_est,
  }));
  return (
    <div className="bg-card rounded-card shadow-card p-5 mt-4">
      <div className="text-meta text-fg-2 mb-2">
        {t("models.stat_chart_title")}
      </div>
      <div style={{ width: "100%", height: 140 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 6, right: 12, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="label"
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
              cursor={{ fill: "var(--navy-faint)" }}
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
                  payload as Array<{ payload: (typeof data)[number] }>
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
                    <div className="text-fg-2">
                      {t("models.stat_chart_tooltip_cost", {
                        cost: p.cost.toFixed(4),
                      })}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="total" fill="var(--indigo)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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
            <span className="rounded-pill px-2 py-0.5 text-micro font-medium uppercase tracking-wide-brand bg-badge-default-bg text-badge-default-fg">
              {PROVIDER_LABEL_KEY[model.provider]
                ? t(PROVIDER_LABEL_KEY[model.provider])
                : model.provider}
            </span>
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
                cost: usage.cost_est.toFixed(2),
              })}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          label={`${t("models.form_input_price")} (${t("models.form_price_unit")})`}
        >
          <input
            type="number"
            step={0.01}
            min={0}
            value={form.input_price_per_1m_tokens ?? 0}
            onChange={(e) =>
              update("input_price_per_1m_tokens", Number(e.target.value) || 0)
            }
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
            title={t("models.form_price_hint")}
          />
        </Field>
        <Field
          label={`${t("models.form_output_price")} (${t("models.form_price_unit")})`}
        >
          <input
            type="number"
            step={0.01}
            min={0}
            value={form.output_price_per_1m_tokens ?? 0}
            onChange={(e) =>
              update("output_price_per_1m_tokens", Number(e.target.value) || 0)
            }
            className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
            title={t("models.form_price_hint")}
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
    input_price_per_1m_tokens: model.input_price_per_1m_tokens,
    output_price_per_1m_tokens: model.output_price_per_1m_tokens,
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

          {showAddForm ? (
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
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="self-start inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-dashed border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo hover:bg-indigo-soft transition-colors duration-fast ease-khx"
            >
              <Icon icon={Plus} size="sm" />
              <span>{t("models.add_model_btn")}</span>
            </button>
          )}
        </div>
      )}
    </main>
  );
}

