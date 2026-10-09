"use client";

import dynamic from "next/dynamic";
import { AppBoot } from "@/components/shared/app-boot";
import { MasyarakatViews } from "@/components/views/masyarakat/masyarakat-views";

// Lazy-load operator & pimpinan — hanya compile saat staf login (hemat memory).
const OperatorViews = dynamic(
  () => import("@/components/views/operator/operator-views").then((m) => m.OperatorViews),
  { ssr: false }
);
const PimpinanViews = dynamic(
  () => import("@/components/views/pimpinan/pimpinan-views").then((m) => m.PimpinanViews),
  { ssr: false }
);

export default function Page() {
  return (
    <AppBoot>
      <MasyarakatViews />
      <OperatorViews />
      <PimpinanViews />
    </AppBoot>
  );
}
