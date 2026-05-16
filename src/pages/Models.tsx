// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useState } from "react";
import {
  api,
  type ModelConfig,
  type ModelConfigInput,
  type TestResult,
} from "../lib/tauri";
import { useT } from "../hooks/useT";

// Provider names are resolved at render time via models.provider_label_*
// keys. Static maps keep code paths simple where t() isn't reachable.
const PROVIDER_LABEL_KEY: Record<string, string> = {
  anthropic: "models.provider_label_anthropic",
  openai: "models.provider_label_openai",
  ollama: "models.provider_label_ollama",
  custom: "models.provider_label_custom",
};

const PROVIDER_ICON: Record<string, string> = {
  anthropic: "🅰️",
  openai: "🟢",
  ollama: "🦙",
  custom: "🔧",
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

// ============================================================
// Stats cards
// ============================================================

function StatsCards({ models }: { models: ModelConfig[] }) {
  const t = useT();
  const cards = [
    {
      label: t("models.stat_configured_models"),
      value: models.length,
      hint: t("models.stat_configured_models_hint"),
    },
    {
      label: t("models.stat_monthly_calls"),
      value: 0,
      hint: t("models.stat_monthly_calls_hint"),
    },
    {
      label: t("models.stat_tokens"),
      value: "0",
      hint: t("models.stat_tokens_hint"),
    },
    {
      label: t("models.stat_cost"),
      value: "$0.00",
      hint: t("models.stat_cost_hint"),
    },
  ];
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white border border-black/10 rounded p-4"
        >
          <div className="text-xs text-app-fg/50">{c.label}</div>
          <div className="text-2xl font-semibold text-primary mt-1">
            {c.value}
          </div>
          <div className="text-[10px] text-app-fg/40 mt-1">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Single model row
// ============================================================

function ModelRow({
  model,
  onChanged,
}: {
  model: ModelConfig;
  onChanged: () => void;
}) {
  const t = useT();
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
    api.setDefaultModel(model.id).then(onChanged).catch(alert);
  };

  const remove = () => {
    if (!confirm(t("models.confirm_delete", { name: model.name }))) return;
    api.deleteModelConfig(model.id).then(onChanged).catch(alert);
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
    <div className="bg-white border border-black/10 rounded p-4">
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0 leading-none mt-0.5">
          {PROVIDER_ICON[model.provider] ?? "🤖"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-primary">{model.name}</div>
            {model.is_default && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold">
                {t("models.default")}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {PROVIDER_LABEL_KEY[model.provider]
                ? t(PROVIDER_LABEL_KEY[model.provider])
                : model.provider}
            </span>
          </div>
          <div className="text-xs text-app-fg/60 mt-0.5 font-mono truncate">
            {model.endpoint}
            <span className="mx-1.5 text-app-fg/30">·</span>
            {model.model_id}
            <span className="mx-1.5 text-app-fg/30">·</span>
            {model.max_tokens.toLocaleString()} tokens
          </div>
          {model.keychain_ref ? (
            <div className="text-[10px] text-green-700 mt-0.5">
              {t("models.key_stored")}
            </div>
          ) : model.provider === "ollama" ? (
            <div className="text-[10px] text-app-fg/50 mt-0.5">
              {t("models.no_key_needed_local")}
            </div>
          ) : (
            <div className="text-[10px] text-amber-600 mt-0.5">
              {t("models.key_missing_warn")}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex gap-1.5">
            <button
              onClick={test}
              disabled={testing}
              className="px-2.5 py-1 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
            >
              {testing ? t("models.testing") : t("models.test_connection")}
            </button>
            {!model.is_default && (
              <button
                onClick={setAsDefault}
                className="px-2.5 py-1 text-xs rounded border border-black/10 text-app-fg hover:border-accent hover:text-accent"
              >
                {t("models.set_default")}
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="px-2.5 py-1 text-xs rounded border border-black/10 text-app-fg hover:border-primary"
            >
              {t("models.edit_model")}
            </button>
            <button
              onClick={remove}
              className="px-2.5 py-1 text-xs rounded border border-black/10 text-red-600 hover:border-red-600 hover:bg-red-50"
            >
              {t("models.delete_model")}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div
          className={`mt-3 px-3 py-2 rounded text-xs ${
            result.success
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="font-medium">
            {result.success ? "✅" : "❌"} {result.message}
          </div>
          {result.model_response && (
            <div className="mt-1 text-app-fg/70 font-mono text-[11px]">
              {t("models.test_response_prefix", {
                response: result.model_response,
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Add / edit form (shared)
// ============================================================

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
    <div className="bg-white border border-primary/30 rounded p-5">
      <div className="font-semibold text-primary mb-4">
        {isEdit ? t("models.form_edit_title") : t("models.form_create_title")}
      </div>

      {!isEdit && presets.length > 0 && (
        <div className="mb-4 pb-4 border-b border-black/5">
          <label className="text-xs text-app-fg/60">
            {t("models.form_preset_label")}
          </label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {presets.map((p, i) => (
              <button
                key={p.name}
                onClick={() => applyPreset(i)}
                className="text-xs px-2.5 py-1 rounded border border-black/10 hover:border-primary hover:bg-primary/5"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("models.form_name_label")}>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Claude Opus 4.7"
            className="w-full px-2.5 py-1.5 border border-black/10 rounded text-sm focus:outline-none focus:border-primary"
          />
        </Field>
        <Field label="Provider">
          <select
            value={form.provider}
            onChange={(e) => update("provider", e.target.value)}
            className="w-full px-2.5 py-1.5 border border-black/10 rounded text-sm focus:outline-none focus:border-primary bg-white"
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
            className="w-full px-2.5 py-1.5 border border-black/10 rounded text-sm font-mono focus:outline-none focus:border-primary"
          />
        </Field>
        <Field label="Model ID">
          <input
            value={form.model_id}
            onChange={(e) => update("model_id", e.target.value)}
            placeholder="claude-opus-4-7"
            className="w-full px-2.5 py-1.5 border border-black/10 rounded text-sm font-mono focus:outline-none focus:border-primary"
          />
        </Field>
        <Field label="Max Tokens">
          <input
            type="number"
            value={form.max_tokens}
            onChange={(e) =>
              update("max_tokens", Number(e.target.value) || 0)
            }
            className="w-full px-2.5 py-1.5 border border-black/10 rounded text-sm focus:outline-none focus:border-primary"
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
            className="w-full px-2.5 py-1.5 border border-black/10 rounded text-sm font-mono focus:outline-none focus:border-primary disabled:bg-black/5 disabled:cursor-not-allowed"
          />
          <div className="text-[10px] text-app-fg/50 mt-1">
            {t("models.key_storage_note")}
          </div>
        </Field>
      </div>

      {err && (
        <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {t("models.error_label", { detail: err })}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded border border-black/10 text-app-fg/70 hover:bg-black/5"
        >
          {t("models.cancel")}
        </button>
        <button
          onClick={submit}
          disabled={saving || !form.name || !form.endpoint || !form.model_id}
          className="px-3 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
        >
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
      <div className="text-xs text-app-fg/60 mb-1">{label}</div>
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
    api_key: null, // null = leave existing alone
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

// ============================================================
// Main page
// ============================================================

export default function Models() {
  const t = useT();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [presets, setPresets] = useState<ModelConfigInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const refresh = () => {
    setLoading(true);
    api
      .getModelConfigs()
      .then(setModels)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    api
      .getModelPresets()
      .then(setPresets)
      .catch((e) => console.warn("getModelPresets failed", e));
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-primary mb-1">
        {t("models.title")}
      </h1>
      <p className="text-sm text-app-fg/60 mb-6">{t("models.subtitle")}</p>

      <StatsCards models={models} />

      {loading && (
        <div className="text-sm text-app-fg/60">{t("models.loading")}</div>
      )}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {t("models.error_label", { detail: error })}
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-3">
          {models.length === 0 && !showAddForm && (
            <div className="bg-white border border-dashed border-black/15 rounded p-8 text-center text-sm text-app-fg/60">
              {t("models.empty_state_hint")}
            </div>
          )}

          {models.map((m) => (
            <ModelRow key={m.id} model={m} onChanged={refresh} />
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
              onClick={() => setShowAddForm(true)}
              className="self-start px-4 py-2 text-sm rounded border border-dashed border-primary/40 text-primary hover:bg-primary/5"
            >
              {t("models.add_model_btn")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
