// i18n: 本组件文案已国际化 (V2.1.0)
/**
 * UpdaterCard — fine-grained auto-updater scheduling UI (V2.1.0).
 *
 * Lives inside Settings → 🔒 隐私与更新. Every config change is saved
 * to the backend immediately (no save button) which also reschedules
 * the cron job — see `setUpdaterConfig` in src/lib/tauri.ts.
 *
 * "Next scheduled check" is computed entirely on the frontend from the
 * backend-supplied cron expression + the user's selected check_time,
 * so the user sees feedback the instant they change the schedule even
 * before the next IPC round-trip.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type UpdaterConfig, type UpdaterStatus } from "../lib/tauri";
import { useT } from "../hooks/useT";

interface Props {
  initial: UpdaterConfig;
  /** Bubbled up so the parent (Settings page) can keep its local copy
   *  of AppConfig in sync. */
  onChange?: (next: UpdaterConfig) => void;
}

const WEEKDAY_BITS: Array<{ bit: number; key: string }> = [
  { bit: 1 << 0, key: "settings.weekday_mon" },
  { bit: 1 << 1, key: "settings.weekday_tue" },
  { bit: 1 << 2, key: "settings.weekday_wed" },
  { bit: 1 << 3, key: "settings.weekday_thu" },
  { bit: 1 << 4, key: "settings.weekday_fri" },
  { bit: 1 << 5, key: "settings.weekday_sat" },
  { bit: 1 << 6, key: "settings.weekday_sun" },
];

const ACTIONS = [
  { value: "notify", labelKey: "settings.updater_action_notify" },
  { value: "silent_download", labelKey: "settings.updater_action_silent" },
  { value: "check_only", labelKey: "settings.updater_action_check" },
];

/** "HH:MM" steps every 15 minutes — 96 entries. */
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

// ============================================================
// Pure helpers
// ============================================================

/** Compute the next firing of "HH:MM" weekly mask (or daily-every-N).
 *  Returns a JS `Date` in the user's local timezone, or null when the
 *  schedule has no valid next firing (e.g. empty weekly mask). */
export function nextCheckAt(
  cfg: UpdaterConfig,
  now: Date = new Date(),
): Date | null {
  const [hh, mm] = cfg.check_time.split(":").map((s) => Number(s));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const today = new Date(now);
  today.setHours(hh, mm, 0, 0);
  const ahead = today.getTime() > now.getTime();

  if (cfg.frequency_type === "daily") {
    const n = Math.max(1, Math.min(30, cfg.frequency_value || 1));
    // If today's slot hasn't passed → today; else add a day and walk
    // until we land on a day-of-month aligned with the cron `*/N`
    // semantics (cron resets at day 1 of the month).
    const candidate = new Date(today);
    if (!ahead) candidate.setDate(candidate.getDate() + 1);
    if (n === 1) return candidate;
    while (true) {
      const dom = candidate.getDate();
      if ((dom - 1) % n === 0) return candidate;
      candidate.setDate(candidate.getDate() + 1);
    }
  }

  if (cfg.frequency_type === "weekly") {
    const mask = cfg.frequency_value & 0x7F;
    if (mask === 0) return null;
    // JS getDay(): Sun=0 Mon=1 .. Sat=6.  Our bitmask: Mon=bit0 .. Sun=bit6.
    const toBit = (jsDay: number) => 1 << ((jsDay + 6) % 7);
    const candidate = new Date(today);
    if (!ahead) candidate.setDate(candidate.getDate() + 1);
    for (let i = 0; i < 7; i++) {
      if (mask & toBit(candidate.getDay())) return candidate;
      candidate.setDate(candidate.getDate() + 1);
    }
    return null;
  }

  return null;
}

function formatLocal(d: Date): string {
  return d.toLocaleString();
}

// ============================================================
// Component
// ============================================================

