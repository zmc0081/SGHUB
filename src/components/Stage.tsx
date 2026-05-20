import { ReactNode } from "react";

export interface StageProps {
  intensity?: "soft" | "full";
  children: ReactNode;
  className?: string;
}

export function Stage({
  intensity = "full",
  children,
  className,
}: StageProps) {
  const purpleSize = intensity === "full" ? 400 : 240;

  return (
    <div
      className={`relative overflow-hidden bg-stage-gradient ${className ?? ""}`}
    >
      <div
        aria-hidden="true"
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "-80px",
          right: "-80px",
          width: `${purpleSize}px`,
          height: `${purpleSize}px`,
          background: "var(--glow-purple)",
        }}
      />
      {intensity === "full" && (
        <div
          aria-hidden="true"
          className="absolute pointer-events-none rounded-full"
          style={{
            bottom: "-80px",
            left: "-64px",
            width: "400px",
            height: "400px",
            background: "var(--glow-blue)",
          }}
        />
      )}
      <div className="relative z-elevated">{children}</div>
    </div>
  );
}
