import type { LucideIcon } from "lucide-react";
import {
  CloudRain,
  Sun,
  Wind,
  Leaf,
  CloudSun,
  Cloud,
  CloudDrizzle,
  Scale,
  Truck,
  AlertTriangle,
  Droplets,
  Trophy,
  Snowflake,
  CloudLightning,
  Thermometer,
  CloudFog,
  Zap,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  CloudRain,
  Sun,
  Wind,
  Leaf,
  CloudSun,
  Cloud,
  CloudDrizzle,
  Scale,
  Truck,
  AlertTriangle,
  Droplets,
  Trophy,
  Snowflake,
  CloudLightning,
  Thermometer,
  CloudFog,
  Zap,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const C = MAP[name] ?? CloudSun;
  return <C className={className} />;
}
