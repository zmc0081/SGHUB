/**
 * SGHUB V2.2 — Tailwind Config Diff
 *
 * This is NOT a drop-in replacement file. It is a diff describing what to
 * MERGE INTO the existing `tailwind.config.js`. Sections marked [REMOVE]
 * should be deleted; [REPLACE] sections fully overwrite the v2.1 equivalent;
 * [ADD] sections are new additions.
 *
 * Strategy (locked by Q1 = B):
 *   All semantic colors are emitted as DIRECT HEX strings, not as
 *   `rgb(var(--xxx) / <alpha-value>)`. This means Tailwind opacity modifiers
 *   like `bg-navy/10` will NO LONGER WORK on these colors. Use the explicit
 *   shade tokens instead (navy-faint, navy-soft, navy-muted, navy-strong).
 *
 *   Tailwind /N opacity modifiers REMAIN AVAILABLE only on:
 *     - white, black, currentColor   → for one-off overlays
 *
 * Theme switching:
 *   Light = :root values (this file shows light only for brevity).
 *   Dark  = [data-theme="dark"] values (mirror structure, paired in
 *           src/styles/index.css). See design-tokens.json for dark values.
 *
 *   Tailwind colors are resolved at build time, so we can NOT put both
 *   light + dark into one Tailwind key. The approach is:
 *     (a) Tailwind colors point to CSS variables: `colors.navy: 'var(--navy)'`
 *     (b) CSS variables are defined twice in index.css:
 *           :root { --navy: #1F2E4D; }
 *           [data-theme="dark"] { --navy: #3D5688; }
 *     (c) Theme switch flips the data attribute, all classes pick up new color
 *
 *   This still gives us HEX-direct semantics (no /N modifier auto-magic) while
 *   keeping theme switch zero-rebuild.
 */

