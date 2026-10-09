"use client";

import * as React from "react";
import { useAppStore, viewFromQuery } from "@/store/app-store";
import { apiFetch, ApiError } from "@/lib/api-client";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { AppShell } from "@/components/shared/app-shell";
import { Loading } from "@/components/shared/loading";

/**
 * AppBoot — top-level bootstrapper.
 *
 * On mount:
 *   1. Read ?view= from URL → setView (if valid) → clean URL via history.replaceState.
 *   2. GET /api/auth/me → setUser(result.user ?? null) → setHydrated(true).
 *   3. Render ThemeProvider > AppShell > children.
 *   4. While !hydrated, show full-screen Loading.
 *
 * Hydration-safe: all browser APIs (window/history) touched in useEffect only.
 */

interface MeResponse {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    bidangId?: string | null;
    bidangName?: string | null;
  } | null;
}

export function AppBoot({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);
  const setHydrated = useAppStore((s) => s.setHydrated);
  const hydrated = useAppStore((s) => s.hydrated);

  React.useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Step 1: ?view= from URL
      if (typeof window !== "undefined") {
        try {
          const u = new URL(window.location.href);
          const q = u.searchParams.get("view");
          const mapped = viewFromQuery(q);
          if (mapped) setView(mapped);
          if (q) {
            u.searchParams.delete("view");
            window.history.replaceState({}, "", u.toString());
          }
        } catch {
          // ignore URL parse errors
        }
      }

      // Step 2: fetch session
      try {
        const me = await apiFetch<MeResponse>("/api/auth/me");
        if (!cancelled && me) {
          setUser(me.user ?? null);
        }
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr?.status === 401) {
          if (!cancelled) setUser(null);
        } else {
          // network error → just clear session and continue
          if (!cancelled) setUser(null);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [setUser, setView, setHydrated]);

  return (
    <ThemeProvider>
      {hydrated ? (
        <AppShell>{children}</AppShell>
      ) : (
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">
            <Loading label="Menyiapkan aplikasi…" />
          </main>
        </div>
      )}
    </ThemeProvider>
  );
}
