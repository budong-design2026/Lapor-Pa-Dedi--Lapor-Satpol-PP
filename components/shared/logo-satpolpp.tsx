"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * LogoSatpolpp
 *
 * Satpol PP Provinsi Jawa Barat horizontal logo (182×44 aspect ratio).
 * Default height matches the 182×44 aspect via `h-9 w-auto`.
 * NEVER apply border-radius — use object-contain, aspect ratio preserved.
 */
export function LogoSatpolpp({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-satpolpp-jabar.png"
      alt="Satpol PP Provinsi Jawa Barat"
      width={182}
      height={44}
      sizes="(max-width: 640px) 130px, 164px"
      className={cn("h-9 w-auto object-contain", className)}
      priority
    />
  );
}
