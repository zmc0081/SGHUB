// V2.2.10 (Session 49) — annotation context menu + the small edit bar.
//
// Menu (right-click on a text selection), five items per the spec:
//   ① 高亮 — with three inline color dots (yellow / green / pink)
//   ② 划线 (underline)
//   ③ 翻译选中内容 — disabled placeholder, enabled in Session 50
//   ④ Ask 大模型   — disabled placeholder, enabled in Session 50
//   ⑤ 取消标注 — only when the selection overlaps an existing annotation
// Scanned PDFs (no text layer) render every action disabled plus a hint row.
//
// AnnotationBar (click on an existing annotation): recolor dots + delete.
import { useEffect, useRef } from "react";
import {
  Eraser,
  Highlighter,
  Languages,
  MessageSquareText,
  Underline,
} from "lucide-react";
import { useT } from "../../hooks/useT";
import { Icon } from "../Icon";
import { ANNOT_COLORS, fillVar, lineVar, type AnnotColor } from "./annotationUtils";

/** Clamp a fixed-position popover into the viewport. */
function clampToViewport(x: number, y: number, w: number, h: number) {
  return {
    left: Math.min(x, window.innerWidth - w - 8),
    top: Math.min(y, window.innerHeight - h - 8),
  };
}

function ColorDot({
  color,
  onPick,
  title,
}: {
  color: AnnotColor;
  onPick: (c: AnnotColor) => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPick(color);
      }}
      aria-label={title}
      title={title}
      className="w-4 h-4 rounded-pill border border-border-strong hover:scale-110 transition-transform duration-fast ease-khx"
      style={{ background: fillVar(color), borderColor: lineVar(color) }}
    />
  );
}

interface MenuProps {
  x: number;
  y: number;
  /** Scanned page — no text layer: everything disabled + hint. */
  noText: boolean;
  /** The selection overlaps ≥1 existing annotation → show 取消标注. */
  hasOverlap: boolean;
  /** False when the PDF has no library paper id (annotations need one). */
  canAnnotate: boolean;
  onHighlight: (color: AnnotColor) => void;
  onUnderline: () => void;
  /** V2.2.10 (Session 50) — enabled: translate / ask about the selection. */
  onTranslate: () => void;
  onAsk: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function AnnotationMenu({
  x,
  y,
  noText,
  hasOverlap,
  canAnnotate,
  onHighlight,
  onUnderline,
  onTranslate,
  onAsk,
  onRemove,
  onClose,
}: MenuProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  // Close on any outside pointer-down / Escape.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const pos = clampToViewport(x, y, 240, 220);
  const itemBase =
    "flex items-center gap-2 w-full text-left px-3 py-2 text-caption transition-colors duration-fast ease-khx";
  const itemOn = `${itemBase} text-fg-1 hover:bg-navy-faint`;
  const itemOff = `${itemBase} text-fg-3 cursor-not-allowed`;

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-popover min-w-[220px] rounded-card-sm border border-border-strong bg-card shadow-nav py-1.5"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      {noText && (
        <div className="px-3 py-1.5 text-meta text-fg-3">
          {t("pdf_viewer.annot_no_text")}
        </div>
      )}

      {/* ① Highlight + inline color dots */}
      <div className={noText || !canAnnotate ? itemOff : itemOn}>
        <Icon icon={Highlighter} size="sm" className="shrink-0" />
        <span className="flex-1">{t("pdf_viewer.annot_highlight")}</span>
        {!noText && canAnnotate && (
          <span className="inline-flex items-center gap-1.5 shrink-0">
            {ANNOT_COLORS.map((c) => (
              <ColorDot
                key={c}
                color={c}
                onPick={onHighlight}
                title={t(`pdf_viewer.annot_color_${c}`)}
              />
            ))}
          </span>
        )}
      </div>

      {/* ② Underline */}
      <button
        type="button"
        disabled={noText || !canAnnotate}
        onClick={onUnderline}
        className={noText || !canAnnotate ? itemOff : itemOn}
      >
        <Icon icon={Underline} size="sm" className="shrink-0" />
        <span>{t("pdf_viewer.annot_underline")}</span>
      </button>

      <div className="border-t border-border-subtle my-1" />

      {/* ③④ V2.2.10 (Session 50) — translate / ask, live. They only need a
          text selection, so a missing paper id doesn't disable them. */}
      <button
        type="button"
        disabled={noText}
        onClick={onTranslate}
        className={noText ? itemOff : itemOn}
      >
        <Icon icon={Languages} size="sm" className="shrink-0" />
        <span>{t("pdf_viewer.annot_translate")}</span>
      </button>
      <button
        type="button"
        disabled={noText}
        onClick={onAsk}
        className={noText ? itemOff : itemOn}
      >
        <Icon icon={MessageSquareText} size="sm" className="shrink-0" />
        <span>{t("pdf_viewer.annot_ask")}</span>
      </button>

      {/* ⑤ Remove — only when the selection touches an existing annotation */}
      {hasOverlap && !noText && (
        <>
          <div className="border-t border-border-subtle my-1" />
          <button
            type="button"
            onClick={onRemove}
            className={`${itemBase} text-danger-fg hover:bg-danger-bg`}
          >
            <Icon icon={Eraser} size="sm" className="shrink-0" />
            <span>{t("pdf_viewer.annot_remove")}</span>
          </button>
        </>
      )}
    </div>
  );
}

interface BarProps {
  x: number;
  y: number;
  color: string;
  onRecolor: (c: AnnotColor) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Small floating bar shown when an existing annotation is clicked. */
export function AnnotationBar({
  x,
  y,
  color,
  onRecolor,
  onDelete,
  onClose,
}: BarProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const pos = clampToViewport(x, y, 170, 44);

  return (
    <div
      ref={ref}
      role="toolbar"
      className="fixed z-popover inline-flex items-center gap-2 rounded-pill border border-border-strong bg-card shadow-nav px-3 py-1.5"
      style={pos}
    >
      {ANNOT_COLORS.map((c) => (
        <span
          key={c}
          className={
            c === color ? "ring-2 ring-border-focus rounded-pill" : undefined
          }
        >
          <ColorDot
            color={c}
            onPick={onRecolor}
            title={t(`pdf_viewer.annot_color_${c}`)}
          />
        </span>
      ))}
      <span className="w-px h-4 bg-border-default" aria-hidden />
      <button
        type="button"
        onClick={onDelete}
        aria-label={t("pdf_viewer.annot_delete")}
        title={t("pdf_viewer.annot_delete")}
        className="text-danger-fg hover:bg-danger-bg rounded-pill p-1 transition-colors duration-fast ease-khx"
      >
        <Icon icon={Eraser} size="xs" />
      </button>
    </div>
  );
}
