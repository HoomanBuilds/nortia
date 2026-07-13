import { EyeOff, ShieldCheck } from "lucide-react";
import { AppPageHeader } from "@/components/app-page-header";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";

export default function PortfolioPage() {
  return (
    <main className="portfolio-page">
      <div className="portfolio-frame">
        <AppPageHeader
          eyebrow={<><EyeOff size={12} />Private portfolio</>}
          title="YOUR POSITIONS."
          accent="ONLY YOURS."
          description="Recover private tickets locally, follow their onchain state, and claim winnings or refunds without exposing the hidden side."
          aside={<div className="privacy-illustration"><div className="privacy-ring ring-one" /><div className="privacy-ring ring-two" /><span><ShieldCheck size={24} /></span><small>Zero-knowledge<br />position recovery</small></div>}
        />
        <PortfolioDashboard />
      </div>
    </main>
  );
}
