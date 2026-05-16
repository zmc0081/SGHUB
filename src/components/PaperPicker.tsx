/**
 * PaperPicker — searchable paper selector backed by FTS5.
 *
 * Used by the Parse page (and reusable elsewhere). The user types a
 * keyword in the input; results are fetched from `search_local_papers`
 * with 200ms debounce and rendered as a dropdown with title highlight,
 * authors, source badge, and current-folder breadcrumb.
 *
 * The component is "headless" w.r.t. selection state — callers pass
 * `selectedId` and `onSelect` and we don't store anything internally.
 */

// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { api, type PaperSearchResult } from "../lib/tauri";
import { useT } from "../hooks/useT";

interface Props {
  selectedId: string;
  onSelect: (paper: PaperSearchResult | null) => void;
  /** Override the placeholder when needed. */
  placeholder?: string;
  /** Show recent papers when input is empty. */
  recentFallback?: { id: string; title: string; authors: string[]; source: string }[];
}

const SOURCE_BADGE: Record<string, string> = {
  arxiv: "bg-[#B31B1B] text-white",
  semantic_scholar: "bg-[#1857B6] text-white",
  pubmed: "bg-[#00897B] text-white",
  openalex: "bg-[#7B3FBF] text-white",
  local: "bg-gray-500 text-white",
};

export function PaperPicker({
  selectedId,
  onSelect,
  placeholder,
  recentFallback = [],
}: Props) {
  const t = useT();
  const effectivePlaceholder = placeholder ?? t("paper_picker.placeholder");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<PaperSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  // Latest-search guard — late-arriving older responses can clobber the
  // active query results without this.
  const searchSeq = useRef(0);

  // ============================================================
  // Resolve `selectedId` → display label (one-shot fetch when needed)
  // ============================================================
  useEffect(() => {
    if (!selectedId) {
      setSelectedLabel("");
      return;
    }
    // Try recent list first (cheap, no IPC).
    const fromRecent = recentFallback.find((p) => p.id === selectedId);
    if (fromRecent) {
      setSelectedLabel(fromRecent.title);
      return;
    }
    // Otherwise pull the row directly.
    void api.getPaper(selectedId).then((p) => {
      if (p) setSelectedLabel(p.title);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ============================================================
  // Debounced search
  // ============================================================
  useEffect(() => {
    if (!open) return;
    const q = input.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      void api
        .searchLocalPapers(q, 30)
        .then((items) => {
          if (seq !== searchSeq.current) return; // stale
          setResults(items);
        })
        .catch(() => {
          if (seq !== searchSeq.current) return;
          setResults([]);
        })
        .finally(() => {
          if (seq === searchSeq.current) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [input, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ============================================================
  // Render
  // ============================================================

  const showRecents =
    open && input.trim().length === 0 && recentFallback.length > 0;
  const showResults = open && input.trim().length > 0;
  const hasResults = results.length > 0;

  const inputBlurDisplay = useMemo(() => {
    if (!selectedId) return "";
    return (
      selectedLabel ||
      t("paper_picker.selected_short", { prefix: selectedId.slice(0, 8) })
    );
  }, [selectedId, selectedLabel, t]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <Command shouldFilter={false} className="w-full">
        <Command.Input
          value={open ? input : inputBlurDisplay}
          onValueChange={(v) => {
            // Treat editing as "the user wants to search again" — reset
            // selection so they don't keep an out-of-date selection.
            setInput(v);
            if (!open) setOpen(true);
            if (selectedId && v !== inputBlurDisplay) {
              onSelect(null);
            }
          }}
          onFocus={() => {
            setOpen(true);
            if (selectedId) setInput("");
          }}
          placeholder={effectivePlaceholder}
          className="w-full px-2.5 py-1.5 text-sm bg-white border border-black/10 rounded focus:outline-none focus:border-primary"
        />

        {open && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-black/10 rounded shadow-lg overflow-hidden">
            <Command.List className="max-h-72 overflow-y-auto">
              {loading && (
                <div className="px-3 py-2 text-xs text-app-fg/50">
                  {t("paper_picker.searching")}
                </div>
              )}

              {showRecents && (
                <>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-app-fg/50">
                    {t("paper_picker.recent")}
                  </div>
                  {recentFallback.slice(0, 15).map((p) => (
                    <Command.Item
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onSelect({
                          id: p.id,
                          title: p.title,
                          title_highlight: p.title,
                          authors: p.authors,
                          source: p.source,
                          abstract: null,
                          doi: null,
                          pdf_path: null,
                          current_folder_path: null,
                          rank: 0,
                        });
                        setSelectedLabel(p.title);
                        setInput("");
                        setOpen(false);
                      }}
                      className="cursor-pointer px-3 py-2 text-xs hover:bg-primary/5 data-[selected=true]:bg-primary/10 flex items-center gap-2"
                    >
                      <SourceBadge source={p.source} />
                      <span className="truncate flex-1 font-medium">{p.title}</span>
                    </Command.Item>
                  ))}
                </>
              )}

              {showResults && !loading && !hasResults && (
                <div className="px-3 py-2 text-xs text-app-fg/50">
                  {t("paper_picker.no_match")}
                </div>
              )}

              {showResults &&
                hasResults &&
                results.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onSelect(p);
                      setSelectedLabel(p.title);
                      setInput("");
                      setOpen(false);
                    }}
                    className="cursor-pointer px-3 py-2 hover:bg-primary/5 data-[selected=true]:bg-primary/10 border-b border-black/5 last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      <SourceBadge source={p.source} />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-xs font-medium text-app-fg [&_mark]:bg-yellow-200 [&_mark]:text-app-fg [&_mark]:px-0.5 [&_mark]:rounded-sm truncate"
                          // Backend already FTS5-escaped & wraps hits in <mark>;
                          // safe to render as HTML.
                          dangerouslySetInnerHTML={{ __html: p.title_highlight }}
                        />
                        <div className="text-[10px] text-app-fg/60 mt-0.5 truncate">
                          {p.authors.slice(0, 3).join(", ")}
                          {p.authors.length > 3 &&
                            t("search.authors_more", { count: p.authors.length })}
                          {p.current_folder_path && (
                            <span className="ml-2 text-app-fg/40">
                              · 📁 {p.current_folder_path}
                            </span>
                          )}
                          {p.doi && (
                            <span className="ml-2 text-app-fg/40">
                              · DOI: {p.doi.slice(0, 24)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Command.Item>
                ))}
            </Command.List>
          </div>
        )}
      </Command>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_BADGE[source] ?? "bg-app-fg/20 text-app-fg";
  return (
    <span
      className={`shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold ${cls}`}
    >
      {source}
    </span>
  );
}
