import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import * as jsyaml from "js-yaml";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useNavigate } from "@tanstack/react-router";
import {
  api,
  type ModelConfig,
  type Paper,
  type TokenPayload,
} from "../lib/tauri";

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
  const draftKey = `skill-draft-${name ?? "new"}`;

  // ----- Source-of-truth state -----
  const [yaml, setYaml] = useState<string>(EMPTY_TEMPLATE);
  const [loadedYaml, setLoadedYaml] = useState<string>(EMPTY_TEMPLATE);
  const [originalName, setOriginalName] = useState<string | null>(null);

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
      // Try restore draft first
      const draft = localStorage.getItem(draftKey);
      if (draft && draft !== EMPTY_TEMPLATE) {
        if (
          window.confirm(
            "发现一份未保存的草稿,是否恢复?(取消会清除草稿,从模板开始)",
          )
        ) {
          setYaml(draft);
        } else {
          localStorage.removeItem(draftKey);
        }
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
      .catch((e) => setParseError(`加载失败: ${e}`));
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

  // ----- Parse YAML for form view (also catches syntax errors) -----
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
      const e = err as { mark?: { line?: number; column?: number }; message?: string };
      const line = (e?.mark?.line ?? 0) + 1;
      const col = (e?.mark?.column ?? 0) + 1;
      const message = e?.message ?? "YAML 语法错误";
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
      setParseError(`第 ${line} 行: ${message}`);
    }
  }, [yaml]);

  // ----- Auto-save draft to localStorage every 30s -----
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const interval = window.setInterval(() => {
      localStorage.setItem(draftKey, yamlRef.current);
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [hasUnsavedChanges, draftKey]);

  // ----- Warn before page unload if unsaved -----
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
          const obj = (jsyaml.load(yamlRef.current) as Record<string, unknown>) ?? {};
          obj[field] = value;
          setYaml(jsyaml.dump(obj, { lineWidth: 100, noRefs: true }));
        } catch {
          // YAML invalid — skip
        }
      }, SYNC_DEBOUNCE_MS),
    [],
  );

  useEffect(() => () => debouncedFormSync.cancel(), [debouncedFormSync]);

  // ----- Save logic -----
  const performSave = async (forceNew: boolean) => {
    try {
      const orig = forceNew ? null : originalName;
      const spec = await api.saveSkill(yaml, orig);
      localStorage.removeItem(draftKey);
      setLoadedYaml(yaml);
      window.alert(`✓ Skill「${spec.display_name}」已保存`);
      navigate({ to: "/skills" });
    } catch (e) {
      const errors = Array.isArray(e) ? (e as string[]) : [String(e)];
      window.alert(`保存失败:\n\n${errors.join("\n")}`);
    }
  };

  // ----- Run test -----
  const runTest = async () => {
    if (!samplePaperId || !testModelId) {
      setTestError("请选好示例文献和模型");
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

  const onBack = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("有未保存的修改,确定离开?")
    ) {
      return;
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
            detail: `论文 ${v}`,
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

  // ----- Format current YAML (parse + dump) -----
  const formatYaml = () => {
    try {
      const obj = jsyaml.load(yaml);
      if (obj && typeof obj === "object") {
        setYaml(jsyaml.dump(obj, { lineWidth: 100, noRefs: true }));
      }
    } catch {
      window.alert("YAML 不合法,无法格式化");
    }
  };

  // ----- Form values from parsed spec -----
  const f = parsedSpec ?? {};
  const fStr = (k: string) => String(f[k] ?? "");

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <header className="border-b border-black/10 bg-white/60 px-4 py-2 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="text-sm text-app-fg/70 hover:text-primary"
          title="返回 Skill 列表"
        >
          ← 返回
        </button>
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className="font-semibold text-primary truncate">
            {mode === "new"
              ? "新建 Skill"
              : mode === "copy"
                ? `基于「${name}」复制`
                : `编辑「${name}」`}
          </span>
          {hasUnsavedChanges && (
            <span className="text-[10px] text-amber-600">● 未保存</span>
          )}
          {parseError && (
            <span className="text-[10px] text-red-600 truncate">
              ⚠ {parseError}
            </span>
          )}
        </div>
        <button
          onClick={runTest}
          disabled={testRunning}
          className="px-2.5 py-1 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white disabled:opacity-50"
        >
          {testRunning ? "测试中…" : "测试 Skill"}
        </button>
        <button
          onClick={() => performSave(true)}
          className="px-2.5 py-1 text-xs rounded border border-black/10 text-app-fg hover:border-primary"
          title="不论是否在编辑现有 Skill,都强制创建为新 Skill"
        >
          另存为新 Skill
        </button>
        <button
          onClick={() => performSave(false)}
          className="px-3 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90"
        >
          保存
        </button>
      </header>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: form */}
        <aside className="w-[280px] shrink-0 border-r border-black/10 bg-white/30 overflow-y-auto p-3 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-app-fg/50">
            基础信息
          </div>
          <Field label="name (标识符)">
            <input
              key={`name-${parsedSpec ? "ok" : "bad"}`}
              defaultValue={fStr("name")}
              onChange={(e) => debouncedFormSync("name", e.target.value)}
              placeholder="my_skill"
              className="w-full px-2 py-1 text-sm border border-black/10 rounded font-mono"
            />
          </Field>
          <Field label="display_name (显示名)">
            <input
              key={`dn-${parsedSpec ? "ok" : "bad"}`}
              defaultValue={fStr("display_name")}
              onChange={(e) =>
                debouncedFormSync("display_name", e.target.value)
              }
              placeholder="我的 Skill"
              className="w-full px-2 py-1 text-sm border border-black/10 rounded"
            />
          </Field>
          <Field label="description">
            <textarea
              key={`desc-${parsedSpec ? "ok" : "bad"}`}
              defaultValue={fStr("description")}
              onChange={(e) =>
                debouncedFormSync("description", e.target.value)
              }
              rows={3}
              className="w-full px-2 py-1 text-sm border border-black/10 rounded resize-y"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="icon">
              <input
                key={`icon-${parsedSpec ? "ok" : "bad"}`}
                defaultValue={fStr("icon")}
                onChange={(e) => debouncedFormSync("icon", e.target.value)}
                placeholder="🤖"
                className="w-full px-2 py-1 text-sm border border-black/10 rounded"
              />
            </Field>
            <Field label="category">
              <input
                key={`cat-${parsedSpec ? "ok" : "bad"}`}
                defaultValue={fStr("category")}
                onChange={(e) =>
                  debouncedFormSync("category", e.target.value)
                }
                placeholder="basic"
                className="w-full px-2 py-1 text-sm border border-black/10 rounded"
              />
            </Field>
          </div>
          <Field label="recommended_models (逗号分隔)">
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
              className="w-full px-2 py-1 text-sm border border-black/10 rounded font-mono"
            />
          </Field>
          {!parsedSpec && (
            <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              YAML 解析失败,表单已禁用同步,直接编辑右侧 YAML 修复
            </div>
          )}
          <div className="pt-2 border-t border-black/5">
            <button
              onClick={formatYaml}
              className="w-full px-2 py-1 text-xs rounded border border-black/10 hover:border-primary"
            >
              格式化 YAML
            </button>
          </div>
        </aside>

        {/* MIDDLE: Monaco */}
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
        <aside className="w-[360px] shrink-0 border-l border-black/10 bg-white/40 flex flex-col overflow-hidden">
          <div className="border-b border-black/10 flex">
            <button
              onClick={() => setTab("prompt")}
              className={`flex-1 text-xs px-3 py-2 ${
                tab === "prompt"
                  ? "bg-white text-primary font-medium border-b-2 border-primary"
                  : "text-app-fg/60 hover:text-app-fg"
              }`}
            >
              渲染后的 Prompt
            </button>
            <button
              onClick={() => setTab("test")}
              className={`flex-1 text-xs px-3 py-2 ${
                tab === "test"
                  ? "bg-white text-primary font-medium border-b-2 border-primary"
                  : "text-app-fg/60 hover:text-app-fg"
              }`}
            >
              测试运行结果
            </button>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[10px] text-app-fg/60 mb-0.5">{label}</div>
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
  const samplePaper = papers.find((p) => p.id === samplePaperId);
  const template =
    typeof parsedSpec?.prompt_template === "string"
      ? (parsedSpec.prompt_template as string)
      : "";

  const rendered = useMemo(() => {
    if (!template) return "(prompt_template 为空)";
    if (samplePaper) {
      return template
        .replaceAll("{{title}}", samplePaper.title)
        .replaceAll("{{authors}}", samplePaper.authors.join(", "))
        .replaceAll("{{abstract}}", samplePaper.abstract ?? "")
        .replaceAll("{{full_text}}", "(此处会替换为论文全文)")
        .replaceAll("{{language}}", "中文");
    }
    return renderPromptPreview(template);
  }, [template, samplePaper]);

  const tokenCount = estimateTokens(rendered);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-2 border-b border-black/5 text-xs">
        <label className="block">
          <div className="text-[10px] text-app-fg/50 mb-0.5">示例文献</div>
          <select
            value={samplePaperId}
            onChange={(e) => setSamplePaperId(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-white border border-black/10 rounded"
          >
            {papers.length === 0 && <option value="">(无文献)</option>}
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title.length > 60 ? p.title.slice(0, 60) + "…" : p.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex-1 overflow-y-auto p-2 text-[11px] text-app-fg/85 leading-relaxed whitespace-pre-wrap font-mono bg-white/50">
        {rendered}
      </div>
      <div className="border-t border-black/5 px-2 py-1 text-[10px] text-app-fg/50">
        预估 ≈ {tokenCount.toLocaleString()} tokens
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
  // Try to parse output_dimensions for grouped display
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
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="p-2 border-b border-black/5 text-xs">
        <label className="block">
          <div className="text-[10px] text-app-fg/50 mb-0.5">测试模型</div>
          <select
            value={testModelId}
            onChange={(e) => setTestModelId(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-white border border-black/10 rounded"
          >
            {models.length === 0 && <option value="">(无模型)</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.is_default ? "★" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-1 text-[10px] text-app-fg/50">
          ⚠ 测试 max_tokens 限 1500,顶栏点「测试 Skill」开始
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {testError && (
          <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded mb-2">
            {testError}
          </div>
        )}
        {!testOutput && !testRunning && !testError && (
          <div className="text-[11px] text-app-fg/40 italic">
            (尚未运行测试)
          </div>
        )}
        {testRunning && !testOutput && (
          <div className="text-[11px] text-app-fg/60 animate-pulse">
            正在生成…
          </div>
        )}
        {sections && sections.size > 0 ? (
          <div className="space-y-2">
            {dims.map((d) => (
              <div
                key={d.key}
                className="bg-white border border-black/10 rounded p-2"
              >
                <div className="text-[11px] font-semibold text-primary mb-1">
                  {d.title}
                </div>
                <div className="text-[11px] text-app-fg/85 whitespace-pre-wrap leading-snug">
                  {sections.get(d.title) || (
                    <span className="text-app-fg/30 italic">(空)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          testOutput && (
            <pre className="text-[11px] text-app-fg/85 whitespace-pre-wrap leading-snug bg-white/60 p-2 rounded">
              {testOutput}
              {testRunning && (
                <span className="inline-block w-1 h-3 bg-primary/60 ml-0.5 animate-pulse align-middle" />
              )}
            </pre>
          )
        )}
      </div>
    </div>
  );
}
