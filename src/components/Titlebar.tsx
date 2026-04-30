import { windowControls } from "../lib/tauri";

function ButtonMin() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <rect x="0" y="4.5" width="10" height="1" />
    </svg>
  );
}

function ButtonMax() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
  );
}

function ButtonClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1">
      <line x1="0" y1="0" x2="10" y2="10" />
      <line x1="10" y1="0" x2="0" y2="10" />
    </svg>
  );
}

export default function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="h-titlebar flex items-center select-none bg-titlebar text-titlebar-fg border-b border-border"
    >
      <div data-tauri-drag-region className="w-14 flex items-center justify-center">
        <div className="w-5 h-5 rounded-sm bg-accent/80" aria-hidden />
      </div>
      <div
        data-tauri-drag-region
        className="flex-1 text-center text-xs font-medium tracking-wider"
      >
        SGHUB
      </div>
      <div className="flex h-full">
        <button
          onClick={() => windowControls.minimize()}
          className="w-12 h-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Minimize"
        >
          <ButtonMin />
        </button>
        <button
          onClick={() => windowControls.toggleMaximize()}
          className="w-12 h-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Maximize"
        >
          <ButtonMax />
        </button>
        <button
          onClick={() => windowControls.close()}
          className="w-12 h-full flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors"
          aria-label="Close"
        >
          <ButtonClose />
        </button>
      </div>
    </div>
  );
}
