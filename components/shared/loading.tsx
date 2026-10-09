"use client";

import * as React from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** Full-block centered gold spinner with optional label. */
export function Loading({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-16 text-center"
    >
      <Loader2 className="h-8 w-8 animate-spin text-jabar-gold" aria-hidden />
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">Memuat…</span>
      )}
    </div>
  );
}

/** Inline gold spinner — use inside buttons / rows. */
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-4 w-4 animate-spin text-jabar-gold", className)}
      aria-hidden
    />
  );
}

/** Skeleton row for lists (avatar + two lines). */
export function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-card rounded-xl p-4 flex items-center gap-3"
        >
          <Skeleton className="h-10 w-10 rounded-full bg-accent/60" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3 bg-accent/60" />
            <Skeleton className="h-3 w-1/3 bg-accent/60" />
          </div>
          <Skeleton className="h-6 w-16 rounded-md bg-accent/60" />
        </div>
      ))}
    </div>
  );
}
