/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        accent: "var(--accent)",
        "app-bg": "var(--bg)",
        "app-fg": "var(--fg)",
        sidebar: "var(--sidebar-bg)",
        "sidebar-fg": "var(--sidebar-fg)",
        "sidebar-fg-active": "var(--sidebar-fg-active)",
        titlebar: "var(--titlebar-bg)",
        "titlebar-fg": "var(--titlebar-fg)",
        border: "var(--border)",
      },
      spacing: {
        sidebar: "220px",
        titlebar: "36px",
      },
    },
  },
  plugins: [],
};
