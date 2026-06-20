// V2.2.6 — in-app PDF reader (pdf.js / pdfjs-dist).
//
// Renders a local PDF (loaded as base64 via `read_pdf_bytes`) with:
//   - continuous scroll, lazy per-page canvas render (IntersectionObserver)
//   - zoom in/out + fit-width
//   - page nav (prev/next) + jump-to-page
//   - document outline (bookmarks) sidebar
//   - page-level text search (jump between matching pages)
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
  List,
  Loader2,
  Maximize2,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api } from "../../lib/tauri";
import { useT } from "../../hooks/useT";
import { Icon } from "../Icon";

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

export function PdfViewer({ path }: { path: string }) {
  const t = useT();
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

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto">
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
    </div>
  );
}

// ── Single page (lazy render via IntersectionObserver) ─────────────
function PdfPage({
  doc,
  pageNumber,
  scale,
  containerWidth,
  registerRef,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number; // -1 = fit-width
  containerWidth: number;
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
        } catch {
          /* text layer is best-effort (e.g. image-only pages) */
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel?.();
      textLayer?.cancel?.();
    };
  }, [visible, scale, containerWidth, doc, pageNumber]);

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="relative shadow-card bg-card"
      style={{
        width: dims ? dims.w : containerWidth ? containerWidth - 32 : 600,
        height: dims ? dims.h : 800,
      }}
    >
      <canvas ref={canvasRef} className="block" />
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
