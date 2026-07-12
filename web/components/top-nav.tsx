import { Activity, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function TopNav() {
  return (
    <header className="top-nav">
      <Link className="brand" href="/" aria-label="Nortia home">
        <span className="brand-mark"><Activity size={18} aria-hidden="true" /></span>
        <span>NORTIA</span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/markets/demo-txline-replay">Market</Link>
        <Link href="/portfolio">Portfolio</Link>
      </nav>
      <div className="network-pill"><ShieldCheck size={15} aria-hidden="true" /> Solana devnet</div>
    </header>
  );
}
