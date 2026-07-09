// i18n: 本组件文案已国际化 (V2.1.0)
// V2.2.1 — collapse/expand support + bottom copyright footer (Session 26)
// V2.2.8 — version line under the copyright (from tauri.conf.json, never
// hard-coded — same source as Settings, so the release version-check holds).
import { useEffect, useState, ComponentType, SVGProps } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Brain,
  MessageSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";
import { api } from "../lib/tauri";
import { useT } from "../hooks/useT";
import { useParseStore } from "../stores/parseStore";
import { Icon } from "./Icon";
import { LogoMark, LogoLockup } from "./BrandLogo";

type BadgeKind = "new" | "unread" | null;

type NavItem = {
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** i18next key under the `sidebar` namespace. */
  labelKey: string;
  badge: BadgeKind;
};

// Single flat nav list — the old "工作区" / "设置" grouping was removed
// (V2.1.0). Order: Chat first (newest, most-used), then read flow
// (search → feed → parse → library), then management (skills → models
// → settings).
const NAV_ITEMS: NavItem[] = [
  { to: "/chat", icon: MessageSquare, labelKey: "sidebar.chat", badge: null },
  { to: "/search", icon: Search, labelKey: "sidebar.search", badge: null },
  { to: "/feed", icon: Newspaper, labelKey: "sidebar.feed", badge: "unread" },
  { to: "/parse", icon: Brain, labelKey: "sidebar.parse", badge: null },
  { to: "/library", icon: Star, labelKey: "sidebar.library", badge: null },
  { to: "/skills", icon: Sparkles, labelKey: "sidebar.skills", badge: null },
  // V2.2.6 — the standalone "AI Store" entry was removed; its product
  // listing now lives inside the 模型配置 (Models) page.
  { to: "/models", icon: Bot, labelKey: "sidebar.models", badge: null },
  { to: "/settings", icon: Settings, labelKey: "sidebar.settings", badge: null },
];

const UNREAD_POLL_MS = 30_000;
const SIDEBAR_COLLAPSE_KEY = "sghub.sidebar.collapsed.v1";
/** Auto-collapse on first launch if the window is narrower than this. */
const NARROW_WINDOW_BREAKPOINT_PX = 900;

/**
 * Read collapsed preference from localStorage. First-launch fallback:
 * collapse if the window is narrow (< 900px). Subsequent launches
 * always respect the saved value, so a user who manually expanded on a
 * narrow window does NOT get re-collapsed on every restart.
 */
function loadCollapsedPref(): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
    if (raw === null) {
      return (
        typeof window !== "undefined" &&
        window.innerWidth < NARROW_WINDOW_BREAKPOINT_PX
      );
    }
    return raw === "true";
  } catch {
    return false;
  }
}

function saveCollapsedPref(c: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, c ? "true" : "false");
  } catch {
    /* private mode / quota — silently ignore */
  }
}

