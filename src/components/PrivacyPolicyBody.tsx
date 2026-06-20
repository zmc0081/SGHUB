// V2.2.6 — shared privacy-policy renderer.
//
// The policy markdown ships with the app (Vite `?raw` import, offline-first).
// Both the Settings viewer (PrivacyPolicyDialog) and the first-run mandatory
// consent screen (PrivacyConsentScreen) render through this one component so
// the styling and bundled content never drift.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import zhContent from "../assets/privacy/zh-CN.md?raw";
import enContent from "../assets/privacy/en-US.md?raw";

export type PrivacyLang = "zh-CN" | "en-US";

export const PRIVACY_CONTENT: Record<PrivacyLang, string> = {
  "zh-CN": zhContent,
  "en-US": enContent,
};

// Tailwind utility classes mimic a tight prose scale (we don't ship
// @tailwindcss/typography). Kept in one place so both callers match.
const ARTICLE_CLASS =
  "text-caption text-fg-1 leading-relaxed space-y-3 [&_h1]:text-h3 [&_h1]:font-semibold [&_h1]:text-fg-1 [&_h1]:mt-0 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg-1 [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-caption [&_h3]:font-semibold [&_h3]:text-fg-1 [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_li]:my-1 [&_a]:text-indigo [&_a]:underline [&_a:hover]:text-indigo-hover [&_strong]:font-semibold [&_strong]:text-fg-1 [&_code]:font-mono [&_code]:text-meta [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-sm [&_code]:bg-navy-faint [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-meta [&_th]:text-left [&_th]:font-semibold [&_th]:px-2 [&_th]:py-1.5 [&_th]:border-b [&_th]:border-border-default [&_td]:px-2 [&_td]:py-1.5 [&_td]:border-b [&_td]:border-border-subtle [&_td]:align-top [&_blockquote]:border-l-2 [&_blockquote]:border-indigo [&_blockquote]:bg-info-bg [&_blockquote]:pl-3 [&_blockquote]:py-1.5 [&_blockquote]:my-3 [&_blockquote]:text-fg-2 [&_blockquote]:rounded-r-sm [&_hr]:my-5 [&_hr]:border-border-subtle";

export function PrivacyPolicyBody({ lang }: { lang: PrivacyLang }) {
  return (
    <article className={ARTICLE_CLASS}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{PRIVACY_CONTENT[lang]}</ReactMarkdown>
    </article>
  );
}
