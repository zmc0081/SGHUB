import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { windowControls } from "../lib/tauri";
import { Icon } from "./Icon";

export default function Titlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    win
      .isMaximized()
      .then((v) => !cancelled && setMaximized(v))
      .catch(() => {});

    win
      .onResized(async () => {
        try {
          const v = await win.isMaximized();
          if (!cancelled) setMaximized(v);
        } catch {
          /* ignore */
        }
      })
      .then((un) => {
        if (cancelled) un();
        else unlisten = un;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const MaxIcon = maximized ? Copy : Square;
  const maxLabel = maximized ? "Restore" : "Maximize";

  return (
    <header
      role="banner"
      data-tauri-drag-region
      className="h-titlebar flex items-center select-none bg-titlebar-bg text-titlebar-fg z-titlebar"
    >
      {/* Left spacer (drag region). Logo removed per design — kept as a
          w-14 spacer so the centered title doesn't shift. */}
      <div data-tauri-drag-region className="w-14" />

      <div
        data-tauri-drag-region
        className="flex-1 text-center text-meta font-medium tracking-wide-brand text-sidebar-fg-active"
      >
        SG Hub
      </div>

      <div className="flex h-full" data-tauri-drag-region="false">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => windowControls.minimize()}
          aria-label="Minimize"
          className="w-12 h-titlebar flex items-center justify-center hover:bg-white/10 transition-colors duration-fast ease-khx"
        >
          <Icon icon={Minus} size={10} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => windowControls.toggleMaximize()}
          aria-label={maxLabel}
          className="w-12 h-titlebar flex items-center justify-center hover:bg-white/10 transition-colors duration-fast ease-khx"
        >
          <Icon icon={MaxIcon} size={10} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => windowControls.close()}
          aria-label="Close"
          className="w-12 h-titlebar flex items-center justify-center hover:bg-titlebar-close-hover hover:text-white transition-colors duration-fast ease-khx"
        >
          <Icon icon={X} size={10} />
        </button>
      </div>
    </header>
  );
}
