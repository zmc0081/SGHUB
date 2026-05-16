/**
 * i18n bootstrap.
 *
 * - All 5 locales are bundled at build time (Vite static-imports the
 *   JSON files), so first paint never blocks on a fetch.
 * - The active language is decided by `bootstrapI18n()` (called from
 *   `main.tsx` before the React tree mounts) — user pick wins, then
 *   the OS locale via Tauri's `get_system_locale` command, then en-US.
 * - `LanguageDetector` is configured but only kept as a last-resort
 *   fallback (browser navigator language) because in a Tauri WebView
 *   the navigator value is usually the OS locale anyway.
 *
 * To add a key, see `locales/README.md`. To swap languages at runtime
 * use the `setAppLanguage()` helper below — it writes through to the
 * Tauri config and changes i18next in one call.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhCN from "../../locales/zh-CN.json";
import enUS from "../../locales/en-US.json";

import { api } from "../lib/tauri";

// V2.1.0-rc2: locked down to the two languages we maintain in-house.
// zh-TW / ja-JP / fr-FR were dropped because we couldn't keep their
// translations in sync with feature work — they're easy to re-enable
// later once we have committed maintainers (see docs/i18n-guide.md).
export const SUPPORTED_LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "en-US", label: "English" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

const resources = {
  "zh-CN": { translation: zhCN },
  "en-US": { translation: enUS },
};

// init synchronously with en-US so anything that fires before bootstrap
// (e.g. an early error toast) still renders.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en-US",
    lng: "en-US",
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false },
    detection: {
      // Tauri WebView2 has no localStorage persistence concerns since
      // we always overwrite from the Rust config; just look at the
      // navigator as a tie-breaker.
      order: ["navigator"],
      caches: [],
    },
  });

/**
 * Decide which language to use and apply it. Called once from
 * `main.tsx` before the React root mounts.
 *
 * Decision order:
 *   1. Config `language` (user pick) — only if it's one of our
 *      supported codes.
 *   2. `get_system_locale` from Rust — already normalized to one of
 *      our 5 codes (or "en-US").
 *   3. Hard fallback to "en-US".
 *
 * Errors are swallowed — i18n already has "en-US" loaded.
 */
export async function bootstrapI18n(): Promise<{
  language: SupportedLanguage;
  source: "user" | "system" | "fallback";
}> {
  try {
    const cfg = await api.getAppConfig();
    if (cfg.language && isSupportedLanguage(cfg.language)) {
      await i18n.changeLanguage(cfg.language);
      return { language: cfg.language, source: "user" };
    }
  } catch (e) {
    console.warn("[i18n] failed to read app config:", e);
  }
  try {
    const sys = await api.getSystemLocale();
    if (isSupportedLanguage(sys)) {
      await i18n.changeLanguage(sys);
      return { language: sys, source: "system" };
    }
  } catch (e) {
    console.warn("[i18n] failed to detect system locale:", e);
  }
  await i18n.changeLanguage("en-US");
  return { language: "en-US", source: "fallback" };
}

/**
 * Switch language at runtime AND persist the choice. Pass `null` for
 * "follow system" — we clear the user pick from config and re-derive
 * from the OS locale immediately.
 */
export async function setAppLanguage(
  next: SupportedLanguage | null,
): Promise<SupportedLanguage> {
  // Update the stored config first; if the save fails we still want
  // the UI to switch (best-effort experience).
  let resolved: SupportedLanguage = "en-US";
  if (next === null) {
    try {
      const sys = await api.getSystemLocale();
      resolved = isSupportedLanguage(sys) ? sys : "en-US";
    } catch {
      resolved = "en-US";
    }
  } else {
    resolved = next;
  }

  try {
    const cfg = await api.getAppConfig();
    await api.saveAppConfig({ ...cfg, language: next ?? undefined });
  } catch (e) {
    console.warn("[i18n] failed to persist language pick:", e);
  }
  await i18n.changeLanguage(resolved);
  return resolved;
}

export default i18n;
