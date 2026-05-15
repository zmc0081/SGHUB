import { useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSearch } from "@tanstack/react-router";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  api,
  type ModelConfig,
  type Paper,
  type ParseResult,
  type PartialMetadata,
  type Skill,
  type SkillSummary,
  type TokenPayload,
  type UploadProgressPayload,
} from "../lib/tauri";
import { PaperPicker } from "../components/PaperPicker";
import { PaperMetadataEditor } from "../components/PaperMetadataEditor";

// ============================================================
// Helpers
// ============================================================

/**
 * Split a streaming markdown response by `## ` headings into a Map of
 * heading-text -> body. Used to render skill output_dimensions as cards.
 */
function parseSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  let currentTitle = "";
  let currentLines: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (currentTitle) {
        sections.set(currentTitle, currentLines.join("\n").trim());
      }
      currentTitle = m[1].trim();
      currentLines = [];
    } else if (currentTitle) {
      currentLines.push(line);
    }
  }
  if (currentTitle) {
    sections.set(currentTitle, currentLines.join("\n").trim());
  }
  return sections;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = (now - t) / 1000;
  if (diff < 60) return `${Math.round(diff)} 秒前`;
  if (diff < 3600) return `${Math.round(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.round(diff / 3600)} 小时前`;
  return `${Math.round(diff / 86400)} 天前`;
}

// ============================================================
// Output panel
// ============================================================

