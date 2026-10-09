"use client";

import * as React from "react";
import { Zap } from "lucide-react";
import {
  APP_NAME,
  SATPOL_TASKS,
  LEGAL_BASIS,
  TRADEMARK,
} from "@/lib/constants";
import { useAppStore, type ViewKey } from "@/store/app-store";

/**
 * SiteFooter — sticky-at-bottom footer with 3 columns.
 * Col1: copyright + SATPOL_TASKS + LEGAL_BASIS.
 * Col2: quick links (Beranda/Lapor/Lacak/Transparansi).
 * Col3: gold "Budong_production2026" badge with glow.
 */
const QUICK_LINKS: { label: string; view: ViewKey }[] = [
  { label: "Beranda", view: "home" },
  { label: "Lapor", view: "lapor" },
  { label: "Lacak", view: "track" },
  { label: "Transparansi", view: "transparency" },
];

export function SiteFooter() {
  const setView = useAppStore((s) => s.setView);

  return (
    <footer
      className="mt-auto border-t border-white/10 bg-background/60 backdrop-blur-md"
      role="contentinfo"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-[env(safe-area-inset-bottom)]">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Col 1 */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">
              Satpol PP Provinsi Jawa Barat
            </h2>
            <p className="text-xs text-muted-foreground">
              &copy; 2026 Satpol PP Provinsi Jawa Barat. {APP_NAME}
            </p>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              <span className="font-semibold text-foreground/90">Tugas: </span>
              {SATPOL_TASKS}.
            </p>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
              <span className="font-semibold text-foreground/90">Dasar Hukum: </span>
              {LEGAL_BASIS}.
            </p>
          </section>

          {/* Col 2 */}
          <nav className="space-y-2" aria-label="Tautan cepat">
            <h2 className="text-sm font-bold text-foreground">Tautan Cepat</h2>
            <ul className="space-y-1.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.view}>
                  <button
                    type="button"
                    onClick={() => setView(link.view)}
                    className="text-xs text-muted-foreground hover:text-jabar-gold transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Col 3 */}
          <section className="space-y-2 md:flex md:flex-col md:items-end md:text-right">
            <h2 className="text-sm font-bold text-foreground">Dibuat oleh</h2>
            <div
              className="inline-flex items-center gap-1.5 rounded-lg bg-jabar-gold px-3 py-1.5 text-xs font-bold text-background shadow-[0_0_18px_rgba(255,214,0,0.45)]"
              title={TRADEMARK}
            >
              <Zap className="size-3.5" aria-hidden />
              {TRADEMARK}
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              PWA mobile-first &middot; Dark mode &middot; Bahasa Indonesia
            </p>
          </section>
        </div>
      </div>
    </footer>
  );
}
