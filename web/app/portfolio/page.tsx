import { ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import { AppPageHeader } from "@/components/app-page-header";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";

export default function PortfolioPage() {
  return (
    <main className="portfolio-page">
      <div className="portfolio-frame">
        <AppPageHeader
          eyebrow={<><ChartNoAxesCombined size={12} />Portfolio</>}
          title="YOUR MARKETS."
          accent="YOUR POSITIONS."
          description="Track public LMSR shares, claim settled payouts, manage creator liquidity, and recover private tickets from one connected-wallet workspace."
          aside={<div className="privacy-illustration"><div className="privacy-ring ring-one" /><div className="privacy-ring ring-two" /><span><ShieldCheck size={24} /></span><small>Zero-knowledge<br />position recovery</small></div>}
        />
        <PortfolioDashboard />
      </div>
    </main>
  );
}
