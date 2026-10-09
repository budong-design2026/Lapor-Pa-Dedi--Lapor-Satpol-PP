"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";
import { SiteHeader } from "@/components/shared/site-header";
import { SiteFooter } from "@/components/shared/site-footer";
import { BottomNav } from "@/components/shared/bottom-nav";

/**
 * AppShell — top-level shell.
 * Layout: sticky SiteHeader, animated main (Framer AnimatePresence keyed on view),
 * sticky SiteFooter (mt-auto), mobile-only BottomNav.
 *
 * NOTE: `children` is rendered inside the animated main region. The view key
 * drives the transition but children content is provided by the page-level
 * router (Lead wires it up).
 */
export interface AppShellProps {
  children: React.ReactNode;
}

const VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function AppShell({ children }: AppShellProps) {
  const view = useAppStore((s) => s.view);

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <SiteHeader />
      <main
        className="app-main flex-1 w-full"
        role="main"
        aria-live="polite"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={VARIANTS.initial}
            animate={VARIANTS.animate}
            exit={VARIANTS.exit}
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
