// store/app-store.ts — SPA view-switching + auth + UI (Zustand)
"use client";
import { create } from "zustand";

export type ViewKey =
  | "home" | "lapor" | "track" | "transparency" | "login"
  | "operator-inbox" | "operator-detail" | "operator-dashboard"
  | "pimpinan-command" | "pimpinan-critical" | "pimpinan-kpi" | "pimpinan-trend";

export type RoleArea = "masyarakat" | "operator" | "pimpinan";

export interface SessionUser { id: string; email: string; name: string; role: string; bidangId?: string | null; bidangName?: string | null; }

interface AppState {
  area: RoleArea;
  view: ViewKey;
  selectedReportId: string | null;
  setArea: (a: RoleArea) => void;
  setView: (v: ViewKey) => void;
  openReport: (id: string) => void;
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  area: "masyarakat",
  view: "home",
  selectedReportId: null,
  setArea: (area) => set({ area, view: area === "masyarakat" ? "home" : area === "operator" ? "operator-inbox" : "pimpinan-command" }),
  setView: (view) => set({ view }),
  openReport: (id) => set({ selectedReportId: id, view: "operator-detail" }),
  user: null,
  setUser: (user) => {
    set({ user });
    if (user) {
      if (user.role === "OPERATOR") set({ area: "operator", view: "operator-inbox" });
      else if (user.role.startsWith("PIMPINAN")) set({ area: "pimpinan", view: "pimpinan-command" });
    } else { set({ area: "masyarakat", view: "home" }); }
  },
  theme: "dark",
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(next);
    }
    set({ theme: next });
  },
  hydrated: false,
  setHydrated: (hydrated) => set({ hydrated }),
}));

export function viewFromQuery(q: string | null): ViewKey | null {
  const map: Record<string, ViewKey> = { lapor: "lapor", track: "track", transparency: "transparency", login: "login" };
  return q ? map[q] ?? null : null;
}
