// i18n: 本组件文案已国际化 (V2.1.0)
// V2.2.5 — updater simplified + privacy policy merged into the
// "隐私与更新" card (UpdaterCard); version now shown there too.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, Settings2, Sparkles } from "lucide-react";
import { api, type AppConfig, type ModelConfig } from "../lib/tauri";
import { useOnboardingStore } from "../stores/onboardingStore";
import {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  setAppLanguage,
  type SupportedLanguage,
} from "../i18n";
import { UpdaterCard } from "../components/UpdaterCard";
import { DataDirCard } from "../components/DataDirCard";
import { SourcesCard } from "../components/SourcesCard";
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
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [models, setModels] = useState<ModelConfig[]>([]);
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
    // Default model is derived from the real model list (is_default), not
    // the config stub — so an unconfigured app shows "not set", not a
    // phantom model name.
    api
      .getModelConfigs()
      .then(setModels)
      .catch(() => {});
  }, []);

  const currentLangValue = config?.language ?? "";
  const defaultModel = models.find((m) => m.is_default) ?? null;

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
            {defaultModel ? (
              <button
                type="button"
                onClick={() => navigate({ to: "/models" })}
                className="inline-flex items-center gap-1 text-caption text-navy hover:text-navy-hover hover:underline transition-colors duration-fast ease-khx"
              >
                <span>{defaultModel.name}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate({ to: "/models" })}
                className="inline-flex items-center gap-2 px-btn-x py-btn-y rounded-pill border border-border-default bg-card text-fg-1 text-caption font-medium hover:border-navy hover:text-navy transition-colors duration-fast ease-khx"
              >
                <Icon icon={Settings2} size="sm" />
                <span>{t("settings.default_model_configure")}</span>
              </button>
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

      {/* V2.2.6 — 文献数据源管理 (placed where 隐私与更新 used to be) */}
      <div className="mt-4">
        <SourcesCard />
      </div>

      <div className="mt-4">
        <DataDirCard />
      </div>

      {/* 隐私与更新 — updater (simplified) + privacy policy, merged (V2.2.5);
          moved below data management in V2.2.6. */}
      <div className="mt-4">
        <UpdaterCard />
      </div>
    </main>
  );
}
