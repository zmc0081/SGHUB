// V2.2.6 — in-app PDF reader (pdf.js / pdfjs-dist).
//
// Renders a local PDF (loaded as base64 via `read_pdf_bytes`) with:
//   - continuous scroll, lazy per-page canvas render (IntersectionObserver)
//   - zoom in/out + fit-width
//   - page nav (prev/next) + jump-to-page
//   - document outline (bookmarks) sidebar
//   - page-level text search (jump between matching pages)
//   - V2.2.10 (Session 49) — text annotations: right-click a selection to
//     highlight (3 colors) / underline; persisted per paper (SQLite) and
//     restored on reopen; click an annotation for a recolor/delete bar.
//
// Worker is bundled by Vite via the `?url` import. All chrome uses Lucide
// icons + V2.2 design tokens (dual-theme safe).
import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Languages,
  List,
  Loader2,
  Maximize2,
  MessageCircle,
  Search,
  Underline,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api, type Annotation } from "../../lib/tauri";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import { Icon } from "../Icon";
import { AnnotationBar, AnnotationMenu } from "./AnnotationMenu";
import { AskDialog } from "./AskDialog";
import { TranslatePopover } from "./TranslatePopover";
import {
  anchorFromRects,
  fillVar,
  lineVar,
  parseAnchor,
  pointInRects,
  rectsOverlap,
  selectionToPageRects,
  type AnnotColor,
  type NormRect,
} from "./annotationUtils";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface OutlineNode {
  title: string;
  pageIndex: number | null;
  children: OutlineNode[];
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface AnnotMenuState {
  x: number;
  y: number;
  pages: Map<number, NormRect[]>;
  overlapIds: string[];
  noText: boolean;
  /** Selected text at menu time (for translate / ask). */
  text: string;
}

/** V2.2.10 (Session 50) — selection cache captured on mouse-up, so toolbar
 *  buttons still know the text/rects after the click clears the selection. */
interface SelCache {
  text: string;
  pages: Map<number, NormRect[]>;
  /** Toolbar anchor (viewport coords, above the selection). */
  barX: number;
  barY: number;
  /** Bottom of the selection (translate popover anchors below it). */
  bottomY: number;
}

interface AnnotBarState {
  id: string;
  color: string;
  x: number;
  y: number;
}

export function PdfViewer({
  path,
  paperId,
  paperTitle,
}: {
  path: string;
  /** Enables persisted annotations when the PDF belongs to a library paper. */
  paperId?: string;
  /** Light context for the Ask dialog (paper title). */
  paperTitle?: string;
}) {
  const t = useT();
  const toast = useToast();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scale, setScale] = useState(1.2);
  const [fitWidth, setFitWidth] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [showOutline, setShowOutline] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<number[]>([]);
  const [matchIdx, setMatchIdx] = useState(0);
  const [searching, setSearching] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [containerWidth, setContainerWidth] = useState(0);

  // ── V2.2.10 (Session 49) — annotations ──────────────────────────
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotMenu, setAnnotMenu] = useState<AnnotMenuState | null>(null);
  const [annotBar, setAnnotBar] = useState<AnnotBarState | null>(null);

  // ── V2.2.10 (Session 50) — selection toolbar / translate / ask ──
  const [selBar, setSelBar] = useState<SelCache | null>(null);
  const [translatePop, setTranslatePop] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [askSel, setAskSel] = useState<string | null>(null);

  // Load persisted annotations for this paper (restored on every open).
  useEffect(() => {
    if (!paperId) {
      setAnnotations([]);
      return;
    }
    api
      .listAnnotations(paperId)
      .then(setAnnotations)
      .catch(() => setAnnotations([]));
  }, [paperId]);

  // Right-click: with a text selection → the annotate menu (split across
  // pages); without one on a page that has NO text layer (scanned PDF) →
  // the disabled menu with a hint.
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const pages = selectionToPageRects(sel, pageRefs.current);
        if (pages.size === 0) return; // selection outside the PDF pages
        e.preventDefault();
        const overlapIds = annotations
          .filter((a) => {
            const rects = pages.get(a.page);
            return rects ? rectsOverlap(parseAnchor(a.anchor), rects) : false;
          })
          .map((a) => a.id);
        setAnnotBar(null);
        setSelBar(null);
        setAnnotMenu({
          x: e.clientX,
          y: e.clientY,
          pages,
          overlapIds,
          noText: false,
          text: sel.toString(),
        });
        return;
      }
      // No selection — scanned page (no text layer)? Show the hint menu.
      const pageEl = (e.target as HTMLElement).closest?.(
        "[data-page]",
      ) as HTMLElement | null;
      if (pageEl && pageEl.dataset.hasText === "0") {
        e.preventDefault();
        setAnnotBar(null);
        setSelBar(null);
        setAnnotMenu({
          x: e.clientX,
          y: e.clientY,
          pages: new Map(),
          overlapIds: [],
          noText: true,
          text: "",
        });
      }
    },
    [annotations],
  );

  // Shared by the context menu AND the selection toolbar (Session 50).
  const addFromPages = useCallback(
    async (
      pages: Map<number, NormRect[]>,
      kind: "highlight" | "underline",
      color: AnnotColor,
    ) => {
      if (!paperId || pages.size === 0) return;
      setAnnotMenu(null);
      setSelBar(null);
      window.getSelection()?.removeAllRanges();
      try {
        const created: Annotation[] = [];
        for (const [page, rects] of pages.entries()) {
          created.push(
            await api.addAnnotation({
              paper_id: paperId,
              page,
              anchor: anchorFromRects(rects),
              type: kind,
              color,
            }),
          );
        }
        setAnnotations((prev) => [...prev, ...created]);
      } catch (err) {
        toast.danger(String(err));
      }
    },
    [paperId, toast],
  );

  // ── V2.2.10 (Session 50) — selection toolbar (mouse-up over pages) ──
  const onPagesMouseUp = useCallback(() => {
    // Defer so the browser finishes committing the selection first.
    window.setTimeout(() => {
      if (annotMenu || translatePop || askSel) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const pages = selectionToPageRects(sel, pageRefs.current);
      if (pages.size === 0) return;
      const rects = Array.from(sel.getRangeAt(0).getClientRects());
      const first = rects.find((r) => r.width > 2) ?? rects[0];
      if (!first) return;
      const all = Array.from(
        { length: sel.rangeCount },
        (_, i) => sel.getRangeAt(i).getClientRects(),
      ).flatMap((l) => Array.from(l));
      const bottomY = Math.max(...all.map((r) => r.bottom));
      setSelBar({
        text: sel.toString(),
        pages,
        barX: first.left + first.width / 2,
        barY: first.top,
        bottomY,
      });
    }, 0);
  }, [annotMenu, translatePop, askSel]);

  // Toolbar disappears on scroll or when the selection collapses.
  useEffect(() => {
    const onSelChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelBar(null);
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  const openTranslate = useCallback((text: string, x: number, y: number) => {
    setAnnotMenu(null);
    setSelBar(null);
    setAskSel(null);
    setTranslatePop({ text, x, y });
  }, []);

  const openAsk = useCallback((text: string) => {
    setAnnotMenu(null);
    setSelBar(null);
    setTranslatePop(null);
    setAskSel(text);
  }, []);

  const removeOverlapping = useCallback(async () => {
    if (!annotMenu) return;
    const ids = annotMenu.overlapIds;
    setAnnotMenu(null);
    window.getSelection()?.removeAllRanges();
    try {
      for (const id of ids) await api.deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => !ids.includes(a.id)));
    } catch (err) {
      toast.danger(String(err));
    }
  }, [annotMenu, toast]);

  // Click on an existing annotation (hit-test inside PdfPage) → edit bar.
  const onAnnotHit = useCallback(
    (id: string, x: number, y: number) => {
      const a = annotations.find((v) => v.id === id);
      if (!a) return;
      setAnnotMenu(null);
      setAnnotBar({ id, color: a.color, x, y: y + 12 });
    },
    [annotations],
  );

  const recolorAnnotation = useCallback(
    async (color: AnnotColor) => {
      if (!annotBar) return;
      const id = annotBar.id;
      try {
        await api.updateAnnotationColor(id, color);
        setAnnotations((prev) =>
          prev.map((a) => (a.id === id ? { ...a, color } : a)),
        );
        setAnnotBar((b) => (b && b.id === id ? { ...b, color } : b));
      } catch (err) {
        toast.danger(String(err));
      }
    },
    [annotBar, toast],
  );

  const deleteFromBar = useCallback(async () => {
    if (!annotBar) return;
    const id = annotBar.id;
    setAnnotBar(null);
    try {
      await api.deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.danger(String(err));
    }
  }, [annotBar, toast]);

  // ── Load document ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const b64 = await api.readPdfBytes(path);
        if (cancelled) return;
        const task = pdfjsLib.getDocument({ data: base64ToBytes(b64) });
        loaded = await task.promise;
        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setDoc(loaded);
        setNumPages(loaded.numPages);
        // Outline (bookmarks)
        try {
          const raw = await loaded.getOutline();
          if (!cancelled && raw) setOutline(await buildOutline(loaded, raw));
        } catch {
          /* no outline */
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [path]);

  // ── Track container width for fit-width ──────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [doc]);

  // ── Track current page via scroll position ───────────────────────
  const onScroll = useCallback(() => {
    // V2.2.10 (Session 50) — the selection toolbar hides on scroll.
    setSelBar(null);
    const el = scrollRef.current;
    if (!el) return;
    const mid = el.scrollTop + el.clientHeight / 2;
    let best = 1;
    let bestDist = Infinity;
    pageRefs.current.forEach((node, n) => {
      const center = node.offsetTop + node.offsetHeight / 2;
      const d = Math.abs(center - mid);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    });
    setCurrentPage(best);
  }, []);

  const scrollToPage = useCallback((n: number) => {
    const node = pageRefs.current.get(n);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ── Page-level text search ───────────────────────────────────────
  async function runSearch() {
    if (!doc || !query.trim()) {
      setMatches([]);
      return;
    }
    setSearching(true);
    const q = query.trim().toLowerCase();
    const found: number[] = [];
    try {
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        const text = tc.items
          .map((it) => ("str" in it ? it.str : ""))
          .join(" ")
          .toLowerCase();
        if (text.includes(q)) found.push(p);
      }
    } finally {
      setSearching(false);
    }
    setMatches(found);
    setMatchIdx(0);
    if (found.length > 0) scrollToPage(found[0]);
  }

  function gotoMatch(delta: number) {
    if (matches.length === 0) return;
    const next = (matchIdx + delta + matches.length) % matches.length;
    setMatchIdx(next);
    scrollToPage(matches[next]);
  }

  const effectiveScale =
    fitWidth && containerWidth > 0 ? -1 : scale; // -1 = fit-width sentinel

  const toolbarBtn =
    "inline-flex items-center justify-center h-8 w-8 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-fast ease-khx";

  return (
    <div className="flex flex-col h-full bg-page">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border-default bg-card flex-shrink-0 flex-wrap">
        <button
          type="button"
          className={toolbarBtn}
          onClick={() => setShowOutline((v) => !v)}
          disabled={outline.length === 0}
          title={t("pdf_viewer.outline")}
          aria-label={t("pdf_viewer.outline")}
        >
          <Icon icon={List} size="sm" />
        </button>

        <div className="w-px h-5 bg-border-default mx-1" />

        <button
          type="button"
          className={toolbarBtn}
          onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label={t("pdf_viewer.prev_page")}
        >
          <Icon icon={ChevronLeft} size="sm" />
        </button>
        <div className="flex items-center gap-1 text-meta text-fg-2">
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={currentPage}
            onChange={(e) => {
              const n = Math.min(
                Math.max(1, Number(e.target.value) || 1),
                numPages,
              );
              setCurrentPage(n);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") scrollToPage(currentPage);
            }}
            className="w-12 text-center px-1 py-0.5 rounded-sm border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            aria-label={t("pdf_viewer.page")}
          />
          <span>/ {numPages || "—"}</span>
        </div>
        <button
          type="button"
          className={toolbarBtn}
          onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
          disabled={currentPage >= numPages}
          aria-label={t("pdf_viewer.next_page")}
        >
          <Icon icon={ChevronRight} size="sm" />
        </button>

        <div className="w-px h-5 bg-border-default mx-1" />

        <button
          type="button"
          className={toolbarBtn}
          onClick={() => {
            setFitWidth(false);
            setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)));
          }}
          aria-label={t("pdf_viewer.zoom_out")}
        >
          <Icon icon={ZoomOut} size="sm" />
        </button>
        <button
          type="button"
          className={toolbarBtn}
          onClick={() => {
            setFitWidth(false);
            setScale((s) => Math.min(4, +(s + 0.2).toFixed(2)));
          }}
          aria-label={t("pdf_viewer.zoom_in")}
        >
          <Icon icon={ZoomIn} size="sm" />
        </button>
        <button
          type="button"
          className={
            toolbarBtn + (fitWidth ? " text-navy bg-navy-faint" : "")
          }
          onClick={() => setFitWidth((v) => !v)}
          title={t("pdf_viewer.fit_width")}
          aria-label={t("pdf_viewer.fit_width")}
        >
          <Icon icon={Maximize2} size="sm" />
        </button>

        <div className="w-px h-5 bg-border-default mx-1" />

        <button
          type="button"
          className={toolbarBtn + (showSearch ? " text-navy bg-navy-faint" : "")}
          onClick={() => setShowSearch((v) => !v)}
          title={t("pdf_viewer.search")}
          aria-label={t("pdf_viewer.search")}
        >
          <Icon icon={Search} size="sm" />
        </button>

        {showSearch && (
          <div className="flex items-center gap-1 ml-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              placeholder={t("pdf_viewer.search_placeholder")}
              className="w-40 px-2 py-1 rounded-sm border border-border-default bg-card text-fg-1 text-meta focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            />
            {searching ? (
              <Icon icon={Loader2} size="sm" className="animate-spin text-fg-3" />
            ) : (
              matches.length > 0 && (
                <span className="text-meta text-fg-2 tabular-nums">
                  {matchIdx + 1}/{matches.length}
                </span>
              )
            )}
            <button
              type="button"
              className={toolbarBtn}
              onClick={() => gotoMatch(-1)}
              disabled={matches.length === 0}
              aria-label={t("pdf_viewer.prev_match")}
            >
              <Icon icon={ChevronLeft} size="sm" />
            </button>
            <button
              type="button"
              className={toolbarBtn}
              onClick={() => gotoMatch(1)}
              disabled={matches.length === 0}
              aria-label={t("pdf_viewer.next_match")}
            >
              <Icon icon={ChevronRight} size="sm" />
            </button>
          </div>
        )}
      </div>

      {/* Body: outline + pages */}
      <div className="flex flex-1 min-h-0">
        {showOutline && outline.length > 0 && (
          <div className="w-56 flex-shrink-0 overflow-y-auto border-r border-border-default bg-card p-2">
            <OutlineTree
              nodes={outline}
              onJump={(p) => scrollToPage(p)}
              depth={0}
            />
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={onScroll}
          onContextMenu={onContextMenu}
          onMouseUp={onPagesMouseUp}
          className="flex-1 overflow-auto"
        >
          {loading && (
            <div className="flex items-center justify-center h-full text-fg-3 gap-2">
              <Icon icon={Loader2} size="sm" className="animate-spin" />
              <span>{t("pdf_viewer.loading")}</span>
            </div>
          )}
          {error && !loading && (
            <div className="flex items-center justify-center h-full text-danger-fg text-caption px-6 text-center">
              {t("pdf_viewer.load_failed", { detail: error })}
            </div>
          )}
          {doc && !error && (
            <div className="flex flex-col items-center gap-4 py-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <PdfPage
                  key={n}
                  doc={doc}
                  pageNumber={n}
                  scale={effectiveScale}
                  containerWidth={containerWidth}
                  annots={annotations.filter((a) => a.page === n)}
                  onAnnotHit={onAnnotHit}
                  registerRef={(el) => {
                    if (el) pageRefs.current.set(n, el);
                    else pageRefs.current.delete(n);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* V2.2.10 (Session 49) — annotation context menu + edit bar */}
      {annotMenu && (
        <AnnotationMenu
          x={annotMenu.x}
          y={annotMenu.y}
          noText={annotMenu.noText}
          hasOverlap={annotMenu.overlapIds.length > 0}
          canAnnotate={!!paperId}
          onHighlight={(c) => void addFromPages(annotMenu.pages, "highlight", c)}
          onUnderline={() =>
            void addFromPages(annotMenu.pages, "underline", "yellow")
          }
          onTranslate={() =>
            openTranslate(annotMenu.text, annotMenu.x, annotMenu.y)
          }
          onAsk={() => openAsk(annotMenu.text)}
          onRemove={() => void removeOverlapping()}
          onClose={() => setAnnotMenu(null)}
        />
      )}
      {annotBar && (
        <AnnotationBar
          x={annotBar.x}
          y={annotBar.y}
          color={annotBar.color}
          onRecolor={(c) => void recolorAnnotation(c)}
          onDelete={() => void deleteFromBar()}
          onClose={() => setAnnotBar(null)}
        />
      )}

      {/* V2.2.10 (Session 50) — selection toolbar: 翻译 / Ask / 高亮 / 划线 */}
      {selBar && (
        <div
          role="toolbar"
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-popover inline-flex items-center gap-1 rounded-pill border border-border-strong bg-card shadow-nav px-1.5 py-1"
          style={{
            left: Math.max(
              8,
              Math.min(selBar.barX - 130, window.innerWidth - 268),
            ),
            top: Math.max(8, selBar.barY - 44),
          }}
        >
          <button
            type="button"
            onClick={() =>
              openTranslate(selBar.text, selBar.barX, selBar.bottomY)
            }
            className="inline-flex items-center gap-1 h-7 px-2 rounded-pill text-meta text-fg-1 hover:bg-navy-faint hover:text-indigo transition-colors duration-fast ease-khx"
          >
            <Icon icon={Languages} size="xs" />
            <span>{t("pdf_viewer.sel_translate")}</span>
          </button>
          <button
            type="button"
            onClick={() => openAsk(selBar.text)}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-pill text-meta text-fg-1 hover:bg-navy-faint hover:text-indigo transition-colors duration-fast ease-khx"
          >
            <Icon icon={MessageCircle} size="xs" />
            <span>Ask</span>
          </button>
          <span className="w-px h-4 bg-border-default" aria-hidden />
          <button
            type="button"
            disabled={!paperId}
            title={paperId ? undefined : t("pdf_viewer.annot_need_paper")}
            onClick={() => void addFromPages(selBar.pages, "highlight", "yellow")}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-pill text-meta text-fg-1 hover:bg-navy-faint hover:text-indigo disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast ease-khx"
          >
            <Icon icon={Highlighter} size="xs" />
            <span>{t("pdf_viewer.annot_highlight")}</span>
          </button>
          <button
            type="button"
            disabled={!paperId}
            title={paperId ? undefined : t("pdf_viewer.annot_need_paper")}
            onClick={() => void addFromPages(selBar.pages, "underline", "yellow")}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-pill text-meta text-fg-1 hover:bg-navy-faint hover:text-indigo disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast ease-khx"
          >
            <Icon icon={Underline} size="xs" />
            <span>{t("pdf_viewer.annot_underline")}</span>
          </button>
        </div>
      )}

      {/* V2.2.10 (Session 50) — translate popover + Ask dialog */}
      {translatePop && (
        <TranslatePopover
          text={translatePop.text}
          x={translatePop.x}
          y={translatePop.y}
          onClose={() => setTranslatePop(null)}
        />
      )}
      {askSel && (
        <AskDialog
          text={askSel}
          paperTitle={paperTitle}
          onClose={() => setAskSel(null)}
        />
      )}
    </div>
  );
}

// ── Single page (lazy render via IntersectionObserver) ─────────────
function PdfPage({
  doc,
  pageNumber,
  scale,
  containerWidth,
  annots,
  onAnnotHit,
  registerRef,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number; // -1 = fit-width
  containerWidth: number;
  /** V2.2.10 — this page's annotations (page-normalised rects). */
  annots: Annotation[];
  onAnnotHit: (id: string, clientX: number, clientY: number) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    registerRef(el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      registerRef(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    let textLayer: InstanceType<typeof pdfjsLib.TextLayer> | null = null;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const effScale =
        scale === -1 && containerWidth > 0
          ? (containerWidth - 32) / base.width
          : scale === -1
            ? 1
            : scale;
      const viewport = page.getViewport({ scale: effScale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      setDims({ w: viewport.width, h: viewport.height });
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      task = page.render({ canvasContext: ctx, viewport });
      try {
        await task.promise;
      } catch {
        return; // render cancelled
      }
      if (cancelled) return;
      // Selectable text layer over the canvas (cursor + copy + selection).
      const layerDiv = textLayerRef.current;
      if (layerDiv) {
        layerDiv.replaceChildren();
        // pdf.js positions glyphs relative to this CSS var.
        layerDiv.style.setProperty("--scale-factor", String(effScale));
        try {
          const textContent = await page.getTextContent();
          if (cancelled) return;
          textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: layerDiv,
            viewport,
          });
          await textLayer.render();
          // V2.2.10 — scanned pages have no glyphs: flag it so the
          // annotate menu can explain instead of silently failing.
          wrapRef.current?.setAttribute(
            "data-has-text",
            layerDiv.childElementCount > 0 ? "1" : "0",
          );
        } catch {
          /* text layer is best-effort (e.g. image-only pages) */
          wrapRef.current?.setAttribute("data-has-text", "0");
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel?.();
      textLayer?.cancel?.();
    };
  }, [visible, scale, containerWidth, doc, pageNumber]);

  // V2.2.10 — click on an existing annotation opens the edit bar. The
  // annotation layer is purely visual (pointer-events none, under the text
  // layer), so we hit-test the click point against this page's rects here.
  const onPageClick = (e: React.MouseEvent) => {
    if (annots.length === 0 || !dims) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // finishing a text selection
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = (e.clientX - box.left) / box.width;
    const py = (e.clientY - box.top) / box.height;
    const hit = annots.find((a) => pointInRects(px, py, parseAnchor(a.anchor)));
    if (hit) onAnnotHit(hit.id, e.clientX, e.clientY);
  };

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      onClick={onPageClick}
      className="relative shadow-card bg-card"
      style={{
        width: dims ? dims.w : containerWidth ? containerWidth - 32 : 600,
        height: dims ? dims.h : 800,
      }}
    >
      <canvas ref={canvasRef} className="block" />
      {/* V2.2.10 — annotation layer: between canvas and text layer so
          highlights sit behind the glyphs; visual only (no pointer events). */}
      {dims && annots.length > 0 && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {annots.flatMap((a) =>
            parseAnchor(a.anchor).map((r, i) =>
              a.type === "highlight" ? (
                <div
                  key={`${a.id}-${i}`}
                  className="absolute rounded-[1px]"
                  style={{
                    left: r.x * dims.w,
                    top: r.y * dims.h,
                    width: r.w * dims.w,
                    height: r.h * dims.h,
                    background: fillVar(a.color),
                  }}
                />
              ) : (
                <div
                  key={`${a.id}-${i}`}
                  className="absolute"
                  style={{
                    left: r.x * dims.w,
                    top: (r.y + r.h) * dims.h - 2,
                    width: r.w * dims.w,
                    height: 2,
                    background: lineVar(a.color),
                  }}
                />
              ),
            ),
          )}
        </div>
      )}
      <div ref={textLayerRef} className="textLayer" />
    </div>
  );
}

// ── Outline tree ───────────────────────────────────────────────────
function OutlineTree({
  nodes,
  onJump,
  depth,
}: {
  nodes: OutlineNode[];
  onJump: (page: number) => void;
  depth: number;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((n, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => n.pageIndex != null && onJump(n.pageIndex + 1)}
            disabled={n.pageIndex == null}
            className="w-full text-left text-meta text-fg-2 hover:text-navy hover:bg-navy-faint rounded-sm px-2 py-1 truncate transition-colors duration-fast ease-khx disabled:opacity-50"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            title={n.title}
          >
            {n.title}
          </button>
          {n.children.length > 0 && (
            <OutlineTree nodes={n.children} onJump={onJump} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

// Resolve pdf.js outline dests → 0-based page index.
async function buildOutline(
  doc: PDFDocumentProxy,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any[],
): Promise<OutlineNode[]> {
  const out: OutlineNode[] = [];
  for (const item of raw) {
    let pageIndex: number | null = null;
    try {
      const dest =
        typeof item.dest === "string"
          ? await doc.getDestination(item.dest)
          : item.dest;
      if (Array.isArray(dest) && dest[0]) {
        pageIndex = await doc.getPageIndex(dest[0]);
      }
    } catch {
      pageIndex = null;
    }
    out.push({
      title: item.title ?? "",
      pageIndex,
      children: item.items?.length ? await buildOutline(doc, item.items) : [],
    });
  }
  return out;
}
