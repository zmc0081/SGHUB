// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { listen } from "@tauri-apps/api/event";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  Loader2,
  Search as SearchIcon,
} from "lucide-react";
import { api, type Paper } from "../lib/tauri";
import { PaperActions } from "../components/PaperActions";
import { Skeleton } from "../components/Skeleton";
import { Icon } from "../components/Icon";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";

type SourceOption = { value: string; label?: string; labelKey?: string };

const ALL_SOURCE: SourceOption = { value: "all", labelKey: "search.source_all" };

// V2.2.3 — 8 sources, grouped so the dropdown stays scannable.
const SOURCE_GROUPS: Array<{ labelKey: string; sources: SourceOption[] }> = [
  {
    labelKey: "search.source_group_general",
    sources: [
      { value: "arxiv", label: "arXiv" },
      { value: "semantic_scholar", label: "Semantic Scholar" },
      { value: "openalex", label: "OpenAlex" },
      { value: "crossref", label: "Crossref" },
      { value: "pubmed", label: "PubMed" },
    ],
  },
  {
    labelKey: "search.source_group_cs",
    sources: [{ value: "dblp", label: "DBLP" }],
  },
  {
    labelKey: "search.source_group_oa",
    sources: [
      { value: "core", label: "CORE" },
      { value: "doaj", label: "DOAJ" },
    ],
  },
];

const TIME_RANGES = [
  { value: "all", labelKey: "search.time_all", days: null as number | null },
  { value: "7d", labelKey: "search.time_7d", days: 7 },
  { value: "30d", labelKey: "search.time_30d", days: 30 },
  { value: "1y", labelKey: "search.time_1y", days: 365 },
];

const SORT_OPTIONS = [
  { value: "relevance", labelKey: "search.sort_relevance" },
  { value: "latest", labelKey: "search.sort_latest" },
  { value: "citation", labelKey: "search.sort_citation" },
];

const SOURCE_BADGE: Record<string, string> = {
  arxiv: "bg-src-arxiv text-src-arxiv-fg",
  semantic_scholar: "bg-src-ss text-src-ss-fg",
  pubmed: "bg-src-pubmed text-src-pubmed-fg",
  openalex: "bg-src-openalex text-src-openalex-fg",
  local: "bg-src-local text-src-local-fg",
  crossref: "bg-src-crossref text-src-crossref-fg",
  core: "bg-src-core text-src-core-fg",
  dblp: "bg-src-dblp text-src-dblp-fg",
  doaj: "bg-src-doaj text-src-doaj-fg",
};

const SOURCE_LABEL: Record<string, string> = {
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
  pubmed: "PubMed",
  openalex: "OpenAlex",
  local: "Local",
  crossref: "Crossref",
  core: "CORE",
  dblp: "DBLP",
  doaj: "DOAJ",
};

function applyTimeFilter(papers: Paper[], days: number | null): Paper[] {
  if (days === null) return papers;
  const cutoff = Date.now() - days * 86400_000;
  return papers.filter((p) => {
    if (!p.published_at) return true;
    const t = Date.parse(p.published_at);
    return Number.isNaN(t) || t >= cutoff;
  });
}

