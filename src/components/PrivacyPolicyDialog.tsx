// V2.2.1 Session 27 — Privacy policy viewer.
//
// Loads the policy markdown via Vite `?raw` import so the bundled
// content ships with the desktop app (offline-first; no fetch needed).
// Has its own language toggle independent of the app language — a user
// reading the Chinese app can still review the English text and vice
// versa, without round-tripping through Settings → Language.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BaseModal } from "./BaseModal";
import { PrivacyPolicyBody, type PrivacyLang } from "./PrivacyPolicyBody";

export interface PrivacyPolicyDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PrivacyPolicyDialog({ open, onClose }: PrivacyPolicyDialogProps) {
  const { i18n, t } = useTranslation();

  // Default to the current app language; user can flip independently.
  const initial: PrivacyLang = i18n.language === "zh-CN" ? "zh-CN" : "en-US";
  const [lang, setLang] = useState<PrivacyLang>(initial);

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      size="lg"
      title={t("settings.privacy_title")}
    >
      {/* Language toggle — chip group, independent of app language. */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-meta text-fg-2">
          {t("settings.privacy_language_label")}
        </span>
        {(["zh-CN", "en-US"] as const).map((code) => {
          const active = lang === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={active}
              className={`px-3 py-1 rounded-pill text-meta font-medium transition-colors duration-fast ease-khx ${
                active
                  ? "bg-navy text-fg-inverse"
                  : "bg-navy-faint text-fg-2 hover:bg-navy-soft hover:text-fg-1"
              }`}
            >
              {code === "zh-CN" ? "中文" : "English"}
            </button>
          );
        })}
      </div>

      {/* Markdown body — shared renderer (also used by the consent screen). */}
      <PrivacyPolicyBody lang={lang} />
    </BaseModal>
  );
}
