// i18n: 本组件文案已国际化 (V2.1.0)
/**
 * DataDirCard — view + manage the active data directory.
 *
 * Lives inside Settings → Data management. Composes the simple
 * "show current path + open folder + copy" header with a 3-step
 * migration wizard accessed via the "Change location" button.
 */
import { useCallback, useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  AlertTriangle,
  Check,
  Copy,
  FolderOpen,
  Loader2,
  RefreshCw,
  Undo2,
} from "lucide-react";
import {
  api,
  type CurrentDataDir,
  type DataDirValidation,
  type DataMigrationProgress,
  type MigrationMode,
  type MigrationResult,
} from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useToast } from "../hooks/useToast";
import { BaseModal } from "./BaseModal";
import { Icon } from "./Icon";

function formatSize(t: ReturnType<typeof useT>, mb: number): string {
  if (mb >= 1024) {
    return t("settings.data_size_gb", { size: (mb / 1024).toFixed(2) });
  }
  return t("settings.data_size_mb", { size: mb.toFixed(1) });
}

export function DataDirCard() {
  const t = useT();
  const toast = useToast();
  const [info, setInfo] = useState<CurrentDataDir | null>(null);
  const [copied, setCopied] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const refresh = useCallback(() => {
    void api
      .getCurrentDataDir()
      .then(setInfo)
      .catch((e) => toast.danger(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => refresh(), [refresh]);

  const doCopy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable in some WebViews */
    }
  };

  const doOpenFolder = async () => {
    if (!info) return;
    try {
      await api.openLocalPdf(info.path);
    } catch (e) {
      toast.danger(String(e));
    }
  };

  const doResetDefault = async () => {
    if (!info?.is_custom) return;
    try {
      await api.resetDataDirToDefault();
      refresh();
      toast.success(t("settings.data_reset_default_done"));
    } catch (e) {
      toast.danger(String(e));
    }
  };

  return (
    <div className="bg-card rounded-card shadow-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h3 font-semibold text-fg-1">
            {t("settings.data_section")}
          </h2>
          <p className="text-caption text-fg-2 mt-1">
            {t("settings.data_section_desc")}
          </p>
        </div>
        {info?.is_custom && (
          <span className="shrink-0 rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-new-bg text-badge-new-fg">
            {t("settings.data_path_custom")}
          </span>
        )}
      </div>

      {info && (
        <>
          <button
            type="button"
            onClick={doCopy}
            title={t("settings.data_copy_path")}
            className="mt-4 w-full text-left p-4 rounded-card-sm bg-soft hover:bg-navy-faint font-mono text-meta text-fg-1 transition-colors duration-fast ease-khx group"
          >
            <div className="flex items-center gap-2">
              <span className="break-all flex-1">{info.path}</span>
              <span className="shrink-0 text-fg-3 group-hover:text-fg-1">
                <Icon
                  icon={copied ? Check : Copy}
                  size="xs"
                  className={copied ? "text-success-fg" : ""}
                />
              </span>
            </div>
            <div className="mt-2 text-meta text-fg-2 tabular-nums text-right">
              {formatSize(t, info.size_mb)}
              {copied && (
                <span className="ml-2 text-success-fg">
                  {t("settings.data_copied")}
                </span>
              )}
            </div>
          </button>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={doOpenFolder}
              className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
            >
              <Icon icon={FolderOpen} size="sm" />
              <span>{t("settings.data_open_folder")}</span>
            </button>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
            >
              <Icon icon={RefreshCw} size="sm" />
              <span>{t("settings.data_change_path")}</span>
            </button>
            {info.is_custom && (
              <button
                type="button"
                onClick={doResetDefault}
                className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-warning-border hover:text-warning-fg-strong transition-colors duration-fast ease-khx"
              >
                <Icon icon={Undo2} size="sm" />
                <span>{t("settings.data_reset_default")}</span>
              </button>
            )}
          </div>
        </>
      )}

      {wizardOpen && info && (
        <MigrationWizard
          currentPath={info.path}
          onClose={() => {
            setWizardOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// 3-step wizard
// ============================================================

type Step = "pick" | "mode" | "confirm" | "running" | "done";

function MigrationWizard({
  currentPath,
  onClose,
}: {
  currentPath: string;
  onClose: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const [step, setStep] = useState<Step>("pick");
  const [picked, setPicked] = useState<string | null>(null);
  const [validation, setValidation] = useState<DataDirValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [mode, setMode] = useState<MigrationMode>("migrate");
  const [progress, setProgress] = useState<DataMigrationProgress | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // V2.2: default to keeping the old dir (safer).
  const [postChoice, setPostChoice] = useState<"keep" | "delete">("keep");
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (step !== "running") return;
    let unlisten: UnlistenFn | undefined;
    void listen<DataMigrationProgress>("data_migration:progress", (e) =>
      setProgress(e.payload),
    ).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, [step]);

  const pickFolder = async () => {
    setErr(null);
    try {
      const p = await api.selectNewDataDir();
      if (!p) return;
      setPicked(p);
      setValidating(true);
      const v = await api.validateDataDir(p);
      setValidation(v);
      setValidating(false);
      if (!v.valid) return;
      if (v.has_existing_sghub_data) setMode("use_existing");
    } catch (e) {
      setErr(String(e));
      setValidating(false);
    }
  };

  const runMigration = async () => {
    if (!picked) return;
    setStep("running");
    setErr(null);
    try {
      const r = await api.migrateDataDir(picked, mode);
      setResult(r);
      setStep("done");
    } catch (e) {
      setErr(String(e));
      setStep("done");
    }
  };

  const finishAndRestart = async () => {
    setRestarting(true);
    if (postChoice === "delete") {
      try {
        await api.deleteOldDataDir(currentPath);
      } catch (e) {
        toast.danger(String(e));
      }
    }
    try {
      await relaunch();
    } catch (e) {
      toast.danger(String(e));
      setRestarting(false);
      onClose();
    }
  };

  const isRunning = step === "running";

  // Header step count + title
  const stepIndex = step === "pick" ? 1 : step === "mode" ? 2 : step === "confirm" ? 3 : null;
  const headerTitle = stepIndex
    ? t("settings.data_wizard_step_x", { current: stepIndex, total: 3 })
    : isRunning
      ? t("settings.data_wizard_running_header")
      : t("settings.data_wizard_done_header");

  return (
    <BaseModal
      open
      onClose={() => !isRunning && onClose()}
      size="md"
      closeOnEscape={!isRunning}
      closeOnBackdrop={!isRunning}
      showClose={!isRunning}
      title={t("settings.data_wizard_title")}
      description={headerTitle}
      footer={
        <>
          {step === "pick" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx font-medium"
              >
                {t("settings.data_wizard_cancel")}
              </button>
              <button
                type="button"
                onClick={() => setStep("mode")}
                disabled={!validation?.valid}
                className="inline-flex items-center px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
              >
                {t("settings.data_wizard_next")}
              </button>
            </>
          )}
          {step === "mode" && (
            <>
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="inline-flex items-center px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx font-medium"
              >
                {t("settings.data_wizard_back")}
              </button>
              <button
                type="button"
                onClick={() => setStep("confirm")}
                className="inline-flex items-center px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover transition-colors duration-fast ease-khx font-medium text-caption"
              >
                {t("settings.data_wizard_next")}
              </button>
            </>
          )}
          {step === "confirm" && (
            <>
              <button
                type="button"
                onClick={() => setStep("mode")}
                className="inline-flex items-center px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx font-medium"
              >
                {t("settings.data_wizard_back")}
              </button>
              <button
                type="button"
                onClick={runMigration}
                className="inline-flex items-center px-btn-x py-btn-y rounded-pill shadow-btn bg-danger-fg text-fg-inverse hover:opacity-90 transition-opacity duration-fast ease-khx font-medium text-caption"
              >
                {t("settings.data_wizard_confirm_btn")}
              </button>
            </>
          )}
          {step === "done" &&
            (result?.success ? (
              <button
                type="button"
                onClick={finishAndRestart}
                disabled={restarting}
                className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill shadow-btn bg-navy text-fg-inverse hover:bg-navy-hover disabled:opacity-50 transition-colors duration-fast ease-khx font-medium text-caption"
              >
                {restarting && (
                  <Icon icon={Loader2} size="sm" className="animate-spin" />
                )}
                {t("settings.data_wizard_restart_btn")}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:bg-navy-faint transition-colors duration-fast ease-khx font-medium"
              >
                {t("settings.data_wizard_close")}
              </button>
            ))}
        </>
      }
    >
      {step === "pick" && (
        <div className="space-y-3">
          <p className="text-caption text-fg-2">
            {t("settings.data_wizard_pick_desc")}
          </p>
          <button
            type="button"
            onClick={pickFolder}
            className="inline-flex items-center gap-1.5 px-btn-x py-btn-y rounded-pill border border-border-default text-caption text-fg-1 hover:border-indigo hover:text-indigo transition-colors duration-fast ease-khx"
          >
            <Icon icon={FolderOpen} size="sm" />
            <span>{t("settings.data_wizard_pick_btn")}</span>
          </button>
          {picked && (
            <div className="text-meta text-fg-1">
              {t("settings.data_wizard_picked")}{" "}
              <code className="text-meta bg-soft px-2 py-1 rounded-pill break-all">
                {picked}
              </code>
            </div>
          )}
          {validating && (
            <div className="inline-flex items-center gap-2 text-meta text-fg-2">
              <Icon icon={Loader2} size="xs" className="animate-spin" />
              <span>{t("settings.data_wizard_validating")}</span>
            </div>
          )}
          {validation?.valid && (
            <div className="inline-flex items-center gap-1.5 text-meta text-success-fg">
              <Icon icon={Check} size="xs" />
              <span>{t("settings.data_wizard_validation_ok")}</span>
            </div>
          )}
          {validation?.has_existing_sghub_data && (
            <div className="inline-flex items-center gap-1.5 text-meta text-warning-fg-strong">
              <Icon icon={AlertTriangle} size="xs" />
              <span>{t("settings.data_wizard_existing_found")}</span>
            </div>
          )}
          {validation && !validation.valid && validation.error && (
            <div className="inline-flex items-start gap-1.5 text-meta text-danger-fg">
              <Icon icon={AlertTriangle} size="xs" className="mt-0.5" />
              <span>{validation.error}</span>
            </div>
          )}
        </div>
      )}

      {step === "mode" && (
        <div role="radiogroup" className="space-y-3">
          <ModeOption
            value="migrate"
            current={mode}
            setMode={setMode}
            title={t("settings.data_wizard_mode_migrate")}
            desc={t("settings.data_wizard_mode_migrate_desc")}
          />
          <ModeOption
            value="fresh"
            current={mode}
            setMode={setMode}
            title={t("settings.data_wizard_mode_fresh")}
            desc={t("settings.data_wizard_mode_fresh_desc")}
          />
          <ModeOption
            value="use_existing"
            current={mode}
            setMode={setMode}
            title={t("settings.data_wizard_mode_use_existing")}
            desc={t("settings.data_wizard_mode_use_existing_desc")}
            disabled={!validation?.has_existing_sghub_data}
          />
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-4">
          <dl className="text-caption space-y-2">
            <div className="flex gap-3 items-baseline">
              <dt className="text-fg-2 w-20 shrink-0">
                {t("settings.data_wizard_summary_old")}
              </dt>
              <dd className="font-mono text-meta text-fg-1 break-all">
                {currentPath}
              </dd>
            </div>
            <div className="flex gap-3 items-baseline">
              <dt className="text-fg-2 w-20 shrink-0">
                {t("settings.data_wizard_summary_new")}
              </dt>
              <dd className="font-mono text-meta text-fg-1 break-all">
                {picked}
              </dd>
            </div>
            <div className="flex gap-3 items-baseline">
              <dt className="text-fg-2 w-20 shrink-0">
                {t("settings.data_wizard_summary_mode")}
              </dt>
              <dd className="font-medium text-fg-1">{labelForMode(t, mode)}</dd>
            </div>
          </dl>
          <div
            role="alert"
            className="bg-danger-bg border border-danger-border text-danger-fg rounded-card-sm p-4 flex items-start gap-2 text-caption"
          >
            <Icon
              icon={AlertTriangle}
              size="sm"
              className="flex-shrink-0 mt-0.5"
            />
            <span>{t("settings.data_wizard_warn")}</span>
          </div>
        </div>
      )}

      {step === "running" && (
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-caption text-fg-2">
            <Icon icon={Loader2} size="sm" className="animate-spin" />
            <span>{t("settings.data_wizard_running")}</span>
          </div>
          {progress && (
            <>
              <div className="h-2 bg-navy-soft rounded-pill overflow-hidden">
                <div
                  role="progressbar"
                  aria-valuenow={progress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-full bg-indigo transition-[width] duration-base ease-khx"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="text-meta text-fg-2 tabular-nums">
                {t("settings.data_wizard_progress", {
                  current: (progress.bytes_copied / (1024 * 1024)).toFixed(1),
                  total: (progress.total_bytes / (1024 * 1024)).toFixed(1),
                  percent: progress.percent,
                })}
              </div>
              <div className="text-meta font-mono text-fg-2 truncate">
                {t("settings.data_wizard_current_file", {
                  file: progress.current_file,
                })}
              </div>
            </>
          )}
        </div>
      )}

      {step === "done" &&
        (result?.success ? (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-caption text-success-fg">
              <Icon icon={Check} size="sm" />
              <span>
                {t("settings.data_wizard_success", {
                  files: result.migrated_files,
                  size: result.total_size_mb.toFixed(1),
                })}
              </span>
            </div>
            {mode === "migrate" && (
              <div className="space-y-2">
                <div className="text-caption text-fg-1">
                  {t("settings.data_wizard_post_migrate_q")}
                </div>
                <div role="radiogroup" className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-2 text-caption text-fg-1 cursor-pointer">
                    <input
                      type="radio"
                      name="post-migrate"
                      checked={postChoice === "keep"}
                      onChange={() => setPostChoice("keep")}
                      className="accent-indigo"
                    />
                    {t("settings.data_wizard_post_migrate_keep")}
                  </label>
                  <label className="inline-flex items-center gap-2 text-caption text-fg-1 cursor-pointer">
                    <input
                      type="radio"
                      name="post-migrate"
                      checked={postChoice === "delete"}
                      onChange={() => setPostChoice("delete")}
                      className="accent-indigo"
                    />
                    {t("settings.data_wizard_post_migrate_delete")}
                  </label>
                </div>
              </div>
            )}
            <p className="text-caption text-fg-2 italic">
              {t("settings.data_wizard_restart_prompt")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-caption text-danger-fg font-semibold inline-flex items-center gap-2">
              <Icon icon={AlertTriangle} size="sm" />
              {t("settings.data_wizard_failed")}
            </div>
            {result?.errors.map((e, i) => (
              <div key={i} className="text-meta font-mono text-danger-fg">
                {e}
              </div>
            ))}
            {err && <div className="text-meta text-danger-fg">{err}</div>}
          </div>
        ))}
    </BaseModal>
  );
}

function ModeOption({
  value,
  current,
  setMode,
  title,
  desc,
  disabled,
}: {
  value: MigrationMode;
  current: MigrationMode;
  setMode: (m: MigrationMode) => void;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  const selected = current === value;
  return (
    <label
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      className={`block rounded-card-sm border p-4 transition-colors duration-fast ease-khx ${
        selected
          ? "border-indigo bg-indigo-soft shadow-focus"
          : "border-border-default hover:border-navy-muted"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="radio"
          checked={selected}
          onChange={() => !disabled && setMode(value)}
          disabled={disabled}
          className="mt-1 accent-indigo"
        />
        <div className="flex-1 min-w-0">
          <div
            className={`text-caption font-semibold ${selected ? "text-indigo" : "text-fg-1"}`}
          >
            {title}
          </div>
          <div className="text-meta text-fg-2 mt-1">{desc}</div>
        </div>
      </div>
    </label>
  );
}

function labelForMode(t: ReturnType<typeof useT>, m: MigrationMode): string {
  switch (m) {
    case "migrate":
      return t("settings.data_wizard_mode_migrate");
    case "fresh":
      return t("settings.data_wizard_mode_fresh");
    case "use_existing":
      return t("settings.data_wizard_mode_use_existing");
  }
}
