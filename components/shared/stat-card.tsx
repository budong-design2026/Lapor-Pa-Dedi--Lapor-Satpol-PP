import * as React from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/shared/glass-card";

/**
 * StatCard — GlassCard with big number + label + icon + accent color.
 * Pure presentational.
 */
export type StatAccent = "gold" | "blue" | "red" | "green" | "amber";

const ACCENT_MAP: Record<
  StatAccent,
  { text: string; ring: string; glow: string }
> = {
  gold: {
    text: "text-jabar-gold",
    ring: "border-jabar-gold/40",
    glow: "shadow-[0_0_18px_rgba(255,214,0,0.18)]",
  },
  blue: {
    text: "text-jabar-blue",
    ring: "border-jabar-blue/40",
    glow: "shadow-[0_0_18px_rgba(13,71,161,0.22)]",
  },
  red: {
    text: "text-red-500",
    ring: "border-red-500/40",
    glow: "shadow-[0_0_18px_rgba(239,68,68,0.20)]",
  },
  green: {
    text: "text-green-500",
    ring: "border-green-500/40",
    glow: "shadow-[0_0_18px_rgba(34,197,94,0.20)]",
  },
  amber: {
    text: "text-amber-500",
    ring: "border-amber-500/40",
    glow: "shadow-[0_0_18px_rgba(245,158,11,0.20)]",
  },
};

export interface StatCardProps {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  accent?: StatAccent;
  hint?: React.ReactNode;
  className?: string;
}

export function StatCard({
  value,
  label,
  icon,
  accent = "gold",
  hint,
  className,
}: StatCardProps) {
  const a = ACCENT_MAP[accent] ?? ACCENT_MAP.gold;
  return (
    <GlassCard className={cn("p-4 sm:p-5", a.ring, a.glow, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-2xl sm:text-3xl font-black leading-tight tabular-nums",
              a.text,
            )}
          >
            {value}
          </div>
          <div className="mt-1 text-xs sm:text-sm text-muted-foreground truncate">
            {label}
          </div>
          {hint ? (
            <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground/80">
              {hint}
            </div>
          ) : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex size-10 sm:size-12 items-center justify-center rounded-xl bg-background/40 border border-white/5",
              a.text,
            )}
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}
