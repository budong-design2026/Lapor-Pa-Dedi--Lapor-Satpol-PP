"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

/**
 * ThemeProvider
 *
 * Reads the persisted Zustand `theme` and applies the matching class
 * ("dark" | "light") to <html>. The store already toggles the class inside
 * `toggleTheme`, but we still need this provider to:
 *   1. Apply the initial theme on mount (hydration sync).
 *   2. Stay subscribed so any external `set` call (e.g. from a settings panel)
 *      keeps documentElement in sync.
 *
 * No-op during SSR — guarded by `typeof window`.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = document.documentElement;
    el.classList.remove("dark", "light");
    el.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
