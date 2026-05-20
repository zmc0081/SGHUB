import { ComponentType, SVGProps } from "react";

export type IconSize = "xs" | "sm" | "base" | "lg" | "xl";

export const ICON_SIZES: Record<IconSize, number> = {
  xs: 14,
  sm: 16,
  base: 20,
  lg: 24,
  xl: 32,
};

// `icon` accepts any component that renders an SVG — Lucide icons (which use
// ForwardRefExoticComponent + LucideProps) and SVGR-imported assets both
// satisfy this shape, but their precise prop types disagree, so the loose
// ComponentType<any> is the pragmatic choice for a wrapper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIconComponent = ComponentType<any>;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  icon: AnyIconComponent;
  size?: IconSize | number;
}

export function Icon({
  icon: IconComponent,
  size = "base",
  strokeWidth = 1.5,
  ...rest
}: IconProps) {
  const px = typeof size === "number" ? size : ICON_SIZES[size];
  return (
    <IconComponent
      width={px}
      height={px}
      strokeWidth={strokeWidth}
      aria-hidden={rest["aria-label"] ? undefined : true}
      {...rest}
    />
  );
}
