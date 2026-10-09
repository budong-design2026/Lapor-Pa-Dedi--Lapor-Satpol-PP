"use client";

import * as React from "react";
import { useAppStore, type ViewKey } from "@/store/app-store";
import { LandingView } from "@/components/views/masyarakat/landing-view";
import { LaporView } from "@/components/views/masyarakat/lapor-view";
import { TrackView } from "@/components/views/masyarakat/track-view";
import { TransparencyView } from "@/components/views/masyarakat/transparency-view";
import { LoginView } from "@/components/views/masyarakat/login-view";

/**
 * MasyarakatViews — orchestrator for the public-side views of Yeuh Satpol!
 *
 * Reads `view` from the global app store and renders the matching masyarakat
 * view. The outer AnimatePresence + motion.div is handled by `AppShell`
 * (keyed on `view`) so we only add layout padding + a max-width container here.
 *
 * Non-masyarakat views (operator-*, pimpinan-*) are ignored — the Lead page
 * composition decides whether to mount this orchestrator at all.
 */
const MASYARAKAT_VIEWS = new Set<ViewKey>([
  "home",
  "lapor",
  "track",
  "transparency",
  "login",
]);

export function MasyarakatViews() {
  const view = useAppStore((s) => s.view);

  if (!MASYARAKAT_VIEWS.has(view)) {
    return null;
  }

  let Active: React.ReactNode = <LandingView />;
  switch (view) {
    case "home":
      Active = <LandingView />;
      break;
    case "lapor":
      Active = <LaporView />;
      break;
    case "track":
      Active = <TrackView />;
      break;
    case "transparency":
      Active = <TransparencyView />;
      break;
    case "login":
      Active = <LoginView />;
      break;
    default:
      Active = <LandingView />;
      break;
  }

  return (
    <div className="pt-6 max-w-6xl mx-auto w-full px-4 sm:px-6">{Active}</div>
  );
}
