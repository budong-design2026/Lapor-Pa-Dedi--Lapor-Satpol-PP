import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { REPORT_STATUSES, type ReportStatusKey } from "@/lib/constants";

/**
 * StatusBadge — render report status with color from REPORT_STATUSES.
 * Pure presentational.
 */
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ReportStatusKey | string | null | undefined;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  size = "sm",
  className,
  ...props
}: StatusBadgeProps) {
  const key = (status as ReportStatusKey | null) ?? "DITERIMA";
  const cfg = REPORT_STATUSES[key] ?? REPORT_STATUSES.DITERIMA;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border gap-1 font-semibold capitalize",
        size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        className,
      )}
      style={{
        color: cfg.color,
        borderColor: cfg.color,
        backgroundColor: `${cfg.color}1a`,
      }}
      {...props}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
      <span>{cfg.label}</span>
    </Badge>
  );
}
