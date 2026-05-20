// i18n: 本组件文案已国际化 (V2.1.0)
/**
 * UpdaterCard — fine-grained auto-updater scheduling UI.
 *
 * Lives inside Settings → 隐私与更新. Every config change is saved to
 * the backend immediately (no save button) which also reschedules the
 * cron job — see `setUpdaterConfig` in src/lib/tauri.ts.
 *
 * "Next scheduled check" is computed entirely on the frontend from the
 * backend-supplied cron expression + the user's selected check_time,
 * so the user sees feedback the instant they change the schedule even
 * before the next IPC round-trip.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { api, type UpdaterConfig, type UpdaterStatus } from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";
import { Icon } from "./Icon";

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

/** Compute the next firing of "HH:MM" weekly mask (or daily-every-N). */
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
    const mask = cfg.frequency_value & 0x7f;
    if (mask === 0) return null;
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

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 items-center rounded-pill transition-colors duration-fast ease-khx focus:outline-none focus-visible:shadow-focus ${
        checked ? "bg-indigo" : "bg-border-strong"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full bg-card shadow-card-sm transform transition-transform duration-fast ease-khx ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function UpdaterCard({ initial, onChange }: Props) {
  const t = useT();
  const toast = useToast();
  const [cfg, setCfg] = useState<UpdaterConfig>(initial);
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [inlineHint, setInlineHint] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const isFirstRun = useRef(true);

  const refreshStatus = useCallback(() => {
    void api
      .getUpdaterStatus()
      .then(setStatus)
      .catch((e) => toast.danger(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .catch((e) => toast.danger(String(e)));
      onChange?.(cfg);
    }, 250);
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [cfg, onChange, refreshStatus, toast]);

  const patch = (changes: Partial<UpdaterConfig>) =>
    setCfg((c) => ({ ...c, ...changes }));

  const onFrequencyTypeChange = (kind: "daily" | "weekly") => {
    if (kind === "daily")
      patch({ frequency_type: "daily", frequency_value: 7 });
    else patch({ frequency_type: "weekly", frequency_value: 1 + 4 + 16 });
  };

  const onDailyValueChange = (n: number) => {
    const clamped = Math.max(1, Math.min(30, isNaN(n) ? 1 : Math.floor(n)));
    patch({ frequency_value: clamped });
  };

  const toggleWeekday = (bit: number) => {
    const next = cfg.frequency_value ^ bit;
    if ((next & 0x7f) === 0) return;
    patch({ frequency_value: next & 0x7f });
  };

  const doCheckNow = async () => {
    setChecking(true);
    setInlineHint(null);
    try {
      const r = await api.checkUpdateNow();
      if (!r.had_update) {
        setInlineHint(t("settings.updater_no_update"));
        window.setTimeout(() => setInlineHint(null), 3000);
      }
      refreshStatus();
    } catch (e) {
      toast.danger(t("settings.updater_check_failed", { detail: String(e) }));
    } finally {
      setChecking(false);
    }
  };

  const doInstallNow = async () => {
    setInstalling(true);
    try {
      await api.installPendingUpdate();
      refreshStatus();
    } catch (e) {
      toast.danger(t("settings.updater_install_failed", { detail: String(e) }));
    } finally {
      setInstalling(false);
    }
  };

  const nextAt = useMemo(
    () => (cfg.enabled ? nextCheckAt(cfg) : null),
    [cfg],
  );

  const disabledClass = cfg.enabled
    ? ""
    : "opacity-50 pointer-events-none transition-opacity duration-base ease-khx";

  return (
    <div className="bg-card rounded-card shadow-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h3 font-semibold text-fg-1">
            {t("settings.updater_section")}
          </h2>
          <p className="text-caption text-fg-2 mt-1">
            {t("settings.updater_section_desc")}
          </p>
        </div>
        <Toggle
          checked={cfg.enabled}
          onChange={(v) => patch({ enabled: v })}
          label={t("settings.updater_enabled")}
        />
      </div>

      <div className={`mt-5 space-y-5 ${disabledClass}`}>
        <div>
          <div className="text-caption font-medium text-fg-1 mb-2">
            {t("settings.updater_frequency")}
          </div>
          <div className="flex items-center gap-5">
            <label className="inline-flex items-center gap-2 cursor-pointer text-caption">
              <input
                type="radio"
                name="upd-freq"
                checked={cfg.frequency_type === "daily"}
                onChange={() => onFrequencyTypeChange("daily")}
                className="accent-indigo"
              />
              <span
                className={
                  cfg.frequency_type === "daily"
                    ? "text-indigo font-medium"
                    : "text-fg-1"
                }
              >
                {t("settings.updater_freq_daily")}
              </span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-caption">
              <input
                type="radio"
                name="upd-freq"
                checked={cfg.frequency_type === "weekly"}
                onChange={() => onFrequencyTypeChange("weekly")}
                className="accent-indigo"
              />
              <span
                className={
                  cfg.frequency_type === "weekly"
                    ? "text-indigo font-medium"
                    : "text-fg-1"
                }
              >
                {t("settings.updater_freq_weekly")}
              </span>
            </label>
          </div>

          <div className="mt-3">
            {cfg.frequency_type === "daily" ? (
              <div className="inline-flex items-center gap-2 text-caption text-fg-1">
                <span>{t("settings.updater_daily_every")}</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={cfg.frequency_value}
                  onChange={(e) => onDailyValueChange(Number(e.target.value))}
                  className="w-20 px-3 py-1.5 rounded-pill border border-border-default bg-card text-fg-1 text-center focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
                />
                <span>{t("settings.updater_daily_days")}</span>
              </div>
            ) : (
              <div>
                <div className="text-meta text-fg-2 mb-2">
                  {t("settings.updater_weekly_choose")}
                </div>
                <div role="group" className="flex flex-wrap gap-2">
                  {WEEKDAY_BITS.map((d) => {
                    const checked = (cfg.frequency_value & d.bit) !== 0;
                    return (
                      <button
                        key={d.bit}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleWeekday(d.bit)}
                        className={`inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-meta border transition-colors duration-fast ease-khx ${
                          checked
                            ? "bg-indigo-soft border-indigo-muted text-indigo"
                            : "bg-card border-border-default text-fg-2 hover:border-indigo-muted"
                        }`}
                      >
                        {checked && <Icon icon={Check} size={12} />}
                        <span>{t(d.key)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-caption font-medium text-fg-1 mb-2">
            {t("settings.updater_check_time")}
            <span className="ml-2 text-meta text-fg-3 font-normal">
              {t("settings.updater_check_time_hint")}
            </span>
          </div>
          <div className="relative inline-block">
            <select
              value={cfg.check_time}
              onChange={(e) => patch({ check_time: e.target.value })}
              className="appearance-none pl-input-x pr-9 py-input-y rounded-pill border border-border-default bg-card text-fg-1 text-caption focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
            >
              {TIME_OPTIONS.map((tv) => (
                <option key={tv} value={tv}>
                  {tv}
                </option>
              ))}
            </select>
            <Icon
              icon={ChevronDown}
              size="sm"
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
            />
          </div>
        </div>

        <div>
          <div className="text-caption font-medium text-fg-1 mb-2">
            {t("settings.updater_action_label")}
          </div>
          <div className="flex flex-col gap-2">
            {ACTIONS.map((a) => (
              <label
                key={a.value}
                className="inline-flex items-center gap-2 cursor-pointer text-caption text-fg-1"
              >
                <input
                  type="radio"
                  name="upd-action"
                  checked={cfg.action === a.value}
                  onChange={() => patch({ action: a.value })}
                  className="accent-indigo"
                />
                <span>{t(a.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border-default mt-5 pt-5">
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-caption">
          <dt className="text-fg-2">{t("settings.updater_status_current")}</dt>
          <dd className="font-mono text-fg-1">
            {status?.current_version ?? "—"}
          </dd>

          <dt className="text-fg-2">
            {t("settings.updater_status_last_check")}
          </dt>
          <dd className="text-fg-1">
            {status?.last_check_at
              ? formatLocal(new Date(status.last_check_at))
              : t("settings.updater_status_never")}
          </dd>

          <dt className="text-fg-2">
            {t("settings.updater_status_next_check")}
          </dt>
          <dd className="text-fg-1">
            {!cfg.enabled
              ? t("settings.updater_status_not_scheduled")
              : nextAt
                ? formatLocal(nextAt)
                : "—"}
          </dd>

          {status?.has_pending_update && status.pending && (
            <>
              <dt className="text-fg-2">
                {t("settings.updater_status_pending")}
              </dt>
              <dd>
                <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-improve-bg text-badge-improve-fg">
                  <Icon icon={RefreshCw} size="xs" />
                  v{status.pending.version}
                </span>
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={doCheckNow}
          disabled={checking}
          className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 transition-colors duration-fast ease-khx"
        >
          {checking ? (
            <Icon icon={Loader2} size="sm" className="animate-spin" />
          ) : (
            <Icon icon={RefreshCw} size="sm" />
          )}
          {checking
            ? t("settings.updater_btn_checking")
            : t("settings.updater_btn_check_now")}
        </button>
        {status?.has_pending_update && (
          <button
            type="button"
            onClick={doInstallNow}
            disabled={installing}
            className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
          >
            {installing && (
              <Icon icon={Loader2} size="sm" className="animate-spin" />
            )}
            {installing
              ? t("settings.updater_btn_installing")
              : t("settings.updater_btn_install_now")}
          </button>
        )}
      </div>

      {inlineHint && (
        <div className="mt-3 text-caption text-info-fg bg-info-bg border border-info-border rounded-card-sm p-3">
          {inlineHint}
        </div>
      )}
    </div>
  );
}
