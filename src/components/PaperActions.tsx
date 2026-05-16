/**
 * PaperActions — single row of paper-level actions used everywhere:
 * Search, Feed, Library, and (eventually) detail pages.
 *
 * Provides:
 *  - ⭐ FavoriteButton          (folder picker)
 *  - 🧠 AI 精读                (navigate to /parse?paper_id=…)
 *  - 📄 原文 / 📂 打开 PDF      (resolve_paper_url or open local PDF)
 *  - 📥 下载 PDF / progress bar (OA only; subscribes to download:progress)
 *
 * The component owns its own download progress state so multiple cards
 * can be downloading simultaneously and each one shows its own bar.
 */

// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  type DownloadProgressPayload,
  type Paper,
} from "../lib/tauri";
import { useAppNavigation } from "../hooks/useAppNavigation";
import { FavoriteButton } from "./FavoriteButton";
import { useT } from "../hooks/useT";

interface Props {
  paper: Paper;
  /** Defaults true. Drop the ⭐ button when the host already renders one
   *  (e.g. Library page where the chip is part of the card header). */
  showFavorite?: boolean;
  /** Compact = icon-only chips; full = labelled chips with more padding. */
  size?: "sm" | "md";
}

// ============================================================
// Helpers
// ============================================================

/** Open-access heuristic — same gate the backend uses for `pdf_url_for`. */
function isLikelyOA(paper: Paper): boolean {
  if (paper.source === "arxiv" && paper.source_id) return true;
  if (paper.source_url?.toLowerCase().endsWith(".pdf")) return true;
  return false;
}

// ============================================================
// Component
// ============================================================

export function PaperActions({
  paper,
  showFavorite = true,
  size = "sm",
}: Props) {
  const t = useT();
  const nav = useAppNavigation();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [localPath, setLocalPath] = useState<string | null>(paper.pdf_path);
  const [error, setError] = useState<string | null>(null);

  // Wire to global download:progress events filtered by paper_id.
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<DownloadProgressPayload>("download:progress", (event) => {
      if (event.payload.paper_id !== paper.id) return;
      const { status, percent, path, error: err } = event.payload;
      if (status === "downloading") {
        setDownloading(true);
        if (percent >= 0) setProgress(percent);
      } else if (status === "done") {
        setDownloading(false);
        setProgress(100);
        if (path) setLocalPath(path);
        setError(null);
      } else if (status === "cancelled") {
        setDownloading(false);
        setProgress(0);
        setError(t("paper_actions.download_cancelled"));
        setTimeout(() => setError(null), 2200);
      } else if (status === "error") {
        setDownloading(false);
        setProgress(0);
        setError(err ?? t("paper_actions.download_failed"));
        setTimeout(() => setError(null), 4200);
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.id]);

  // ============================================================
  // Action handlers
  // ============================================================

  const onOpenParse = () => {
    void nav.openParseWithPaper(paper.id);
  };

  const onOpenExternal = async () => {
    try {
      const url = await nav.openPaperExternal(paper.id);
      if (!url) setError(t("paper_actions.no_source_url"));
      else setError(null);
    } catch (e) {
      setError(t("paper_actions.open_failed", { detail: String(e) }));
    }
    if (error) setTimeout(() => setError(null), 2500);
  };

  const onDownload = async () => {
    setError(null);
    setDownloading(true);
    setProgress(0);
    try {
      const path = await nav.downloadPaperPdf(paper.id);
      setLocalPath(path);
    } catch (e) {
      // The error event already triggered the UI message; swallow here so
      // it doesn't surface twice. Detect the cancellation marker in either
      // language so we don't double-display.
      const msg = String(e);
      const cancelled = t("paper_actions.download_cancelled");
      if (!msg.includes(cancelled) && !msg.includes("Cancelled") && !msg.includes("已取消")) {
        setError(msg);
        setTimeout(() => setError(null), 4200);
      }
    } finally {
      setDownloading(false);
    }
  };

  const onCancel = () => {
    void nav.cancelDownload(paper.id);
  };

  const onOpenLocal = async () => {
    if (!localPath) return;
    try {
      await nav.openLocalPdf(localPath);
    } catch (e) {
      setError(t("paper_actions.open_failed", { detail: String(e) }));
      setTimeout(() => setError(null), 2500);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  const btnBase =
    size === "sm"
      ? "px-2 py-1 rounded border text-xs transition-colors"
      : "px-2.5 py-1.5 rounded border text-sm transition-colors";
  const btnNormal =
    "border-black/10 hover:border-primary/30 hover:bg-primary/5 text-app-fg/80";
  const btnDisabled = "border-black/10 opacity-40 cursor-not-allowed";

  const oa = isLikelyOA(paper);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {showFavorite && (
        <FavoriteButton paperId={paper.id} variant="compact" />
      )}

      <button onClick={onOpenParse} className={`${btnBase} ${btnNormal}`}>
        {t("paper_actions.ai_read")}
      </button>

      <button
        onClick={onOpenExternal}
        className={`${btnBase} ${btnNormal}`}
        title={t("paper_actions.view_source_title")}
      >
        {t("paper_actions.view_source")}
      </button>

      {/* Download / local-open / progress */}
      {localPath ? (
        <button
          onClick={onOpenLocal}
          className={`${btnBase} ${btnNormal}`}
          title={localPath}
        >
          {t("paper_actions.open_pdf")}
        </button>
      ) : downloading ? (
        <div className="inline-flex items-center gap-1.5 text-xs">
          <div className="w-24 h-2 bg-black/10 rounded overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: progress >= 0 ? `${progress}%` : "30%",
              }}
            />
          </div>
          <span className="text-app-fg/60 tabular-nums">
            {progress >= 0 ? `${progress}%` : "…"}
          </span>
          <button
            onClick={onCancel}
            className="text-red-600 hover:underline"
            title={t("paper_actions.cancel_title")}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={onDownload}
          disabled={!oa}
          className={`${btnBase} ${oa ? btnNormal : btnDisabled}`}
          title={
            oa
              ? t("paper_actions.download_title")
              : t("paper_actions.not_oa_title")
          }
        >
          {t("paper_actions.download_pdf")}
        </button>
      )}

      {error && (
        <span className="text-[11px] text-red-600 ml-1" title={error}>
          ⚠ {error.length > 30 ? error.slice(0, 30) + "…" : error}
        </span>
      )}
    </div>
  );
}
