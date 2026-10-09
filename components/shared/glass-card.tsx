import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * GlassCard — wrapper over shadcn Card with `glass-card` class.
 * Pure presentational (no hooks) — can stay client-only because Card is.
 */
export type GlassCardProps = React.ComponentProps<"div">;

export function GlassCard({ className, ...props }: GlassCardProps) {
  return (
    <Card
      className={cn("glass-card rounded-xl p-4 sm:p-6", className)}
      {...props}
    />
  );
}
