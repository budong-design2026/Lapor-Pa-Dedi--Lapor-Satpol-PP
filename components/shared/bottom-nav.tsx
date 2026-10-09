"use client";

import * as React from "react";
import {
  Home,
  Plus,
  Search,
  BarChart3,
  User,
  Inbox,
  LayoutDashboard,
  Shield,
  AlertTriangle,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAppStore, type ViewKey, type RoleArea } from "@/store/app-store";
import { cn } from "@/lib/utils";

interface TabDef {
  label: string;
  view: ViewKey;
  icon: LucideIcon;
  highlight?: boolean; // gold highlighted center button (Lapor)
}

const TABS: Record<RoleArea, TabDef[]> = {
  masyarakat: [
    { label: "Beranda", view: "home", icon: Home },
    { label: "Lacak", view: "track", icon: Search },
    { label: "Lapor", view: "lapor", icon: Plus, highlight: true },
    { label: "Transparansi", view: "transparency", icon: BarChart3 },
    { label: "Masuk", view: "login", icon: User },
  ],
  operator: [
    { label: "Inbox", view: "operator-inbox", icon: Inbox },
    { label: "Dashboard", view: "operator-dashboard", icon: LayoutDashboard },
    { label: "Akun", view: "home", icon: User },
  ],
  pimpinan: [
    { label: "Command", view: "pimpinan-command", icon: Shield },
    { label: "Critical", view: "pimpinan-critical", icon: AlertTriangle },
    { label: "KPI", view: "pimpinan-kpi", icon: TrendingUp },
    { label: "Akun", view: "home", icon: User },
  ],
};

/**
 * BottomNav — mobile-only bottom tab bar (sm:hidden).
 * Tabs depend on current `area`. Active tab gets gold highlight.
 * Touch targets ≥44px (min-h-[44px] enforced on each button).
 */
export function BottomNav() {
  const area = useAppStore((s) => s.area);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  const tabs = TABS[area] ?? TABS.masyarakat;

  return (
    <nav
      role="navigation"
      aria-label="Navigasi utama"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between gap-1 px-2 pt-1">
        {tabs.map((t) => {
          const active = view === t.view;
          const Icon = t.icon;

          if (t.highlight) {
            return (
              <li key={t.view} className="flex-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => setView(t.view)}
                  aria-label={t.label}
                  aria-current={active ? "page" : undefined}
                  className="flex h-[44px] w-[44px] -translate-y-3 items-center justify-center rounded-full bg-jabar-gold text-background shadow-[0_4px_14px_rgba(255,214,0,0.45)] active:scale-95 transition"
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </button>
              </li>
            );
          }

          return (
            <li key={t.view} className="flex-1">
              <button
                type="button"
                onClick={() => setView(t.view)}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[10px] transition active:scale-95",
                  active
                    ? "text-jabar-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="truncate max-w-[60px]">{t.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
