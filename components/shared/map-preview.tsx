"use client";

import * as React from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";

/**
 * MapPreview — static MVP map placeholder.
 *
 * No leaflet / map libs — just a styled placeholder with a pin icon,
 * coordinates, and an outbound "Buka di Google Maps" link.
 */
export function MapPreview({
  latitude,
  longitude,
  className,
}: {
  latitude: number;
  longitude: number;
  className?: string;
}) {
  const latStr = Number.isFinite(latitude)
    ? latitude.toFixed(6)
    : String(latitude ?? 0);
  const lngStr = Number.isFinite(longitude)
    ? longitude.toFixed(6)
    : String(longitude ?? 0);
  const gmapsUrl = `https://www.google.com/maps?q=${latStr},${lngStr}`;

  return (
    <GlassCard className={className}>
      <div className="relative">
        {/* Faux grid background */}
        <div
          aria-hidden
          className="relative h-44 w-full overflow-hidden rounded-t-xl"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,214,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,214,0,0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            backgroundColor: "rgba(13, 71, 161, 0.12)",
          }}
        >
          {/* Center pin */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex flex-col items-center gap-0.5">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jabar-gold opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-jabar-gold" />
              </span>
              <MapPin className="h-8 w-8 text-jabar-gold" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-jabar-gold" aria-hidden />
            <span className="font-mono text-foreground">
              {latStr}, {lngStr}
            </span>
          </div>
          <a
            href={gmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-md bg-jabar-gold px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Buka di Google Maps
          </a>
        </div>
      </div>
    </GlassCard>
  );
}
