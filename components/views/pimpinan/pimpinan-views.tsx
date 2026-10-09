"use client";

import * as React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useAppStore, type ViewKey } from "@/store/app-store";
import { PimpinanCommandView } from "@/components/views/pimpinan/pimpinan-command-view";
import { PimpinanCriticalView } from "@/components/views/pimpinan/pimpinan-critical-view";
import { PimpinanKpiView } from "@/components/views/pimpinan/pimpinan-kpi-view";
import { PimpinanTrendView } from "@/components/views/pimpinan/pimpinan-trend-view";
import { EmptyState } from "@/components/shared/empty-state";
import { ROLE_LABELS } from "@/lib/constants";

/**
 * PimpinanViews — orchestrator for the Pimpinan (Kasatpol / Kabid / Sekretaris)
 * views.
 *
 * Reads `view` from the global store and renders the matching pimpinan view.
 * The outer AnimatePresence + motion.div is handled by `AppShell` (keyed on
 * `view`) so we only add layout padding + a max-width container here (no
 * nested motion — avoids double-fade stutter).
 *
 * Non-pimpinan views (masyarakat-*, operator-*) are ignored — the Lead page
 * composition decides whether to mount this orchestrator at all.
 *
 * Guard: requires an authenticated PIMPINAN_* session. Otherwise renders an
 * access-denied EmptyState with a button back home.
 */
const PIMPINAN_VIEWS = new Set<ViewKey>([
  "pimpinan-command",
  "pimpinan-critical",
  "pimpinan-kpi",
  "pimpinan-trend",
]);

export function PimpinanViews() {
  const view = useAppStore((s) => s.view);
  const user = useAppStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);

  if (!PIMPINAN_VIEWS.has(view)) {
    return null;
  }

  // Auth guard — Pimpinan only.
  if (!user || !user.role.startsWith("PIMPINAN")) {
    return (
      <div className="pt-6 max-w-7xl mx-auto w-full px-4 sm:px-6">
        <EmptyState
          icon={ShieldAlert}
          title="Akses ditolak"
          description="Halaman ini khusus untuk Pimpinan Satpol PP Prov. Jawa Barat (Kasatpol PP / Kepala Bidang / Sekretaris). Silakan masuk dengan akun Pimpinan."
          action={{ label: "Kembali ke Beranda", onClick: () => setView("home") }}
        />
      </div>
    );
  }

  let Active: React.ReactNode = <PimpinanCommandView />;
  switch (view) {
    case "pimpinan-command":
      Active = <PimpinanCommandView />;
      break;
    case "pimpinan-critical":
      Active = <PimpinanCriticalView />;
      break;
    case "pimpinan-kpi":
      Active = <PimpinanKpiView />;
      break;
    case "pimpinan-trend":
      Active = <PimpinanTrendView />;
      break;
    default:
      Active = <PimpinanCommandView />;
      break;
  }

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const isKabid = user.role === "PIMPINAN_KABID";
  const scopeText = isKabid && user.bidangName
    ? `Bidang ${user.bidangName}`
    : "Akses penuh semua Bidang";

  return (
    <div className="pt-6 max-w-7xl mx-auto w-full px-4 sm:px-6">
      {/* ─── Scope banner ─── */}
      <aside
        aria-label="Informasi sesi pimpinan"
        className="mb-4 flex items-center gap-2 rounded-lg border border-jabar-gold/25 bg-jabar-gold/8 px-3 py-2 text-xs"
      >
        <ShieldCheck className="h-4 w-4 text-jabar-gold" aria-hidden />
        <span className="text-muted-foreground">
          Anda masuk sebagai{" "}
          <span className="font-bold text-jabar-gold">{roleLabel}</span>.
          {" "}
          <span className="text-foreground/90">{scopeText}</span>.
        </span>
      </aside>

      {Active}
    </div>
  );
}
