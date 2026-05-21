// V2.2.1 Session 27 — Privacy policy viewer.
//
// Loads the policy markdown via Vite `?raw` import so the bundled
// content ships with the desktop app (offline-first; no fetch needed).
// Has its own language toggle independent of the app language — a user
// reading the Chinese app can still review the English text and vice
// versa, without round-tripping through Settings → Language.
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { BaseModal } from "./BaseModal";

// eslint-disable-next-line import/no-unresolved
import zhContent from "../assets/privacy/zh-CN.md?raw";
// eslint-disable-next-line import/no-unresolved
import enContent from "../assets/privacy/en-US.md?raw";

type Lang = "zh-CN" | "en-US";

const CONTENT: Record<Lang, string> = {
  "zh-CN": zhContent,
  "en-US": enContent,
};

export interface PrivacyPolicyDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PrivacyPolicyDialog({ open, onClose }: PrivacyPolicyDialogProps) {
  const { i18n, t } = useTranslation();

  // Default to the current app language; user can flip independently.
  const initial: Lang = i18n.language === "zh-CN" ? "zh-CN" : "en-US";
  const [lang, setLang] = useState<Lang>(initial);

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      size="lg"
      title={t("settings.privacy_title")}
      description={t("settings.privacy_subtitle")}
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

      {/* Markdown body. Tailwind utility classes mimic a tight prose
          scale (we don't ship @tailwindcss/typography). */}
      <article className="text-caption text-fg-1 leading-relaxed space-y-3 [&_h1]:text-h3 [&_h1]:font-semibold [&_h1]:text-fg-1 [&_h1]:mt-0 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg-1 [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-caption [&_h3]:font-semibold [&_h3]:text-fg-1 [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:my-1 [&_a]:text-indigo [&_a]:underline [&_a:hover]:text-indigo-hover [&_strong]:font-semibold [&_strong]:text-fg-1 [&_code]:font-mono [&_code]:text-meta [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm [&_code]:bg-navy-faint [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-meta [&_th]:text-left [&_th]:font-semibold [&_th]:px-2 [&_th]:py-1.5 [&_th]:border-b [&_th]:border-border-default [&_td]:px-2 [&_td]:py-1.5 [&_td]:border-b [&_td]:border-border-subtle [&_td]:align-top [&_blockquote]:border-l-2 [&_blockquote]:border-indigo [&_blockquote]:bg-info-bg [&_blockquote]:pl-3 [&_blockquote]:py-1.5 [&_blockquote]:my-3 [&_blockquote]:text-fg-2 [&_blockquote]:rounded-r-sm [&_hr]:my-5 [&_hr]:border-border-subtle">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {CONTENT[lang]}
        </ReactMarkdown>
      </article>
    </BaseModal>
  );
}
