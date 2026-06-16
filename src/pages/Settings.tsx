// i18n: 本组件文案已国际化 (V2.1.0)
// V2.2.1 — added Privacy policy section below DataDirCard (Session 27)
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronDown, Shield, Sparkles } from "lucide-react";
import { api, type AppConfig, type UpdaterConfig } from "../lib/tauri";
import { useOnboardingStore } from "../stores/onboardingStore";
import {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  setAppLanguage,
  type SupportedLanguage,
} from "../i18n";
import { UpdaterCard } from "../components/UpdaterCard";
import { DataDirCard } from "../components/DataDirCard";
import { PrivacyPolicyDialog } from "../components/PrivacyPolicyDialog";
import { Icon } from "../components/Icon";
import { Skeleton } from "../components/Skeleton";

const THEME_LABEL_KEY: Record<string, string> = {
  light: "settings.theme_light",
  dark: "settings.theme_dark",
  system: "settings.theme_system",
};

const LOG_LEVEL_LABEL_KEY: Record<string, string> = {
  debug: "settings.log_debug",
  info: "settings.log_info",
  warn: "settings.log_warn",
  error: "settings.log_error",
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 py-4 border-b border-border-subtle last:border-b-0">
      <dt className="text-caption font-medium text-fg-2">{label}</dt>
      <dd className="text-caption text-fg-1">{children}</dd>
    </div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemLocale, setSystemLocale] = useState<SupportedLanguage>("en-US");

  useEffect(() => {
    api
      .getAppConfig()
      .then(setConfig)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    api
      .getSystemLocale()
      .then((s) => {
        if (isSupportedLanguage(s)) setSystemLocale(s);
      })
      .catch(() => {});
  }, []);

  const currentLangValue = config?.language ?? "";

  const handleLanguageChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const next = e.target.value;
    const choice: SupportedLanguage | null =
      next === "" ? null : isSupportedLanguage(next) ? next : null;
    try {
      await setAppLanguage(choice);
      setConfig((prev) =>
        prev ? { ...prev, language: choice ?? undefined } : prev,
      );
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <main role="main" className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <h1 className="text-h2 font-semibold text-fg-1">
          {t("settings.title")}
        </h1>
      </header>

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton variant="rect" height={120} />
          <Skeleton variant="rect" height={200} />
        </div>
      )}
      {error && !loading && (
        <div
          role="alert"
          className="rounded-card-sm bg-danger-bg border border-danger-border text-danger-fg px-4 py-3 flex items-start gap-2 text-caption"
        >
          <Icon
            icon={AlertTriangle}
            size="sm"
            className="flex-shrink-0 mt-0.5"
          />
          <span>{error}</span>
        </div>
      )}

      {config && (
        <div className="bg-card rounded-card shadow-card p-6">
          <Row label={t("settings.language")}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <select
                  value={currentLangValue}
                  onChange={handleLanguageChange}
                  className="appearance-none pr-9 pl-input-x py-input-y rounded-pill border border-border-default bg-card text-caption text-fg-1 focus:outline-none focus:border-border-focus focus:shadow-focus transition-colors duration-fast ease-khx"
                >
                  <option value="">
                    {t("settings.language_follow_system")}
                  </option>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <Icon
                  icon={ChevronDown}
                  size="sm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-fg-2"
                />
              </div>
              {currentLangValue === "" && (
                <span className="text-meta text-fg-3">
                  {t("settings.language_follow_system_with", {
                    current:
                      SUPPORTED_LANGUAGES.find((l) => l.code === systemLocale)
                        ?.label ?? systemLocale,
                  })}
                </span>
              )}
            </div>
          </Row>
          <Row label={t("settings.theme")}>
            {t(THEME_LABEL_KEY[config.theme] ?? config.theme)}
          </Row>
          <Row label={t("settings.default_model")}>
            {config.default_model_id ? (
              <code className="text-meta font-mono">
                {config.default_model_id}
              </code>
            ) : (
              <span className="text-fg-3">
                {t("settings.default_model_unset")}
              </span>
            )}
          </Row>
          <Row label={t("settings.log_level")}>
            {t(LOG_LEVEL_LABEL_KEY[config.log_level] ?? config.log_level)}
          </Row>
          <Row label={t("settings.onboarding")}>
            <button
              type="button"
              onClick={() => useOnboardingStore.getState().show()}
              className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default bg-card text-fg-1 text-caption font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
            >
              <Icon icon={Sparkles} size="sm" />
              <span>{t("settings.rerun_onboarding")}</span>
            </button>
          </Row>
        </div>
      )}

      {config && (
        <div className="mt-4">
          <UpdaterCardSection
            updater={config.updater}
            setConfig={setConfig}
          />
        </div>
      )}

      <div className="mt-4">
        <DataDirCard />
      </div>

      <div className="mt-4">
        <PrivacyCard />
      </div>
    </main>
  );
}

/**
 * Privacy-policy entry card. Sits below DataDirCard so it reads as
 * "data lives here → here's how it's handled". The actual policy text
 * is rendered in a dialog (PrivacyPolicyDialog) so a user can also
 * compare zh/en side-by-side without leaving Settings.
 */
function PrivacyCard() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <section
        aria-labelledby="settings-privacy-heading"
        className="bg-card rounded-card shadow-card p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-icon bg-indigo-soft text-indigo flex items-center justify-center flex-shrink-0">
            <Icon icon={Shield} size="lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="settings-privacy-heading"
              className="text-h3 font-semibold text-fg-1"
            >
              {t("settings.privacy_section")}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default bg-card text-fg-1 text-caption font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
            >
              <span>{t("settings.privacy_open_btn")}</span>
            </button>
          </div>
        </div>
      </section>
      <PrivacyPolicyDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function UpdaterCardSection({
  updater,
  setConfig,
}: {
  updater: UpdaterConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
}) {
  const handleChange = useCallback(
    (next: UpdaterConfig) =>
      setConfig((c) => (c ? { ...c, updater: next } : c)),
    [setConfig],
  );
  return <UpdaterCard initial={updater} onChange={handleChange} />;
}
