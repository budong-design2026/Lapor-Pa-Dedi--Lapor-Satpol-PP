"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { REPORT_STATUSES, type ReportStatusKey } from "@/lib/constants";

/**
 * StatusBadge — colored report-status badge.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: ReportStatusKey | string | null | undefined;
  className?: string;
}) {
  if (!status || !REPORT_STATUSES[status as ReportStatusKey]) {
    return (
      <Badge variant="secondary" className={cn("text-muted-foreground", className)}>
        —
      </Badge>
    );
  }

  const s = REPORT_STATUSES[status as ReportStatusKey];

  return (
    <Badge
      variant="outline"
      className={cn("font-semibold", className)}
      style={{
        color: s.color,
        borderColor: s.color,
        backgroundColor: `${s.color}1a`,
      }}
    >
      {s.label}
    </Badge>
  );
}
