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
  api,
  type ModelConfig,
  type Paper,
  type SkillSpec,
  type TokenPayload,
} from "../lib/tauri";
import { useT } from "../hooks/useT";
import {
  useSkillGenStore,
  type GenMessage,
} from "../stores/skillGeneratorStore";

type PreviewTab = "config" | "yaml" | "test";

export default function SkillGenerator() {
  const t = useT();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [tab, setTab] = useState<PreviewTab>("config");
  const [input, setInput] = useState("");
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
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

  // Load models + draft once.
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

  // Auto-scroll the chat to bottom on new messages.
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

  // ============================================================
  // Save → write user skill + go back to Skills page
  // ============================================================
  const canSave = !!currentSpec && !isStreaming;
  const save = async () => {
    if (!currentYaml || !currentSpec) return;
    setSaving(true);
    try {
      await api.saveSkill(currentYaml, null);
      setSavedToast("✓");
      setTimeout(() => navigate({ to: "/skills" }), 350);
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  };

  const switchToManual = () => {
    // The handcrafted editor lives at /skills/new. We pass the current
    // YAML via sessionStorage so the editor can pick it up on mount.
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
    <div className="flex h-full">
      {/* ============================================================
          LEFT — chat
          ============================================================ */}
      <section className="w-1/2 flex flex-col border-r border-black/10 bg-white/40">
        <header className="p-4 border-b border-black/10 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-primary">
              {t("skill_gen.title")}
            </h1>
            <p className="text-xs text-app-fg/60 mt-0.5">
              {t("skill_gen.subtitle")}
            </p>
          </div>
          <ModelPicker
            models={models}
            value={selectedModel}
            onChange={setSelectedModel}
          />
        </header>

        {/* Chat scroll area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {noModels && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              {t("skill_gen.no_model_warn")}
              <button
                onClick={() => navigate({ to: "/models" })}
                className="ml-2 text-primary hover:underline"
              >
                {t("skill_gen.no_model_link")}
              </button>
            </div>
          )}
          {messages.length === 0 && !noModels && <TipsCard />}
          {messages.map((m) => (
            <ChatBubble key={m.id} m={m} />
          ))}
          {lastError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {t("skill_gen.error_prefix", { detail: lastError })}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-black/10 p-3 bg-white/60">
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
            className="w-full px-3 py-2 text-sm bg-white border border-black/10 rounded resize-none focus:outline-none focus:border-primary disabled:opacity-50"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="text-[11px] text-app-fg/40">
              {isStreaming ? t("skill_gen.generating") : "Enter ↵ / Shift+Enter"}
            </div>
            <button
              onClick={send}
              disabled={!input.trim() || isStreaming || noModels}
              className="px-4 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
            >
              {t("skill_gen.send")}
            </button>
          </div>
        </div>
      </section>

      {/* ============================================================
          RIGHT — preview
          ============================================================ */}
      <section className="w-1/2 flex flex-col bg-app-bg">
        <div className="px-4 pt-3 border-b border-black/10 bg-white/30">
          <div className="flex gap-1">
            {(["config", "yaml", "test"] as PreviewTab[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 text-xs rounded-t border-b-2 ${
                  tab === k
                    ? "border-primary text-primary font-medium"
                    : "border-transparent text-app-fg/60 hover:text-app-fg"
                }`}
              >
                {t(`skill_gen.preview_tab_${k}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!currentSpec ? (
            <div className="h-full flex items-center justify-center text-sm text-app-fg/40 italic">
              {t("skill_gen.preview_empty")}
            </div>
          ) : tab === "config" ? (
            <ConfigPreview spec={currentSpec} />
          ) : tab === "yaml" ? (
            <pre className="text-[12px] bg-white border border-black/10 rounded p-3 overflow-auto leading-relaxed font-mono whitespace-pre">
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

        <div className="border-t border-black/10 p-3 bg-white/60 flex flex-wrap items-center gap-2 justify-end">
          {savedToast && (
            <span className="text-xs text-emerald-700 mr-auto">
              {savedToast}
            </span>
          )}
          <button
            onClick={() => {
              if (
                confirm(
                  // Use the existing reset prompt — destructive but quick.
                  t("skill_gen.reset"),
                )
              )
                reset();
            }}
            className="px-2 py-1 text-[11px] text-app-fg/60 hover:text-red-600"
          >
            {t("skill_gen.reset")}
          </button>
          <button
            onClick={switchToManual}
            className="px-3 py-1 text-xs text-app-fg/70 hover:text-primary"
          >
            {t("skill_gen.switch_to_editor")}
          </button>
          <button
            onClick={save}
            disabled={!canSave || saving}
            className="px-4 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
          >
            {saving ? t("skill_gen.save_pending") : t("skill_gen.save_btn")}
          </button>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

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
    <label className="text-[11px] text-app-fg/60 inline-flex items-center gap-1">
      {t("skill_gen.model_label")}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-xs border border-black/10 rounded px-1.5 py-0.5 bg-white max-w-[180px]"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.is_default ? " ★" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function TipsCard() {
  const t = useT();
  return (
    <div className="text-xs text-app-fg/70 bg-primary/5 border border-primary/20 rounded p-3">
      <div className="font-semibold mb-1">{t("skill_gen.tip_header")}</div>
      <ul className="list-disc pl-5 space-y-0.5">
        <li>{t("skill_gen.tip_1")}</li>
        <li>{t("skill_gen.tip_2")}</li>
        <li>{t("skill_gen.tip_3")}</li>
      </ul>
    </div>
  );
}

function ChatBubble({ m }: { m: GenMessage }) {
  const t = useT();
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] text-sm bg-primary text-white rounded px-3 py-2 whitespace-pre-wrap">
          {m.text}
        </div>
      </div>
    );
  }
  // Assistant — we don't dump YAML into the bubble; instead show a
  // short confirmation card pointing at the right-hand preview.
  const isStreaming = m.streaming;
  const isFirst = m.text === "(first-skill-ready)";
  const isRefine = m.text === "(refined)";
  const isError = m.text === "(error)";
  return (
    <div className="flex">
      <div className="max-w-[85%] text-sm bg-white border border-black/10 rounded px-3 py-2 space-y-1">
        {isStreaming ? (
          <div className="text-app-fg/60 italic">
            {t("skill_gen.generating")}
            <span className="inline-block w-1.5 h-3 bg-primary/60 ml-1 animate-pulse align-middle" />
          </div>
        ) : isFirst ? (
          <div className="text-emerald-700">
            {t("skill_gen.first_skill_ready")}
          </div>
        ) : isRefine ? (
          <div className="text-primary">{t("skill_gen.refined")}</div>
        ) : isError ? (
          <div className="text-red-600">
            {t("skill_gen.error_invalid_yaml")}
          </div>
        ) : (
          <div>{m.text}</div>
        )}
        {m.retried && !isStreaming && (
          <div className="text-[11px] text-amber-700">
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
    <div className="space-y-3 text-sm">
      <div className="bg-white border border-black/10 rounded p-3 space-y-2">
        <div className="text-[11px] text-app-fg/60 uppercase tracking-wider">
          {t("skill_gen.preview_name")}
        </div>
        <div className="flex items-center gap-2">
          {spec.icon && <span className="text-xl">{spec.icon}</span>}
          <div>
            <div className="font-semibold text-primary">{spec.display_name}</div>
            <code className="text-[10px] text-app-fg/40">{spec.name}</code>
          </div>
        </div>
      </div>

      <div className="bg-white border border-black/10 rounded p-3">
        <div className="text-[11px] text-app-fg/60 uppercase tracking-wider mb-1">
          {t("skill_gen.preview_desc")}
        </div>
        <div className="text-sm text-app-fg/85">{spec.description}</div>
      </div>

      {spec.recommended_models.length > 0 && (
        <div className="bg-white border border-black/10 rounded p-3">
          <div className="text-[11px] text-app-fg/60 uppercase tracking-wider mb-1">
            {t("skill_gen.preview_models")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {spec.recommended_models.map((m) => (
              <span
                key={m}
                className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-black/10 rounded p-3">
        <div className="text-[11px] text-app-fg/60 uppercase tracking-wider mb-2">
          {t("skill_gen.preview_dimensions")} ({spec.output_dimensions.length})
        </div>
        <div className="flex flex-col gap-1.5">
          {spec.output_dimensions.map((d) => (
            <div key={d.key} className="text-sm flex items-center gap-2">
              <span className="font-medium">{d.title}</span>
              <code className="text-[10px] text-app-fg/40">{d.key}</code>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-black/10 rounded p-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left text-[11px] text-app-fg/60 uppercase tracking-wider flex items-center justify-between"
        >
          <span>{t("skill_gen.preview_prompt")}</span>
          <span className="text-app-fg/40">
            {open
              ? t("skill_gen.preview_collapse_prompt")
              : t("skill_gen.preview_expand_prompt")}
          </span>
        </button>
        {open && (
          <pre className="mt-2 text-[11px] bg-black/5 p-2 rounded font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
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

  // Listen for skill_test:token events (reused from the editor flow).
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
    <div className="text-sm space-y-3">
      <div className="flex gap-2 items-center">
        <select
          value={paperId}
          onChange={(e) => setPaperId(e.target.value)}
          className="flex-1 px-2 py-1 text-xs bg-white border border-black/10 rounded"
        >
          <option value="">{t("skill_gen.test_pick_paper")}</option>
          {papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title.length > 70 ? `${p.title.slice(0, 70)}…` : p.title}
            </option>
          ))}
        </select>
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="px-2 py-1 text-xs bg-white border border-black/10 rounded max-w-[160px]"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={!canRun}
          className="px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
        >
          {running ? t("skill_gen.test_running") : t("skill_gen.test_run_btn")}
        </button>
      </div>
      <div className="bg-white border border-black/10 rounded p-3 min-h-[200px]">
        {output ? (
          <pre className="text-[12px] whitespace-pre-wrap leading-relaxed">
            {output}
            {running && (
              <span className="text-primary/60 animate-pulse">
                {" "}
                {t("skill_gen.test_streaming")}
              </span>
            )}
          </pre>
        ) : (
          <div className="text-xs text-app-fg/40 italic">
            {t("skill_gen.test_result_placeholder")}
          </div>
        )}
      </div>
    </div>
  );
}
