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

import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  type DownloadProgressPayload,
  type Paper,
} from "../lib/tauri";
import { useAppNavigation } from "../hooks/useAppNavigation";
import { FavoriteButton } from "./FavoriteButton";

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
        setError("已取消");
        setTimeout(() => setError(null), 2200);
      } else if (status === "error") {
        setDownloading(false);
        setProgress(0);
        setError(err ?? "下载失败");
        setTimeout(() => setError(null), 4200);
      }
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
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
      if (!url) setError("该文献无可用的原文链接");
      else setError(null);
    } catch (e) {
      setError(`打开失败: ${e}`);
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
      // it doesn't surface twice.
      const msg = String(e);
      if (!msg.includes("已取消")) {
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
      setError(`打开失败: ${e}`);
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
        🧠 AI 精读
      </button>

      <button
        onClick={onOpenExternal}
        className={`${btnBase} ${btnNormal}`}
        title="在浏览器打开原文"
      >
        📄 原文
      </button>

      {/* Download / local-open / progress */}
      {localPath ? (
        <button
          onClick={onOpenLocal}
          className={`${btnBase} ${btnNormal}`}
          title={localPath}
        >
          📂 打开 PDF
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
            title="取消"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={onDownload}
          disabled={!oa}
          className={`${btnBase} ${oa ? btnNormal : btnDisabled}`}
          title={oa ? "下载 PDF" : "非开放获取,无法下载"}
        >
          📥 下载 PDF
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
