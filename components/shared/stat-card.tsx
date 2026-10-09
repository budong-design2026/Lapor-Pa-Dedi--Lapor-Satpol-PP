"use client";

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

type Accent = "gold" | "blue" | "red" | "green" | "amber";

const ACCENT_MAP: Record<Accent, string> = {
  gold: "#ffd600",
  blue: "#0d47a1",
  red: "#ef4444",
  green: "#22c55e",
  amber: "#f9a825",
};

/**
 * StatCard — glass card with big number + label + optional icon + accent.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "gold",
  sub,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: Accent;
  sub?: string;
  className?: string;
}) {
  const color = ACCENT_MAP[accent];

  return (
    <GlassCard className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className="mt-1 text-3xl font-black leading-none"
            style={{ color }}
          >
            {value}
          </p>
          {sub ? (
            <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}
