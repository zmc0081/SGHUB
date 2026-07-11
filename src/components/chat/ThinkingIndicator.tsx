// V2.2.10 (Session 48, R4) — "Thinking…" bubble shown between sending a
// message and the first streamed token, so a slow model never looks like a
// dropped message. Live seconds counter; after 90s an extra "still waiting"
// line appears (without interrupting). Pure-CSS motion via tailwind's
// built-in spin keyframes (no blanket transition utility).
import { useEffect, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { useT } from "../../hooks/useT";
import { Icon } from "../Icon";

const LONG_WAIT_SECONDS = 90;

/** "45秒" under a minute, "1分23秒" from there up (localised). */
export function formatDuration(
  totalSeconds: number,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return t("chat.duration_sec", { s });
  return t("chat.duration_min_sec", { m: Math.floor(s / 60), s: s % 60 });
}

export function ThinkingIndicator({ startedAt }: { startedAt: number }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));

  return (
    <div className="flex gap-3 flex-row mb-5">
      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-indigo-soft text-indigo">
        <Icon icon={Bot} size="xs" />
      </div>
      <div className="rounded-card-sm px-4 py-3 inline-block bg-card border border-border-default shadow-card-sm">
        <span className="inline-flex items-center gap-2 text-caption text-fg-2">
          <Icon
            icon={Loader2}
            size="sm"
            className="animate-spin text-indigo"
            aria-hidden
          />
          <span>
            {t("chat.thinking")}{" "}
            <span className="tabular-nums text-fg-3">
              {formatDuration(seconds, t)}
            </span>
          </span>
        </span>
        {seconds >= LONG_WAIT_SECONDS && (
          <div className="mt-1.5 text-meta text-fg-3">
            {t("chat.thinking_waiting")}
          </div>
        )}
      </div>
    </div>
  );
}