module.exports = {
  // ════════════════════════════════════════════════════════════════════════
  // [KEEP UNCHANGED] content paths
  // ════════════════════════════════════════════════════════════════════════
  content: ['./index.html', './src/**/*.{ts,tsx}'],

  // ════════════════════════════════════════════════════════════════════════
  // [REPLACE] theme.extend
  // ════════════════════════════════════════════════════════════════════════
  theme: {
    extend: {
      // ────────────────────────────────────────────────────────────────
      // COLORS
      // ────────────────────────────────────────────────────────────────
      // [REMOVE] all of the following v2.1 keys:
      //   primary, accent, bg, fg, sidebar-bg, sidebar-fg,
      //   sidebar-fg-active, titlebar-bg, border
      //   (also remove any usage of bg-primary/5, /10, /20, text-app-fg/50 etc.)
      //
      // [ADD] V2.2 token-mapped colors. ALL POINT TO CSS VARIABLES so theme
      //       switching works.

      colors: {
        // ──── Brand: navy ────
        navy: 'var(--navy)',
        'navy-hover': 'var(--navy-hover)',
        'navy-active': 'var(--navy-active)',
        'navy-strong': 'var(--navy-strong)',
        'navy-muted': 'var(--navy-muted)',
        'navy-soft': 'var(--navy-soft)',
        'navy-faint': 'var(--navy-faint)',

        // ──── Brand: indigo ────
        indigo: 'var(--indigo)',
        'indigo-hover': 'var(--indigo-hover)',
        'indigo-soft': 'var(--indigo-soft)',
        'indigo-light': 'var(--indigo-light)',
        'indigo-muted': 'var(--indigo-muted)',

        // ──── Text ────
        // Naming: text-1 / text-2 / text-3 (replaces v2.1 text-app-fg/50/60/70)
        // In Tailwind these become: text-text-1 → ugly. Tailwind plugin alias
        // (see plugins[] below) gives shorter `text-fg-1` etc.
        'fg-1': 'var(--text-1)',
        'fg-2': 'var(--text-2)',
        'fg-3': 'var(--text-3)',
        'fg-inverse': 'var(--text-inverse)',
        'fg-link': 'var(--text-link)',

        // ──── Border ────
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        'border-focus': 'var(--border-focus)',
        'border-subtle': 'var(--border-subtle)',

        // ──── Background ────
        // Tailwind: bg-page, bg-soft, bg-card → already conflict-free
        page: 'var(--bg-page)',
        soft: 'var(--bg-soft)',
        card: 'var(--bg-card)',

        // ──── Feedback semantic ────
        'success-bg': 'var(--success-bg)',
        'success-fg': 'var(--success-fg)',
        'success-border': 'var(--success-border)',
        'danger-bg': 'var(--danger-bg)',
        'danger-fg': 'var(--danger-fg)',
        'danger-border': 'var(--danger-border)',
        'warning-bg': 'var(--warning-bg)',
        'warning-fg': 'var(--warning-fg)',
        'warning-fg-strong': 'var(--warning-fg-strong)',
        'warning-border': 'var(--warning-border)',
        'info-bg': 'var(--info-bg)',
        'info-fg': 'var(--info-fg)',
        'info-border': 'var(--info-border)',

        // ──── Badge semantic (changelog/state badges) ────
        'badge-update-bg': 'var(--badge-update-bg)',
        'badge-update-fg': 'var(--badge-update-fg)',
        'badge-improve-bg': 'var(--badge-improve-bg)',
        'badge-improve-fg': 'var(--badge-improve-fg)',
        'badge-bug-bg': 'var(--badge-bug-bg)',
        'badge-bug-fg': 'var(--badge-bug-fg)',
        'badge-new-bg': 'var(--badge-new-bg)',
        'badge-new-fg': 'var(--badge-new-fg)',
        'badge-default-bg': 'var(--badge-default-bg)',
        'badge-default-fg': 'var(--badge-default-fg)',

        // ──── Sidebar / Titlebar (SGHUB extension) ────
        'sidebar-bg': 'var(--sidebar-bg)',
        'sidebar-fg': 'var(--sidebar-fg)',
        'sidebar-fg-active': 'var(--sidebar-fg-active)',
        'sidebar-fg-hover': 'var(--sidebar-fg-hover)',
        'sidebar-bar': 'var(--sidebar-active-bar)',
        'titlebar-bg': 'var(--titlebar-bg)',
        'titlebar-fg': 'var(--titlebar-fg)',
        'titlebar-close-hover': 'var(--titlebar-close-hover)',

        // ──── Source badges (SGHUB extension) ────
        // Used as <SourceBadge source="arxiv"/> in code; classes available
        // for direct use too.
        'src-arxiv': 'var(--src-arxiv)',
        'src-arxiv-fg': 'var(--src-arxiv-fg)',
        'src-ss': 'var(--src-ss)',
        'src-ss-fg': 'var(--src-ss-fg)',
        'src-pubmed': 'var(--src-pubmed)',
        'src-pubmed-fg': 'var(--src-pubmed-fg)',
        'src-openalex': 'var(--src-openalex)',
        'src-openalex-fg': 'var(--src-openalex-fg)',
        'src-local': 'var(--src-local)',
        'src-local-fg': 'var(--src-local-fg)',

        // ──── Read status (Library card bar) ────
        'read-unread': 'var(--read-unread)',
        'read-reading': 'var(--read-reading)',
        'read-read': 'var(--read-read)',
        'read-parsed': 'var(--read-parsed)',

        // ──── Accent anchors (gradient stops) ────
        'purple-glow': 'var(--purple-glow)',
        'blue-glow': 'var(--blue-glow)',

        // ──── Tag palette (Library tag chips, 8-color cycle) ────
        // Exposed as 8 explicit Tailwind colors per Q5 decision:
        // Tailwind cannot resolve dynamic class names (bg-${index}) at build time,
        // so each palette slot becomes its own first-class color token.
        'tag-0': 'var(--tag-0)',
        'tag-1': 'var(--tag-1)',
        'tag-2': 'var(--tag-2)',
        'tag-3': 'var(--tag-3)',
        'tag-4': 'var(--tag-4)',
        'tag-5': 'var(--tag-5)',
        'tag-6': 'var(--tag-6)',
        'tag-7': 'var(--tag-7)',

        // ──── Modal backdrop overlay (theme-aware) ────
        // Light = rgba(0,0,0,0.4), Dark = rgba(0,0,0,0.6).
        // Use as `bg-overlay-modal-backdrop` on the backdrop element.
        // For other one-off neutral overlays (row hover scrim), prefer inline style.
        'overlay-modal-backdrop': 'var(--overlay-modal-backdrop)',
      },

      // ────────────────────────────────────────────────────────────────
      // BORDER RADIUS
      // ────────────────────────────────────────────────────────────────
      // [REMOVE] v2.1 used Tailwind defaults (rounded-md = 6px, etc.)
      //          We are NOT overriding defaults, we are ADDING semantic keys.
      //          Codebase should migrate to the named keys; the defaults can
      //          be kept as fallback for legacy.
      borderRadius: {
        pill: '999px',           // use: rounded-pill
        card: '16px',            // use: rounded-card
        'card-sm': '14px',       // use: rounded-card-sm (also for textarea)
        icon: '10px',            // use: rounded-icon
        sm: '8px',               // use: rounded-sm (note: overrides Tailwind default 0.125rem=2px → we deliberately set to 8px)
      },

      // ────────────────────────────────────────────────────────────────
      // BOX SHADOW
      // ────────────────────────────────────────────────────────────────
      // [REMOVE] v2.1 had no custom shadows (cards used border-black/10 only).
      // [ADD] navy-tinted shadow set, theme-aware via CSS variables.
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-sm': 'var(--shadow-card-sm)',
        'card-hover': 'var(--shadow-card-hover)',
        nav: 'var(--shadow-nav)',
        btn: 'var(--shadow-btn)',
        'btn-hover': 'var(--shadow-btn-hover)',
        modal: 'var(--shadow-modal)',
        focus: 'var(--shadow-focus)',
        'focus-danger': 'var(--shadow-focus-danger)',
      },

      // ────────────────────────────────────────────────────────────────
      // FONT FAMILY
      // ────────────────────────────────────────────────────────────────
      fontFamily: {
        // [REPLACE] v2.1 used system stack; v2.2 leads with Inter.
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei',
          'Hiragino Sans GB',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'SF Mono',
          'Consolas',
          'monospace',
        ],
      },

      // ────────────────────────────────────────────────────────────────
      // FONT SIZE
      // ────────────────────────────────────────────────────────────────
      // [ADD] semantic sizes mapped to KHX 9-step.
      // Existing Tailwind text-xs/sm/base/lg/xl/2xl remain available;
      // codebase should migrate to semantic names over time.
      fontSize: {
        display:     ['60px', { lineHeight: '1.2',  fontWeight: '700' }],
        'display-sm':['48px', { lineHeight: '1.2',  fontWeight: '700' }],
        h1:          ['36px', { lineHeight: '1.25', fontWeight: '700' }],
        h2:          ['24px', { lineHeight: '1.3',  fontWeight: '600' }],  // PAGE H1 (unified)
        h3:          ['18px', { lineHeight: '1.4',  fontWeight: '600' }],
        'body-lg':   ['18px', { lineHeight: '1.65', fontWeight: '400' }],
        body:        ['16px', { lineHeight: '1.65', fontWeight: '400' }],
        caption:     ['14px', { lineHeight: '1.5',  fontWeight: '400' }],
        meta:        ['12px', { lineHeight: '1.5',  fontWeight: '500' }],
        micro:       ['11px', { lineHeight: '1.4',  fontWeight: '500' }],
      },

      // ────────────────────────────────────────────────────────────────
      // LETTER SPACING
      // ────────────────────────────────────────────────────────────────
      letterSpacing: {
        'wide-brand': '0.05em', // for "SGHUB" wordmark + section uppercase labels
      },

      // ────────────────────────────────────────────────────────────────
      // SPACING
      // ────────────────────────────────────────────────────────────────
      // [KEEP] sidebar / titlebar from v2.1
      // [ADD] component padding tokens (Q3 = A)
      spacing: {
        // v2.1 retained
        sidebar:  '220px',
        titlebar: '36px',

        // V2.2 new — sidebar variants
        'session-list':  '240px',   // Chat session list (w-60)
        'parse-history': '256px',   // Parse history sidebar (w-64)
        'side-panel':    '288px',   // Feed / Library left panel (w-72)

        // V2.2 new — KHX paddings as first-class tokens
        'btn-x':       '22px',
        'btn-y':       '12px',
        'btn-x-sm':    '14px',
        'btn-y-sm':    '8px',
        'btn-x-lg':    '26px',
        'btn-y-lg':    '14px',
        'input-x':     '18px',
        'input-y':     '12px',
        'textarea-x':  '18px',
        'textarea-y':  '14px',

        // Read-status color bar width (Library card)
        'read-bar':    '10px',
        // Sidebar active-bar width (left accent)
        'active-bar':  '4px',
      },

      // ────────────────────────────────────────────────────────────────
      // TRANSITIONS
      // ────────────────────────────────────────────────────────────────
      transitionDuration: {
        instant: '0ms',
        fast:    '120ms',
        base:    '180ms',
        slow:    '240ms',
      },
      transitionTimingFunction: {
        khx:        'cubic-bezier(0.4, 0, 0.2, 1)',
        decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
        accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
      },

      // ────────────────────────────────────────────────────────────────
      // Z-INDEX
      // ────────────────────────────────────────────────────────────────
      zIndex: {
        base:     '0',
        elevated: '10',
        dropdown: '20',
        popover:  '30',
        modal:    '40',
        toast:    '50',
        tooltip:  '60',
        titlebar: '100',
      },

      // ────────────────────────────────────────────────────────────────
      // BACKGROUND IMAGE (gradients)
      // ────────────────────────────────────────────────────────────────
      backgroundImage: {
        'stage-gradient': 'var(--bg-gradient)',
        'glow-purple':    'var(--glow-purple)',
        'glow-blue':      'var(--glow-blue)',
      },
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // [ADD] plugins — utility shorthands for the most common patterns
  // ════════════════════════════════════════════════════════════════════════
  plugins: [
    // Optional: small plugin to expose `text-1`/`text-2`/`text-3` as text
    // utilities directly (instead of `text-fg-1`). If desired:
    //
    // function ({ addUtilities, theme }) {
    //   addUtilities({
    //     '.text-1': { color: 'var(--text-1)' },
    //     '.text-2': { color: 'var(--text-2)' },
    //     '.text-3': { color: 'var(--text-3)' },
    //     '.bg-stage': { backgroundImage: 'var(--bg-gradient)' },
    //   });
    // },
  ],
};


