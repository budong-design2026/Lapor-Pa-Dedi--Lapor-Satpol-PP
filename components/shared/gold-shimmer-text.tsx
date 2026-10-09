"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Tag = "span" | "h1" | "h2" | "h3";

/**
 * GoldShimmerText — "JABAR ISTIMEWA" / hero title effect.
 * Relies on `.gold-shimmer` from globals.css (animated gold gradient clip-text).
 */
export function GoldShimmerText({
  children,
  className,
  as = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: Tag;
}) {
  const Tag = as as React.ElementType;
  return (
    <Tag className={cn("gold-shimmer font-black tracking-tight", className)}>
      {children}
    </Tag>
  );
}
