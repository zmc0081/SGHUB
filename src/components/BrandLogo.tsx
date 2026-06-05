// V2.2.2 — SG Hub brand logo (folder + golden vertical bookmark).
//
// Rebuilt from the "SG Hub logo design 应用版" design spec (upright/portrait
// reference). Single source of truth for the in-app mark + lockup. Theme
// adaptation is handled by `currentColor`: the folder outline inherits the
// caller's text color (the sidebar and titlebar are always on a dark navy
// surface, so it reads as the paper outline in both light/dark app themes),
// while the bookmark is the fixed brand gold token (`--brand-gold`). No
// hardcoded hex here — see src/styles/index.css for the token,
// tailwind.config.js for the mapping.
//
// Geometry (64-unit viewBox):
//   • Folder — landscape document folder with a raised tab on the upper
//     left (tab top y=16) sloping down a shoulder to the body top (y=22);
//     body spans x 10..54, bottom y=52. Outer corners rounded r=4.
//   • Bookmark — vertical gold ribbon hanging from the body-top edge,
//     right-of-center (x 36..44), ending in a bottom swallowtail (tail
//     tips at y=36, notch vertex up at y=33).
//
// The same two paths are mirrored in src-tauri/icons/app-icon.svg (the
// desktop-icon source). Keep them in sync if the mark geometry changes.
// NOTE: the bookmark is drawn BEFORE the folder so the folder's body-top
// edge crosses in front of the bookmark (it appears to hang from the edge).

/** Folder with a raised upper-left tab (clockwise from the tab top-left). */
const CARD_PATH =
  "M14 16 H25 L29 22 H50 A4 4 0 0 1 54 26 V48 A4 4 0 0 1 50 52 H14 A4 4 0 0 1 10 48 V20 A4 4 0 0 1 14 16 Z";
/** Golden vertical bookmark with a bottom swallowtail notch. */
const FLAG_PATH = "M36 22 H44 V36 L40 33 L36 36 Z";

export function LogoMark({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d={FLAG_PATH} className="fill-brand-gold" />
      <path
        d={CARD_PATH}
        className="stroke-current"
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Full primary lockup: mark + "SG Hub" serif wordmark + "Academic AI"
 * subtitle. Used in the expanded sidebar. Colors come from the sidebar
 * tokens since that is its only mount point.
 */
export function LogoLockup({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={30} className="shrink-0 text-sidebar-fg-active" />
      <div className="flex flex-col leading-none">
        <span className="font-serif text-lg font-bold tracking-wide-brand text-sidebar-fg-active">
          SG Hub
        </span>
        <span className="mt-1 text-micro font-medium uppercase tracking-[0.22em] text-sidebar-fg/70">
          Academic AI
        </span>
      </div>
    </div>
  );
}
