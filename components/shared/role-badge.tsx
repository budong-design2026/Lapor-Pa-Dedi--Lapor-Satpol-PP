import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, PIMPINAN_ROLES } from "@/lib/constants";

/**
 * RoleBadge — render a user role with its Indonesian label.
 * Pimpinan roles get gold styling.
 * Pure presentational.
 */
export interface RoleBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "role"> {
  role: string | null | undefined;
  size?: "sm" | "md";
}

export function RoleBadge({
  role,
  size = "sm",
  className,
  ...props
}: RoleBadgeProps) {
  const r = role ?? "MASYARAKAT";
  const label = ROLE_LABELS[r] ?? r;
  const isPimpinan = PIMPINAN_ROLES.includes(r);

  return (
    <Badge
      variant={isPimpinan ? "default" : "secondary"}
      className={cn(
        "font-semibold gap-1",
        size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        isPimpinan &&
          "bg-jabar-gold text-background border-jabar-gold/50 shadow-[0_0_12px_rgba(255,214,0,0.35)]",
        className,
      )}
      {...props}
    >
      <span>{label}</span>
    </Badge>
  );
}