export function UpdaterCard({ initial, onChange }: Props) {
  const t = useT();
  const [cfg, setCfg] = useState<UpdaterConfig>(initial);
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Debounce save-on-change so dragging the time slider doesn't spam IPC.
  const saveTimer = useRef<number | null>(null);
  // Skip the save effect's first run — cfg equals `initial`, the
  // backend already has that value. Without this guard the component
  // mount triggers a redundant IPC + reschedule.
  const isFirstRun = useRef(true);

  // Intentionally NO re-sync from `initial` — once we're mounted this
  // component owns the cfg state. Re-syncing on every parent re-render
  // creates a save→onChange→setConfig→re-render→reset→save loop because
  // every `setConfig` produces a new object reference.

  const refreshStatus = useCallback(() => {
    void api
      .getUpdaterStatus()
      .then(setStatus)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Persist + reschedule whenever the config changes.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      void api
        .setUpdaterConfig(cfg)
        .then(refreshStatus)
        .catch((e) => setErr(String(e)));
      onChange?.(cfg);
    }, 250);
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [cfg, onChange, refreshStatus]);

  // ============================================================
  // Mutators
  // ============================================================

  const patch = (changes: Partial<UpdaterConfig>) =>
    setCfg((c) => ({ ...c, ...changes }));

  const onToggleEnabled = (enabled: boolean) => patch({ enabled });

  const onFrequencyTypeChange = (kind: "daily" | "weekly") => {
    // When switching mode, swap to a sensible default value so we don't
    // carry a stale bitmask into daily mode or a "7" into weekly mode.
    if (kind === "daily") patch({ frequency_type: "daily", frequency_value: 7 });
    else patch({ frequency_type: "weekly", frequency_value: 1 + 4 + 16 }); // Mon Wed Fri
  };

  const onDailyValueChange = (n: number) => {
    const clamped = Math.max(1, Math.min(30, isNaN(n) ? 1 : Math.floor(n)));
    patch({ frequency_value: clamped });
  };

  const toggleWeekday = (bit: number) => {
    const next = cfg.frequency_value ^ bit;
    // Enforce "at least one day" — refuse the toggle if it would clear
    // every bit, otherwise the backend rejects the schedule.
    if ((next & 0x7F) === 0) return;
    patch({ frequency_value: next & 0x7F });
  };

  // ============================================================
  // Actions
  // ============================================================

  const doCheckNow = async () => {
    setChecking(true);
    setErr(null);
    setToast(null);
    try {
      const r = await api.checkUpdateNow();
      if (!r.had_update) setToast(t("settings.updater_no_update"));
      refreshStatus();
    } catch (e) {
      setErr(t("settings.updater_check_failed", { detail: String(e) }));
    } finally {
      setChecking(false);
    }
  };

  const doInstallNow = async () => {
    setInstalling(true);
    setErr(null);
    try {
      await api.installPendingUpdate();
      refreshStatus();
    } catch (e) {
      setErr(t("settings.updater_install_failed", { detail: String(e) }));
    } finally {
      setInstalling(false);
    }
  };

  // ============================================================
  // Derived UI
  // ============================================================

  const nextAt = useMemo(
    () => (cfg.enabled ? nextCheckAt(cfg) : null),
    [cfg],
  );

  // Subtle disabled treatment when master switch is off.
  const disabledClass = cfg.enabled ? "" : "opacity-40 pointer-events-none";

  return (
    <div className="bg-white rounded border border-black/10 px-6 py-4 space-y-4">
      {/* Title + master switch */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">
          {t("settings.updater_section")}
        </h2>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">{t("settings.updater_enabled")}</span>
        </label>
      </div>

      {/* Frequency row */}
      <div className={`space-y-2 transition-opacity ${disabledClass}`}>
        <div className="text-xs text-app-fg/60">
          {t("settings.updater_frequency")}
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="upd-freq"
              checked={cfg.frequency_type === "daily"}
              onChange={() => onFrequencyTypeChange("daily")}
            />
            <span className="text-sm">{t("settings.updater_freq_daily")}</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="upd-freq"
              checked={cfg.frequency_type === "weekly"}
              onChange={() => onFrequencyTypeChange("weekly")}
            />
            <span className="text-sm">{t("settings.updater_freq_weekly")}</span>
          </label>
        </div>

        {/* Daily input — smoothly swap with weekly checkboxes */}
        <div className="transition-all">
          {cfg.frequency_type === "daily" ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-app-fg/70">
                {t("settings.updater_daily_every")}
              </span>
              <input
                type="number"
                min={1}
                max={30}
                value={cfg.frequency_value}
                onChange={(e) => onDailyValueChange(Number(e.target.value))}
                className="w-16 px-2 py-1 border border-black/10 rounded text-sm"
              />
              <span className="text-app-fg/70">
                {t("settings.updater_daily_days")}
              </span>
            </div>
          ) : (
            <div>
              <div className="text-xs text-app-fg/60 mb-1.5">
                {t("settings.updater_weekly_choose")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_BITS.map((d) => {
                  const checked = (cfg.frequency_value & d.bit) !== 0;
                  return (
                    <button
                      key={d.bit}
                      onClick={() => toggleWeekday(d.bit)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-black/10 text-app-fg/60 hover:border-primary/30"
                      }`}
                    >
                      {checked ? "✓ " : ""}
                      {t(d.key)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Check time */}
      <div className={`space-y-1.5 ${disabledClass}`}>
        <div className="text-xs text-app-fg/60">
          {t("settings.updater_check_time")}
          <span className="ml-1 text-app-fg/40">
            {t("settings.updater_check_time_hint")}
          </span>
        </div>
        <select
          value={cfg.check_time}
          onChange={(e) => patch({ check_time: e.target.value })}
          className="px-2 py-1 border border-black/10 rounded text-sm bg-white"
        >
          {TIME_OPTIONS.map((t2) => (
            <option key={t2} value={t2}>
              {t2}
            </option>
          ))}
        </select>
      </div>

      {/* Action when update is found */}
      <div className={`space-y-1.5 ${disabledClass}`}>
        <div className="text-xs text-app-fg/60">
          {t("settings.updater_action_label")}
        </div>
        <div className="flex flex-col gap-1">
          {ACTIONS.map((a) => (
            <label
              key={a.value}
              className="inline-flex items-center gap-2 cursor-pointer text-sm"
            >
              <input
                type="radio"
                name="upd-action"
                checked={cfg.action === a.value}
                onChange={() => patch({ action: a.value })}
              />
              <span>{t(a.labelKey)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Status block */}
      <div className="border-t border-black/5 pt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-app-fg/60">{t("settings.updater_status_current")}</div>
        <div className="font-mono">{status?.current_version ?? "—"}</div>

        <div className="text-app-fg/60">{t("settings.updater_status_last_check")}</div>
        <div>
          {status?.last_check_at
            ? formatLocal(new Date(status.last_check_at))
            : t("settings.updater_status_never")}
        </div>

        <div className="text-app-fg/60">{t("settings.updater_status_next_check")}</div>
        <div>
          {!cfg.enabled
            ? t("settings.updater_status_not_scheduled")
            : nextAt
              ? formatLocal(nextAt)
              : "—"}
        </div>

        {status?.has_pending_update && status.pending && (
          <>
            <div className="text-app-fg/60">
              {t("settings.updater_status_pending")}
            </div>
            <div className="font-mono text-emerald-700">
              v{status.pending.version}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={doCheckNow}
          disabled={checking}
          className="px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
        >
          {checking
            ? t("settings.updater_btn_checking")
            : t("settings.updater_btn_check_now")}
        </button>
        {status?.has_pending_update && (
          <button
            onClick={doInstallNow}
            disabled={installing}
            className="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {installing
              ? t("settings.updater_btn_installing")
              : t("settings.updater_btn_install_now")}
          </button>
        )}
        {toast && (
          <span className="text-xs text-emerald-700 ml-1">{toast}</span>
        )}
        {err && <span className="text-xs text-red-600 ml-1">{err}</span>}
      </div>
    </div>
  );
}
