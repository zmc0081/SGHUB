// i18n: 本组件文案已国际化 (V2.1.0)
/**
 * SkillGenerator — Claude.ai-style conversational Skill builder.
 *
 * Left  (50%): chat box (instruction → confirmation messages).
 * Right (50%): live preview tabs (Config / YAML / Test).
 *
 * State lives in `useSkillGenStore`; localStorage drafting kicks in
 * automatically so accidental page navigation doesn't lose work.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronDown,
  Loader2,
  Save,
  Settings,
  Sparkles,
} from "lucide-react";
import EmptySkillGenArt from "../assets/illustrations/empty-skillgen.svg?react";
import {
  api,
  type ModelConfig,
  type Paper,
  type SkillSpec,
  type TokenPayload,
} from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";
import { confirmAsync } from "../components/DialogProvider";
import { Icon } from "../components/Icon";
import { Stage } from "../components/Stage";
import {
  useSkillGenStore,
  type GenMessage,
} from "../stores/skillGeneratorStore";

type PreviewTab = "config" | "yaml" | "test";

export default function SkillGenerator() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [tab, setTab] = useState<PreviewTab>("config");
  const [input, setInput] = useState("");
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    currentYaml,
    currentSpec,
    selectedModel,
    isStreaming,
    lastError,
    setSelectedModel,
    sendUserMessage,
    reset,
    hydrateFromDraft,
  } = useSkillGenStore();

  useEffect(() => {
    void api.getModelConfigs().then((ms) => {
      setModels(ms);
      if (!selectedModel) {
        const d = ms.find((m) => m.is_default) ?? ms[0];
        setSelectedModel(d?.id ?? null);
      }
    });
    hydrateFromDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await sendUserMessage(text);
    setTab("config");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || composing || e.shiftKey) return;
    e.preventDefault();
    void send();
  };

  const canSave = !!currentSpec && !isStreaming;
  const save = async () => {
    if (!currentYaml || !currentSpec) return;
    setSaving(true);
    try {
      await api.saveSkill(currentYaml, null);
      toast.success(t("skill_gen.saved_toast"));
      setTimeout(() => navigate({ to: "/skills" }), 350);
    } catch (e) {
      toast.danger(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await confirmAsync({
      title: t("skill_gen.reset_confirm_title"),
      description: t("skill_gen.reset_confirm"),
      variant: "danger",
      confirmLabel: t("common.discard"),
      cancelLabel: t("common.cancel"),
    });
    if (ok) reset();
  };

  const switchToManual = () => {
    if (currentYaml) {
      try {
        sessionStorage.setItem("skill-editor-prefill-yaml", currentYaml);
      } catch {
        /* ignore */
      }
    }
    navigate({ to: "/skills/new" });
  };

  const noModels = models.length === 0;

  return (
    <div className="flex h-full bg-page text-fg-1">
      <section className="w-1/2 flex flex-col border-r border-border-default bg-card">
        <header className="p-5 border-b border-border-default flex items-center justify-between">
          <div>
            <h1 className="text-h2 font-semibold text-fg-1 inline-flex items-center gap-2">
              <Icon icon={Sparkles} size="base" className="text-indigo" />
              {t("skill_gen.title")}
            </h1>
            <p className="text-meta text-fg-2 mt-1">{t("skill_gen.subtitle")}</p>
          </div>
          <ModelPicker
            models={models}
            value={selectedModel}
            onChange={setSelectedModel}
          />
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3">
          {noModels && (
            <div
              role="alert"
              className="rounded-card-sm bg-warning-bg border border-warning-border text-warning-fg-strong px-4 py-3 flex items-start gap-2 text-caption"
            >
              <Icon icon={AlertTriangle} size="sm" className="flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                {t("skill_gen.no_model_warn")}
                <button
                  type="button"
                  onClick={() => navigate({ to: "/models" })}
                  className="ml-2 text-indigo hover:text-indigo-hover transition-colors duration-fast ease-khx"
                >
                  {t("skill_gen.no_model_link")}
                </button>
              </div>
            </div>
          )}
          {messages.length === 0 && !noModels && <TipsCard />}
          {messages.map((m) => (
            <ChatBubble key={m.id} m={m} />
          ))}
          {lastError && (
            <div
              role="alert"
              className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 text-caption"
            >
              {t("skill_gen.error_prefix", { detail: lastError })}
            </div>
          )}
        </div>

        <div className="border-t border-border-default p-4 bg-card">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            placeholder={
              messages.length === 0
                ? t("skill_gen.input_first_time")
                : t("skill_gen.input_placeholder")
            }
            rows={3}
            disabled={noModels}
            className="w-full px-textarea-x py-textarea-y rounded-card-sm border border-border-default bg-card text-caption text-fg-1 placeholder:text-fg-3 resize-none focus:outline-none focus:border-border-focus focus:shadow-focus disabled:opacity-50 transition-colors duration-fast ease-khx"
            style={{ fontSize: "13px" }}
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-meta text-fg-3">
              {isStreaming
                ? t("skill_gen.generating")
                : t("skill_gen.send_hint")}
            </div>
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || isStreaming || noModels}
              className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-btn transition-[background,box-shadow,transform] duration-fast ease-khx"
            >
              {isStreaming ? (
                <Icon icon={Loader2} size="sm" className="animate-spin" />
              ) : (
                <Icon icon={ArrowUp} size="sm" />
              )}
              <span>{t("skill_gen.send")}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="w-1/2 flex flex-col bg-page">
        <Stage intensity="full" className="border-b border-border-default">
          <div className="px-5 pt-4 flex gap-1" role="tablist">
            {(["config", "yaml", "test"] as PreviewTab[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`px-4 py-2 text-caption font-medium border-b-2 transition-colors duration-fast ease-khx ${
                  tab === k
                    ? "border-indigo text-indigo"
                    : "border-transparent text-fg-2 hover:text-fg-1"
                }`}
              >
                {t(`skill_gen.preview_tab_${k}`)}
              </button>
            ))}
          </div>
        </Stage>

        <div className="flex-1 overflow-y-auto p-5">
          {!currentSpec ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <EmptySkillGenArt
                  width={160}
                  height={120}
                  aria-hidden="true"
                  className="mx-auto text-indigo opacity-80"
                />
                <p className="text-caption text-fg-2 mt-4 italic">
                  {t("skill_gen.preview_empty")}
                </p>
              </div>
            </div>
          ) : tab === "config" ? (
            <ConfigPreview spec={currentSpec} />
          ) : tab === "yaml" ? (
            <pre className="text-meta bg-card border border-border-default rounded-card-sm p-4 overflow-auto leading-relaxed font-mono whitespace-pre">
              {currentYaml}
            </pre>
          ) : (
            <TestRunPanel
              yaml={currentYaml}
              models={models}
              defaultModel={selectedModel}
            />
          )}
        </div>

        <div className="border-t border-border-default p-4 bg-card flex flex-wrap items-center gap-3 justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="mr-auto inline-flex items-center px-3 py-1.5 text-meta text-fg-3 hover:text-danger-fg transition-colors duration-fast ease-khx"
          >
            {t("skill_gen.reset")}
          </button>
          <button
            type="button"
            onClick={switchToManual}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-caption text-fg-2 hover:text-indigo transition-colors duration-fast ease-khx"
          >
            <Icon icon={Settings} size="xs" />
            <span>{t("skill_gen.switch_to_editor")}</span>
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave || saving}
            className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-btn transition-[background,box-shadow,transform] duration-fast ease-khx"
          >
            {saving ? (
              <Icon icon={Loader2} size="sm" className="animate-spin" />
            ) : (
              <Icon icon={Save} size="sm" />
            )}
            <span>
              {saving ? t("skill_gen.save_pending") : t("skill_gen.save_btn")}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelConfig[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useT();
  return (
    <label className="text-meta text-fg-2 inline-flex items-center gap-2">
      {t("skill_gen.model_label")}
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="appearance-none pr-7 pl-3 py-1.5 text-meta rounded-pill border border-border-default bg-card text-fg-1 max-w-[200px] focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.is_default ? t("skill_gen.model_default_suffix") : ""}
            </option>
          ))}
        </select>
        <Icon
          icon={ChevronDown}
          size={12}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
        />
      </div>
    </label>
  );
}

