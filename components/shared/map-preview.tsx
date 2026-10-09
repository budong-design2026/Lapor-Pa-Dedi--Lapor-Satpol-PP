import * as React from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";

/**
 * MapPreview — static placeholder map card.
 * Shows coords + a "Buka di Google Maps" link (target _blank).
 * Pure presentational.
 */
export interface MapPreviewProps {
  latitude: number;
  longitude: number;
  label?: string;
  className?: string;
}

export function MapPreview({
  latitude,
  longitude,
  label = "Lokasi Pengaduan",
  className,
}: MapPreviewProps) {
  const lat = Number(latitude ?? 0);
  const lng = Number(longitude ?? 0);
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <GlassCard className={className}>
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 items-center justify-center rounded-lg bg-jabar-blue/15 text-jabar-gold border border-jabar-blue/30"
          aria-hidden
        >
          <MapPin className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-jabar-gold hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Buka di Google Maps
          </a>
        </div>
      </div>
    </GlassCard>
  );
}
