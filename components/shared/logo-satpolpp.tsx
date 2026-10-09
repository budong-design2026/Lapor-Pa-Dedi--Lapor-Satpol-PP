import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * LogoSatpolpp — Satpol PP emblem (placeholder using /logo-satpol.svg).
 * Aspect ratio preserved; NOT rounded.
 * Pure presentational.
 */
export interface LogoSatpolppProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  height?: number;
}

export function LogoSatpolpp({
  height = 36,
  className,
  alt = "Satpol PP",
  ...props
}: LogoSatpolppProps) {
  return (
    <img
      src="/logo-satpol.svg"
      alt={alt}
      height={height}
      style={{ height, width: "auto" }}
      className={cn("object-contain", className)}
      {...props}
    />
  );
}
