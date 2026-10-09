"use client";

import Image from "next/image";

/**
 * LogoPemprov
 *
 * Pemerintah Provinsi Jawa Barat vertical emblem (682×961).
 * Renders with object-contain, NO border-radius, responsive width.
 */
export function LogoPemprov({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-pemprov-jabar.png"
      alt="Pemerintah Provinsi Jawa Barat"
      width={96}
      height={135}
      sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 96px"
      className={`h-auto w-16 sm:w-20 md:w-24 object-contain ${className ?? ""}`}
      priority
    />
  );
}
