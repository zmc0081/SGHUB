// V2.2.4 — shared Tailwind class strings for the onboarding wizard.
// Composed from the same V2.2 tokens the rest of the app uses (see
// Models.tsx / BaseModal.tsx) so the wizard matches the design system
// without re-deriving the long utility chains in every step.

/** Primary action — solid navy pill (e.g. 下一步 / 完成 / 开始设置). */
export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 px-btn-x py-btn-y rounded-pill " +
  "bg-navy text-fg-inverse text-caption font-medium shadow-btn " +
  "hover:bg-navy-hover hover:shadow-btn-hover hover:-translate-y-px " +
  "disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed " +
  "transition-[background,box-shadow,transform] duration-fast ease-khx";

/** Secondary action — outline pill (e.g. 上一步). */
export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 px-btn-x py-btn-y rounded-pill " +
  "border border-border-default bg-card text-fg-1 text-caption font-medium " +
  "hover:border-navy hover:text-navy " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "transition-colors duration-fast ease-khx";

/** Tertiary / quiet action — text only (e.g. 跳过此步 / 跳过,直接进入). */
export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 px-btn-x py-btn-y rounded-pill " +
  "text-fg-2 text-caption font-medium " +
  "hover:text-fg-1 hover:bg-navy-faint " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "transition-colors duration-fast ease-khx";

/** Text input / select — pill field. */
export const FIELD =
  "w-full px-input-x py-input-y rounded-pill border border-border-default bg-card " +
  "text-fg-1 text-caption placeholder:text-fg-3 " +
  "focus:outline-none focus:border-border-focus focus:shadow-focus " +
  "transition-colors duration-fast ease-khx";
