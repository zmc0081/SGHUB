/**
 * Thin wrapper over react-i18next's `useTranslation` — gives every
 * component a single `t()` import with no namespace ceremony.
 *
 * Usage:
 *   const t = useT();
 *   <button>{t("common.save")}</button>
 *   <span>{t("notifications.subscription_new_count", { name, count })}</span>
 */
import { useTranslation } from "react-i18next";

export function useT() {
  return useTranslation().t;
}
