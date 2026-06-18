// i18n: 本组件文案已国际化 (V2.1.0; 简化 V2.2.5)
/**
 * UpdaterCard — the combined "隐私与更新" settings card.
 *
 * V2.2.5 simplification: the fine-grained scheduler UI (toggle /
 * frequency / time / action / last-&-next-check) is gone. What remains:
 *   - top-right「立即检查」button (manual check)
 *   - current version (from package_info → tauri.conf.json)
 *   - an "install" affordance when an update was found
 *   - a divider, then the privacy-policy entry (Opt②) — opens the
 *     existing bilingual PrivacyPolicyDialog.
 *
 * The background check now runs once on startup (see updater::scheduler);
 * there is no per-user schedule to configure here.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { api, type UpdaterStatus } from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";
import { Icon } from "./Icon";
import { PrivacyPolicyDialog } from "./PrivacyPolicyDialog";

export function UpdaterCard() {
  const t = useT();
  const toast = useToast();
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [inlineHint, setInlineHint] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const refreshStatus = useCallback(() => {
    void api
      .getUpdaterStatus()
      .then(setStatus)
      .catch((e) => toast.danger(String(e)));
  }, [toast]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

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

  return (
    <section
      aria-labelledby="settings-updater-heading"
      className="bg-card rounded-card shadow-card p-6"
    >
      {/* Header: title + top-right 立即检查 */}
      <div className="flex items-start justify-between gap-3">
        <h2
          id="settings-updater-heading"
          className="text-h3 font-semibold text-fg-1"
        >
          {t("settings.updater_section")}
        </h2>
        <button
          type="button"
          onClick={doCheckNow}
          disabled={checking}
          className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo disabled:opacity-50 transition-colors duration-fast ease-khx"
        >
          <Icon
            icon={checking ? Loader2 : RefreshCw}
            size="sm"
            className={checking ? "animate-spin" : ""}
          />
          {checking
            ? t("settings.updater_btn_checking")
            : t("settings.updater_btn_check_now")}
        </button>
      </div>

      {/* Current version */}
      <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-caption">
        <dt className="text-fg-2">{t("settings.updater_status_current")}</dt>
        <dd className="font-mono text-fg-1">{status?.current_version ?? "—"}</dd>
      </dl>

      {/* Update found → install */}
      {status?.has_pending_update && status.pending && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-improve-bg text-badge-improve-fg">
            <Icon icon={RefreshCw} size="xs" />v{status.pending.version}
          </span>
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
        </div>
      )}

      {inlineHint && (
        <div className="mt-3 text-caption text-info-fg bg-info-bg border border-info-border rounded-card-sm p-3">
          {inlineHint}
        </div>
      )}

      {/* Divider + privacy policy (Opt②) */}
      <div className="border-t border-border-default mt-5 pt-5">
        <h3 className="text-caption font-medium text-fg-1">
          {t("settings.privacy_section")}
        </h3>
        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          className="mt-3 inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default bg-card text-fg-1 text-caption font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
        >
          <span>{t("settings.privacy_open_btn")}</span>
        </button>
      </div>

      <PrivacyPolicyDialog
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />
    </section>
  );
}