// ═══════════════════════════════════════════════════════════════════════════════
// COMPANION FILE: src/styles/index.css — REQUIRED ADDITIONS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Below is the CSS-variable block that must be added to src/styles/index.css.
// Tailwind colors above reference these variables; without them, the theme
// will not render. This is the SINGLE SOURCE OF TRUTH for runtime values.
//
// The CSS is held in a JavaScript template literal (not a /* */ block comment)
// because CSS-block comments inside would prematurely close the outer comment.
// This string is for documentation only — it is NOT exported and not used at
// runtime. Copy its contents (between the backticks) verbatim into index.css.
// ───────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
const __INDEX_CSS_BLOCK__ = `
:root {
  /* ── Brand: navy ── */
  --navy:           #1F2E4D;
  --navy-hover:     #2A3A5F;
  --navy-active:    #15203A;
  --navy-strong:    #15203A;
  --navy-muted:     #D9DEEA;
  --navy-soft:      #E8EBF2;
  --navy-faint:     #F3F5F9;

  /* ── Brand: indigo ── */
  --indigo:         #4F46E5;
  --indigo-hover:   #3730A3;
  --indigo-soft:    #EEF0FF;
  --indigo-light:   #E0E5FF;
  --indigo-muted:   #C8D0FF;

  /* ── Text ── */
  --text-1:         #1F2E4D;
  --text-2:         #5C6B88;
  --text-3:         #939EB3;
  --text-inverse:   #FFFFFF;
  --text-link:      #4F46E5;

  /* ── Border ── */
  --border-default: #ECEEF5;
  --border-strong:  #D9DEEA;
  --border-focus:   #1F2E4D;
  --border-subtle:  #F3F5F9;

  /* ── Background ── */
  --bg-page:        #FFFFFF;
  --bg-soft:        #F8FAFF;
  --bg-card:        #FFFFFF;

  /* ── Feedback ── */
  --success-bg:     #DEF5E2;
  --success-fg:     #1A8A3A;
  --success-border: #A8D8B0;
  --danger-bg:      #FFE0E0;
  --danger-fg:      #C8323C;
  --danger-border:  #F0B0B0;
  --warning-bg:     #FFF3C2;
  --warning-fg:     #D4AE00;
  --warning-fg-strong: #8A6D00;
  --warning-border: #EBD480;
  --info-bg:        #EEF0FF;
  --info-fg:        #4F46E5;
  --info-border:    #C8D0FF;

  /* ── Badges ── */
  --badge-update-bg:   #EEF0FF;
  --badge-update-fg:   #4F46E5;
  --badge-improve-bg:  #DEF5E2;
  --badge-improve-fg:  #1A8A3A;
  --badge-bug-bg:      #FFE0E0;
  --badge-bug-fg:      #C8323C;
  --badge-new-bg:      #FFF3C2;
  --badge-new-fg:      #8A6D00;
  --badge-default-bg:  #ECEEF5;
  --badge-default-fg:  #5C6B88;

  /* ── Sidebar / Titlebar ── */
  --sidebar-bg:         #1F2E4D;
  --sidebar-fg:         #C8C8D0;
  --sidebar-fg-active:  #FFFFFF;
  --sidebar-fg-hover:   #E8E8EC;
  --sidebar-active-bar: #4F46E5;
  --titlebar-bg:        #1F2E4D;
  --titlebar-fg:        #C8C8D0;
  --titlebar-close-hover: #DC2626;

  /* ── Source badges ── */
  --src-arxiv:      #B31B1B;
  --src-arxiv-fg:   #FFFFFF;
  --src-ss:         #1857B6;
  --src-ss-fg:      #FFFFFF;
  --src-pubmed:     #00897B;
  --src-pubmed-fg:  #FFFFFF;
  --src-openalex:   #7B3FBF;
  --src-openalex-fg:#FFFFFF;
  --src-local:      #6B7280;
  --src-local-fg:   #FFFFFF;

  /* ── Read status ── */
  --read-unread:   #D9DEEA;  /* = border-strong */
  --read-reading:  #D4AE00;  /* = warning-fg */
  --read-read:     #1A8A3A;  /* = success-fg */
  --read-parsed:   #4F46E5;  /* = indigo */

  /* ── Accent anchors ── */
  --purple-glow:   #7D42FB;
  --blue-glow:     #8DADFD;

  /* ── Tag palette (Library tag chips) ── */
  --tag-0:         #1F2E4D;
  --tag-1:         #4F46E5;
  --tag-2:         #1A8A3A;
  --tag-3:         #C8323C;
  --tag-4:         #7D42FB;
  --tag-5:         #06B6D4;
  --tag-6:         #D4AE00;
  --tag-7:         #EC4899;

  /* ── Overlay (theme-aware modal backdrop) ── */
  --overlay-modal-backdrop: rgba(0, 0, 0, 0.4);

  /* ── Gradients ── */
  --bg-gradient:   linear-gradient(135deg, #F8FAFF 0%, #F0F2FB 100%);
  --glow-purple:   radial-gradient(circle, rgba(125,66,251,0.18) 0%, transparent 70%);
  --glow-blue:     radial-gradient(circle, rgba(141,173,253,0.22) 0%, transparent 70%);

  /* ── Shadows ── */
  --shadow-card:        0 1px 2px rgba(31,46,77,.04), 0 8px 24px rgba(31,46,77,.06);
  --shadow-card-sm:     0 1px 2px rgba(31,46,77,.04), 0 4px 14px rgba(31,46,77,.05);
  --shadow-card-hover:  0 2px 4px rgba(31,46,77,.06), 0 12px 32px rgba(31,46,77,.10);
  --shadow-nav:         0 4px 24px rgba(31,46,77,.08);
  --shadow-btn:         0 4px 12px rgba(31,46,77,.18);
  --shadow-btn-hover:   0 6px 16px rgba(31,46,77,.22);
  --shadow-modal:       0 20px 40px rgba(31,46,77,.18);
  --shadow-focus:       0 0 0 3px rgba(31,46,77,.08);
  --shadow-focus-danger:0 0 0 3px rgba(200,50,60,.12);
}

[data-theme="dark"] {
  /* ── Brand: navy ── */
  --navy:           #3D5688;
  --navy-hover:     #4A6BA8;
  --navy-active:    #5A7BC8;
  --navy-strong:    #5A7BC8;
  --navy-muted:     #3D4866;
  --navy-soft:      #252D40;
  --navy-faint:     #1C2233;

  /* ── Brand: indigo ── */
  --indigo:         #7B73F0;
  --indigo-hover:   #9890F5;
  --indigo-soft:    #1F1F33;
  --indigo-light:   #2A2A4D;
  --indigo-muted:   #3D3D66;

  /* ── Text ── */
  --text-1:         #E8E8EC;
  --text-2:         #9CA3B8;
  --text-3:         #7A8298;   /* adjusted from spec #5C6478 (failed AA) */
  --text-inverse:   #FFFFFF;
  --text-link:      #7B73F0;

  /* ── Border ── */
  --border-default: #252A38;
  --border-strong:  #363B4D;
  --border-focus:   #7B73F0;
  --border-subtle:  #1C2233;

  /* ── Background ── */
  --bg-page:        #0F1115;
  --bg-soft:        #161922;
  --bg-card:        #1A1E2A;

  /* ── Feedback ── */
  --success-bg:     #0F2A1F;
  --success-fg:     #4ADE80;
  --success-border: #1E5128;
  --danger-bg:      #2A0F0F;
  --danger-fg:      #F87171;
  --danger-border:  #5C1F1F;
  --warning-bg:     #2A2208;
  --warning-fg:     #FCD34D;
  --warning-fg-strong: #FCD34D;
  --warning-border: #5C4A1F;
  --info-bg:        #1F1F33;
  --info-fg:        #7B73F0;
  --info-border:    #3D3D66;

  /* ── Badges ── */
  --badge-update-bg:   #1F1F33;
  --badge-update-fg:   #7B73F0;
  --badge-improve-bg:  #0F2A1F;
  --badge-improve-fg:  #4ADE80;
  --badge-bug-bg:      #2A0F0F;
  --badge-bug-fg:      #F87171;
  --badge-new-bg:      #2A2208;
  --badge-new-fg:      #FCD34D;
  --badge-default-bg:  #252A38;
  --badge-default-fg:  #9CA3B8;

  /* ── Sidebar / Titlebar ── */
  --sidebar-bg:         #0F1115;
  --sidebar-fg:         #B0B0BC;
  --sidebar-fg-active:  #FFFFFF;
  --sidebar-fg-hover:   #E8E8EC;
  --sidebar-active-bar: #7B73F0;
  --titlebar-bg:        #0F1115;
  --titlebar-fg:        #B0B0BC;
  --titlebar-close-hover: #DC2626;

  /* ── Source badges ── */
  --src-arxiv:      #D62828;
  --src-ss:         #3A7BD5;
  --src-pubmed:     #1FAE9F;
  --src-openalex:   #9F5FE0;
  --src-local:      #9CA3AF;

  /* ── Read status ── */
  --read-unread:   #363B4D;
  --read-reading:  #FCD34D;
  --read-read:     #4ADE80;
  --read-parsed:   #7B73F0;

  /* ── Tag palette (Library tag chips) — dark variants ── */
  --tag-0:         #3D5688;
  --tag-1:         #7B73F0;
  --tag-2:         #4ADE80;
  --tag-3:         #F87171;
  --tag-4:         #9F65FF;
  --tag-5:         #22D3EE;
  --tag-6:         #FCD34D;
  --tag-7:         #F472B6;

  /* ── Overlay (theme-aware modal backdrop) ── */
  --overlay-modal-backdrop: rgba(0, 0, 0, 0.6);

  /* ── Gradients ── */
  --bg-gradient:   linear-gradient(135deg, #161922 0%, #1F2335 100%);
  --glow-purple:   radial-gradient(circle, rgba(125,66,251,0.25) 0%, transparent 70%);
  --glow-blue:     radial-gradient(circle, rgba(141,173,253,0.30) 0%, transparent 70%);

  /* ── Shadows ── */
  --shadow-card:        0 1px 2px rgba(0,0,0,.3),  0 8px 24px rgba(0,0,0,.4);
  --shadow-card-sm:     0 1px 2px rgba(0,0,0,.3),  0 4px 14px rgba(0,0,0,.35);
  --shadow-card-hover:  0 2px 4px rgba(0,0,0,.35), 0 12px 32px rgba(0,0,0,.5);
  --shadow-nav:         0 4px 24px rgba(0,0,0,.5);
  --shadow-btn:         0 4px 12px rgba(0,0,0,.5);
  --shadow-btn-hover:   0 6px 16px rgba(0,0,0,.55);
  --shadow-modal:       0 20px 40px rgba(0,0,0,.6);
  --shadow-focus:       0 0 0 3px rgba(123,115,240,.2);
  --shadow-focus-danger:0 0 0 3px rgba(248,113,113,.2);
}
`;

