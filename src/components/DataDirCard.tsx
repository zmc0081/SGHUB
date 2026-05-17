// i18n: 本组件文案已国际化 (V2.1.0)
/**
 * DataDirCard — view + manage the active data directory.
 *
 * Lives inside Settings → 💾 数据管理. Composes the simple "show
 * current path + open folder + copy" header with a 3-step migration
 * wizard accessed via the "Change location" button.
 */
import { useCallback, useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  api,
  type CurrentDataDir,
  type DataDirValidation,
  type DataMigrationProgress,
  type MigrationMode,
  type MigrationResult,
} from "../lib/tauri";
import { useT } from "../hooks/useT";

// ============================================================
// Format helpers
// ============================================================

function formatSize(t: ReturnType<typeof useT>, mb: number): string {
  if (mb >= 1024) {
    return t("settings.data_size_gb", { size: (mb / 1024).toFixed(2) });
  }
  return t("settings.data_size_mb", { size: mb.toFixed(1) });
}

// ============================================================
// Main card
// ============================================================

export function DataDirCard() {
  const t = useT();
  const [info, setInfo] = useState<CurrentDataDir | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const refresh = useCallback(() => {
    void api
      .getCurrentDataDir()
      .then(setInfo)
      .catch((e) => setErr(String(e)));
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
      setErr(String(e));
    }
  };

  const doResetDefault = async () => {
    if (!info?.is_custom) return;
    try {
      await api.resetDataDirToDefault();
      refresh();
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <div className="bg-white rounded border border-black/10 px-6 py-4 space-y-3">
      <h2 className="text-sm font-semibold text-primary">
        {t("settings.data_section")}
      </h2>

      {info && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span
              className={`px-1.5 py-0.5 rounded font-semibold ${
                info.is_custom
                  ? "bg-amber-100 text-amber-800"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {info.is_custom
                ? t("settings.data_path_custom")
                : t("settings.data_path_default")}
            </span>
            <span className="text-app-fg/60">{formatSize(t, info.size_mb)}</span>
          </div>
          <code
            className="block text-[11px] bg-black/5 px-2 py-1.5 rounded break-all cursor-pointer hover:bg-black/10"
            onClick={doCopy}
            title={t("settings.data_copy_path")}
          >
            {info.path}
            {copied && (
              <span className="ml-2 text-emerald-700">
                {t("settings.data_copied")}
              </span>
            )}
          </code>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={doOpenFolder}
              className="px-3 py-1.5 text-xs rounded border border-black/10 hover:border-primary/30 text-app-fg/80"
            >
              {t("settings.data_open_folder")}
            </button>
            <button
              onClick={() => setWizardOpen(true)}
              className="px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
            >
              {t("settings.data_change_path")}
            </button>
            {info.is_custom && (
              <button
                onClick={doResetDefault}
                className="px-3 py-1.5 text-xs rounded border border-black/10 hover:border-amber-400 text-app-fg/80"
              >
                {t("settings.data_reset_default")}
              </button>
            )}
          </div>
        </div>
      )}

      {err && <div className="text-xs text-red-600">{err}</div>}

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
  const [step, setStep] = useState<Step>("pick");
  const [picked, setPicked] = useState<string | null>(null);
  const [validation, setValidation] = useState<DataDirValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [mode, setMode] = useState<MigrationMode>("migrate");
  const [progress, setProgress] = useState<DataMigrationProgress | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [postChoice, setPostChoice] = useState<"keep" | "delete" | null>(null);
  const [restarting, setRestarting] = useState(false);

  // Subscribe to `data_migration:progress` events only while running.
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
      // If the new path already has SGHUB data, default the mode hint
      // to "use_existing" so the user notices the option.
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
        setErr(String(e));
      }
    }
    try {
      await relaunch();
    } catch (e) {
      // If relaunch unavailable in dev, just close — user can restart manually.
      setErr(String(e));
      setRestarting(false);
      onClose();
    }
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-md shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black/10">
          <h3 className="text-sm font-semibold text-primary">
            {t("settings.data_wizard_title")}
          </h3>
          {step !== "running" && (
            <button
              onClick={onClose}
              className="text-app-fg/50 hover:text-app-fg px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 text-sm space-y-3">
          {step === "pick" && (
            <>
              <div className="text-xs text-app-fg/60 font-semibold">
                {t("settings.data_wizard_step_pick")}
              </div>
              <p className="text-xs text-app-fg/70">
                {t("settings.data_wizard_pick_desc")}
              </p>
              <button
                onClick={pickFolder}
                className="px-3 py-1.5 text-xs rounded border border-primary text-primary hover:bg-primary hover:text-white"
              >
                {t("settings.data_wizard_pick_btn")}
              </button>
              {picked && (
                <div className="text-xs text-app-fg/80 mt-2">
                  {t("settings.data_wizard_picked")}{" "}
                  <code className="text-[11px] bg-black/5 px-1.5 py-0.5 rounded break-all">
                    {picked}
                  </code>
                </div>
              )}
              {validating && (
                <div className="text-xs text-app-fg/50 italic">
                  {t("settings.data_wizard_validating")}
                </div>
              )}
              {validation && validation.valid && (
                <div className="text-xs text-emerald-700">
                  {t("settings.data_wizard_validation_ok")}
                </div>
              )}
              {validation?.has_existing_sghub_data && (
                <div className="text-xs text-amber-700">
                  {t("settings.data_wizard_existing_found")}
                </div>
              )}
              {validation && !validation.valid && validation.error && (
                <div className="text-xs text-red-600">{validation.error}</div>
              )}
            </>
          )}

          {step === "mode" && (
            <>
              <div className="text-xs text-app-fg/60 font-semibold">
                {t("settings.data_wizard_step_mode")}
              </div>
              <div className="space-y-3">
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
            </>
          )}

          {step === "confirm" && (
            <>
              <div className="text-xs text-app-fg/60 font-semibold">
                {t("settings.data_wizard_step_confirm")}
              </div>
              <div className="text-xs space-y-1">
                <div>
                  <span className="text-app-fg/60">
                    {t("settings.data_wizard_summary_old")}
                  </span>{" "}
                  <code className="bg-black/5 px-1.5 py-0.5 rounded text-[11px]">
                    {currentPath}
                  </code>
                </div>
                <div>
                  <span className="text-app-fg/60">
                    {t("settings.data_wizard_summary_new")}
                  </span>{" "}
                  <code className="bg-black/5 px-1.5 py-0.5 rounded text-[11px]">
                    {picked}
                  </code>
                </div>
                <div>
                  <span className="text-app-fg/60">
                    {t("settings.data_wizard_summary_mode")}
                  </span>{" "}
                  <strong>{labelForMode(t, mode)}</strong>
                </div>
              </div>
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1.5 rounded">
                {t("settings.data_wizard_warn")}
              </div>
            </>
          )}

          {step === "running" && (
            <>
              <div className="text-xs text-app-fg/70 italic">
                {t("settings.data_wizard_running")}
              </div>
              {progress && (
                <>
                  <div className="h-2 bg-black/10 rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="text-xs text-app-fg/70">
                    {t("settings.data_wizard_progress", {
                      current: (progress.bytes_copied / (1024 * 1024)).toFixed(1),
                      total: (progress.total_bytes / (1024 * 1024)).toFixed(1),
                      percent: progress.percent,
                    })}
                  </div>
                  <div className="text-[10px] text-app-fg/40 truncate">
                    {t("settings.data_wizard_current_file", {
                      file: progress.current_file,
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {step === "done" && (
            <>
              {result?.success ? (
                <>
                  <div className="text-xs text-emerald-700">
                    {t("settings.data_wizard_success", {
                      files: result.migrated_files,
                      size: result.total_size_mb.toFixed(1),
                    })}
                  </div>
                  {mode === "migrate" && (
                    <div className="space-y-2">
                      <div className="text-xs text-app-fg/70">
                        {t("settings.data_wizard_post_migrate_q")}
                      </div>
                      <div className="flex gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="radio"
                            checked={postChoice === "keep"}
                            onChange={() => setPostChoice("keep")}
                          />
                          {t("settings.data_wizard_post_migrate_keep")}
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="radio"
                            checked={postChoice === "delete"}
                            onChange={() => setPostChoice("delete")}
                          />
                          {t("settings.data_wizard_post_migrate_delete")}
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-app-fg/70 pt-1">
                    {t("settings.data_wizard_restart_prompt")}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-red-700 font-semibold">
                    {t("settings.data_wizard_failed")}
                  </div>
                  {result?.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-600 font-mono">
                      {e}
                    </div>
                  ))}
                  {err && <div className="text-xs text-red-600">{err}</div>}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-3 border-t border-black/10 bg-gray-50">
          {step === "pick" && (
            <>
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded border border-black/10 text-app-fg/70 hover:bg-black/5"
              >
                {t("settings.data_wizard_cancel")}
              </button>
              <button
                onClick={() => setStep("mode")}
                disabled={!validation?.valid}
                className="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {t("settings.data_wizard_next")}
              </button>
            </>
          )}
          {step === "mode" && (
            <>
              <button
                onClick={() => setStep("pick")}
                className="px-3 py-1.5 text-xs rounded border border-black/10 text-app-fg/70 hover:bg-black/5"
              >
                {t("settings.data_wizard_back")}
              </button>
              <button
                onClick={() => setStep("confirm")}
                className="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90"
              >
                {t("settings.data_wizard_next")}
              </button>
            </>
          )}
          {step === "confirm" && (
            <>
              <button
                onClick={() => setStep("mode")}
                className="px-3 py-1.5 text-xs rounded border border-black/10 text-app-fg/70 hover:bg-black/5"
              >
                {t("settings.data_wizard_back")}
              </button>
              <button
                onClick={runMigration}
                className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
              >
                {t("settings.data_wizard_confirm_btn")}
              </button>
            </>
          )}
          {step === "done" && (
            <>
              {result?.success ? (
                <button
                  onClick={finishAndRestart}
                  disabled={restarting || (mode === "migrate" && postChoice === null)}
                  className="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {t("settings.data_wizard_restart_btn")}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs rounded border border-black/10 text-app-fg/70 hover:bg-black/5"
                >
                  {t("settings.data_wizard_close")}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Mode option (extracted for tidy JSX)
// ============================================================

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
  return (
    <label
      className={`block border rounded p-3 cursor-pointer transition-colors ${
        current === value
          ? "border-primary bg-primary/5"
          : "border-black/10 hover:border-primary/30"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="radio"
          checked={current === value}
          onChange={() => !disabled && setMode(value)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-app-fg/60 mt-0.5">{desc}</div>
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
