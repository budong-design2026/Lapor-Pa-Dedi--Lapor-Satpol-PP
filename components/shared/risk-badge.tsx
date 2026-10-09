import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { RISK_LEVELS, type RiskLevelKey } from "@/lib/constants";

/**
 * RiskBadge — render risk level with emoji + label + color from RISK_LEVELS.
 * CRITICAL adds the critical-pulse animation.
 * Pure presentational.
 */
export interface RiskBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: RiskLevelKey | string | null | undefined;
  size?: "sm" | "md";
}

export function RiskBadge({ level, size = "sm", className, ...props }: RiskBadgeProps) {
  const key = (level as RiskLevelKey | null) ?? "LOW";
  const cfg = RISK_LEVELS[key] ?? RISK_LEVELS.LOW;
  const isCritical = key === "CRITICAL";

  return (
    <Badge
      variant="outline"
      className={cn(
        "border gap-1 font-semibold",
        size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        isCritical && "critical-pulse",
        className,
      )}
      style={{
        color: cfg.color,
        borderColor: cfg.color,
        backgroundColor: `${cfg.color}1a`, // 10% alpha tint
      }}
      {...props}
    >
      <span aria-hidden>{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </Badge>
  );
}
