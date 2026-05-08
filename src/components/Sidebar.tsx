import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { api } from "../lib/tauri";

type NavItem = {
  to: string;
  icon: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/search", icon: "🔍", label: "文献检索" },
  { to: "/feed", icon: "📰", label: "今日推送" },
  { to: "/library", icon: "⭐", label: "收藏夹" },
  { to: "/parse", icon: "🧠", label: "AI 解析" },
  { to: "/models", icon: "🤖", label: "模型配置" },
  { to: "/settings", icon: "⚙️", label: "设置" },
];

const UNREAD_POLL_MS = 30_000;

function SidebarItem({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
}) {
  const base =
    "flex items-center gap-3 pl-4 pr-3 py-2.5 text-sm border-l-4 transition-colors";
  const stateClass = active
    ? "border-accent bg-white/5 text-sidebar-fg-active"
    : "border-transparent text-sidebar-fg hover:bg-white/5 hover:text-sidebar-fg-active";

  return (
    <Link to={item.to} className={`${base} ${stateClass}`}>
      <span className="text-base leading-none w-5 text-center">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
      {badge > 0 ? (
        <span className="bg-accent text-[#1A1F2E] text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
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
    <aside className="w-sidebar bg-sidebar text-sidebar-fg flex flex-col border-r border-border">
      <div className="px-5 pt-5 pb-6">
        <div className="text-xl font-bold text-sidebar-fg-active tracking-wider">
          SGHUB
        </div>
        <div className="text-[10px] text-sidebar-fg/60 mt-0.5 tracking-wide">
          v2.0.1
        </div>
      </div>
      <nav className="flex flex-col flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <SidebarItem
            key={item.to}
            item={item}
            active={pathname.startsWith(item.to)}
            badge={item.to === "/feed" ? unread : 0}
          />
        ))}
      </nav>
    </aside>
  );
}
