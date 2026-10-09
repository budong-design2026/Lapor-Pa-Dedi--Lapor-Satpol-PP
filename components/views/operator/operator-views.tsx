"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { useAppStore, type ViewKey } from "@/store/app-store";
import { OperatorInboxView } from "@/components/views/operator/operator-inbox-view";
import { OperatorDetailView } from "@/components/views/operator/operator-detail-view";
import { OperatorDashboardView } from "@/components/views/operator/operator-dashboard-view";
import { EmptyState } from "@/components/shared/empty-state";

/**
 * OperatorViews — orchestrator for the Operator (Penatakelola) views.
 *
 * Reads `view` from the global store and renders the matching operator view.
 * The outer AnimatePresence + motion.div is handled by `AppShell` (keyed on
 * `view`) so we only add layout padding + a max-width container here.
 *
 * Non-operator views (masyarakat-*, pimpinan-*) are ignored — the Lead page
 * composition decides whether to mount this orchestrator at all.
 *
 * Guard: requires an authenticated OPERATOR session. Otherwise renders an
 * access-denied EmptyState with a button back home.
 */
const OPERATOR_VIEWS = new Set<ViewKey>([
  "operator-inbox",
  "operator-detail",
  "operator-dashboard",
]);

export function OperatorViews() {
  const view = useAppStore((s) => s.view);
  const user = useAppStore((s) => s.user);
  const setView = useAppStore((s) => s.setView);

  if (!OPERATOR_VIEWS.has(view)) {
    return null;
  }

  // Auth guard — Operator only.
  if (!user || user.role !== "OPERATOR") {
    return (
      <div className="pt-6 max-w-7xl mx-auto w-full px-4 sm:px-6">
        <EmptyState
          icon={ShieldAlert}
          title="Akses ditolak"
          description="Halaman ini khusus untuk Operator Satpol PP Prov. Jawa Barat. Silakan masuk dengan akun Operator."
          action={{ label: "Kembali ke Beranda", onClick: () => setView("home") }}
        />
      </div>
    );
  }

  let Active: React.ReactNode = <OperatorInboxView />;
  switch (view) {
    case "operator-inbox":
      Active = <OperatorInboxView />;
      break;
    case "operator-detail":
      Active = <OperatorDetailView />;
      break;
    case "operator-dashboard":
      Active = <OperatorDashboardView />;
      break;
    default:
      Active = <OperatorInboxView />;
      break;
  }

  return (
    <div className="pt-6 max-w-7xl mx-auto w-full px-4 sm:px-6">{Active}</div>
  );
}
