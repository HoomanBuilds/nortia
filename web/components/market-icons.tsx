import { NetworkSolana, TokenSOL, TokenUSDC } from "@web3icons/react";
import {
  Bitcoin,
  ChartCandlestick,
  ChartNoAxesCombined,
  Clapperboard,
  Cpu,
  Fingerprint,
  FlaskConical,
  Landmark,
  LayoutGrid,
  Network,
  RadioTower,
  Scale,
  Shapes,
  Sigma,
  Trophy,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { MarketCategory } from "@/lib/markets";

type IconProps = {
  className?: string;
  size?: number;
};

const categoryIcons: Record<MarketCategory | "All categories", LucideIcon> = {
  "All categories": LayoutGrid,
  Sports: Trophy,
  Crypto: Bitcoin,
  Economics: ChartNoAxesCombined,
  Politics: Landmark,
  Technology: Cpu,
  Culture: Clapperboard,
  Science: FlaskConical,
  Other: Shapes,
};

export function MarketCategoryIcon({ category, className, size = 16 }: IconProps & { category: MarketCategory | "All categories" }) {
  const Icon = categoryIcons[category];
  return <Icon aria-hidden="true" className={className} focusable="false" size={size} strokeWidth={1.8} />;
}

export function ResolverIcon({ resolver, className, size = 16 }: IconProps & { resolver: string }) {
  const normalized = resolver.toLowerCase();
  let Icon: LucideIcon = Sigma;
  if (normalized.includes("txline") || normalized.includes("sports")) Icon = RadioTower;
  else if (normalized.includes("pyth")) Icon = ChartCandlestick;
  else if (normalized.includes("switchboard")) Icon = Network;
  else if (normalized.includes("stork")) Icon = Waypoints;
  else if (normalized.includes("optimistic") || normalized.includes("bonded")) Icon = Scale;
  else if (normalized.includes("proof") || normalized.includes("receipt")) Icon = Fingerprint;
  return <Icon aria-hidden="true" className={className} focusable="false" size={size} strokeWidth={1.8} />;
}

export function SolanaNetworkIcon({ className, size = 16 }: IconProps) {
  return <NetworkSolana aria-hidden="true" className={className} focusable="false" size={size} variant="branded" />;
}

export function SolTokenIcon({ className, size = 16 }: IconProps) {
  return <TokenSOL aria-hidden="true" className={className} focusable="false" size={size} variant="branded" />;
}

export function UsdcTokenIcon({ className, size = 16 }: IconProps) {
  return <TokenUSDC aria-hidden="true" className={className} focusable="false" size={size} variant="branded" />;
}
