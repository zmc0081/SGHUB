// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useMemo, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSearch } from "@tanstack/react-router";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  Check,
  Loader2,
  Upload,
  X,
} from "lucide-react";
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
import { Icon } from "../components/Icon";
import { Stage } from "../components/Stage";
import {
  InsufficientBalanceDialog,
  isInsufficientBalanceError,
} from "../components/InsufficientBalanceDialog";
import { useT } from "../hooks/useT";

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

function formatRelative(
  iso: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const now = Date.now();
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const diff = (now - parsed) / 1000;
  if (diff < 60)
    return t("parse.time_ago_seconds", { count: Math.round(diff) });
  if (diff < 3600)
    return t("parse.time_ago_minutes", { count: Math.round(diff / 60) });
  if (diff < 86400)
    return t("parse.time_ago_hours", { count: Math.round(diff / 3600) });
  return t("parse.time_ago_days", { count: Math.round(diff / 86400) });
}

function DimensionCard({
  dimension,
  content,
  streaming,
}: {
  dimension: { key: string; title: string };
  content: string;
  streaming: boolean;
}) {
  const t = useT();
  const empty = !content || content.length === 0;
  return (
    <div className="bg-card rounded-card-sm border border-border-default p-4 flex flex-col">
      <div className="text-caption font-semibold text-indigo mb-2 flex items-center gap-2">
        {dimension.title}
        {streaming && empty && (
          <span className="text-meta text-fg-3 animate-pulse">
            {t("parse.dimension_waiting")}
          </span>
        )}
      </div>
      <div className="text-caption text-fg-1 whitespace-pre-wrap leading-relaxed flex-1">
        {empty ? (
          <span className="text-fg-3 text-meta italic">
            {t("parse.dimension_not_generated")}
          </span>
        ) : (
          <>
            {content}
            {streaming && (
              <span
                aria-hidden="true"
                className="inline-block w-1 h-4 bg-indigo ml-0.5 animate-pulse align-middle"
              />
            )}
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
  const t = useT();
  return (
    <div className="bg-card rounded-card-sm border border-border-default p-5">
      <div className="text-meta uppercase tracking-wide-brand text-fg-3 mb-2">
        {t("parse.raw_response_header")}
      </div>
      <div className="text-caption text-fg-1 whitespace-pre-wrap leading-relaxed">
        {text || (
          <span className="text-fg-3 italic">
            {t("parse.raw_response_waiting")}
          </span>
        )}
        {streaming && (
          <span
            aria-hidden="true"
            className="inline-block w-1 h-4 bg-indigo ml-0.5 animate-pulse align-middle"
          />
        )}
      </div>
    </div>
  );
}

export default function Parse() {
  const t = useT();
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

  // V2.2.1 Session 29 — pop the recharge dialog on SG AI Store balance gate.
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  useEffect(() => {
    if (error && isInsufficientBalanceError(error)) {
      setInsufficientOpen(true);
    }
  }, [error]);

  const [uploadProgress, setUploadProgress] =
    useState<UploadProgressPayload | null>(null);
  type UploadFileStatus = {
    name: string;
    status: "pending" | "ok" | "error";
    error?: string;
    paperId?: string;
    needsReview?: boolean;
  };
  const [uploadStatus, setUploadStatus] = useState<{
    kind: "uploading" | "done";
    files: UploadFileStatus[];
  } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorData, setEditorData] = useState<{
    paperId: string;
    initial: PartialMetadata;
    pdfPath: string | null;
  } | null>(null);

  const outputRef = useRef("");
  const startBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const loadPapers = async () => {
      try {
        const recent = await api.getRecentPapers(50);
        if (
          search.paper_id &&
          !recent.some((p) => p.id === search.paper_id)
        ) {
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

  useEffect(() => {
    if (search.paper_id && papers.some((p) => p.id === search.paper_id)) {
      setPaperId(search.paper_id);
      setTimeout(() => {
        startBtnRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [search.paper_id, papers]);

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
      setError(t("parse.validation_pick_all"));
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
      api.getParseHistory(paperId).then(setHistory).catch(() => {});
    }
  };

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<UploadProgressPayload>("upload:progress", (event) => {
      setUploadProgress(event.payload);
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  const handleUploadClick = async () => {
    let picked: string | string[] | null;
    try {
      picked = await openDialog({
        multiple: true,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    } catch (e) {
      setError(t("parse.error_picker", { detail: String(e) }));
      return;
    }
    if (!picked) return;
    const paths = Array.isArray(picked) ? picked : [picked];
    if (paths.length === 0) return;

    const fileNames = paths.map(
      (p) => p.split(/[/\\]/).pop() ?? "(unknown)",
    );
    setUploadStatus({
      kind: "uploading",
      files: fileNames.map((n) => ({ name: n, status: "pending" })),
    });
    setUploadProgress({ current: 0, total: paths.length, current_file: "" });

    try {
      if (paths.length === 1) {
        const result = await api.uploadLocalPaper(paths[0]);
        const recent = await api.getRecentPapers(50);
        setPapers(recent);
        setPaperId(result.paper_id);
        setUploadStatus({
          kind: "done",
          files: [
            {
              name: fileNames[0],
              status: "ok",
              paperId: result.paper_id,
              needsReview: result.needs_user_review,
            },
          ],
        });
        if (result.needs_user_review) {
          setEditorData({
            paperId: result.paper_id,
            initial: result.partial_metadata,
            pdfPath: null,
          });
          setEditorOpen(true);
        }
      } else {
        const results = await api.uploadLocalPapersBatch(paths);
        const recent = await api.getRecentPapers(50);
        setPapers(recent);
        setUploadStatus({
          kind: "done",
          files: results.map((r, i) => ({
            name: fileNames[i],
            status: r.success ? "ok" : "error",
            error: r.error ?? undefined,
            paperId: r.paper_id ?? undefined,
            needsReview: r.needs_user_review,
          })),
        });
        if (results.some((r) => !r.success)) {
          console.warn(
            "upload failures:",
            results.filter((r) => !r.success),
          );
        }
      }
    } catch (e) {
      setError(t("parse.error_upload", { detail: String(e) }));
      setUploadStatus((prev) =>
        prev
          ? {
              kind: "done",
              files: prev.files.map((f) => ({
                ...f,
                status: f.status === "ok" ? "ok" : "error",
                error: f.error ?? String(e),
              })),
            }
          : null,
      );
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
      /* not JSON, keep raw */
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
    startedAt && finishedAt
      ? finishedAt - startedAt
      : startedAt
        ? Date.now() - startedAt
        : 0;

  return (
    <div className="flex h-full bg-page text-fg-1">
      <aside
        aria-label="Parse history"
        className="w-parse-history border-r border-border-default bg-soft overflow-y-auto p-3"
      >
        <div className="text-meta uppercase tracking-wide-brand text-fg-3 mb-3 px-2">
          {t("parse.history")}
        </div>
        {!paperId && (
          <div className="text-meta text-fg-3 px-2">
            {t("parse.select_paper_first")}
          </div>
        )}
        {paperId && history.length === 0 && (
          <div className="text-meta text-fg-3 px-2">
            {t("parse.no_history")}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => loadHistoryItem(h)}
              className="text-left text-meta px-3 py-2 rounded-card-sm bg-card border border-border-default hover:border-indigo-muted hover:bg-indigo-soft transition-colors duration-fast ease-khx"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-indigo truncate">
                  {h.skill_name}
                </span>
                <span className="text-micro text-fg-3 shrink-0">
                  {formatRelative(h.created_at, t)}
                </span>
              </div>
              <div className="text-micro text-fg-3 mt-1 tabular-nums">
                {h.model_name} · in≈{h.tokens_in} · out≈{h.tokens_out} ·{" "}
                {(h.duration_ms / 1000).toFixed(1)}s
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-page">
        <div className="border-b border-border-default px-8 py-5 bg-card space-y-4">
          <h1 className="text-h2 font-semibold text-fg-1">
            {t("parse.title")}
          </h1>

          <div className="flex gap-3 items-center">
            <label className="text-caption font-medium text-fg-1 w-16 shrink-0">
              {t("parse.paper_label")}
            </label>
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
              type="button"
              onClick={handleUploadClick}
              disabled={!!uploadProgress}
              className="shrink-0 inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast ease-khx"
              title={t("parse.upload_pdf_title")}
            >
              <Icon icon={Upload} size="sm" />
              <span>{t("parse.upload_pdf")}</span>
            </button>
          </div>

          {uploadStatus && (
            <div className="pl-16">
              <div
                className={`flex items-start gap-2 px-3 py-2 rounded-card-sm border text-meta ${
                  uploadStatus.kind === "uploading"
                    ? "border-warning-border bg-warning-bg"
                    : uploadStatus.files.some((f) => f.status === "error")
                      ? "border-danger-border bg-danger-bg"
                      : "border-success-border bg-success-bg"
                }`}
              >
                <div className="flex-1 min-w-0">
                  {uploadStatus.kind === "uploading" && uploadProgress ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-card rounded-pill overflow-hidden">
                        <div
                          role="progressbar"
                          aria-valuenow={
                            uploadProgress.total > 0
                              ? (uploadProgress.current /
                                  uploadProgress.total) *
                                100
                              : 0
                          }
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="h-full bg-indigo transition-[width] duration-base ease-khx"
                          style={{
                            width: `${
                              uploadProgress.total > 0
                                ? (uploadProgress.current /
                                    uploadProgress.total) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="tabular-nums shrink-0 text-warning-fg-strong inline-flex items-center gap-1">
                        <Icon icon={Loader2} size="xs" className="animate-spin" />
                        {uploadProgress.current} / {uploadProgress.total}
                      </span>
                    </div>
                  ) : (
                    <div className="font-medium text-fg-1">
                      {uploadStatus.files.every((f) => f.status === "ok")
                        ? t("parse.upload_status_uploaded_all", {
                            count: uploadStatus.files.length,
                          })
                        : t("parse.upload_status_mixed", {
                            ok: uploadStatus.files.filter(
                              (f) => f.status === "ok",
                            ).length,
                            fail: uploadStatus.files.filter(
                              (f) => f.status === "error",
                            ).length,
                          })}
                    </div>
                  )}
                  <ul className="mt-1 flex flex-col gap-1">
                    {uploadStatus.files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-1.5 text-meta"
                      >
                        <span className="shrink-0">
                          {f.status === "pending" ? (
                            <Icon
                              icon={Loader2}
                              size="xs"
                              className="animate-spin text-warning-fg-strong"
                            />
                          ) : f.status === "ok" ? (
                            <Icon icon={Check} size="xs" className="text-success-fg" />
                          ) : (
                            <Icon icon={X} size="xs" className="text-danger-fg" />
                          )}
                        </span>
                        <span
                          className={`truncate ${
                            f.status === "error"
                              ? "text-danger-fg"
                              : f.status === "ok"
                                ? "text-success-fg"
                                : "text-warning-fg-strong"
                          }`}
                          title={f.error ?? f.name}
                        >
                          {f.name}
                          {f.needsReview && (
                            <span className="ml-1 text-warning-fg-strong">
                              {t("parse.upload_needs_review")}
                            </span>
                          )}
                          {f.error && (
                            <span className="ml-1 text-danger-fg">
                              · {f.error.slice(0, 40)}
                              {f.error.length > 40 ? "…" : ""}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {uploadStatus.kind === "done" && (
                  <button
                    type="button"
                    onClick={() => setUploadStatus(null)}
                    className="shrink-0 text-fg-3 hover:text-fg-1 transition-colors duration-fast ease-khx"
                    title={t("parse.upload_close")}
                    aria-label={t("parse.upload_close")}
                  >
                    <Icon icon={X} size="xs" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 items-center">
            <label className="text-caption font-medium text-fg-1 w-16 shrink-0">
              {t("parse.model_label")}
            </label>
            <div className="relative flex-1">
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
              >
                {models.length === 0 && (
                  <option value="">{t("parse.model_unconfigured")}</option>
                )}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.is_default ? t("parse.model_default_suffix") : ""}
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
              ref={startBtnRef}
              onClick={startParse}
              disabled={streaming || !paperId || !skillName || !modelId}
              className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px active:bg-navy-active active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-btn transition-[background,box-shadow,transform] duration-fast ease-khx"
            >
              {streaming ? (
                <Icon icon={Loader2} size="sm" className="animate-spin" />
              ) : (
                <Icon icon={Brain} size="sm" />
              )}
              <span>{streaming ? t("parse.parsing") : t("parse.start")}</span>
            </button>
          </div>

          <div className="flex gap-3 items-center">
            <label className="text-caption font-medium text-fg-1 w-16 shrink-0">
              {t("parse.skill_label")}
            </label>
            <div className="relative flex-1">
              <select
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                className="w-full appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
              >
                {skills.length === 0 && (
                  <option value="">{t("parse.skill_unloaded")}</option>
                )}
                {skills.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.icon ? `${s.icon} ` : ""}
                    {s.display_name}
                    {s.is_builtin
                      ? t("parse.skill_builtin")
                      : t("parse.skill_user")}
                  </option>
                ))}
              </select>
              <Icon
                icon={ChevronDown}
                size="sm"
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
              />
            </div>
          </div>

          {(() => {
            const sel = skills.find((s) => s.name === skillName);
            if (!sel) return null;
            return (
              <div className="flex gap-3 items-start">
                <div className="w-16 shrink-0" />
                <div className="flex-1 text-meta text-fg-2 leading-snug">
                  {sel.description}
                  {sel.recommended_models.length > 0 && (
                    <span className="ml-2 text-fg-3">
                      {t("parse.skill_recommended_prefix")}
                      {sel.recommended_models.slice(0, 3).join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-page">
          {error && (
            <div
              role="alert"
              className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption mb-4"
            >
              <Icon
                icon={AlertTriangle}
                size="sm"
                className="flex-shrink-0 mt-0.5"
              />
              <span>{t("search.error_prefix", { detail: error })}</span>
            </div>
          )}

          {!output && !streaming && !error && (
            <Stage intensity="full" className="rounded-card p-12 text-center">
              <Icon icon={Brain} size={64} className="mx-auto text-indigo opacity-60" />
              <p className="text-caption text-fg-2 mt-6">
                {t("parse.empty_hint")}
              </p>
            </Stage>
          )}

          {(output || streaming) &&
            selectedSkill &&
            selectedSkill.output_dimensions.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
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
            (!selectedSkill ||
              selectedSkill.output_dimensions.length === 0) && (
              <RawOutput text={output} streaming={streaming} />
            )}
        </div>

        <div className="border-t border-border-default px-8 py-2 bg-card text-meta text-fg-2 flex items-center gap-4 tabular-nums">
          <span>
            in ≈ <strong className="text-fg-1">{tokensIn.toLocaleString()}</strong>
            {" · "}
            out ≈ <strong className="text-fg-1">{tokensOut.toLocaleString()}</strong>
          </span>
          <span>
            {t("parse.elapsed_label")}
            <strong className="text-fg-1">
              {(elapsedMs / 1000).toFixed(1)}s
            </strong>
          </span>
          <span>
            {t("parse.estimated_cost_label")}
            <strong className="text-fg-1">$0.00</strong>
            <span className="text-fg-3 ml-1">
              {t("parse.estimated_cost_pending")}
            </span>
          </span>
          {streaming && (
            <span className="ml-auto text-indigo animate-pulse inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-indigo"
              />
              {t("parse.streaming_indicator")}
            </span>
          )}
        </div>
      </main>

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
            void api.getRecentPapers(50).then(setPapers);
          }}
        />
      )}
      <InsufficientBalanceDialog
        open={insufficientOpen}
        onClose={() => {
          setInsufficientOpen(false);
          setError(null);
        }}
        onSwitchModel={() => setError(null)}
      />
    </div>
  );
}
