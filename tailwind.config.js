/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ──── Brand: navy ────
        navy: "var(--navy)",
        "navy-hover": "var(--navy-hover)",
        "navy-active": "var(--navy-active)",
        "navy-strong": "var(--navy-strong)",
        "navy-muted": "var(--navy-muted)",
        "navy-soft": "var(--navy-soft)",
        "navy-faint": "var(--navy-faint)",

        // ──── Brand: indigo ────
        indigo: "var(--indigo)",
        "indigo-hover": "var(--indigo-hover)",
        "indigo-soft": "var(--indigo-soft)",
        "indigo-light": "var(--indigo-light)",
        "indigo-muted": "var(--indigo-muted)",

        // ──── Brand: gold (V2.2.2 logo accent) ────
        "brand-gold": "var(--brand-gold)",

        // ──── Text ────
        "fg-1": "var(--text-1)",
        "fg-2": "var(--text-2)",
        "fg-3": "var(--text-3)",
        "fg-inverse": "var(--text-inverse)",
        "fg-link": "var(--text-link)",

        // ──── Border ────
        "border-default": "var(--border-default)",
        "border-strong": "var(--border-strong)",
        "border-focus": "var(--border-focus)",
        "border-subtle": "var(--border-subtle)",

        // ──── Background ────
        page: "var(--bg-page)",
        soft: "var(--bg-soft)",
        card: "var(--bg-card)",

        // ──── Feedback semantic ────
        "success-bg": "var(--success-bg)",
        "success-fg": "var(--success-fg)",
        "success-border": "var(--success-border)",
        "danger-bg": "var(--danger-bg)",
        "danger-fg": "var(--danger-fg)",
        "danger-border": "var(--danger-border)",
        "warning-bg": "var(--warning-bg)",
        "warning-fg": "var(--warning-fg)",
        "warning-fg-strong": "var(--warning-fg-strong)",
        "warning-border": "var(--warning-border)",
        "info-bg": "var(--info-bg)",
        "info-fg": "var(--info-fg)",
        "info-border": "var(--info-border)",

        // ──── Badge semantic ────
        "badge-update-bg": "var(--badge-update-bg)",
        "badge-update-fg": "var(--badge-update-fg)",
        "badge-improve-bg": "var(--badge-improve-bg)",
        "badge-improve-fg": "var(--badge-improve-fg)",
        "badge-bug-bg": "var(--badge-bug-bg)",
        "badge-bug-fg": "var(--badge-bug-fg)",
        "badge-new-bg": "var(--badge-new-bg)",
        "badge-new-fg": "var(--badge-new-fg)",
        "badge-default-bg": "var(--badge-default-bg)",
        "badge-default-fg": "var(--badge-default-fg)",

        // ──── Sidebar / Titlebar (SGHUB extension) ────
        "sidebar-bg": "var(--sidebar-bg)",
        "sidebar-fg": "var(--sidebar-fg)",
        "sidebar-fg-active": "var(--sidebar-fg-active)",
        "sidebar-fg-hover": "var(--sidebar-fg-hover)",
        "sidebar-bar": "var(--sidebar-active-bar)",
        "titlebar-bg": "var(--titlebar-bg)",
        "titlebar-fg": "var(--titlebar-fg)",
        "titlebar-close-hover": "var(--titlebar-close-hover)",

        // ──── Source badges (SGHUB extension) ────
        "src-arxiv": "var(--src-arxiv)",
        "src-arxiv-fg": "var(--src-arxiv-fg)",
        "src-ss": "var(--src-ss)",
        "src-ss-fg": "var(--src-ss-fg)",
        "src-pubmed": "var(--src-pubmed)",
        "src-pubmed-fg": "var(--src-pubmed-fg)",
        "src-openalex": "var(--src-openalex)",
        "src-openalex-fg": "var(--src-openalex-fg)",
        "src-local": "var(--src-local)",
        "src-local-fg": "var(--src-local-fg)",
        // V2.2.3 — new sources
        "src-crossref": "var(--src-crossref)",
        "src-crossref-fg": "var(--src-crossref-fg)",
        "src-core": "var(--src-core)",
        "src-core-fg": "var(--src-core-fg)",
        "src-dblp": "var(--src-dblp)",
        "src-dblp-fg": "var(--src-dblp-fg)",
        "src-doaj": "var(--src-doaj)",
        "src-doaj-fg": "var(--src-doaj-fg)",

        // ──── Read status (Library card bar) ────
        "read-unread": "var(--read-unread)",
        "read-reading": "var(--read-reading)",
        "read-read": "var(--read-read)",
        "read-parsed": "var(--read-parsed)",

        // ──── Accent anchors (gradient stops) ────
        "purple-glow": "var(--purple-glow)",
        "blue-glow": "var(--blue-glow)",

        // ──── Tag palette (Library tag chips, 8-color cycle) ────
        "tag-0": "var(--tag-0)",
        "tag-1": "var(--tag-1)",
        "tag-2": "var(--tag-2)",
        "tag-3": "var(--tag-3)",
        "tag-4": "var(--tag-4)",
        "tag-5": "var(--tag-5)",
        "tag-6": "var(--tag-6)",
        "tag-7": "var(--tag-7)",

        // ──── Modal backdrop overlay (theme-aware) ────
        "overlay-modal-backdrop": "var(--overlay-modal-backdrop)",
      },

      borderRadius: {
        pill: "999px",
        card: "16px",
        "card-sm": "14px",
        icon: "10px",
        sm: "8px",
      },

      boxShadow: {
        card: "var(--shadow-card)",
        "card-sm": "var(--shadow-card-sm)",
        "card-hover": "var(--shadow-card-hover)",
        nav: "var(--shadow-nav)",
        btn: "var(--shadow-btn)",
        "btn-hover": "var(--shadow-btn-hover)",
        modal: "var(--shadow-modal)",
        focus: "var(--shadow-focus)",
        "focus-danger": "var(--shadow-focus-danger)",
      },

      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "Hiragino Sans GB",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "Consolas",
          "monospace",
        ],
        // V2.2.2 — brand wordmark (logo lockup). Source Serif 4 is the
        // design-spec face; Georgia/Times provide the serif fallback
        // until/unless the webfont is bundled.
        serif: [
          "Source Serif 4",
          "Source Serif Pro",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
      },

      fontSize: {
        display: ["60px", { lineHeight: "1.2", fontWeight: "700" }],
        "display-sm": ["48px", { lineHeight: "1.2", fontWeight: "700" }],
        h1: ["36px", { lineHeight: "1.25", fontWeight: "700" }],
        h2: ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.65", fontWeight: "400" }],
        body: ["16px", { lineHeight: "1.65", fontWeight: "400" }],
        caption: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        meta: ["12px", { lineHeight: "1.5", fontWeight: "500" }],
        micro: ["11px", { lineHeight: "1.4", fontWeight: "500" }],
      },

      letterSpacing: {
        "wide-brand": "0.05em",
      },

      spacing: {
        sidebar: "220px",
        titlebar: "36px",

        "session-list": "240px",
        "parse-history": "256px",
        "side-panel": "288px",

        "btn-x": "22px",
        "btn-y": "12px",
        "btn-x-sm": "14px",
        "btn-y-sm": "8px",
        "btn-x-lg": "26px",
        "btn-y-lg": "14px",
        "input-x": "18px",
        "input-y": "12px",
        "textarea-x": "18px",
        "textarea-y": "14px",

        "read-bar": "10px",
        "active-bar": "4px",
      },

      transitionDuration: {
        instant: "0ms",
        fast: "120ms",
        base: "180ms",
        slow: "240ms",
      },
      transitionTimingFunction: {
        khx: "cubic-bezier(0.4, 0, 0.2, 1)",
        decelerate: "cubic-bezier(0, 0, 0.2, 1)",
        accelerate: "cubic-bezier(0.4, 0, 1, 1)",
      },

      zIndex: {
        base: "0",
        elevated: "10",
        dropdown: "20",
        popover: "30",
        modal: "40",
        toast: "50",
        tooltip: "60",
        titlebar: "100",
      },

      backgroundImage: {
        "stage-gradient": "var(--bg-gradient)",
        "glow-purple": "var(--glow-purple)",
        "glow-blue": "var(--glow-blue)",
      },
    },
  },
  plugins: [],
};
