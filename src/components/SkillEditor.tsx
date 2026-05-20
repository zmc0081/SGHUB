import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as jsyaml from "js-yaml";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  api,
  type ModelConfig,
  type Paper,
  type TokenPayload,
} from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";
import { confirmAsync } from "./DialogProvider";
import { Icon } from "./Icon";

// ============================================================
// Constants
// ============================================================

const PROMPT_VARS = ["title", "authors", "abstract", "full_text", "language"];
const FAKE_RENDER_VARS: Record<string, string> = {
  title: "(示例标题)",
  authors: "(作者 A, 作者 B)",
  abstract: "(论文摘要…)",
  full_text: "(论文全文…)",
  language: "中文",
};

const EMPTY_TEMPLATE = `name: my_skill
display_name: 我的 Skill
description: 描述这个 Skill 的用途
icon: 🤖
category: basic

prompt_template: |
  请精读以下论文,按下方要求输出。

  论文标题: {{title}}
  作者: {{authors}}
  摘要: {{abstract}}
  全文: {{full_text}}

  请用 {{language}} 输出结构化解析。

output_dimensions:
  - key: summary
    title: 📝 摘要
  - key: keywords
    title: 🏷 关键词

recommended_models:
  - claude-opus
`;

const AUTOSAVE_INTERVAL_MS = 30_000;
const SYNC_DEBOUNCE_MS = 300;

// ============================================================
// Types
// ============================================================

export type EditorMode = "new" | "edit" | "copy";

interface Props {
  mode: EditorMode;
  /** Skill name from URL param (null for /new) */
  name: string | null;
}

// ============================================================
// Helpers
// ============================================================

function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait: number,
): T & { cancel: () => void } {
  let timer: number | undefined;
  const wrapped = ((...args: Parameters<T>) => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  }) as T & { cancel: () => void };
  wrapped.cancel = () => {
    if (timer !== undefined) window.clearTimeout(timer);
  };
  return wrapped;
}

function renderPromptPreview(template: string): string {
  let out = template;
  for (const v of PROMPT_VARS) {
    out = out.replaceAll(`{{${v}}}`, FAKE_RENDER_VARS[v]);
  }
  return out;
}

function estimateTokens(s: string): number {
  return Math.ceil([...s].length / 4);
}

// ============================================================
// Main component
// ============================================================

