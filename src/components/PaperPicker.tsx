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
import { FolderClosed } from "lucide-react";
import { api, type PaperSearchResult } from "../lib/tauri";
import { useT } from "../hooks/useT";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";

interface Props {
  selectedId: string;
  onSelect: (paper: PaperSearchResult | null) => void;
  /** Override the placeholder when needed. */
  placeholder?: string;
  /** Show recent papers when input is empty. */
  recentFallback?: { id: string; title: string; authors: string[]; source: string }[];
}

const SOURCE_BADGE: Record<string, string> = {
  arxiv: "bg-src-arxiv text-src-arxiv-fg",
  semantic_scholar: "bg-src-ss text-src-ss-fg",
  pubmed: "bg-src-pubmed text-src-pubmed-fg",
  openalex: "bg-src-openalex text-src-openalex-fg",
  local: "bg-src-local text-src-local-fg",
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
    const fromRecent = recentFallback.find((p) => p.id === selectedId);
    if (fromRecent) {
      setSelectedLabel(fromRecent.title);
      return;
    }
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
    const timer = setTimeout(() => {
      void api
        .searchLocalPapers(q, 30)
        .then((items) => {
          if (seq !== searchSeq.current) return;
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
    return () => clearTimeout(timer);
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
          className="w-full px-input-x py-input-y rounded-pill border border-border-default bg-card text-fg-1 placeholder:text-fg-3 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
          style={{ fontSize: "13px" }}
        />

        {open && (
          <div className="absolute z-popover left-0 right-0 mt-1 bg-card rounded-card-sm shadow-nav overflow-hidden">
            <Command.List className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="p-3">
                  <Skeleton variant="text" lines={3} />
                </div>
              )}

              {showRecents && (
                <>
                  <div className="px-3 py-2 text-meta uppercase tracking-wide-brand text-fg-3">
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
                      className="cursor-pointer px-3 py-2 text-caption hover:bg-navy-faint data-[selected=true]:bg-navy-soft flex items-center gap-2"
                    >
                      <SourceBadge source={p.source} />
                      <span className="truncate flex-1 font-medium text-fg-1">
                        {p.title}
                      </span>
                    </Command.Item>
                  ))}
                </>
              )}

              {showResults && !loading && !hasResults && (
                <div className="px-3 py-3 text-caption text-fg-3">
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
                    className="cursor-pointer px-3 py-2 hover:bg-navy-faint data-[selected=true]:bg-navy-soft border-b border-border-subtle last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      <SourceBadge source={p.source} />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-caption font-medium text-fg-1 [&_mark]:bg-indigo-soft [&_mark]:text-indigo [&_mark]:px-1 [&_mark]:rounded-pill truncate"
                          dangerouslySetInnerHTML={{ __html: p.title_highlight }}
                        />
                        <div className="text-meta text-fg-2 mt-0.5 truncate flex items-center gap-1">
                          <span className="truncate">
                            {p.authors.slice(0, 3).join(", ")}
                            {p.authors.length > 3 &&
                              t("search.authors_more", { count: p.authors.length })}
                          </span>
                          {p.current_folder_path && (
                            <span className="text-fg-3 inline-flex items-center gap-1">
                              <span aria-hidden>·</span>
                              <Icon icon={FolderClosed} size="xs" />
                              <span className="truncate">{p.current_folder_path}</span>
                            </span>
                          )}
                          {p.doi && (
                            <span className="text-fg-3">
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
  const cls = SOURCE_BADGE[source] ?? "bg-badge-default-bg text-badge-default-fg";
  return (
    <span
      className={`shrink-0 text-micro uppercase tracking-wide-brand px-2 py-0.5 rounded-pill font-semibold ${cls}`}
    >
      {source}
    </span>
  );
}
