import * as React from "react";
import { createElement } from "react";
import {
  Map as MapIcon,
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
import { cn } from "@/lib/utils";

/**
 * CategoryIcon — render the lucide icon for a category code.
 * Falls back to MessageCircle for unknown codes.
 * Uses createElement for linter-friendly dynamic dispatch.
 * Pure presentational.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  Map: MapIcon,
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

export interface CategoryIconProps {
  icon?: string;
  className?: string;
  size?: number;
  "aria-hidden"?: boolean;
}

export function CategoryIcon({
  icon = "MessageCircle",
  className,
  size = 18,
  ...rest
}: CategoryIconProps) {
  const IconComp = ICON_MAP[icon] ?? MessageCircle;
  return createElement(IconComp, {
    className: cn("shrink-0", className),
    size,
    "aria-hidden": true,
    ...rest,
  });
}

export { ICON_MAP };
