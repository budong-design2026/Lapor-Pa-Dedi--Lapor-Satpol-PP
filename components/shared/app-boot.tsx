"use client";

import * as React from "react";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { AppShell } from "@/components/shared/app-shell";
import { useAppStore, viewFromQuery } from "@/store/app-store";
import { apiFetch } from "@/lib/api-client";
import type { SessionUser } from "@/store/app-store";
import { Loading } from "@/components/shared/loading";

/**
 * AppBoot — single client root.
 *
 * On mount:
 *   1. Fetch `/api/auth/me` to hydrate the current session.
 *   2. Apply `?view=...` from the URL query (if valid) — then clean the URL
 *      via `history.replaceState` so refreshes don't re-trigger navigation.
 *   3. Mark the store as hydrated.
 *
 * Renders `<ThemeProvider><AppShell>{children}</AppShell></ThemeProvider>`.
 */
export function AppBoot({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);
  const setHydrated = useAppStore((s) => s.setHydrated);
  const hydrated = useAppStore((s) => s.hydrated);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // Apply ?view=… from URL before the first paint of the wrong view.
      try {
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const v = viewFromQuery(params.get("view"));
          if (v) setView(v);
          if (params.has("view")) {
            const clean = window.location.pathname;
            window.history.replaceState({}, "", clean);
          }
        }
      } catch {
        // ignore — non-critical
      }

      try {
        const data = await apiFetch<{ user: SessionUser | null }>("/api/auth/me");
        if (!cancelled) setUser(data?.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) {
    return <Loading label="Memuat Yeuh Satpol!…" />;
  }

  return (
    <ThemeProvider>
      <AppShell>{children}</AppShell>
    </ThemeProvider>
  );
}
