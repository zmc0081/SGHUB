// V2.2.6 — full-screen in-app PDF reader overlay. Mounted once in App;
// shown whenever `pdfReaderStore.open` is true. Hosts the PdfViewer (and,
// from V2.2.6, the translation panel — added in a later step).
import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { FileText, Languages, X } from "lucide-react";
import { usePdfReaderStore } from "../../stores/pdfReaderStore";
import { useT } from "../../hooks/useT";
import { Icon } from "../Icon";
import { PdfViewer } from "./PdfViewer";
import { TranslatePanel } from "./TranslatePanel";

export function PdfReaderOverlay() {
  const t = useT();
  const open = usePdfReaderStore((s) => s.open);
  const source = usePdfReaderStore((s) => s.source);
  const autoTranslate = usePdfReaderStore((s) => s.autoTranslate);
  const close = usePdfReaderStore((s) => s.close);
  const [showTranslate, setShowTranslate] = useState(false);

  // The reader is constrained to the content column, so the sidebar stays
  // clickable while reading. When the user navigates to another page, close
  // the reader so that page is actually revealed (otherwise the reader would
  // keep covering the content column over the new route).
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const firstNav = useRef(true);
  useEffect(() => {
    if (firstNav.current) {
      firstNav.current = false;
      return;
    }
    close();
  }, [pathname, close]);

  // Open the translation panel automatically when launched via 翻译.
  useEffect(() => {
    if (open) setShowTranslate(autoTranslate);
  }, [open, source, autoTranslate]);

  // Esc to close + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!open || !source) return null;

  return (
    <div
      className="absolute inset-0 z-modal bg-page flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={source.title}
    >
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border-default bg-card flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon icon={FileText} size="sm" className="text-fg-2 flex-shrink-0" />
          <span className="text-caption font-medium text-fg-1 truncate">
            {source.title}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowTranslate((v) => !v)}
            aria-label={t("translate.title")}
            className={
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border text-meta transition-colors duration-fast ease-khx " +
              (showTranslate
                ? "border-navy text-navy bg-navy-faint"
                : "border-border-default text-fg-2 hover:text-navy hover:border-navy")
            }
          >
            <Icon icon={Languages} size="sm" />
            <span>{t("translate.title")}</span>
          </button>
          <button
            type="button"
            onClick={close}
            aria-label={t("pdf_viewer.close")}
            title={t("pdf_viewer.close")}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border border-border-default text-meta text-fg-2 hover:text-danger-fg hover:border-danger-border hover:bg-danger-bg transition-colors duration-fast ease-khx"
          >
            <Icon icon={X} size="sm" />
            <span>{t("pdf_viewer.close")}</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <PdfViewer
            key={source.path}
            path={source.path}
            paperId={source.paperId ?? undefined}
            paperTitle={source.title ?? undefined}
          />
        </div>
        {showTranslate && (
          <TranslatePanel
            key={source.path}
            paperId={source.paperId}
            filePath={source.path}
            autoStart={autoTranslate}
          />
        )}
      </div>
    </div>
  );
}