function DimensionCard({
  dimension,
  content,
  streaming,
}: {
  dimension: { key: string; title: string };
  content: string;
  streaming: boolean;
}) {
  const empty = !content || content.length === 0;
  return (
    <div className="bg-white border border-black/10 rounded p-4 flex flex-col">
      <div className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
        {dimension.title}
        {streaming && empty && (
          <span className="text-[10px] text-app-fg/40 animate-pulse">
            等待…
          </span>
        )}
      </div>
      <div className="text-sm text-app-fg/85 whitespace-pre-wrap leading-relaxed flex-1">
        {empty ? (
          <span className="text-app-fg/30 text-xs italic">
            (尚未生成此维度)
          </span>
        ) : (
          <>
            {content}
            {streaming && <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-pulse align-middle" />}
          </>
        )}
      </div>
    </div>
  );
}

function RawOutput({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <div className="bg-white border border-black/10 rounded p-4">
      <div className="text-xs text-app-fg/50 mb-2">
        模型输出(无 output_dimensions 定义,显示原始响应)
      </div>
      <div className="text-sm text-app-fg/85 whitespace-pre-wrap leading-relaxed">
        {text || (
          <span className="text-app-fg/30 italic">(等待响应…)</span>
        )}
        {streaming && (
          <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main
// ============================================================

export default function Parse() {
  const search = useSearch({ from: "/parse" }) as {
    paper_id?: string;
    skill?: string;
  };

  const [papers, setPapers] = useState<Paper[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [history, setHistory] = useState<ParseResult[]>([]);

  const [paperId, setPaperId] = useState<string>("");
  const [skillName, setSkillName] = useState<string>("");
  const [modelId, setModelId] = useState<string>("");

  const [output, setOutput] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [tokensOut, setTokensOut] = useState(0);

  // Local PDF upload state
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgressPayload | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorData, setEditorData] = useState<{
    paperId: string;
    initial: PartialMetadata;
    pdfPath: string | null;
  } | null>(null);

  // Stable refs for token append (avoid stale closure in Tauri event handler)
  const outputRef = useRef("");
  // After deep-link load, scroll the "开始解析" button into view but don't
  // auto-fire it — the user does a final visual confirm before spending
  // an API call.
  const startBtnRef = useRef<HTMLButtonElement>(null);

  // Load reference data
  useEffect(() => {
    // If we arrived here via /parse?paper_id=...&skill=..., the recent
    // 50-paper list may not contain that paper. Fetch the single paper
    // by id and prepend it so the <select> can preselect it.
    const loadPapers = async () => {
      try {
        const recent = await api.getRecentPapers(50);
        if (search.paper_id && !recent.some((p) => p.id === search.paper_id)) {
          try {
            const target = await api.getPaper(search.paper_id);
            if (target) setPapers([target, ...recent]);
            else setPapers(recent);
          } catch {
            setPapers(recent);
          }
        } else {
          setPapers(recent);
        }
      } catch (e) {
        setError(String(e));
      }
    };
    void loadPapers();

    api
      .getSkills()
      .then((s) => {
        setSkills(s);
        // Search-param skill wins; otherwise fall back to first.
        if (search.skill && s.some((x) => x.name === search.skill)) {
          setSkillName(search.skill);
        } else if (s.length > 0 && !skillName) {
          setSkillName(s[0].name);
        }
      })
      .catch((e) => setError(String(e)));
    api
      .getModelConfigs()
      .then((m) => {
        setModels(m);
        const def = m.find((x) => x.is_default) ?? m[0];
        if (def && !modelId) setModelId(def.id);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.paper_id, search.skill]);

  // Apply paper_id from URL once papers list is ready.
  useEffect(() => {
    if (search.paper_id && papers.some((p) => p.id === search.paper_id)) {
      setPaperId(search.paper_id);
      // Scroll the start button into view so the user knows where to click.
      setTimeout(() => {
        startBtnRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [search.paper_id, papers]);

  // Subscribe to streaming events
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<TokenPayload>("parse:token", (event) => {
      const { text, done } = event.payload;
      if (text) {
        outputRef.current += text;
        setOutput(outputRef.current);
        setTokensOut((n) => n + Math.ceil(text.length / 4));
      }
      if (done) {
        setStreaming(false);
        setFinishedAt(Date.now());
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // Reload history when paper changes
  useEffect(() => {
    if (!paperId) {
      setHistory([]);
      return;
    }
    api.getParseHistory(paperId).then(setHistory).catch(() => setHistory([]));
  }, [paperId]);

  const selectedPaper = useMemo(
    () => papers.find((p) => p.id === paperId),
    [paperId, papers],
  );

  // Lazy-load full Skill (incl. output_dimensions + prompt_template) for the
  // selected skill — get_skills now returns SkillSummary only to keep IPC small.
  useEffect(() => {
    if (!skillName) {
      setSelectedSkill(null);
      return;
    }
    api
      .getSkillDetail(skillName)
      .then(setSelectedSkill)
      .catch((e) => console.warn("getSkillDetail", e));
  }, [skillName]);

  const startParse = async () => {
    if (!paperId || !skillName || !modelId) {
      setError("请先选择文献、Skill 和模型");
      return;
    }
    setError(null);
    setOutput("");
    outputRef.current = "";
    setTokensOut(0);
    setStartedAt(Date.now());
    setFinishedAt(null);
    setStreaming(true);
    try {
      await api.startParse(paperId, skillName, modelId);
    } catch (e) {
      setError(String(e));
      setStreaming(false);
      setFinishedAt(Date.now());
    } finally {
      // Refresh history (the new entry should now be there)
      api.getParseHistory(paperId).then(setHistory).catch(() => {});
    }
  };

  // ============================================================
  // Subscribe to upload:progress events (lives for the page lifetime)
  // ============================================================
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<UploadProgressPayload>("upload:progress", (event) => {
      setUploadProgress(event.payload);
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  // ============================================================
  // Local PDF upload
  // ============================================================
  const handleUploadClick = async () => {
    let picked: string | string[] | null;
    try {
      picked = await openDialog({
        multiple: true,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    } catch (e) {
      setError(`打开文件选择器失败: ${e}`);
      return;
    }
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    if (paths.length === 0) return;

    setUploadProgress({ current: 0, total: paths.length, current_file: "" });
    try {
      if (paths.length === 1) {
        // Single file → call upload_local_paper directly so we get the
        // full UploadResult (includes partial_metadata + needs_user_review).
        const result = await api.uploadLocalPaper(paths[0]);
        // Refresh recent papers so the new one is in the picker's
        // recent-fallback list.
        const recent = await api.getRecentPapers(50);
        setPapers(recent);
        setPaperId(result.paper_id);
        if (result.needs_user_review) {
          setEditorData({
            paperId: result.paper_id,
            initial: result.partial_metadata,
            pdfPath: null, // pdf_path stored relative — reset modal disables that link
          });
          setEditorOpen(true);
        }
      } else {
        const results = await api.uploadLocalPapersBatch(paths);
        const recent = await api.getRecentPapers(50);
        setPapers(recent);
        const ok = results.filter((r) => r.success).length;
        const fail = results.length - ok;
        setError(
          fail > 0
            ? `批量上传完成:✓ ${ok} / ✗ ${fail}(失败详情见控制台)`
            : null,
        );
        if (fail > 0) {
          console.warn("upload failures:", results.filter((r) => !r.success));
        }
      }
    } catch (e) {
      setError(`上传失败: ${e}`);
    } finally {
      setUploadProgress(null);
    }
  };

  const loadHistoryItem = (h: ParseResult) => {
    let text = h.result_json;
    try {
      const parsed = JSON.parse(h.result_json);
      if (parsed && typeof parsed.text === "string") text = parsed.text;
    } catch {
      // not JSON, keep raw
    }
    setOutput(text);
    outputRef.current = text;
    setStreaming(false);
    setStartedAt(null);
    setFinishedAt(null);
    setTokensOut(h.tokens_out);
  };

  const sections = useMemo(() => parseSections(output), [output]);
  const tokensIn = useMemo(() => {
    if (!selectedPaper) return 0;
    const approx =
      (selectedPaper.title.length +
        selectedPaper.authors.join(", ").length +
        (selectedPaper.abstract?.length ?? 0)) /
      4;
    return Math.ceil(approx);
  }, [selectedPaper]);
  const elapsedMs =
    startedAt && finishedAt ? finishedAt - startedAt : startedAt ? Date.now() - startedAt : 0;

  return (
    <div className="flex h-full">
      {/* HISTORY SIDEBAR */}
      <aside className="w-64 border-r border-black/10 bg-white/40 overflow-y-auto p-3">
        <div className="text-[10px] uppercase tracking-wider text-app-fg/50 mb-2 px-1">
          解析历史
        </div>
        {!paperId && (
          <div className="text-[11px] text-app-fg/40 px-1">
            选择文献后查看历史
          </div>
        )}
        {paperId && history.length === 0 && (
          <div className="text-[11px] text-app-fg/40 px-1">该文献暂无历史</div>
        )}
        <div className="flex flex-col gap-1.5">
          {history.map((h) => (
            <button
              key={h.id}
              onClick={() => loadHistoryItem(h)}
              className="text-left text-xs px-2 py-1.5 rounded border border-black/5 hover:border-primary/30 hover:bg-primary/5 bg-white"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-medium text-primary truncate">
                  {h.skill_name}
                </span>
                <span className="text-[10px] text-app-fg/40 shrink-0">
                  {formatRelative(h.created_at)}
                </span>
              </div>
              <div className="text-[10px] text-app-fg/60 mt-0.5">
                {h.model_name} · in≈{h.tokens_in} · out≈{h.tokens_out} ·{" "}
                {(h.duration_ms / 1000).toFixed(1)}s
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Config */}
        <div className="border-b border-black/10 p-4 bg-white/30 space-y-3">
          <h1 className="text-xl font-semibold text-primary">AI 解析</h1>

          <div className="flex gap-2 items-center">
            <label className="text-xs text-app-fg/60 w-12 shrink-0">文献</label>
            <PaperPicker
              selectedId={paperId}
              onSelect={(p) => setPaperId(p?.id ?? "")}
              recentFallback={papers.map((p) => ({
                id: p.id,
                title: p.title,
                authors: p.authors,
                source: p.source,
              }))}
            />
            <button
              onClick={handleUploadClick}
              disabled={!!uploadProgress}
              className="shrink-0 px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="上传本地 PDF"
            >
              📤 上传文献
            </button>
          </div>

          {/* Upload progress bar */}
          {uploadProgress && (
            <div className="flex items-center gap-2 text-[11px] text-app-fg/70 pl-14">
              <div className="flex-1 h-1.5 bg-black/10 rounded overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${
                      uploadProgress.total > 0
                        ? (uploadProgress.current / uploadProgress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="tabular-nums shrink-0">
                {uploadProgress.current} / {uploadProgress.total}
                {uploadProgress.current_file &&
                  ` · ${uploadProgress.current_file.slice(0, 30)}${uploadProgress.current_file.length > 30 ? "…" : ""}`}
              </span>
            </div>
          )}

          <div className="flex gap-2 items-center">
            <label className="text-xs text-app-fg/60 w-12 shrink-0">模型</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm bg-white border border-black/10 rounded"
            >
              {models.length === 0 && <option value="">(未配置模型)</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.is_default ? "  ★ 默认" : ""}
                </option>
              ))}
            </select>
            <button
              ref={startBtnRef}
              onClick={startParse}
              disabled={streaming || !paperId || !skillName || !modelId}
              className="px-4 py-1.5 text-sm rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {streaming ? "解析中…" : "开始解析"}
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-xs text-app-fg/60 w-12 shrink-0">Skill</label>
            <select
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm bg-white border border-black/10 rounded"
            >
              {skills.length === 0 && (
                <option value="">(未加载到 Skill)</option>
              )}
              {skills.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.icon ? `${s.icon} ` : ""}
                  {s.display_name}
                  {s.is_builtin ? "  · 内置" : "  · 用户"}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Skill info line — description + recommended models */}
          {(() => {
            const sel = skills.find((s) => s.name === skillName);
            if (!sel) return null;
            return (
              <div className="flex gap-2 items-start">
                <div className="w-12 shrink-0" />
                <div className="flex-1 text-[11px] text-app-fg/55 leading-snug">
                  {sel.description}
                  {sel.recommended_models.length > 0 && (
                    <span className="ml-2 text-app-fg/40">
                      · 推荐 {sel.recommended_models.slice(0, 3).join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Output */}
        <div className="flex-1 overflow-y-auto p-4 bg-app-bg">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded mb-3">
              错误: {error}
            </div>
          )}

          {!output && !streaming && !error && (
            <div className="text-sm text-app-fg/40 text-center py-12">
              选好文献 / Skill / 模型,点「开始解析」开始
            </div>
          )}

          {(output || streaming) && selectedSkill && selectedSkill.output_dimensions.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {selectedSkill.output_dimensions.map((d) => (
                <DimensionCard
                  key={d.key}
                  dimension={d}
                  content={sections.get(d.title) ?? ""}
                  streaming={streaming}
                />
              ))}
            </div>
          )}

          {(output || streaming) &&
            (!selectedSkill || selectedSkill.output_dimensions.length === 0) && (
              <RawOutput text={output} streaming={streaming} />
            )}
        </div>

        {/* Status bar */}
        <div className="border-t border-black/10 px-4 py-2 bg-white/40 text-[11px] text-app-fg/60 flex items-center gap-4">
          <span>
            in ≈ <strong className="text-app-fg">{tokensIn.toLocaleString()}</strong>
            {" · "}
            out ≈ <strong className="text-app-fg">{tokensOut.toLocaleString()}</strong>
          </span>
          <span>
            耗时{" "}
            <strong className="text-app-fg">
              {(elapsedMs / 1000).toFixed(1)}s
            </strong>
          </span>
          <span>
            预估成本{" "}
            <strong className="text-app-fg">$0.00</strong>
            <span className="text-app-fg/40 ml-1">(待接定价表)</span>
          </span>
          {streaming && (
            <span className="ml-auto text-primary animate-pulse">● 流式输出中…</span>
          )}
        </div>
      </main>

      {/* Metadata editor — opens automatically when upload returns
          needs_user_review: true */}
      {editorOpen && editorData && (
        <PaperMetadataEditor
          paperId={editorData.paperId}
          initial={editorData.initial}
          pdfPath={editorData.pdfPath}
          onClose={() => {
            setEditorOpen(false);
            setEditorData(null);
          }}
          onSaved={() => {
            // Refresh recent papers so the corrected title shows up.
            void api.getRecentPapers(50).then(setPapers);
          }}
        />
      )}
    </div>
  );
}
