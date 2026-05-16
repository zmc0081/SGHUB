// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api, type Paper } from "../lib/tauri";
import { PaperActions } from "../components/PaperActions";
import { useT } from "../hooks/useT";

// Each option carries an i18n labelKey instead of a hardcoded label —
// see SOURCES_T() in component body for the rendered version.
const SOURCES = [
  { value: "all", labelKey: "search.source_all" },
  { value: "arxiv", label: "arXiv" },
  { value: "semantic_scholar", label: "Semantic Scholar" },
  { value: "pubmed", label: "PubMed" },
  { value: "openalex", label: "OpenAlex" },
] as Array<{ value: string; label?: string; labelKey?: string }>;

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
  arxiv: "bg-[#B31B1B] text-white",
  semantic_scholar: "bg-[#1857B6] text-white",
  pubmed: "bg-[#00897B] text-white",
  openalex: "bg-[#7B3FBF] text-white",
};

const SOURCE_LABEL: Record<string, string> = {
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
  pubmed: "PubMed",
  openalex: "OpenAlex",
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

function PaperCard({ paper }: { paper: Paper }) {
  const t = useT();
  const sourceCls = SOURCE_BADGE[paper.source] ?? "bg-app-fg/20 text-app-fg";
  return (
    <article className="bg-white rounded border border-black/10 p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${sourceCls}`}
          >
            {SOURCE_LABEL[paper.source] ?? paper.source}
          </span>
          <span className="text-base font-semibold text-primary leading-snug truncate">
            {paper.title}
          </span>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-app-fg/70">
        {paper.authors.slice(0, 5).join(", ")}
        {paper.authors.length > 5 &&
          t("search.authors_more", { count: paper.authors.length })}
        {paper.published_at && (
          <span className="ml-2">· {paper.published_at.slice(0, 10)}</span>
        )}
        {paper.doi && (
          <span className="ml-2 text-app-fg/50">· DOI: {paper.doi}</span>
        )}
      </div>
      {paper.abstract && (
        <p className="mt-2 text-sm text-app-fg/80 line-clamp-3">
          {paper.abstract}
        </p>
      )}
      <div className="mt-3">
        <PaperActions paper={paper} />
      </div>
    </article>
  );
}

function PaperListSimple({ papers }: { papers: Paper[] }) {
  return (
    <div className="flex flex-col gap-3">
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
    estimateSize: () => 200,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto border border-black/10 rounded bg-white/30"
      style={{ height: "calc(100vh - 280px)" }}
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
              padding: "0 12px 12px",
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

  // First load: empty (don't auto-fire HTTP). User types -> Enter -> search.
  useEffect(() => {
    setPapers([]);
  }, []);

  const visible = useMemo(() => {
    const days = TIME_RANGES.find((t) => t.value === timeRange)?.days ?? null;
    return applySort(applyTimeFilter(papers, days), sortBy);
  }, [papers, timeRange, sortBy]);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-primary mb-1">
        {t("search.title")}
      </h1>
      <p className="text-sm text-app-fg/60 mb-6">{t("search.subtitle")}</p>

      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder={t("search.placeholder")}
          className="flex-1 px-3 py-2 bg-white border border-black/10 rounded text-sm focus:outline-none focus:border-primary"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="px-3 py-2 bg-white border border-black/10 rounded text-sm focus:outline-none focus:border-primary"
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.labelKey ? t(s.labelKey) : s.label}
            </option>
          ))}
        </select>
        <button
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? t("search.searching") : t("search.search_button")}
        </button>
      </div>

      <div className="flex gap-3 items-center mb-4 text-xs text-app-fg/70">
        <label className="flex items-center gap-1.5">
          {t("search.time_label")}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-white border border-black/10 rounded px-2 py-1"
          >
            {TIME_RANGES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          {t("search.sort_label")}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-black/10 rounded px-2 py-1"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-app-fg/60 animate-pulse">
          <div className="h-2 w-2 bg-accent rounded-full animate-bounce" />
          {t("search.loading_sources")}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {t("search.error_prefix", { detail: error })}
        </div>
      )}

      {!loading && papers.length === 0 && !error && (
        <div className="text-sm text-app-fg/50">
          {query.trim() ? t("search.no_results") : t("search.empty_prompt")}
        </div>
      )}

      {!loading && papers.length > 0 && (
        <>
          <div className="text-xs text-app-fg/50 mb-3">
            {t("search.results_count", { count: visible.length })}
            {visible.length !== papers.length &&
              t("search.results_filtered_from", { total: papers.length })}
            {duration !== null && ` · ${duration}ms`}
            {papers.length > 100 && t("search.results_virtual")}
          </div>
          <PaperList papers={visible} />
        </>
      )}
    </div>
  );
}