function TipsCard() {
  const t = useT();
  return (
    <div className="rounded-card-sm bg-indigo-soft border border-indigo-muted p-4 flex items-start gap-3">
      <span className="shrink-0 w-11 h-11 rounded-icon bg-card text-indigo flex items-center justify-center">
        <Icon icon={Sparkles} size="base" />
      </span>
      <div className="flex-1 text-caption text-fg-2">
        <div className="font-semibold text-fg-1 mb-1.5">
          {t("skill_gen.tip_header")}
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>{t("skill_gen.tip_1")}</li>
          <li>{t("skill_gen.tip_2")}</li>
          <li>{t("skill_gen.tip_3")}</li>
        </ul>
      </div>
    </div>
  );
}

function ChatBubble({ m }: { m: GenMessage }) {
  const t = useT();
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] text-caption bg-navy text-fg-inverse rounded-card-sm px-4 py-2.5 whitespace-pre-wrap">
          {m.text}
        </div>
      </div>
    );
  }
  const isStreaming = m.streaming;
  const isFirst = m.text === "(first-skill-ready)";
  const isRefine = m.text === "(refined)";
  const isError = m.text === "(error)";
  return (
    <div className="flex">
      <div className="max-w-[85%] text-caption bg-card border border-border-default shadow-card-sm rounded-card-sm px-4 py-2.5 space-y-1">
        {isStreaming ? (
          <div className="text-fg-2 italic inline-flex items-center gap-1">
            {t("skill_gen.generating")}
            <span
              aria-hidden="true"
              className="inline-block w-1 h-4 bg-indigo ml-1 animate-pulse align-middle"
            />
          </div>
        ) : isFirst ? (
          <div className="text-success-fg inline-flex items-center gap-1.5">
            <Icon icon={Check} size="xs" />
            <span>{t("skill_gen.first_skill_ready")}</span>
          </div>
        ) : isRefine ? (
          <div className="text-indigo">{t("skill_gen.refined")}</div>
        ) : isError ? (
          <div className="text-danger-fg inline-flex items-center gap-1.5">
            <Icon icon={AlertTriangle} size="xs" />
            <span>{t("skill_gen.error_invalid_yaml")}</span>
          </div>
        ) : (
          <div>{m.text}</div>
        )}
        {m.retried && !isStreaming && (
          <div className="text-meta text-warning-fg-strong">
            {t("skill_gen.auto_fixed")}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigPreview({ spec }: { spec: SkillSpec }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4 text-caption">
      <div className="bg-card rounded-card-sm border border-border-default p-4 space-y-2">
        <div className="text-meta text-fg-3 uppercase tracking-wide-brand">
          {t("skill_gen.preview_name")}
        </div>
        <div className="flex items-center gap-2">
          {spec.icon && <span className="text-h3 leading-none">{spec.icon}</span>}
          <div>
            <div className="text-h3 font-semibold text-fg-1">
              {spec.display_name}
            </div>
            <code className="text-meta font-mono text-fg-3">{spec.name}</code>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-card-sm border border-border-default p-4">
        <div className="text-meta text-fg-3 uppercase tracking-wide-brand mb-2">
          {t("skill_gen.preview_desc")}
        </div>
        <div className="text-caption text-fg-1 leading-relaxed">
          {spec.description}
        </div>
      </div>

      {spec.recommended_models.length > 0 && (
        <div className="bg-card rounded-card-sm border border-border-default p-4">
          <div className="text-meta text-fg-3 uppercase tracking-wide-brand mb-2">
            {t("skill_gen.preview_models")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {spec.recommended_models.map((m) => (
              <span
                key={m}
                className="text-micro px-2 py-0.5 rounded-pill bg-indigo-soft text-indigo"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-card-sm border border-border-default p-4">
        <div className="text-meta text-fg-3 uppercase tracking-wide-brand mb-2">
          {t("skill_gen.preview_dimensions")} ({spec.output_dimensions.length})
        </div>
        <div className="flex flex-col gap-2">
          {spec.output_dimensions.map((d) => (
            <div key={d.key} className="text-caption flex items-center gap-2">
              <span className="font-medium text-fg-1">{d.title}</span>
              <code className="text-meta font-mono text-fg-3">{d.key}</code>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-card-sm border border-border-default p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left text-meta text-fg-3 uppercase tracking-wide-brand flex items-center justify-between"
        >
          <span>{t("skill_gen.preview_prompt")}</span>
          <span className="inline-flex items-center gap-1 text-indigo">
            <Icon
              icon={ChevronDown}
              size={12}
              className={`transition-transform duration-fast ease-khx ${open ? "rotate-180" : ""}`}
            />
            <span>
              {open
                ? t("skill_gen.preview_collapse_prompt")
                : t("skill_gen.preview_expand_prompt")}
            </span>
          </span>
        </button>
        {open && (
          <pre className="mt-3 text-meta bg-soft p-3 rounded-card-sm font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
            {spec.prompt_template}
          </pre>
        )}
      </div>
    </div>
  );
}

function TestRunPanel({
  yaml,
  models,
  defaultModel,
}: {
  yaml: string;
  models: ModelConfig[];
  defaultModel: string | null;
}) {
  const t = useT();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [paperId, setPaperId] = useState("");
  const [modelId, setModelId] = useState<string>(defaultModel ?? "");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");

  useEffect(() => {
    void api.getRecentPapers(20).then(setPapers);
  }, []);

  useEffect(() => {
    if (!running) return;
    let un: UnlistenFn | undefined;
    void listen<TokenPayload>("skill_test:token", (e) => {
      if (e.payload.done) return;
      setOutput((o) => o + e.payload.text);
    }).then((u) => {
      un = u;
    });
    return () => un?.();
  }, [running]);

  const run = async () => {
    if (!yaml || !paperId || !modelId) return;
    setRunning(true);
    setOutput("");
    try {
      const r = await api.testSkillWithPaper(yaml, paperId, modelId);
      if (!r.success && r.message) setOutput((o) => o + `\n${r.message}`);
    } catch (e) {
      setOutput((o) => o + `\n[ERROR] ${String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const canRun = useMemo(
    () => !!yaml && !!paperId && !!modelId && !running,
    [yaml, paperId, modelId, running],
  );

  return (
    <div className="text-caption space-y-4">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <select
            value={paperId}
            onChange={(e) => setPaperId(e.target.value)}
            className="w-full appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          >
            <option value="">{t("skill_gen.test_pick_paper")}</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title.length > 70 ? `${p.title.slice(0, 70)}…` : p.title}
              </option>
            ))}
          </select>
          <Icon
            icon={ChevronDown}
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
          />
        </div>
        <div className="relative">
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 max-w-[200px] focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Icon
            icon={ChevronDown}
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={!canRun}
          className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover disabled:opacity-40 transition-colors duration-fast ease-khx"
        >
          {running && <Icon icon={Loader2} size="sm" className="animate-spin" />}
          <span>
            {running
              ? t("skill_gen.test_running")
              : t("skill_gen.test_run_btn")}
          </span>
        </button>
      </div>
      <div className="bg-card border border-border-default rounded-card-sm p-4 min-h-[200px]">
        {output ? (
          <pre className="text-meta whitespace-pre-wrap leading-relaxed font-mono text-fg-1">
            {output}
            {running && (
              <span className="text-indigo animate-pulse">
                {" "}
                {t("skill_gen.test_streaming")}
              </span>
            )}
          </pre>
        ) : (
          <div className="text-meta text-fg-3 italic">
            {t("skill_gen.test_result_placeholder")}
          </div>
        )}
      </div>
    </div>
  );
}
