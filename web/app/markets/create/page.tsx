import { PlusCircle } from "lucide-react";
import { AppPageHeader } from "@/components/app-page-header";
import { CreateMarketForm } from "@/components/create-market-form";

export default function CreateMarketPage() {
  return (
    <main className="application-page">
      <div className="page-frame">
        <AppPageHeader
          eyebrow={<><PlusCircle size={12} />Permissionless creation</>}
          title="CREATE A MARKET."
          accent="KEEP THE RULES FIXED."
          description="Launch a private binary USDC pool against a connected resolver. Nortia's first production adapter turns TxLINE-covered sports fixtures into deterministic markets."
        />
        <CreateMarketForm />
      </div>
    </main>
  );
}
