"use client";

import * as React from "react";
import {
  Home,
  Megaphone,
  Search,
  BarChart3,
  LogIn,
  Inbox,
  LayoutDashboard,
  User,
  ShieldAlert,
  Target,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, type RoleArea, type ViewKey } from "@/store/app-store";

/**
 * BottomNav — mobile-only (sm:hidden) fixed bottom navigation.
 * Tabs depend on area (masyarakat/operator/pimpinan).
 * Active tab gets gold text.
 */
interface TabDef {
  view: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  highlight?: boolean;
}

const TABS_BY_AREA: Record<RoleArea, TabDef[]> = {
  masyarakat: [
    { view: "home", label: "Beranda", icon: Home },
    { view: "lapor", label: "Lapor", icon: Megaphone, highlight: true },
    { view: "track", label: "Lacak", icon: Search },
    { view: "transparency", label: "Transparansi", icon: BarChart3 },
    { view: "login", label: "Masuk", icon: LogIn },
  ],
  operator: [
    { view: "operator-inbox", label: "Inbox", icon: Inbox },
    { view: "operator-dashboard", label: "Dashboard", icon: LayoutDashboard },
    { view: "operator-inbox", label: "Akun", icon: User }, // akun lands on inbox view for now
  ],
  pimpinan: [
    { view: "pimpinan-command", label: "Command", icon: ShieldAlert },
    { view: "pimpinan-critical", label: "Critical", icon: Target },
    { view: "pimpinan-kpi", label: "KPI", icon: Gauge },
    { view: "pimpinan-command", label: "Akun", icon: User },
  ],
};

export function BottomNav() {
  const area = useAppStore((s) => s.area);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  const tabs = TABS_BY_AREA[area] ?? TABS_BY_AREA.masyarakat;

  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 glass-card border-t border-white/10 rounded-none"
      role="navigation"
      aria-label="Navigasi bawah"
    >
      <ul className="grid grid-flow-col auto-cols-fr">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const active = view === tab.view;
          return (
            <li key={`${tab.view}-${tab.label}-${idx}`}>
              <button
                type="button"
                onClick={() => setView(tab.view)}
                className={cn(
                  "w-full flex flex-col items-center justify-center gap-1 py-2 px-1 text-[10px] font-medium transition-colors",
                  "min-h-[52px]", // >= 44px touch target
                  active
                    ? "text-jabar-gold"
                    : "text-muted-foreground hover:text-foreground",
                  tab.highlight && !active && "text-jabar-gold/80",
                )}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full",
                    tab.highlight
                      ? "bg-jabar-gold/15 ring-1 ring-jabar-gold/40"
                      : active
                        ? "bg-jabar-gold/15"
                        : "",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" aria-hidden />
    </nav>
  );
}
