"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { BottomNav } from "@/components/shared/bottom-nav";
import { useAppStore } from "@/store/app-store";

/**
 * AppShell — top-level client layout.
 *
 * - `<div className="app-shell">` enforces `min-h-screen flex flex-col`.
 * - `<SiteHeader />` sticky top.
 * - `<main className="app-main flex-1">` holds the active view. Uses
 *   Framer Motion `AnimatePresence mode="wait"` to fade between views
 *   keyed by `view` (subtle 180ms fade/slide).
 * - `<SiteFooter />` carries `mt-auto` so it sticks on short pages
 *   and pushes down on long pages.
 * - `<BottomNav />` fixed on mobile, hidden on `sm:` and up.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const view = useAppStore((s) => s.view);

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="app-main flex-1 w-full">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="min-h-[60vh] pb-24 sm:pb-0"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}
