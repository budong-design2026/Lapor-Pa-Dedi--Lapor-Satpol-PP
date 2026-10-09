import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading — block-level centered loader. Pure presentational.
 */
export function Loading({
  label = "Memuat…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-8 animate-spin text-jabar-gold" aria-hidden />
      <span className="text-sm">{label}</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * LoadingSpinner — inline spinner. Pure presentational.
 */
export function LoadingSpinner({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <Loader2
      className={cn("animate-spin", className)}
      size={size}
      aria-hidden
    />
  );
}

/**
 * RowSkeleton — placeholder row for lists. Pure presentational.
 */
export function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
