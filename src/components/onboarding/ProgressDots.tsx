// V2.2.4 — step progress indicator for the onboarding wizard.
// The active step is a wider navy pill; others are small muted dots.

export function ProgressDots({
  total,
  current,
  label,
}: {
  total: number;
  current: number;
  label?: string;
}) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={label}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={
            "h-2 rounded-pill transition-[width,background-color] duration-base ease-khx " +
            (i === current ? "w-6 bg-navy" : "w-2 bg-border-default")
          }
        />
      ))}
    </div>
  );
}
