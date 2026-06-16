// V2.2.4 — onboarding Step 2 (configure an AI model). Three tabs:
//   A. Quick preset  — Claude / GPT / DeepSeek + API key + test connection
//   B. Local Ollama  — auto-detect localhost:11434, pick an installed model
//   C. AI Store      — popular packs preview, buy link, verify key + add
//
// All paths reuse existing backend commands (add_model_config,
// test_model_connection, detect_ollama, ai_store_verify_key). A model
// configured here is set as the default model. Nothing is mandatory —
// the step is fully skippable.
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
  Sparkles,
  Store,
  XCircle,
} from "lucide-react";
import {
  api,
  type ModelConfigInput,
  type OllamaDetect,
  type SgStoreBalanceSnapshot,
  type TestResult,
} from "../../lib/tauri";
import { Icon } from "../Icon";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import i18n from "../../i18n";
import { ProgressDots } from "./ProgressDots";
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, FIELD } from "./styles";

const BUY_URL = "https://sgaistore.com/buy?utm_source=sghub_onboarding";

type Tab = "preset" | "ollama" | "aistore";

interface PopularProduct {
  id: string;
  name: string;
  model_id: string;
  price_cny: number;
  billing_period: string;
}

export function ModelStep({
  onAdvance,
  onBack,
}: {
  /** Move to the Done step (used by both 完成 and 跳过此步). */
  onAdvance: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("preset");
  const [busy, setBusy] = useState(false);

  // ── Tab A: quick preset ──────────────────────────────────────────
  const [presets, setPresets] = useState<ModelConfigInput[]>([]);
  const [presetIdx, setPresetIdx] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  // The model config created on first "test"; reused on subsequent
  // tests/finish so we never leave duplicate rows behind.
  const draftIdRef = useRef<string | null>(null);

  // ── Tab B: ollama ────────────────────────────────────────────────
  const [ollama, setOllama] = useState<OllamaDetect | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [ollamaModel, setOllamaModel] = useState("");

  // ── Tab C: AI Store ──────────────────────────────────────────────
  const [products, setProducts] = useState<PopularProduct[]>([]);
  const [storeKey, setStoreKey] = useState("");
  const [storeProductId, setStoreProductId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [storeBalance, setStoreBalance] = useState<SgStoreBalanceSnapshot | null>(
    null,
  );
  const storeAddedRef = useRef<boolean>(false);

  // Load presets (filter to the three remote BYOK presets for Tab A).
  useEffect(() => {
    api
      .getModelPresets()
      .then((all) => {
        const remote = all.filter(
          (p) => p.provider !== "ollama" && !p.endpoint.includes("sgaistore.com"),
        );
        setPresets(remote);
      })
      .catch((e) => console.warn("getModelPresets failed", e));
  }, []);

  // Load popular products for the AI Store preview (mock-safe).
  useEffect(() => {
    let cancelled = false;
    import("../../lib/sgAiStoreApi").then(({ sgAiStoreApi, pickLocalized }) => {
      sgAiStoreApi
        .getProducts()
        .then((list) => {
          if (cancelled) return;
          const popular = list
            .filter((p) => p.popular)
            .slice(0, 3)
            .map((p) => ({
              id: p.id,
              name: pickLocalized(p.name, i18n.language),
              model_id: p.model_id,
              price_cny: p.price_cny,
              billing_period: p.billing_period,
            }));
          setProducts(popular.length > 0 ? popular : []);
          if (popular[0]) setStoreProductId(popular[0].model_id);
        })
        .catch((e) => console.warn("onboarding store preview failed", e));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-detect Ollama the first time the tab is opened.
  useEffect(() => {
    if (tab === "ollama" && ollama === null && !detecting) {
      void detectOllama();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function detectOllama() {
    setDetecting(true);
    try {
      const d = await api.detectOllama();
      setOllama(d);
      if (d.running && d.models.length > 0) setOllamaModel(d.models[0]);
    } catch (e) {
      console.warn("detectOllama failed", e);
      setOllama({ running: false, endpoint: "", models: [], message: String(e) });
    } finally {
      setDetecting(false);
    }
  }

  // Create-or-update the preset draft config (Tab A).
  async function ensurePresetDraft(): Promise<string> {
    const p = presets[presetIdx];
    const input: ModelConfigInput = {
      name: p.name,
      provider: p.provider,
      endpoint: p.endpoint,
      model_id: p.model_id,
      max_tokens: p.max_tokens,
      api_key: apiKey.trim(),
      input_price_per_1m_tokens: p.input_price_per_1m_tokens ?? 0,
      output_price_per_1m_tokens: p.output_price_per_1m_tokens ?? 0,
    };
    if (draftIdRef.current) {
      await api.updateModelConfig(draftIdRef.current, input);
      return draftIdRef.current;
    }
    const cfg = await api.addModelConfig(input);
    draftIdRef.current = cfg.id;
    return cfg.id;
  }

  async function testPreset() {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        latency_ms: 0,
        message: t("onboarding.model_need_key"),
        model_response: null,
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const id = await ensurePresetDraft();
      const r = await api.testModelConnection(id);
      setTestResult(r);
    } catch (e) {
      setTestResult({
        success: false,
        latency_ms: 0,
        message: String(e),
        model_response: null,
      });
    } finally {
      setTesting(false);
    }
  }

  async function verifyStoreKey() {
    if (!storeKey.trim()) return;
    setVerifying(true);
    setStoreBalance(null);
    try {
      const snap = await api.aiStoreVerifyKey(storeKey.trim());
      setStoreBalance(snap);
      // Auto-create the SG AI Store model config + make it default.
      const product = products.find((p) => p.model_id === storeProductId);
      const cfg = await api.addModelConfig({
        name: product
          ? `${product.name} (SG AI Store)`
          : "SG AI Store",
        provider: "openai",
        endpoint: "https://sgaistore.com/v1",
        model_id: storeProductId || product?.model_id || "",
        max_tokens: 128000,
        api_key: storeKey.trim(),
        input_price_per_1m_tokens: 0,
        output_price_per_1m_tokens: 0,
      });
      await api.setDefaultModel(cfg.id);
      storeAddedRef.current = true;
      toast.success(
        t("onboarding.store_verified", { balance: snap.balance_cny.toFixed(2) }),
      );
    } catch (e) {
      toast.danger(t("onboarding.store_verify_failed"), String(e));
    } finally {
      setVerifying(false);
    }
  }

  async function handleFinish() {
    setBusy(true);
    try {
      if (tab === "preset" && apiKey.trim() && presets[presetIdx]) {
        const id = await ensurePresetDraft();
        await api.setDefaultModel(id);
      } else if (tab === "ollama" && ollama?.running && ollamaModel) {
        const cfg = await api.addModelConfig({
          name: `Ollama · ${ollamaModel}`,
          provider: "ollama",
          endpoint: ollama.endpoint || "http://localhost:11434",
          model_id: ollamaModel,
          max_tokens: 8192,
          api_key: null,
          input_price_per_1m_tokens: 0,
          output_price_per_1m_tokens: 0,
        });
        await api.setDefaultModel(cfg.id);
      }
      // Tab C already created + defaulted on "验证并添加"; nothing to do.
      onAdvance();
    } catch (e) {
      toast.danger(t("onboarding.model_save_failed"), String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    // Clean up a preset draft we created during testing but never kept.
    if (draftIdRef.current && !storeAddedRef.current) {
      try {
        await api.deleteModelConfig(draftIdRef.current);
      } catch {
        /* best-effort */
      }
      draftIdRef.current = null;
    }
    onAdvance();
  }

  const TABS: { key: Tab; label: string; icon: typeof Sparkles }[] = [
    { key: "preset", label: t("onboarding.tab_preset"), icon: Sparkles },
    { key: "ollama", label: t("onboarding.tab_ollama"), icon: Server },
    { key: "aistore", label: t("onboarding.tab_aistore"), icon: Store },
  ];

  return (
    <div className="flex flex-col gap-5">
      <ProgressDots total={2} current={1} label={t("onboarding.step_of", { n: 2, total: 2 })} />

      <div>
        <h2 className="text-h3 font-semibold text-fg-1">
          {t("onboarding.model_title")}
        </h2>
        <p className="mt-1 text-meta text-fg-2 leading-relaxed">
          {t("onboarding.model_desc")}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 rounded-pill bg-navy-faint">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            aria-pressed={tab === tb.key}
            className={
              "flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-pill text-caption font-medium transition-colors duration-fast ease-khx " +
              (tab === tb.key
                ? "bg-card text-navy shadow-btn"
                : "text-fg-2 hover:text-fg-1")
            }
          >
            <Icon icon={tb.icon} size="sm" />
            <span>{tb.label}</span>
          </button>
        ))}
      </div>

      {/* Tab body — fixed min height so the footer doesn't jump */}
      <div className="min-h-[220px]">
        {tab === "preset" && (
          <div className="flex flex-col gap-3">
            <label className="text-meta font-medium text-fg-2">
              {t("onboarding.preset_model_label")}
            </label>
            <select
              value={presetIdx}
              onChange={(e) => {
                setPresetIdx(Number(e.target.value));
                setTestResult(null);
              }}
              className={FIELD}
            >
              {presets.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="text-meta font-medium text-fg-2 mt-1">
              {t("onboarding.preset_key_label")}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder={t("onboarding.preset_key_placeholder")}
              className={`${FIELD} font-mono`}
            />
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={testPreset}
                disabled={testing || !apiKey.trim()}
                className={BTN_SECONDARY}
              >
                {testing && (
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                )}
                <span>{t("onboarding.preset_test")}</span>
              </button>
              {testResult && (
                <span
                  className={
                    "inline-flex items-center gap-2 text-meta " +
                    (testResult.success ? "text-success-fg" : "text-danger-fg")
                  }
                >
                  <Icon
                    icon={testResult.success ? CheckCircle2 : XCircle}
                    size="sm"
                  />
                  <span>{testResult.message}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {tab === "ollama" && (
          <div className="flex flex-col gap-3">
            {detecting && (
              <p className="flex items-center gap-2 text-meta text-fg-2">
                <Icon icon={Loader2} size="sm" className="animate-spin" />
                <span>{t("onboarding.ollama_detecting")}</span>
              </p>
            )}
            {!detecting && ollama?.running && (
              <>
                <p className="inline-flex items-center gap-2 text-meta text-success-fg">
                  <Icon icon={CheckCircle2} size="sm" />
                  <span>
                    {t("onboarding.ollama_running", {
                      count: ollama.models.length,
                    })}
                  </span>
                </p>
                {ollama.models.length > 0 ? (
                  <>
                    <label className="text-meta font-medium text-fg-2">
                      {t("onboarding.ollama_pick_model")}
                    </label>
                    <select
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className={FIELD}
                    >
                      {ollama.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <p className="text-meta text-fg-3">
                    {t("onboarding.ollama_no_models")}
                  </p>
                )}
              </>
            )}
            {!detecting && ollama && !ollama.running && (
              <div className="rounded-card-sm border border-border-default bg-card p-4">
                <p className="text-caption font-medium text-fg-1">
                  {t("onboarding.ollama_not_running")}
                </p>
                <p className="mt-2 text-meta text-fg-2 leading-relaxed whitespace-pre-line">
                  {t("onboarding.ollama_help")}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={detectOllama}
              disabled={detecting}
              className={`${BTN_GHOST} self-start`}
            >
              <Icon icon={RefreshCw} size="sm" />
              <span>{t("onboarding.ollama_redetect")}</span>
            </button>
          </div>
        )}

        {tab === "aistore" && (
          <div className="flex flex-col gap-3">
            <p className="text-meta text-fg-2 leading-relaxed">
              {t("onboarding.store_desc")}
            </p>

            {products.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setStoreProductId(p.model_id)}
                    aria-pressed={storeProductId === p.model_id}
                    className={
                      "text-left rounded-card-sm border p-3 transition-colors duration-fast ease-khx " +
                      (storeProductId === p.model_id
                        ? "border-navy bg-navy-faint"
                        : "border-border-default bg-card hover:border-navy")
                    }
                  >
                    <p className="text-meta font-medium text-fg-1 truncate">
                      {p.name}
                    </p>
                    <p className="mt-1 text-micro text-fg-2">
                      {t("onboarding.store_price", {
                        price: p.price_cny,
                        period: t(
                          p.billing_period === "yearly"
                            ? "onboarding.store_yearly"
                            : "onboarding.store_monthly",
                        ),
                      })}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => api.openExternalUrl(BUY_URL).catch(() => {})}
              className={`${BTN_PRIMARY} self-start`}
            >
              <Icon icon={ExternalLink} size="sm" />
              <span>{t("onboarding.store_buy")}</span>
            </button>

            <ol className="text-micro text-fg-2 leading-relaxed list-decimal pl-5 space-y-0.5">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <li key={n}>{t(`onboarding.store_step_${n}`)}</li>
              ))}
            </ol>

            <div className="flex items-center gap-2 mt-1">
              <input
                type="password"
                value={storeKey}
                onChange={(e) => setStoreKey(e.target.value)}
                placeholder={t("onboarding.store_key_placeholder")}
                className={`${FIELD} font-mono`}
              />
              <button
                type="button"
                onClick={verifyStoreKey}
                disabled={verifying || !storeKey.trim()}
                className={`${BTN_SECONDARY} flex-shrink-0`}
              >
                {verifying && (
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                )}
                <span>{t("onboarding.store_verify")}</span>
              </button>
            </div>
            {storeBalance && (
              <p className="inline-flex items-center gap-2 text-meta text-success-fg">
                <Icon icon={CheckCircle2} size="sm" />
                <span>
                  {t("onboarding.store_balance", {
                    balance: storeBalance.balance_cny.toFixed(2),
                  })}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onBack} className={BTN_SECONDARY}>
          {t("onboarding.back")}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSkip} className={BTN_GHOST}>
            {t("onboarding.skip_step")}
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={busy}
            className={BTN_PRIMARY}
          >
            {busy && <Icon icon={Loader2} size="sm" className="animate-spin" />}
            <span>{t("onboarding.finish")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
