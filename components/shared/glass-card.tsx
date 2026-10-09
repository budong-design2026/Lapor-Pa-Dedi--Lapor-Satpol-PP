"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * GlassCard — premium glassmorphism wrapper over shadcn Card.
 * Uses the `.glass-card` CSS class defined in globals.css.
 */
export function GlassCard({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card className={cn("glass-card rounded-xl border-0 p-0", className)} {...props}>
      {children}
    </Card>
  );
}
