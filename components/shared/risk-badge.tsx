"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RISK_LEVELS, type RiskLevelKey } from "@/lib/constants";

/**
 * RiskBadge — colored risk-level badge with emoji + label.
 * CRITICAL adds the `.critical-pulse` glow animation.
 */
export function RiskBadge({
  riskLevel,
  className,
}: {
  riskLevel: RiskLevelKey | string | null | undefined;
  className?: string;
}) {
  if (!riskLevel || !RISK_LEVELS[riskLevel as RiskLevelKey]) {
    return (
      <Badge variant="secondary" className={cn("text-muted-foreground", className)}>
        Belum ditentukan
      </Badge>
    );
  }

  const r = RISK_LEVELS[riskLevel as RiskLevelKey];
  const isCritical = riskLevel === "CRITICAL";

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold",
        isCritical && "critical-pulse",
        className,
      )}
      style={{
        color: r.color,
        borderColor: r.color,
        backgroundColor: `${r.color}1a`,
      }}
    >
      <span aria-hidden>{r.emoji}</span>
      {r.label}
    </Badge>
  );
}
