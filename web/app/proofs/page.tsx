import { ShieldCheck } from "lucide-react";
import { AppPageHeader } from "@/components/app-page-header";
import { ProofDashboard } from "@/components/proof-dashboard";

export default function ProofsPage() {
  return (
    <main className="application-page">
      <div className="page-frame">
        <AppPageHeader
          eyebrow={<><ShieldCheck size={12} />Verification center</>}
          title="DO NOT TRUST."
          accent="TRACE THE RECEIPT."
          description="Inspect how private orders, resolver evidence, market rules, and USDC accounting become one deterministic settlement record."
        />
        <ProofDashboard />
      </div>
    </main>
  );
}
