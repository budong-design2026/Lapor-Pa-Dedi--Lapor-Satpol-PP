"use client";

import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/store/app-store";

/**
 * ThemeProvider — SSR-safe.
 * On mount, reads theme from Zustand store and applies class to <html>.
 * Subscribes to theme changes so toggleTheme in store keeps DOM in sync.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
