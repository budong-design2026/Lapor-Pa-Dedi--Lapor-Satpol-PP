"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, PIMPINAN_ROLES } from "@/lib/constants";

/**
 * RoleBadge — labeled role badge. Gold accent for pimpinan roles.
 */
export function RoleBadge({
  role,
  className,
}: {
  role: string | null | undefined;
  className?: string;
}) {
  if (!role) {
    return (
      <Badge variant="secondary" className={cn("text-muted-foreground", className)}>
        Tamu
      </Badge>
    );
  }

  const label = ROLE_LABELS[role] ?? role;
  const isPimpinan = PIMPINAN_ROLES.includes(role);

  if (isPimpinan) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "font-bold",
          className,
        )}
        style={{
          color: "#ffd600",
          borderColor: "#ffd600",
          backgroundColor: "rgba(255,214,0,0.12)",
        }}
      >
        {label}
      </Badge>
    );
  }

  if (role === "OPERATOR") {
    return (
      <Badge
        variant="outline"
        className={cn("font-semibold", className)}
        style={{
          color: "#0d47a1",
          borderColor: "#0d47a1",
          backgroundColor: "rgba(13,71,161,0.18)",
        }}
      >
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={cn("text-muted-foreground", className)}>
      {label}
    </Badge>
  );
}
