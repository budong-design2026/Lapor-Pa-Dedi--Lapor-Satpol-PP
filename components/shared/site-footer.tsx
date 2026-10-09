"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  APP_SHORT,
  SATPOL_TASKS,
  LEGAL_BASIS,
  TRADEMARK,
} from "@/lib/constants";
import { useAppStore, type ViewKey } from "@/store/app-store";

interface QuickLink {
  label: string;
  view: ViewKey;
}

const QUICK_LINKS: QuickLink[] = [
  { label: "Beranda", view: "home" },
  { label: "Lapor", view: "lapor" },
  { label: "Lacak", view: "track" },
  { label: "Transparansi", view: "transparency" },
];

/**
 * SiteFooter — sticky footer with mt-auto.
 * Three columns on desktop, stacked on mobile.
 * Bottom safe-area inset reserved for iOS.
 */
export function SiteFooter() {
  const setView = useAppStore((s) => s.setView);
  const year = 2026;

  return (
    <footer
      role="contentinfo"
      className="mt-auto w-full border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 grid gap-8 md:grid-cols-3">
        {/* Col 1: copyright + tasks + legal basis */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            © {year} Satpol PP Provinsi Jawa Barat
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {SATPOL_TASKS}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dasar hukum: {LEGAL_BASIS}
          </p>
        </div>

        {/* Col 2: quick links */}
        <nav aria-label="Tautan cepat" className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tautan Cepat
          </p>
          <ul className="flex flex-col gap-1">
            {QUICK_LINKS.map((q) => (
              <li key={q.view}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit justify-start px-2 text-sm text-muted-foreground hover:text-jabar-gold"
                  onClick={() => setView(q.view)}
                >
                  {q.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Col 3: gold trademark badge */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {APP_SHORT}
          </p>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-jabar-gold px-3 py-1 text-xs font-bold text-background"
            style={{ boxShadow: "0 0 12px rgba(255,214,0,0.4)" }}
          >
            {TRADEMARK}
          </span>
          <p className="text-[11px] text-muted-foreground">
            Dibuat untuk masyarakat Jawa Barat.
          </p>
        </div>
      </div>
    </footer>
  );
}
