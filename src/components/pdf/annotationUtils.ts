// V2.2.10 (Session 49) — geometry helpers for PDF text annotations.
//
// Anchors are stored as page-NORMALISED rects (0–1 fractions of the page
// box), so they re-render correctly at any zoom level. A selection that
// spans multiple pages is split into one annotation per page.

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function parseAnchor(anchor: string): NormRect[] {
  try {
    const parsed = JSON.parse(anchor);
    if (Array.isArray(parsed?.rects)) return parsed.rects as NormRect[];
  } catch {
    /* tolerate malformed anchors — render nothing */
  }
  return [];
}

export function anchorFromRects(rects: NormRect[]): string {
  return JSON.stringify({ rects });
}

/** Split the current selection's client rects across the visible PDF pages,
 *  normalised to each page's box. Returns an empty map when the selection
 *  doesn't intersect any page. */
export function selectionToPageRects(
  selection: Selection,
  pageEls: Map<number, HTMLDivElement>,
): Map<number, NormRect[]> {
  const out = new Map<number, NormRect[]>();
  if (selection.rangeCount === 0 || selection.isCollapsed) return out;

  const pages: { n: number; box: DOMRect }[] = [];
  pageEls.forEach((el, n) => pages.push({ n, box: el.getBoundingClientRect() }));

  for (let i = 0; i < selection.rangeCount; i++) {
    const rects = selection.getRangeAt(i).getClientRects();
    for (const r of Array.from(rects)) {
      if (r.width < 2 || r.height < 2) continue; // stray zero-ish fragments
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const page = pages.find(
        (p) =>
          cx >= p.box.left && cx <= p.box.right && cy >= p.box.top && cy <= p.box.bottom,
      );
      if (!page) continue;
      const norm: NormRect = {
        x: (r.left - page.box.left) / page.box.width,
        y: (r.top - page.box.top) / page.box.height,
        w: r.width / page.box.width,
        h: r.height / page.box.height,
      };
      const list = out.get(page.n) ?? [];
      list.push(norm);
      out.set(page.n, list);
    }
  }
  return out;
}

function overlap1(a: NormRect, b: NormRect): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/** True when any rect of `a` intersects any rect of `b` (same page). */
export function rectsOverlap(a: NormRect[], b: NormRect[]): boolean {
  return a.some((ra) => b.some((rb) => overlap1(ra, rb)));
}

/** Point (page-normalised) hit-test against a rect list. */
export function pointInRects(
  px: number,
  py: number,
  rects: NormRect[],
): boolean {
  return rects.some(
    (r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h,
  );
}

export const ANNOT_COLORS = ["yellow", "green", "pink"] as const;
export type AnnotColor = (typeof ANNOT_COLORS)[number];

/** CSS variables (defined in src/styles/index.css, light + dark). */
export function fillVar(color: string): string {
  return `var(--annot-${color})`;
}
export function lineVar(color: string): string {
  return `var(--annot-${color}-line)`;
}
