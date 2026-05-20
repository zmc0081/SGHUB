import { CSSProperties } from "react";

export type SkeletonVariant =
  | "text"
  | "circle"
  | "rect"
  | "paper-card"
  | "list-row";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

function dim(v: string | number | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  lines = 1,
  className,
}: SkeletonProps) {
  const style: CSSProperties = {
    width: dim(width),
    height: dim(height),
  };

  if (variant === "text") {
    const rows = Array.from({ length: Math.max(1, lines) });
    return (
      <div className={className} aria-hidden="true">
        {rows.map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-pill bg-navy-soft animate-pulse"
            style={{
              ...style,
              width: i === rows.length - 1 && rows.length > 1 ? "60%" : style.width || "100%",
              marginTop: i === 0 ? 0 : 8,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "circle") {
    return (
      <div
        aria-hidden="true"
        className={`rounded-full bg-navy-soft animate-pulse ${className ?? ""}`}
        style={{
          width: dim(width) ?? "32px",
          height: dim(height) ?? dim(width) ?? "32px",
        }}
      />
    );
  }

  if (variant === "rect") {
    return (
      <div
        aria-hidden="true"
        className={`rounded-card-sm bg-navy-soft animate-pulse ${className ?? ""}`}
        style={{
          width: dim(width) ?? "100%",
          height: dim(height) ?? "80px",
        }}
      />
    );
  }

  if (variant === "paper-card") {
    return (
      <div
        aria-hidden="true"
        className={`rounded-card bg-card p-5 ${className ?? ""}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-16 rounded-pill bg-navy-soft animate-pulse" />
          <div className="h-3 w-24 rounded-pill bg-navy-soft animate-pulse" />
        </div>
        <div className="h-4 w-11/12 rounded-pill bg-navy-soft animate-pulse mb-2" />
        <div className="h-4 w-3/4 rounded-pill bg-navy-soft animate-pulse mb-4" />
        <div className="h-3 w-1/2 rounded-pill bg-navy-soft animate-pulse mb-3" />
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-pill bg-navy-soft animate-pulse" />
          <div className="h-7 w-20 rounded-pill bg-navy-soft animate-pulse" />
        </div>
      </div>
    );
  }

  // list-row
  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-3 py-2 ${className ?? ""}`}
    >
      <div className="w-8 h-8 rounded-full bg-navy-soft animate-pulse flex-shrink-0" />
      <div className="flex-1">
        <div className="h-3 w-2/3 rounded-pill bg-navy-soft animate-pulse mb-2" />
        <div className="h-3 w-1/3 rounded-pill bg-navy-soft animate-pulse" />
      </div>
    </div>
  );
}
