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
          description="Launch a collateralized binary USDC market against a resolver the contract can verify. Use continuous LMSR pricing for general markets or the private TxLINE pool for the sports replay."
        />
        <CreateMarketForm />
      </div>
    </main>
  );
}
