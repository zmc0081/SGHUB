// V2.2.10 (Session 50, R6) — selection-translate popover.
//
// Floats near the selection; streams the translation of the selected text
// through the default model (`ai_chat_stream` → "ai:token" events), with
// copy, retry, and a target-language switch (defaults to the UI language).
// The caller guarantees only ONE ai:token consumer is active at a time.
import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Copy, Languages, Loader2, RefreshCw, X } from "lucide-react";
import i18n from "../../i18n";
import { api, type TokenPayload } from "../../lib/tauri";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import { Icon } from "../Icon";

const TARGETS = [
  { code: "zh-CN", label: "中文", prompt: "Simplified Chinese (简体中文)" },
  { code: "en-US", label: "English", prompt: "English" },
] as const;

function defaultTarget(): string {
  return i18n.language?.startsWith("zh") ? "zh-CN" : "en-US";
}

export function TranslatePopover({
  text,
  x,
  y,
  onClose,
}: {
  text: string;
  /** Anchor (viewport coords) — rendered just below the selection. */
  x: number;
  y: number;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [target, setTarget] = useState(defaultTarget);
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const runRef = useRef(0);

  const run = useCallback(
    async (lang: string) => {
      const runId = ++runRef.current;
      setOutput("");
      setError(null);
      setStreaming(true);
      let unlisten: UnlistenFn | undefined;
      try {
        unlisten = await listen<TokenPayload>("ai:token", (e) => {
          if (runRef.current !== runId) return;
          if (e.payload.text) setOutput((o) => o + e.payload.text);
        });
        const models = await api.getModelConfigs();
        const def = models.find((m) => m.is_default) ?? models[0];
        if (!def) throw new Error(t("chat.no_models"));
        const langName =
          TARGETS.find((v) => v.code === lang)?.prompt ?? "Simplified Chinese";
        await api.aiChatStream(def.id, [
          {
            role: "system",
            content: `You are a professional academic translator. Translate the user's text into ${langName}. Output ONLY the translation — no preamble, no explanations.`,
          },
          { role: "user", content: text },
        ]);
      } catch (err) {
        if (runRef.current === runId) setError(String(err));
      } finally {
        unlisten?.();
        if (runRef.current === runId) setStreaming(false);
      }
    },
    [text, t],
  );

  useEffect(() => {
    void run(target);
    const ref = runRef; // stable container; bump invalidates in-flight streams
    return () => {
      ref.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape / outside pointer-down.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success(t("chat.msg_copied"));
    } catch {
      toast.danger(t("chat.copy_failed"));
    }
  };

  const width = 380;
  const left = Math.max(8, Math.min(x - width / 2, window.innerWidth - width - 8));
  const top = Math.min(y + 8, window.innerHeight - 120);

  return (
    <div
      ref={ref}
      className="fixed z-popover rounded-card-sm border border-border-strong bg-card shadow-nav flex flex-col"
      style={{ left, top, width, maxHeight: 320 }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <Icon icon={Languages} size="sm" className="text-indigo shrink-0" />
        <span className="text-caption font-medium text-fg-1 flex-1">
          {t("pdf_viewer.annot_translate")}
        </span>
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            void run(e.target.value);
          }}
          aria-label={t("pdf_viewer.translate_target")}
          className="text-meta px-2 py-1 rounded-pill border border-border-default bg-card text-fg-1 focus:outline-none focus:border-border-focus transition-colors duration-fast ease-khx"
        >
          {TARGETS.map((v) => (
            <option key={v.code} value={v.code}>
              {v.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={copy}
          disabled={!output}
          aria-label={t("common.copy")}
          title={t("common.copy")}
          className="text-fg-3 hover:text-indigo disabled:opacity-40 transition-colors duration-fast ease-khx"
        >
          <Icon icon={Copy} size="xs" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="text-fg-3 hover:text-fg-1 transition-colors duration-fast ease-khx"
        >
          <Icon icon={X} size="xs" />
        </button>
      </div>

      <div className="px-3 py-2.5 overflow-y-auto text-caption text-fg-1 leading-relaxed whitespace-pre-wrap">
        {error ? (
          <div className="flex items-start gap-2 text-danger-fg">
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => void run(target)}
              className="shrink-0 inline-flex items-center gap-1 text-meta hover:text-indigo transition-colors duration-fast ease-khx"
            >
              <Icon icon={RefreshCw} size={12} />
              <span>{t("common.retry")}</span>
            </button>
          </div>
        ) : (
          <>
            {output}
            {streaming && (
              <span className="inline-flex items-center gap-1.5 text-fg-3 ml-1">
                <Icon icon={Loader2} size={12} className="animate-spin" />
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
