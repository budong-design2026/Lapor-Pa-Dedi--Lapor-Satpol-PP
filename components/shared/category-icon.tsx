"use client";

import * as React from "react";
import {
  Map,
  Route,
  Bus,
  Waves,
  Leaf,
  Store,
  Building2,
  Users,
  HeartPulse,
  AlertTriangle,
  ShieldCheck,
  TreePine,
  Fish,
  Zap,
  Landmark,
  Briefcase,
  FileText,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { getCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Static icon map — covers all 18 categories in CATEGORIES.
 * Falls back to MessageCircle for unknown codes.
 *
 * Resolved outside the render so the returned component reference is stable;
 * rendered via `createElement` so the static-components lint rule is happy.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Map,
  Route,
  Bus,
  Waves,
  Leaf,
  Store,
  Building2,
  Users,
  HeartPulse,
  AlertTriangle,
  ShieldCheck,
  TreePine,
  Fish,
  Zap,
  Landmark,
  Briefcase,
  FileText,
  MessageCircle,
};

function lookupCategoryIcon(code: string): LucideIcon {
  const cat = getCategory(code);
  if (cat && ICON_MAP[cat.icon]) return ICON_MAP[cat.icon];
  return MessageCircle;
}

export function CategoryIcon({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const cls = cn("h-5 w-5", className);
  const Icon = lookupCategoryIcon(code);
  return React.createElement(Icon, { className: cls, "aria-hidden": true });
}
