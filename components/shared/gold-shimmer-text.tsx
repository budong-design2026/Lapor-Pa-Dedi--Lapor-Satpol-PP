import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GoldShimmerText — renders text with the gold-shimmer animated gradient.
 * Tag ∈ span/h1/h2/h3. Pure presentational.
 */
export type GoldShimmerTag = "span" | "h1" | "h2" | "h3";

export interface GoldShimmerTextProps extends React.HTMLAttributes<HTMLElement> {
  as?: GoldShimmerTag;
}

export function GoldShimmerText({
  as = "span",
  className,
  ...props
}: GoldShimmerTextProps) {
  const Tag = as;
  return (
    <Tag
      className={cn("gold-shimmer font-black tracking-tight", className)}
      {...props}
    />
  );
}
