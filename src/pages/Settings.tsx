// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type AppConfig } from "../lib/tauri";
import {
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  setAppLanguage,
  type SupportedLanguage,
} from "../i18n";

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
    <div className="grid grid-cols-[140px_1fr] gap-4 py-3 border-b border-black/5">
      <dt className="text-sm text-app-fg/60">{label}</dt>
      <dd className="text-sm text-app-fg">{children}</dd>
    </div>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // System locale snapshot — shown next to "follow system" so the user
  // knows which language the OS would resolve to right now.
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

  // ============================================================
  // Language switcher
  // ============================================================
  // "" → follow system (i.e. config.language is null/undefined).
  const currentLangValue = config?.language ?? "";

  const handleLanguageChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const next = e.target.value;
    const choice: SupportedLanguage | null =
      next === "" ? null : isSupportedLanguage(next) ? next : null;
    try {
      await setAppLanguage(choice);
      // Keep local config in sync so the dropdown reflects the pick
      // without a round-trip refresh.
      setConfig((prev) =>
        prev ? { ...prev, language: choice ?? undefined } : prev,
      );
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-primary mb-1">
        {t("settings.title")}
      </h1>
      <p className="text-sm text-app-fg/60 mb-6">
        ~/.sghub/config.toml
      </p>

      {loading && (
        <div className="text-sm text-app-fg/60">{t("common.loading")}</div>
      )}
      {error && <div className="text-sm text-red-600">Error: {error}</div>}

      {config && (
        <div className="bg-white rounded border border-black/10 px-6 py-2">
          <Row label={t("settings.language")}>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={currentLangValue}
                onChange={handleLanguageChange}
                className="text-sm border border-black/10 rounded px-2 py-1 bg-white"
              >
                <option value="">{t("settings.language_follow_system")}</option>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              {currentLangValue === "" && (
                <span className="text-xs text-app-fg/50">
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
          <Row label={t("settings.data_dir")}>
            <code className="text-xs bg-black/5 px-1.5 py-0.5 rounded">
              {config.data_dir}
            </code>
          </Row>
          <Row label={t("settings.auto_update")}>
            <span
              className={
                config.auto_update ? "text-green-700" : "text-app-fg/50"
              }
            >
              ●{" "}
              {config.auto_update
                ? t("settings.status_on")
                : t("settings.status_off")}
            </span>
          </Row>
          {/* "自动备份" 设置项已于 V2.1.0 移除 —— 后端 auto_backup /
              backup_retention_days 字段保留供未来扩展,但 UI 不再展示。 */}
          <Row label={t("settings.default_model")}>
            {config.default_model_id ? (
              <code className="text-xs">{config.default_model_id}</code>
            ) : (
              <span className="text-app-fg/50">
                {t("settings.default_model_unset")}
              </span>
            )}
          </Row>
          <Row label={t("settings.log_level")}>
            {t(LOG_LEVEL_LABEL_KEY[config.log_level] ?? config.log_level)}
          </Row>
        </div>
      )}
    </div>
  );
}
