import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api, type Paper } from "../lib/tauri";

const SOURCES = [
  { value: "all", label: "全部" },
  { value: "arxiv", label: "arXiv" },
  { value: "semantic_scholar", label: "Semantic Scholar" },
  { value: "pubmed", label: "PubMed" },
  { value: "openalex", label: "OpenAlex" },
];

const TIME_RANGES = [
  { value: "all", label: "不限", days: null as number | null },
  { value: "7d", label: "近 7 天", days: 7 },
  { value: "30d", label: "近 30 天", days: 30 },
  { value: "1y", label: "近 1 年", days: 365 },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "相关性" },
  { value: "latest", label: "最新" },
  { value: "citation", label: "引用 (待支持)" },
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

function pdfUrlFor(p: Paper): string | null {
  if (p.source === "arxiv" && p.source_id) {
    return `https://arxiv.org/pdf/${p.source_id}`;
  }
  return null;
}

function PaperCard({ paper }: { paper: Paper }) {
  const pdf = pdfUrlFor(paper);
  const sourceCls =
    SOURCE_BADGE[paper.source] ?? "bg-app-fg/20 text-app-fg";

  return (
    <article className="bg-white rounded border border-black/10 p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${sourceCls}`}
          >
            {SOURCE_LABEL[paper.source] ?? paper.source}
          </span>
          <a
            href={paper.source_url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-base font-semibold text-primary hover:underline leading-snug truncate"
          >
            {paper.title}
          </a>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-app-fg/70">
        {paper.authors.slice(0, 5).join(", ")}
        {paper.authors.length > 5 && ` 等 ${paper.authors.length} 人`}
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
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <button
          onClick={() => alert("收藏 — 待实现 (将打开文件夹选择器)")}
          className="px-2 py-1 rounded border border-black/10 hover:border-primary/30 hover:bg-primary/5"
        >
          ⭐ 收藏
        </button>
        <button
          onClick={() => alert("AI 精读 — 待实现 (跳转 /parse)")}
          className="px-2 py-1 rounded border border-black/10 hover:border-primary/30 hover:bg-primary/5"
        >
          🧠 AI 精读
        </button>
        {paper.source_url && (
          <a
            href={paper.source_url}
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 rounded border border-black/10 hover:border-primary/30 hover:bg-primary/5"
          >
            📄 原文
          </a>
        )}
        <button
          onClick={() => pdf && window.open(pdf, "_blank")}
          disabled={!pdf}
          className="px-2 py-1 rounded border border-black/10 hover:border-primary/30 hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
          title={pdf ? "下载 PDF" : "该来源未提供 PDF 链接"}
        >
          📥 下载 PDF
        </button>
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
      <h1 className="text-2xl font-semibold text-primary mb-1">文献检索</h1>
      <p className="text-sm text-app-fg/60 mb-6">
        多源聚合 — arXiv / Semantic Scholar / PubMed (E-utilities) /
        OpenAlex 4 源并发,10s 超时单源降级,DOI + 标题双重去重,结果自动入库
      </p>

      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="关键词,如 transformer / RLHF / AlphaFold"
          className="flex-1 px-3 py-2 bg-white border border-black/10 rounded text-sm focus:outline-none focus:border-primary"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="px-3 py-2 bg-white border border-black/10 rounded text-sm focus:outline-none focus:border-primary"
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={runSearch}
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "检索中…" : "检索"}
        </button>
      </div>

      <div className="flex gap-3 items-center mb-4 text-xs text-app-fg/70">
        <label className="flex items-center gap-1.5">
          时间:
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-white border border-black/10 rounded px-2 py-1"
          >
            {TIME_RANGES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          排序:
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-black/10 rounded px-2 py-1"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-app-fg/60 animate-pulse">
          <div className="h-2 w-2 bg-accent rounded-full animate-bounce" />
          正在并发请求 arXiv 与 Semantic Scholar…
        </div>
      )}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
          错误: {error}
        </div>
      )}

      {!loading && papers.length === 0 && !error && (
        <div className="text-sm text-app-fg/50">
          {query.trim() ? "暂无结果" : "输入关键词后回车开始检索"}
        </div>
      )}

      {!loading && papers.length > 0 && (
        <>
          <div className="text-xs text-app-fg/50 mb-3">
            {visible.length} 条结果
            {visible.length !== papers.length &&
              ` (从 ${papers.length} 条中筛选)`}
            {duration !== null && ` · ${duration}ms`}
            {papers.length > 100 && " · 已启用虚拟滚动"}
          </div>
          <PaperList papers={visible} />
        </>
      )}
    </div>
  );
}