function SidebarItem({
  item,
  active,
  unread,
  collapsed,
  label,
  newBadgeLabel,
  parsing,
}: {
  item: NavItem;
  active: boolean;
  unread: number;
  collapsed: boolean;
  label: string;
  newBadgeLabel: string;
  /** V2.2.9 (Session 45) — a parse task is streaming (AI 解析 item only). */
  parsing?: boolean;
}) {
  const stateClass = active
    ? "text-sidebar-fg-active bg-white/[0.08]"
    : "text-sidebar-fg hover:text-sidebar-fg-hover hover:bg-white/[0.05]";

  // In collapsed mode: center the icon, drop the label, and replace the
  // full badge with a 6px dot at the top-right of the row so the
  // unread/new signal isn't lost.
  const layoutClass = collapsed ? "justify-center px-0" : "pl-5 pr-4 gap-3";

  // Native `title` provides the OS-level tooltip on hover; cheap and
  // a11y-correct for icon-only nav items.
  const tooltip = collapsed ? label : undefined;

  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      title={tooltip}
      className={`relative flex items-center h-10 text-caption transition-colors duration-fast ease-khx ${layoutClass} ${stateClass}`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-active-bar ${
          active ? "bg-sidebar-bar" : ""
        }`}
      />
      <Icon icon={item.icon} size={18} />

      {/* Expanded mode: label + full badge */}
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && item.badge === "new" && (
        <span className="rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-update-bg text-badge-update-fg">
          {newBadgeLabel}
        </span>
      )}
      {!collapsed && item.badge === "unread" && unread > 0 && (
        <span
          aria-label={`${unread} unread`}
          className="rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-improve-bg text-badge-improve-fg tabular-nums"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}

      {/* V2.2.9 (Session 45) — parse-in-progress indicator: mini equalizer
          bars (the R1 motion element) in expanded mode, a pulsing dot when
          collapsed. Stops with the task (conditional render). */}
      {!collapsed && parsing && (
        <span className="flex items-end gap-px h-2.5 shrink-0" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-0.5 h-2.5 rounded-pill bg-sidebar-bar origin-bottom animate-eq"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </span>
      )}
      {collapsed && parsing && (
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-pill bg-sidebar-bar animate-pulse"
        />
      )}

      {/* Collapsed mode: tiny status dot only */}
      {collapsed && item.badge === "unread" && unread > 0 && (
        <span
          aria-label={`${unread} unread`}
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-pill bg-badge-improve-fg"
        />
      )}
      {collapsed && item.badge === "new" && (
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-pill bg-badge-update-fg"
        />
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsedPref);
  const [version, setVersion] = useState<string>("");
  const parseRunning = useParseStore((s) => s.running);
  const t = useT();

  // App version for the footer — read once from the runtime (embedded from
  // tauri.conf.json at build time). Empty until resolved; renders nothing
  // rather than a stale/hard-coded number.
  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  // Poll the unread subscription count. Refresh when navigating to /feed
  // so the badge clears immediately after user opens it.
  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      api
        .getUnreadSubscriptionCount()
        .then((n) => {
          if (!cancelled) setUnread(n);
        })
        .catch(() => {});
    };
    tick();
    const interval = window.setInterval(tick, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      saveCollapsedPref(next);
      return next;
    });
  }

  // 220px (w-sidebar) vs 60px (w-[60px]). The transition runs on width
  // so the main content area (`<main className="flex-1">` in App.tsx)
  // auto-resizes smoothly alongside.
  const widthClass = collapsed ? "w-[60px]" : "w-sidebar";
  const newBadgeLabel = t("sidebar.badge_new");
  const toggleLabel = t(collapsed ? "sidebar.expand" : "sidebar.collapse");

  return (
    <aside
      className={`${widthClass} bg-sidebar-bg text-sidebar-fg flex flex-col overflow-hidden transition-[width] duration-base ease-khx`}
      data-collapsed={collapsed}
    >
      <Link
        to="/"
        aria-label="SG Hub home"
        title={collapsed ? "SG Hub" : undefined}
        className={
          collapsed
            ? "pt-5 pb-6 flex items-center justify-center focus:outline-none"
            : "px-5 pt-5 pb-6 block focus:outline-none"
        }
      >
        {collapsed ? (
          <LogoMark size={30} className="text-sidebar-fg-active" />
        ) : (
          <LogoLockup />
        )}
      </Link>

      <nav aria-label="Main navigation" className="flex flex-col flex-1">
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.to}
            item={item}
            active={pathname.startsWith(item.to)}
            unread={item.to === "/feed" ? unread : 0}
            collapsed={collapsed}
            label={t(item.labelKey)}
            newBadgeLabel={newBadgeLabel}
            parsing={item.to === "/parse" && parseRunning}
          />
        ))}
      </nav>

      {/* Collapse / expand toggle. Bottom-of-sidebar so it's out of
          the way but still discoverable. Icon-only in both states —
          the action is so universal that the glyph alone reads as
          "collapse / expand". The aria-label + title attributes still
          carry the localized text for screen readers and hover. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={toggleLabel}
        title={toggleLabel}
        className={`flex items-center h-10 text-caption text-sidebar-fg hover:text-sidebar-fg-hover hover:bg-white/[0.05] border-t border-white/[0.04] transition-colors duration-fast ease-khx ${
          collapsed ? "justify-center px-0" : "pl-5 pr-4"
        }`}
      >
        <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={18} />
      </button>

      {/* R7 — copyright footer. The flex layout already keeps it stuck
          to the bottom (the nav above has flex-1). Brand statement is
          NOT localized — industry convention (cf. Adobe / Microsoft
          desktop footers stay in English). Collapsed mode shrinks to
          a single © glyph (centered for the 60px column); expanded
          mode is left-aligned at pl-5 to match the brand + nav column. */}
      <div
        className={`text-micro text-sidebar-fg/40 border-t border-white/[0.04] ${
          collapsed ? "py-2 text-center" : "px-5 py-3 text-left leading-snug"
        }`}
      >
        {collapsed ? (
          "©"
        ) : (
          <>
            <div>Copyright © Star Technology. All Rights Reserved</div>
            {/* V2.2.8 — version line (hidden when collapsed; reserved height
                even while the async version resolves, so no layout jump).
                V2.2.9 (R2) — left-aligned to match the copyright line. */}
            <div className="mt-0.5 tabular-nums min-h-[14px]">
              {version ? `V${version}` : ""}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
