import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — icon + title + description + optional action.
 * Pure presentational.
 */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-card rounded-xl flex flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
      role="status"
    >
      {icon ? (
        <div className="text-muted-foreground/60" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