/*
══════════════════════════════════════════════════════════════════════════════
USAGE EXAMPLES (for reviewer)
══════════════════════════════════════════════════════════════════════════════

V2.1 → V2.2 migration patterns:

  bg-primary               →  bg-navy
  bg-primary/5             →  bg-navy-faint
  bg-primary/10            →  bg-navy-soft
  bg-primary/20            →  bg-navy-muted
  hover:bg-primary/90      →  hover:bg-navy-hover
  border-primary           →  border-navy
  ring-1 ring-primary/20   →  ring-1 ring-indigo-muted
  text-primary             →  text-navy   (LIGHT MODE)
                              text-fg-1   (DARK MODE — H1 readability)
                              → use semantic component classes to handle both

  text-app-fg              →  text-fg-1
  text-app-fg/50           →  text-fg-3
  text-app-fg/60           →  text-fg-3
  text-app-fg/70           →  text-fg-2

  bg-app-bg                →  bg-page
  border-black/10          →  border-border-default
  border-black/5           →  border-border-subtle

  rounded-md               →  rounded-card    (16px)
  rounded                  →  rounded-pill    (for buttons / chips / inputs)
                              rounded-card-sm (for textareas)

  bg-accent (yellow)       →  bg-badge-update-bg + text-badge-update-fg
                              (NEW Skill badge etc — converted to indigo)
                              OR bg-warning-bg + text-warning-fg-strong
                              (genuinely warning semantics)

  transition-colors        →  transition-colors duration-base ease-khx
  transition-all           →  ❌ FORBIDDEN — pick specific transition + token
*/
