// V2.2.4 — onboarding Step 1 (data directory).
//
// Fresh install: this only *sets the initial location*, it never migrates
// data. The OS-default path is pre-selected and recommended; picking a
// custom folder runs the same validation the Settings page uses
// (writable / not a system dir / not the current dir). Keeping the
// default persists nothing (bootstrap.data_dir stays None).
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  FolderOpen,
  HardDrive,
  Loader2,
} from "lucide-react";
import { api, type CurrentDataDir, type DataDirValidation } from "../../lib/tauri";
import { Icon } from "../Icon";
import { useT } from "../../hooks/useT";
import { useToast } from "../../hooks/useToast";
import { ProgressDots } from "./ProgressDots";
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY } from "./styles";

type Mode = "default" | "custom";

export function DataDirStep({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [current, setCurrent] = useState<CurrentDataDir | null>(null);
  const [mode, setMode] = useState<Mode>("default");
  const [customPath, setCustomPath] = useState<string | null>(null);
  const [validation, setValidation] = useState<DataDirValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getCurrentDataDir()
      .then(setCurrent)
      .catch((e) => console.warn("getCurrentDataDir failed", e));
  }, []);

  async function pickCustom() {
    try {
      const picked = await api.selectNewDataDir();
      if (!picked) return; // user cancelled
      setCustomPath(picked);
      setMode("custom");
      setValidation(null);
      setValidating(true);
      const v = await api.validateDataDir(picked);
      setValidation(v);
    } catch (e) {
      toast.danger(t("onboarding.datadir_pick_failed"), String(e));
    } finally {
      setValidating(false);
    }
  }

  const customInvalid =
    mode === "custom" && (!customPath || (!!validation && !validation.valid));
  const nextDisabled = saving || validating || customInvalid;

  async function handleNext() {
    if (nextDisabled) return;
    if (mode === "custom" && customPath && validation?.valid) {
      setSaving(true);
      try {
        await api.onboardingSetDataDir(customPath);
        toast.success(t("onboarding.datadir_saved"));
      } catch (e) {
        toast.danger(t("onboarding.datadir_save_failed"), String(e));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    onNext();
  }

  return (
    <div className="flex flex-col gap-5">
      <ProgressDots total={2} current={0} label={t("onboarding.step_of", { n: 1, total: 2 })} />

      <div>
        <h2 className="text-h3 font-semibold text-fg-1">
          {t("onboarding.datadir_title")}
        </h2>
        <p className="mt-1 text-meta text-fg-2 leading-relaxed">
          {t("onboarding.datadir_desc")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Default (recommended) */}
        <button
          type="button"
          onClick={() => setMode("default")}
          aria-pressed={mode === "default"}
          className={
            "flex items-start gap-3 text-left rounded-card-sm border p-4 transition-colors duration-fast ease-khx " +
            (mode === "default"
              ? "border-navy bg-navy-faint"
              : "border-border-default bg-card hover:border-navy")
          }
        >
          <div className="w-9 h-9 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center flex-shrink-0">
            <Icon icon={HardDrive} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-caption font-medium text-fg-1">
                {t("onboarding.datadir_default_label")}
              </span>
              <span className="text-micro font-medium text-navy bg-navy-faint rounded-pill px-2 py-0.5">
                {t("onboarding.datadir_recommended")}
              </span>
            </div>
            <p className="mt-1 text-meta text-fg-3 font-mono break-all">
              {current?.path ?? "…"}
            </p>
          </div>
          {mode === "default" && (
            <Icon icon={Check} size="sm" className="text-navy flex-shrink-0" />
          )}
        </button>

        {/* Custom location */}
        <div
          className={
            "rounded-card-sm border p-4 transition-colors duration-fast ease-khx " +
            (mode === "custom"
              ? "border-navy bg-navy-faint"
              : "border-border-default bg-card")
          }
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-caption font-medium text-fg-1">
              {t("onboarding.datadir_custom_label")}
            </span>
            <button
              type="button"
              onClick={pickCustom}
              disabled={validating || saving}
              className={BTN_SECONDARY}
            >
              <Icon icon={FolderOpen} size="sm" />
              <span>{t("onboarding.datadir_pick")}</span>
            </button>
          </div>

          {customPath && (
            <p className="mt-3 text-meta text-fg-2 font-mono break-all">
              {customPath}
            </p>
          )}

          {validating && (
            <p className="mt-2 flex items-center gap-2 text-meta text-fg-3">
              <Icon icon={Loader2} size="sm" className="animate-spin" />
              <span>{t("onboarding.datadir_validating")}</span>
            </p>
          )}

          {!validating && validation && mode === "custom" && (
            <p
              className={
                "mt-2 flex items-start gap-2 text-meta " +
                (validation.valid ? "text-success-fg" : "text-danger-fg")
              }
            >
              <Icon
                icon={validation.valid ? Check : AlertTriangle}
                size="sm"
                className="flex-shrink-0 mt-0.5"
              />
              <span>
                {validation.valid
                  ? validation.has_existing_sghub_data
                    ? t("onboarding.datadir_valid_existing")
                    : t("onboarding.datadir_valid")
                  : (validation.error ?? t("onboarding.datadir_invalid"))}
              </span>
            </p>
          )}
        </div>
      </div>

      <p className="text-micro text-fg-3">{t("onboarding.datadir_no_migration")}</p>

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onBack} className={BTN_SECONDARY}>
          {t("onboarding.back")}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onSkip} className={BTN_GHOST}>
            {t("onboarding.skip_step")}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={nextDisabled}
            className={BTN_PRIMARY}
          >
            {saving && <Icon icon={Loader2} size="sm" className="animate-spin" />}
            <span>{t("onboarding.next")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
