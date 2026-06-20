// V2.2.6 — translation side-panel for the in-app PDF reader.
//
// Runs `translate_document` (default model) and renders the result with
// react-markdown. Two layouts: 整篇替换 (translated only) and 中外对照
// (original ↔ translated, aligned per chunk). Streams progress via the
// `translate:progress` event; supports copy + export.
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Columns2,
  Copy,
  Download,
  FileText,
  Languages,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { api, type TranslateProgressPayload } from "../../lib/tauri";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import i18n from "../../i18n";
import { Icon } from "../Icon";

type Status = "idle" | "running" | "done" | "error";
type Mode = "replace" | "compare";
interface Block {
  original: string;
  translated: string;
}

const TARGET_LANGS = [
  { code: "zh-CN", label: "中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "fr", label: "Français" },
];

export function TranslatePanel({
  paperId,
  filePath,
  autoStart,
}: {
  paperId: string | null;
  filePath: string;
  autoStart: boolean;
}) {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<Mode>("replace");
  const [targetLang, setTargetLang] = useState<string>(
    i18n.language?.startsWith("zh") ? "zh-CN" : "zh-CN",
  );
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const start = useCallback(async () => {
    setStatus("running");
    setError(null);
    setBlocks([]);
    setPercent(0);
    let unlisten: UnlistenFn | undefined;
    try {
      unlisten = await listen<TranslateProgressPayload>(
        "translate:progress",
        (e) => {
          setBlocks((b) => [
            ...b,
            { original: e.payload.original, translated: e.payload.translated },
          ]);
          setPercent(e.payload.percent);
        },
      );
      await api.translateDocument({ paperId, filePath, targetLang, mode });
      setStatus("done");
      setPercent(100);
    } catch (err) {
      setError(String(err));
      setStatus("error");
    } finally {
      unlisten?.();
    }
  }, [paperId, filePath, targetLang, mode]);

  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true;
      void start();
    }
  }, [autoStart, start]);

  const fullText = blocks.map((b) => b.translated).join("\n\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success(t("translate.copied"));
    } catch {
      toast.danger(t("translate.copy_failed"));
    }
  };

  const exportMd = async () => {
    try {
      await api.exportTextFile("translation.md", fullText);
      toast.success(t("translate.exported"));
    } catch (e) {
      toast.danger(String(e));
    }
  };

  const ctrlBtn =
    "inline-flex items-center justify-center h-8 w-8 rounded-pill text-fg-2 hover:text-fg-1 hover:bg-navy-faint disabled:opacity-40 transition-colors duration-fast ease-khx";

  return (
    <div className="flex flex-col h-full w-[44%] min-w-[340px] border-l border-border-default bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default flex-shrink-0 flex-wrap">
        <Icon icon={Languages} size="sm" className="text-navy" />
        <span className="text-caption font-medium text-fg-1">
          {t("translate.title")}
        </span>

        <div className="flex-1" />

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          disabled={status === "running"}
          className="px-2 py-1 rounded-pill border border-border-default bg-card text-fg-1 text-meta focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx disabled:opacity-50"
          aria-label={t("translate.target_lang")}
        >
          {TARGET_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "replace" ? "compare" : "replace"))}
          className={ctrlBtn + (mode === "compare" ? " text-navy bg-navy-faint" : "")}
          title={t(mode === "compare" ? "translate.mode_compare" : "translate.mode_replace")}
          aria-label={t("translate.toggle_mode")}
        >
          <Icon icon={mode === "compare" ? Columns2 : FileText} size="sm" />
        </button>

        <button
          type="button"
          onClick={() => void start()}
          disabled={status === "running"}
          className={ctrlBtn}
          title={t("translate.retranslate")}
          aria-label={t("translate.retranslate")}
        >
          <Icon
            icon={RefreshCw}
            size="sm"
            className={status === "running" ? "animate-spin" : ""}
          />
        </button>

        <button
          type="button"
          onClick={copy}
          disabled={blocks.length === 0}
          className={ctrlBtn}
          title={t("translate.copy")}
          aria-label={t("translate.copy")}
        >
          <Icon icon={Copy} size="sm" />
        </button>
        <button
          type="button"
          onClick={exportMd}
          disabled={blocks.length === 0}
          className={ctrlBtn}
          title={t("translate.export")}
          aria-label={t("translate.export")}
        >
          <Icon icon={Download} size="sm" />
        </button>
      </div>

      {/* Progress */}
      {status === "running" && (
        <div className="px-3 py-2 border-b border-border-default flex items-center gap-2 flex-shrink-0">
          <div className="flex-1 h-1 rounded-pill bg-navy-soft overflow-hidden">
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-full bg-indigo transition-[width] duration-base ease-khx"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-micro text-fg-2 tabular-nums">{percent}%</span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {status === "idle" && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <Icon icon={Languages} size="xl" className="text-fg-3" />
            <p className="text-meta text-fg-2 max-w-xs">{t("translate.idle_hint")}</p>
            <button
              type="button"
              onClick={() => void start()}
              className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill bg-navy text-fg-inverse text-caption font-medium shadow-btn hover:bg-navy-hover hover:-translate-y-px transition-[background,box-shadow,transform] duration-fast ease-khx"
            >
              <Icon icon={Languages} size="sm" />
              <span>{t("translate.start")}</span>
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-4">
            <Icon icon={AlertTriangle} size="lg" className="text-danger-fg" />
            <p className="text-meta text-danger-fg break-words">{error}</p>
            <button
              type="button"
              onClick={() => void start()}
              className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default text-fg-1 text-caption font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
            >
              <Icon icon={RefreshCw} size="sm" />
              <span>{t("translate.retry")}</span>
            </button>
          </div>
        )}

        {(status === "running" || status === "done") &&
          (mode === "compare" ? (
            <div className="flex flex-col gap-4">
              {blocks.map((b, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 gap-3 pb-3 border-b border-border-subtle last:border-b-0"
                >
                  <div className="text-meta text-fg-3 whitespace-pre-wrap leading-relaxed">
                    {b.original}
                  </div>
                  <div className="chat-md prose-sm text-fg-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {b.translated}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {status === "running" && (
                <div className="flex items-center gap-2 text-meta text-fg-3 py-2">
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                  <span>{t("translate.translating")}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="chat-md prose-sm text-fg-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullText}</ReactMarkdown>
              {status === "running" && (
                <div className="flex items-center gap-2 text-meta text-fg-3 py-2">
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                  <span>{t("translate.translating")}</span>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
