/**
 * PaperActions — single row of paper-level actions used everywhere:
 * Search, Feed, Library, and (eventually) detail pages.
 *
 * Provides:
 *  - FavoriteButton             (folder picker)
 *  - AI 精读                    (navigate to /parse?paper_id=…)
 *  - 原文 / 打开 PDF            (resolve_paper_url or open local PDF)
 *  - 下载 PDF / progress bar    (OA only; subscribes to download:progress)
 *
 * The component owns its own download progress state so multiple cards
 * can be downloading simultaneously and each one shows its own bar.
 */

// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  AlertTriangle,
  Brain,
  Download,
  FileText,
  FolderOpen,
  X,
} from "lucide-react";
import {
  type DownloadProgressPayload,
  type Paper,
} from "../lib/tauri";
import { useAppNavigation } from "../hooks/useAppNavigation";
import { FavoriteButton } from "./FavoriteButton";
import { useT } from "../hooks/useT";
import { Icon } from "./Icon";

interface Props {
  paper: Paper;
  /** Defaults true. Drop the ⭐ button when the host already renders one
   *  (e.g. Library page where the chip is part of the card header). */
  showFavorite?: boolean;
  /** Compact = icon-only chips; full = labelled chips with more padding. */
  size?: "sm" | "md";
}

/** Open-access heuristic — same gate the backend uses for `pdf_url_for`. */
function isLikelyOA(paper: Paper): boolean {
  if (paper.source === "arxiv" && paper.source_id) return true;
  if (paper.source_url?.toLowerCase().endsWith(".pdf")) return true;
  return false;
}

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
      const msg = String(e);
      const cancelled = t("paper_actions.download_cancelled");
      if (
        !msg.includes(cancelled) &&
        !msg.includes("Cancelled") &&
        !msg.includes("已取消")
      ) {
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

  // Sizing tokens (sm = Library dense rows, md = Search/Feed cards).
  const isSm = size === "sm";
  const iconSize = isSm ? "xs" : "sm";
  const btnHeight = isSm ? "h-7" : "h-8";
  const btnPadX = isSm ? "px-2.5" : "px-3";
  const btnTextSize = isSm ? "text-meta" : "text-caption";
  const progressBarW = isSm ? "w-20" : "w-24";

  const btnBase = `inline-flex items-center gap-1.5 ${btnHeight} ${btnPadX} rounded-pill border ${btnTextSize} transition-colors duration-fast ease-khx`;
  const btnNormal =
    "border-border-default text-fg-2 hover:text-indigo hover:bg-indigo-soft hover:border-indigo-muted";
  const btnDisabled =
    "border-border-default text-fg-3 bg-soft cursor-not-allowed opacity-60";

  const oa = isLikelyOA(paper);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showFavorite && (
        <FavoriteButton paperId={paper.id} variant="compact" size={size} />
      )}

      <button
        type="button"
        aria-label={t("paper_actions.ai_read")}
        onClick={onOpenParse}
        className={`${btnBase} ${btnNormal}`}
      >
        <Icon icon={Brain} size={iconSize} />
        <span>{t("paper_actions.ai_read")}</span>
      </button>

      <button
        type="button"
        aria-label={t("paper_actions.view_source_title")}
        onClick={onOpenExternal}
        className={`${btnBase} ${btnNormal}`}
        title={t("paper_actions.view_source_title")}
      >
        <Icon icon={FileText} size={iconSize} />
        <span>{t("paper_actions.view_source")}</span>
      </button>

      {localPath ? (
        <button
          type="button"
          onClick={onOpenLocal}
          className={`${btnBase} ${btnNormal}`}
          title={localPath}
        >
          <Icon icon={FolderOpen} size={iconSize} />
          <span>{t("paper_actions.open_pdf")}</span>
        </button>
      ) : downloading ? (
        <div
          className={`inline-flex items-center gap-2 ${btnHeight} ${btnPadX} rounded-pill border border-border-default ${btnTextSize}`}
        >
          <div
            className={`${progressBarW} h-1 rounded-pill bg-navy-soft overflow-hidden`}
          >
            <div
              role="progressbar"
              aria-valuenow={Math.max(0, progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-full bg-indigo transition-[width] duration-base ease-khx"
              style={{ width: progress >= 0 ? `${progress}%` : "30%" }}
            />
          </div>
          <span className="text-meta text-fg-2 tabular-nums">
            {progress >= 0 ? `${progress}%` : "…"}
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("paper_actions.cancel_title")}
            title={t("paper_actions.cancel_title")}
            className="text-danger-fg hover:bg-danger-bg rounded-pill p-0.5 transition-colors duration-fast ease-khx"
          >
            <Icon icon={X} size="xs" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onDownload}
          disabled={!oa}
          aria-label={
            oa
              ? t("paper_actions.download_title")
              : t("paper_actions.not_oa_title")
          }
          className={`${btnBase} ${oa ? btnNormal : btnDisabled}`}
          title={
            oa
              ? t("paper_actions.download_title")
              : t("paper_actions.not_oa_title")
          }
        >
          <Icon icon={Download} size={iconSize} />
          <span>{t("paper_actions.download_pdf")}</span>
        </button>
      )}

      {error && (
        <span
          role="alert"
          aria-live="polite"
          title={error}
          className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 bg-danger-bg text-danger-fg text-meta transition-opacity duration-base ease-khx"
        >
          <Icon icon={AlertTriangle} size="xs" />
          <span>{error.length > 30 ? error.slice(0, 30) + "…" : error}</span>
        </span>
      )}
    </div>
  );
}