function applySort(papers: Paper[], sortBy: string): Paper[] {
  if (sortBy === "latest") {
    return [...papers].sort((a, b) =>
      (b.published_at ?? "").localeCompare(a.published_at ?? ""),
    );
  }
  return papers;
}

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_BADGE[source] ?? "bg-badge-default-bg text-badge-default-fg";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-pill text-micro font-medium ${cls}`}
    >
      {SOURCE_LABEL[source] ?? source}
    </span>
  );
}

function PaperCard({ paper }: { paper: Paper }) {
  const t = useT();
  const toast = useToast();
  // V2.2.3 — a merged paper carries every source it was found in.
  const sources = paper.sources && paper.sources.length > 0 ? paper.sources : [paper.source];

  const openFulltext = () => {
    if (!paper.fulltext_url) return;
    api
      .openExternalUrl(paper.fulltext_url)
      .catch((e) => toast.danger(t("search.error_open_fulltext"), String(e)));
  };

  return (
    <article className="rounded-card bg-card shadow-card p-6 transition-shadow duration-base ease-khx hover:shadow-card-hover">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {sources.map((s) => (
          <SourceBadge key={s} source={s} />
        ))}
        {paper.published_at && (
          <span className="text-meta text-fg-3 tabular-nums">
            {paper.published_at.slice(0, 10)}
          </span>
        )}
      </div>
      <h3 className="text-h3 font-semibold text-fg-1 leading-snug">
        {paper.title}
      </h3>
      <p className="text-meta text-fg-2 mt-2">
        {paper.authors.slice(0, 5).join(", ")}
        {paper.authors.length > 5 &&
          t("search.authors_more", { count: paper.authors.length })}
      </p>
      {paper.doi && (
        <p className="text-meta text-fg-3 mt-1 font-mono truncate">
          DOI: {paper.doi}
        </p>
      )}
      {paper.abstract && (
        <p className="text-caption text-fg-2 mt-3 line-clamp-3 leading-relaxed">
          {paper.abstract}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <PaperActions paper={paper} size="md" />
        {paper.fulltext_url && (
          <button
            type="button"
            onClick={openFulltext}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-border-default bg-card text-meta text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx"
          >
            <Icon icon={FileText} size="sm" />
            <span>{t("search.fulltext_pdf")}</span>
          </button>
        )}
      </div>
    </article>
  );
}

function PaperListSimple({ papers }: { papers: Paper[] }) {
  return (
    <div className="flex flex-col gap-4">
      {papers.map((p) => (
        <PaperCard key={p.id} paper={p} />
      ))}
    </div>
  );
}

function PaperListVirtual({ papers }: { papers: Paper[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: papers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 240,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto rounded-card bg-soft"
      style={{ height: "calc(100vh - 320px)" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${row.start}px)`,
              padding: "0 16px 16px",
            }}
          >
            <PaperCard paper={papers[row.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PaperList({ papers }: { papers: Paper[] }) {
  return papers.length > 100 ? (
    <PaperListVirtual papers={papers} />
  ) : (
    <PaperListSimple papers={papers} />
  );
}

export default function Search() {
  const t = useT();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [sortBy, setSortBy] = useState("relevance");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const runSearch = () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    const start = Date.now();
    api
      .searchPapers(query, source, 50)
      .then((p) => {
        setPapers(p);
        setDuration(Date.now() - start);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPapers([]);
  }, []);

  // V2.2.3 — the backend auto-expands a sparse single-source search to
  // Crossref + CORE and fires this event so we can tell the user.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("search:fallback", () => {
      toast.info(t("search.fallback_expanded"));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [toast, t]);

  const visible = useMemo(() => {
    const days = TIME_RANGES.find((tr) => tr.value === timeRange)?.days ?? null;
    return applySort(applyTimeFilter(papers, days), sortBy);
  }, [papers, timeRange, sortBy]);

  return (
    <main role="main" className="p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-h2 font-semibold text-fg-1">{t("search.title")}</h1>
        <p className="text-meta text-fg-2 mt-1">{t("search.subtitle")}</p>
      </header>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Icon
            icon={SearchIcon}
            size="sm"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-3"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder={t("search.placeholder")}
            type="search"
            aria-label={t("search.title")}
            className="w-full pl-10 pr-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          />
        </div>

        <div className="relative">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label={t("search.source_label")}
            className="appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          >
            <option value={ALL_SOURCE.value}>{t(ALL_SOURCE.labelKey!)}</option>
            {SOURCE_GROUPS.map((g) => (
              <optgroup key={g.labelKey} label={t(g.labelKey)}>
                {g.sources.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.labelKey ? t(s.labelKey) : s.label}
                  </option>
                ))}
              </optgroup>
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
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px active:bg-navy-active active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-btn transition-[background,box-shadow,transform] duration-fast ease-khx"
        >
          {loading ? (
            <Icon icon={Loader2} size="sm" className="animate-spin" />
          ) : (
            <Icon icon={SearchIcon} size="sm" />
          )}
          <span>{loading ? t("search.searching") : t("search.search_button")}</span>
        </button>
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-meta text-fg-2">{t("search.time_label")}</span>
          <div role="radiogroup" className="flex gap-1.5">
            {TIME_RANGES.map((opt) => {
              const isActive = opt.value === timeRange;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setTimeRange(opt.value)}
                  className={`inline-flex items-center px-3 py-1 rounded-pill text-meta border transition-colors duration-fast ease-khx ${
                    isActive
                      ? "bg-indigo-soft border-indigo-muted text-indigo font-medium"
                      : "bg-card border-border-default text-fg-2 hover:text-fg-1 hover:bg-navy-faint"
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-meta text-fg-2">{t("search.sort_label")}</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label={t("search.sort_label")}
              className="appearance-none pr-8 pl-3 py-1 rounded-pill border border-border-default bg-card text-meta text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <Icon
              icon={ChevronDown}
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col gap-4">
          <Skeleton variant="paper-card" />
          <Skeleton variant="paper-card" />
          <Skeleton variant="paper-card" />
        </div>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption"
        >
          <Icon icon={AlertTriangle} size="sm" className="flex-shrink-0 mt-0.5" />
          <span>{t("search.error_prefix", { detail: error })}</span>
        </div>
      )}

      {!loading && papers.length === 0 && !error && (
        <div className="text-caption text-fg-3 text-center py-8">
          {query.trim() ? t("search.no_results") : t("search.empty_prompt")}
        </div>
      )}

      {!loading && papers.length > 0 && (
        <>
          <div className="text-meta text-fg-3 mb-4 flex items-center gap-2">
            <span>{t("search.results_count", { count: visible.length })}</span>
            {visible.length !== papers.length && (
              <span>
                {t("search.results_filtered_from", { total: papers.length })}
              </span>
            )}
            {duration !== null && (
              <span className="tabular-nums">· {duration}ms</span>
            )}
            {papers.length > 100 && <span>· {t("search.results_virtual")}</span>}
          </div>
          <PaperList papers={visible} />
        </>
      )}
    </main>
  );
}
