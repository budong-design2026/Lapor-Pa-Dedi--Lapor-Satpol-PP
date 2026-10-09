"use client";

import * as React from "react";
import { type LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * EmptyState — reusable placeholder for empty list / no-result / errors.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role="status"
      className="glass-card rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-muted-foreground">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={action.onClick}
          className="mt-1"
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
