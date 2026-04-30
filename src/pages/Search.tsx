import { useEffect, useState } from "react";
import { api, type Paper } from "../lib/tauri";

const SOURCES = [
  { value: "all", label: "全部来源" },
  { value: "arxiv", label: "arXiv" },
  { value: "pubmed", label: "PubMed" },
  { value: "semantic_scholar", label: "Semantic Scholar" },
  { value: "openalex", label: "OpenAlex" },
];

const STATUS_LABEL: Record<string, string> = {
  unread: "未读",
  reading: "阅读中",
  read: "已读",
  parsed: "已解析",
};

export default function Search() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runSearch = () => {
    setLoading(true);
    setError(null);
    api
      .searchPapers(query, source, 20)
      .then(setPapers)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-primary mb-1">文献检索</h1>
      <p className="text-sm text-app-fg/60 mb-6">
        多源聚合检索 (arXiv / PubMed / Semantic Scholar / OpenAlex)
      </p>

      <div className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="关键词,如 transformer / BERT / RLHF"
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
          className="px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors"
        >
          检索
        </button>
      </div>

      {loading && <div className="text-sm text-app-fg/60">加载中…</div>}
      {error && <div className="text-sm text-red-600">错误: {error}</div>}
      {!loading && !error && papers.length === 0 && (
        <div className="text-sm text-app-fg/60">暂无结果</div>
      )}

      <div className="flex flex-col gap-3">
        {papers.map((p) => (
          <article
            key={p.id}
            className="bg-white rounded border border-black/10 p-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-primary leading-snug">
                {p.title}
              </h2>
              <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                {p.source}
              </span>
            </div>
            <div className="mt-1.5 text-xs text-app-fg/70">
              {p.authors.slice(0, 4).join(", ")}
              {p.authors.length > 4 && ` 等 ${p.authors.length} 人`}
              {p.published_at && (
                <span className="ml-2">
                  · {p.published_at.slice(0, 10)}
                </span>
              )}
            </div>
            {p.abstract && (
              <p className="mt-2 text-sm text-app-fg/80 line-clamp-3">
                {p.abstract}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs text-app-fg/60">
              <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                {STATUS_LABEL[p.read_status] ?? p.read_status}
              </span>
              {p.doi && <span>DOI: {p.doi}</span>}
              {p.source_url && (
                <a
                  href={p.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  原文
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