export default function SkillEditor({ mode, name }: Props) {
  const navigate = useNavigate();
  const t = useT();
  const toast = useToast();
  const draftKey = `skill-draft-${name ?? "new"}`;

  // ----- Source-of-truth state -----
  const [yaml, setYaml] = useState<string>(EMPTY_TEMPLATE);
  const [loadedYaml, setLoadedYaml] = useState<string>(EMPTY_TEMPLATE);
  const [originalName, setOriginalName] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);

  // ----- Reference data -----
  const [papers, setPapers] = useState<Paper[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [samplePaperId, setSamplePaperId] = useState<string>("");
  const [testModelId, setTestModelId] = useState<string>("");

  // ----- Editor / parse state -----
  const [parseError, setParseError] = useState<string | null>(null);
  const [tab, setTab] = useState<"prompt" | "test">("prompt");
  const [testOutput, setTestOutput] = useState<string>("");
  const [testRunning, setTestRunning] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ----- Refs -----
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const testOutputRef = useRef<string>("");
  const yamlRef = useRef<string>(yaml);
  yamlRef.current = yaml;

  const hasUnsavedChanges = yaml !== loadedYaml;

  // ----- Load existing skill on mount (edit / copy modes) -----
  useEffect(() => {
    if (mode === "new") {
      // V2.1.0 — if the AI generator forwarded its YAML for manual
      // tweaking, that takes priority over both the draft restore
      // banner and the empty template.
      let prefill: string | null = null;
      try {
        prefill = sessionStorage.getItem("skill-editor-prefill-yaml");
        if (prefill) sessionStorage.removeItem("skill-editor-prefill-yaml");
      } catch {
        /* ignore */
      }
      if (prefill) {
        setYaml(prefill);
        setLoadedYaml(EMPTY_TEMPLATE);
        setOriginalName(null);
        return;
      }
      // Draft restore — shown as a banner, not a blocking confirm.
      const draft = localStorage.getItem(draftKey);
      if (draft && draft !== EMPTY_TEMPLATE) {
        setPendingDraft(draft);
      }
      setLoadedYaml(EMPTY_TEMPLATE);
      setOriginalName(null);
      return;
    }
    if (!name) return;
    api
      .getSkillYaml(name)
      .then((content) => {
        setYaml(content);
        setLoadedYaml(content);
        setOriginalName(name);
      })
      .catch((e) =>
        setParseError(t("skill_editor.load_failed", { detail: String(e) })),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, name]);

  // ----- Load papers + models -----
  useEffect(() => {
    api.getRecentPapers(50).then((ps) => {
      setPapers(ps);
      if (ps.length > 0) setSamplePaperId(ps[0].id);
    });
    api.getModelConfigs().then((ms) => {
      setModels(ms);
      const def = ms.find((m) => m.is_default) ?? ms[0];
      if (def) setTestModelId(def.id);
    });
  }, []);

  // ----- Subscribe to streaming test events -----
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<TokenPayload>("skill_test:token", (event) => {
      const { text, done } = event.payload;
      if (text) {
        testOutputRef.current += text;
        setTestOutput(testOutputRef.current);
      }
      if (done) {
        setTestRunning(false);
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // ----- Parse YAML for form view -----
  const parsedSpec = useMemo<Record<string, unknown> | null>(() => {
    try {
      const obj = jsyaml.load(yaml);
      if (obj && typeof obj === "object") {
        return obj as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }, [yaml]);

  // ----- Update Monaco markers when YAML parse fails -----
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;
    try {
      jsyaml.load(yaml);
      monaco.editor.setModelMarkers(model, "yaml-validate", []);
      setParseError(null);
    } catch (err: unknown) {
      const e = err as {
        mark?: { line?: number; column?: number };
        message?: string;
      };
      const line = (e?.mark?.line ?? 0) + 1;
      const col = (e?.mark?.column ?? 0) + 1;
      const message = e?.message ?? t("skill_editor.yaml_syntax_error");
      monaco.editor.setModelMarkers(model, "yaml-validate", [
        {
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: col + 1,
          message,
          severity: monaco.MarkerSeverity.Error,
        },
      ]);
      setParseError(t("skill_editor.yaml_line", { line, message }));
    }
  }, [yaml, t]);

  // ----- Auto-save draft to localStorage every 30s -----
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const interval = window.setInterval(() => {
      localStorage.setItem(draftKey, yamlRef.current);
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [hasUnsavedChanges, draftKey]);

  // ----- Warn before page unload if unsaved (native browser dialog —
  // intentionally not ConfirmDialog because beforeunload is synchronous).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // ----- Form-field updaters (debounced YAML write) -----
  const debouncedFormSync = useMemo(
    () =>
      debounce((field: string, value: unknown) => {
        try {
          const obj =
            (jsyaml.load(yamlRef.current) as Record<string, unknown>) ?? {};
          obj[field] = value;
          setYaml(jsyaml.dump(obj, { lineWidth: 100, noRefs: true }));
        } catch {
          /* YAML invalid — skip */
        }
      }, SYNC_DEBOUNCE_MS),
    [],
  );

  useEffect(() => () => debouncedFormSync.cancel(), [debouncedFormSync]);

  // ----- Save logic -----
  const performSave = async (forceNew: boolean) => {
    setSaving(true);
    try {
      const orig = forceNew ? null : originalName;
      const spec = await api.saveSkill(yaml, orig);
      localStorage.removeItem(draftKey);
      setLoadedYaml(yaml);
      toast.success(
        t("skill_editor.saved_title"),
        t("skill_editor.saved_description", { name: spec.display_name }),
      );
      navigate({ to: "/skills" });
    } catch (e) {
      const errors = Array.isArray(e) ? (e as string[]) : [String(e)];
      toast.danger(t("skill_editor.save_failed_title"), errors.join("\n"));
    } finally {
      setSaving(false);
    }
  };

  // ----- Run test -----
  const runTest = async () => {
    if (!samplePaperId || !testModelId) {
      setTestError(t("skill_editor.test_missing_inputs"));
      return;
    }
    setTestError(null);
    setTestOutput("");
    testOutputRef.current = "";
    setTestRunning(true);
    setTab("test");
    try {
      await api.testSkillWithPaper(yaml, samplePaperId, testModelId);
    } catch (e) {
      setTestError(String(e));
      setTestRunning(false);
    }
  };

  const onBack = async () => {
    if (hasUnsavedChanges) {
      const ok = await confirmAsync({
        title: t("skill_editor.unsaved_title"),
        description: t("skill_editor.unsaved_description"),
        variant: "danger",
        confirmLabel: t("skill_editor.discard"),
        cancelLabel: t("common.cancel"),
      });
      if (!ok) return;
    }
    navigate({ to: "/skills" });
  };

  // ----- Monaco mount handler: theme, completion, Ctrl+S -----
  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void performSave(false);
    });

    monaco.languages.registerCompletionItemProvider("yaml", {
      triggerCharacters: ["{"],
      provideCompletionItems: (
        model: { getLineContent: (n: number) => string },
        position: { lineNumber: number; column: number },
      ) => {
        const lineText = model.getLineContent(position.lineNumber);
        const before = lineText.substring(0, position.column - 1);
        if (!before.endsWith("{{")) {
          return { suggestions: [] };
        }
        return {
          suggestions: PROMPT_VARS.map((v) => ({
            label: v,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: `${v}}}`,
            detail: t("skill_editor.var_paper_x", { name: v }),
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column,
              endColumn: position.column,
            },
          })),
        };
      },
    });
  };

  const formatYaml = () => {
    try {
      const obj = jsyaml.load(yaml);
      if (obj && typeof obj === "object") {
        setYaml(jsyaml.dump(obj, { lineWidth: 100, noRefs: true }));
      }
    } catch {
      toast.warning(t("skill_editor.format_invalid"));
    }
  };

  const restoreDraft = () => {
    if (pendingDraft) {
      setYaml(pendingDraft);
      setPendingDraft(null);
    }
  };

  const discardDraft = () => {
    setPendingDraft(null);
    localStorage.removeItem(draftKey);
  };

  // ----- Form values from parsed spec -----
  const f = parsedSpec ?? {};
  const fStr = (k: string) => String(f[k] ?? "");

  const modeLabel =
    mode === "new"
      ? t("skill_editor.mode_new")
      : mode === "copy"
        ? t("skill_editor.mode_copy", { name })
        : t("skill_editor.mode_edit", { name });

  return (
    <div className="flex flex-col h-full bg-page text-fg-1">
      {/* Top bar */}
      <header className="border-b border-border-default bg-card px-4 py-2 flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-caption text-fg-2 hover:text-indigo hover:bg-indigo-soft transition-colors duration-fast ease-khx"
          title={t("skill_editor.back_title")}
        >
          <Icon icon={ArrowLeft} size="sm" />
          <span>{t("skill_editor.back")}</span>
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <span className="text-h3 font-semibold text-fg-1 truncate">
            {modeLabel}
          </span>
          {hasUnsavedChanges && (
            <span
              role="status"
              aria-label={t("skill_editor.unsaved_indicator")}
              className="inline-flex items-center gap-1.5 text-meta text-warning-fg-strong"
            >
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-warning-fg"
              />
              {t("skill_editor.unsaved_indicator")}
            </span>
          )}
          {parseError && (
            <span className="inline-flex items-center gap-1 text-meta text-danger-fg truncate">
              <Icon icon={AlertTriangle} size="xs" />
              <span className="truncate">{parseError}</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={testRunning}
          className="inline-flex items-center gap-1.5 px-btn-x-sm py-btn-y-sm rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 transition-colors duration-fast ease-khx"
        >
          {testRunning && (
            <Icon icon={Loader2} size="xs" className="animate-spin" />
          )}
          {testRunning
            ? t("skill_editor.testing")
            : t("skill_editor.test_skill")}
        </button>
        <button
          type="button"
          onClick={() => performSave(true)}
          className="inline-flex items-center px-btn-x-sm py-btn-y-sm rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
          title={t("skill_editor.save_as_new_title")}
        >
          {t("skill_editor.save_as_new")}
        </button>
        <button
          type="button"
          onClick={() => performSave(false)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
        >
          {saving && (
            <Icon icon={Loader2} size="sm" className="animate-spin" />
          )}
          {t("skill_editor.save")}
        </button>
      </header>

      {/* Draft restore banner */}
      {pendingDraft && (
        <div className="px-4 py-2 bg-info-bg text-info-fg border-b border-info-border flex items-center gap-3 text-caption">
          <Icon icon={RefreshCw} size="sm" />
          <span className="flex-1">{t("skill_editor.draft_banner")}</span>
          <button
            type="button"
            onClick={restoreDraft}
            className="px-3 py-1 rounded-pill bg-info-fg text-fg-inverse text-meta font-medium hover:opacity-90 transition-opacity duration-fast ease-khx"
          >
            {t("skill_editor.draft_restore")}
          </button>
          <button
            type="button"
            onClick={discardDraft}
            className="px-3 py-1 rounded-pill border border-info-border text-info-fg text-meta hover:bg-info-bg transition-colors duration-fast ease-khx"
          >
            {t("skill_editor.draft_discard")}
          </button>
        </div>
      )}

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: form */}
        <aside
          aria-label="Skill metadata form"
          className="w-[280px] shrink-0 border-r border-border-default bg-card overflow-y-auto p-4 space-y-3"
        >
          <div className="text-meta uppercase tracking-wide-brand text-fg-3">
            {t("skill_editor.section_basic")}
          </div>
          <Field label={t("skill_editor.field_name")}>
            <input
              key={`name-${parsedSpec ? "ok" : "bad"}`}
              defaultValue={fStr("name")}
              onChange={(e) => debouncedFormSync("name", e.target.value)}
              placeholder="my_skill"
              disabled={mode === "edit"}
              className="w-full px-3 py-1.5 text-caption rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 font-mono focus:outline-none focus:border-border-focus focus:shadow-focus disabled:bg-soft disabled:text-fg-3 transition-colors duration-fast ease-khx"
            />
          </Field>
          <Field label={t("skill_editor.field_display_name")}>
            <input
              key={`dn-${parsedSpec ? "ok" : "bad"}`}
              defaultValue={fStr("display_name")}
              onChange={(e) =>
                debouncedFormSync("display_name", e.target.value)
              }
              placeholder="我的 Skill"
              className="w-full px-3 py-1.5 text-caption rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            />
          </Field>
          <Field label={t("skill_editor.field_description")}>
            <textarea
              key={`desc-${parsedSpec ? "ok" : "bad"}`}
              defaultValue={fStr("description")}
              onChange={(e) =>
                debouncedFormSync("description", e.target.value)
              }
              rows={3}
              className="w-full px-3 py-2 text-caption rounded-card-sm border border-border-default bg-card text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx resize-y"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label={t("skill_editor.field_icon")}
              hint={t("skill_editor.field_icon_hint")}
            >
              <input
                key={`icon-${parsedSpec ? "ok" : "bad"}`}
                defaultValue={fStr("icon")}
                onChange={(e) => debouncedFormSync("icon", e.target.value)}
                placeholder="🤖"
                className="w-full px-3 py-1.5 text-caption rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
              />
            </Field>
            <Field label={t("skill_editor.field_category")}>
              <input
                key={`cat-${parsedSpec ? "ok" : "bad"}`}
                defaultValue={fStr("category")}
                onChange={(e) =>
                  debouncedFormSync("category", e.target.value)
                }
                placeholder="basic"
                className="w-full px-3 py-1.5 text-caption rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
              />
            </Field>
          </div>
          <Field label={t("skill_editor.field_models")}>
            <input
              key={`rm-${parsedSpec ? "ok" : "bad"}`}
              defaultValue={
                Array.isArray(f.recommended_models)
                  ? (f.recommended_models as string[]).join(", ")
                  : ""
              }
              onChange={(e) => {
                const arr = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                debouncedFormSync("recommended_models", arr);
              }}
              placeholder="claude-opus, gpt-5"
              className="w-full px-3 py-1.5 text-caption rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 font-mono focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            />
          </Field>
          {!parsedSpec && (
            <div
              role="alert"
              className="text-meta text-warning-fg-strong bg-warning-bg border border-warning-border rounded-card-sm p-3 flex items-start gap-2"
            >
              <Icon
                icon={AlertTriangle}
                size="sm"
                className="flex-shrink-0 mt-0.5"
              />
              <span>{t("skill_editor.parse_lock_hint")}</span>
            </div>
          )}
          <div className="pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={formatYaml}
              className="w-full px-3 py-1.5 text-meta rounded-pill border border-border-default text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
            >
              {t("skill_editor.format_yaml")}
            </button>
          </div>
        </aside>

        {/* MIDDLE: Monaco — internal theme stays vs-dark per spec */}
        <div className="flex-1 min-w-[600px] flex flex-col bg-[#1e1e1e]">
          <Editor
            height="100%"
            language="yaml"
            theme="vs-dark"
            value={yaml}
            onChange={(v) => setYaml(v ?? "")}
            onMount={onMount}
            options={{
              fontFamily:
                "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
            }}
          />
        </div>

        {/* RIGHT: preview */}
        <aside
          aria-label="Skill preview"
          className="w-[360px] shrink-0 border-l border-border-default bg-card flex flex-col overflow-hidden"
        >
          <div
            role="tablist"
            className="border-b border-border-default flex"
          >
            <TabButton
              active={tab === "prompt"}
              onClick={() => setTab("prompt")}
              label={t("skill_editor.tab_prompt")}
            />
            <TabButton
              active={tab === "test"}
              onClick={() => setTab("test")}
              label={t("skill_editor.tab_test")}
            />
          </div>
          {tab === "prompt" ? (
            <PromptPreview
              parsedSpec={parsedSpec}
              papers={papers}
              samplePaperId={samplePaperId}
              setSamplePaperId={setSamplePaperId}
            />
          ) : (
            <TestPreview
              models={models}
              testModelId={testModelId}
              setTestModelId={setTestModelId}
              testOutput={testOutput}
              testRunning={testRunning}
              testError={testError}
              parsedSpec={parsedSpec}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-caption font-medium border-b-2 transition-colors duration-fast ease-khx ${
        active
          ? "border-indigo text-indigo"
          : "border-transparent text-fg-2 hover:text-fg-1"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-meta text-fg-2 mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-micro text-fg-3">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function PromptPreview({
  parsedSpec,
  papers,
  samplePaperId,
  setSamplePaperId,
}: {
  parsedSpec: Record<string, unknown> | null;
  papers: Paper[];
  samplePaperId: string;
  setSamplePaperId: (id: string) => void;
}) {
  const t = useT();
  const samplePaper = papers.find((p) => p.id === samplePaperId);
  const template =
    typeof parsedSpec?.prompt_template === "string"
      ? (parsedSpec.prompt_template as string)
      : "";

  const rendered = useMemo(() => {
    if (!template) return t("skill_editor.prompt_empty");
    if (samplePaper) {
      return template
        .replaceAll("{{title}}", samplePaper.title)
        .replaceAll("{{authors}}", samplePaper.authors.join(", "))
        .replaceAll("{{abstract}}", samplePaper.abstract ?? "")
        .replaceAll(
          "{{full_text}}",
          t("skill_editor.full_text_placeholder_runtime"),
        )
        .replaceAll("{{language}}", "中文");
    }
    return renderPromptPreview(template);
  }, [template, samplePaper, t]);

  const tokenCount = estimateTokens(rendered);

  return (
    <div role="tabpanel" className="flex flex-col flex-1 overflow-hidden">
      <div className="p-3 border-b border-border-subtle">
        <label className="block">
          <div className="text-meta text-fg-3 mb-1.5">
            {t("skill_editor.sample_paper")}
          </div>
          <select
            value={samplePaperId}
            onChange={(e) => setSamplePaperId(e.target.value)}
            className="w-full px-3 py-1.5 text-caption rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          >
            {papers.length === 0 && (
              <option value="">{t("skill_editor.no_papers")}</option>
            )}
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title.length > 60 ? p.title.slice(0, 60) + "…" : p.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <pre className="flex-1 overflow-y-auto p-3 text-meta text-fg-1 leading-relaxed whitespace-pre-wrap font-mono bg-soft rounded-none">
        {rendered}
      </pre>
      <div className="border-t border-border-subtle px-3 py-2 text-meta text-fg-2 tabular-nums text-right">
        {t("skill_editor.token_estimate", {
          value: tokenCount.toLocaleString(),
        })}
      </div>
    </div>
  );
}

function TestPreview({
  models,
  testModelId,
  setTestModelId,
  testOutput,
  testRunning,
  testError,
  parsedSpec,
}: {
  models: ModelConfig[];
  testModelId: string;
  setTestModelId: (id: string) => void;
  testOutput: string;
  testRunning: boolean;
  testError: string | null;
  parsedSpec: Record<string, unknown> | null;
}) {
  const t = useT();
  const dims = useMemo(() => {
    const raw = parsedSpec?.output_dimensions;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (d): d is { key: string; title: string } =>
          typeof d === "object" &&
          d !== null &&
          "key" in d &&
          "title" in d,
      )
      .map((d) => ({ key: String(d.key), title: String(d.title) }));
  }, [parsedSpec]);

  const sections = useMemo(() => {
    if (!testOutput || dims.length === 0) return null;
    const map = new Map<string, string>();
    let current = "";
    let lines: string[] = [];
    for (const line of testOutput.split("\n")) {
      const m = line.match(/^##\s+(.+?)\s*$/);
      if (m) {
        if (current) map.set(current, lines.join("\n").trim());
        current = m[1].trim();
        lines = [];
      } else if (current) {
        lines.push(line);
      }
    }
    if (current) map.set(current, lines.join("\n").trim());
    return map;
  }, [testOutput, dims]);

  return (
    <div role="tabpanel" className="flex flex-col flex-1 overflow-hidden">
      <div className="p-3 border-b border-border-subtle">
        <label className="block">
          <div className="text-meta text-fg-3 mb-1.5">
            {t("skill_editor.test_model")}
          </div>
          <select
            value={testModelId}
            onChange={(e) => setTestModelId(e.target.value)}
            className="w-full px-3 py-1.5 text-caption rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          >
            {models.length === 0 && (
              <option value="">{t("skill_editor.no_models")}</option>
            )}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.is_default ? "★" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-2 inline-flex items-center gap-1 text-micro text-warning-fg-strong">
          <Icon icon={AlertTriangle} size="xs" />
          <span>{t("skill_editor.test_hint")}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {testError && (
          <div
            role="alert"
            className="text-meta text-danger-fg bg-danger-bg border border-danger-border rounded-card-sm px-3 py-2 mb-3 flex items-start gap-2"
          >
            <Icon
              icon={AlertTriangle}
              size="sm"
              className="flex-shrink-0 mt-0.5"
            />
            <span>{testError}</span>
          </div>
        )}
        {!testOutput && !testRunning && !testError && (
          <div className="text-meta text-fg-3 italic">
            {t("skill_editor.test_idle")}
          </div>
        )}
        {testRunning && !testOutput && (
          <div className="text-meta text-fg-2 animate-pulse">
            {t("skill_editor.test_generating")}
          </div>
        )}
        {sections && sections.size > 0 ? (
          <div className="space-y-3">
            {dims.map((d) => (
              <div
                key={d.key}
                className="bg-card border border-border-default rounded-card-sm p-3"
              >
                <div className="text-meta font-semibold text-indigo mb-1.5">
                  {d.title}
                </div>
                <div className="text-meta text-fg-1 whitespace-pre-wrap leading-snug">
                  {sections.get(d.title) || (
                    <span className="text-fg-3 italic">
                      {t("skill_editor.section_empty")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          testOutput && (
            <pre className="text-meta text-fg-1 whitespace-pre-wrap leading-snug bg-soft p-3 rounded-card-sm">
              {testOutput}
              {testRunning && (
                <span
                  aria-hidden="true"
                  className="inline-block w-1 h-4 bg-indigo align-middle animate-pulse ml-0.5"
                />
              )}
            </pre>
          )
        )}
      </div>
    </div>
  );
}
