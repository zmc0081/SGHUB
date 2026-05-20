// i18n: 本组件文案已国际化 (V2.1.0)
import { useEffect, useState, ComponentType, SVGProps } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bot,
  Brain,
  MessageSquare,
  Newspaper,
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

function SidebarItem({
  item,
  active,
  unread,
}: {
  item: NavItem;
  active: boolean;
  unread: number;
}) {
  const t = useT();

  const stateClass = active
    ? "text-sidebar-fg-active bg-white/[0.08]"
    : "text-sidebar-fg hover:text-sidebar-fg-hover hover:bg-white/[0.05]";

  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 h-10 pl-5 pr-4 text-caption transition-colors duration-fast ease-khx ${stateClass}`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 bottom-0 w-active-bar ${
          active ? "bg-sidebar-bar" : ""
        }`}
      />
      <Icon icon={item.icon} size={18} />
      <span className="flex-1">{t(item.labelKey)}</span>
      {item.badge === "new" && (
        <span className="rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-update-bg text-badge-update-fg">
          {t("sidebar.badge_new")}
        </span>
      )}
      {item.badge === "unread" && unread > 0 && (
        <span
          aria-label={`${unread} unread`}
          className="rounded-pill px-2 py-0.5 text-micro font-medium bg-badge-improve-bg text-badge-improve-fg tabular-nums"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);

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

  return (
    <aside className="w-sidebar bg-sidebar-bg text-sidebar-fg flex flex-col overflow-hidden">
      <Link
        to="/"
        aria-label="SGHUB home"
        className="px-5 pt-5 pb-6 block focus:outline-none"
      >
        <div className="text-xl font-bold text-sidebar-fg-active tracking-wide-brand">
          SGHUB
        </div>
        <div className="text-micro text-sidebar-fg/60 mt-1 tracking-wide">
          v2.2.0
        </div>
      </Link>
      <nav aria-label="Main navigation" className="flex flex-col flex-1">
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.to}
            item={item}
            active={pathname.startsWith(item.to)}
            unread={item.to === "/feed" ? unread : 0}
          />
        ))}
      </nav>
    </aside>
  );
}
