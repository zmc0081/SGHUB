// i18n: 本组件文案已国际化 (V2.1.0)
// V2.2.1 — collapse/expand support + bottom copyright footer (Session 26)
import { useEffect, useState, ComponentType, SVGProps } from "react";
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
import { Icon } from "./Icon";

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
  { to: "/chat", icon: MessageSquare, labelKey: "sidebar.chat", badge: "new" },
  { to: "/search", icon: Search, labelKey: "sidebar.search", badge: null },
  { to: "/feed", icon: Newspaper, labelKey: "sidebar.feed", badge: "unread" },
  { to: "/parse", icon: Brain, labelKey: "sidebar.parse", badge: null },
  { to: "/library", icon: Star, labelKey: "sidebar.library", badge: null },
  { to: "/skills", icon: Sparkles, labelKey: "sidebar.skills", badge: null },
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
}: {
  item: NavItem;
  active: boolean;
  unread: number;
  collapsed: boolean;
  label: string;
  newBadgeLabel: string;
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
  const t = useT();

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
          <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center text-sidebar-fg-active text-meta font-bold tracking-wide-brand">
            S
          </div>
        ) : (
          <>
            <div className="text-xl font-bold text-sidebar-fg-active tracking-wide-brand">
              SG Hub
            </div>
            <div className="text-micro text-sidebar-fg/60 mt-1 tracking-wide">
              v2.2.0
            </div>
          </>
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
          />
        ))}
      </nav>

      {/* Collapse / expand toggle. Bottom-of-sidebar so it's out of the
          way but still discoverable. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="h-10 flex items-center justify-center text-sidebar-fg hover:text-sidebar-fg-hover hover:bg-white/[0.05] border-t border-white/[0.04] transition-colors duration-fast ease-khx"
      >
        <Icon icon={collapsed ? PanelLeftOpen : PanelLeftClose} size={18} />
      </button>

      {/* R7 — copyright footer. The flex layout already keeps it stuck
          to the bottom (the nav above has flex-1). Brand statement is
          NOT localized — industry convention (cf. Adobe / Microsoft
          desktop footers stay in English). Collapsed mode shrinks to
          a single © glyph so the 60px column stays readable. */}
      <div
        className={`text-micro text-sidebar-fg/40 border-t border-white/[0.04] text-center ${
          collapsed ? "py-2" : "px-3 py-3"
        }`}
      >
        {collapsed ? "©" : "Copyright © Star Technology. All Rights Reserved"}
      </div>
    </aside>
  );
}
