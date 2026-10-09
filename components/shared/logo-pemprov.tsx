import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * LogoPemprov — Pemprov Jabar logo (placeholder using /logo-satpol.svg).
 * User will re-upload the real logos later.
 * Aspect ratio preserved; NOT rounded.
 * Pure presentational.
 */
export interface LogoPemprovProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  height?: number;
}

export function LogoPemprov({
  height = 64,
  className,
  alt = "Pemprov Jabar (placeholder)",
  ...props
}: LogoPemprovProps) {
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
