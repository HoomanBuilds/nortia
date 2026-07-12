import { Download, FileKey2, FolderOpen, Info } from "lucide-react";
import Link from "next/link";

export default function PortfolioPage() {
  return (
    <main className="page-shell portfolio-page">
      <div className="section-heading"><span>PRIVATE PORTFOLIO</span><h1>Your positions live in this browser</h1><p>Nortia cannot discover a private side from your wallet address. Import the recovery file created when a ticket was placed.</p></div>
      <section className="panel empty-portfolio">
        <div className="empty-icon"><FileKey2 size={30} /></div>
        <h2>No local positions</h2>
        <p>This browser has no recovery records. You can still inspect the full judge replay without connecting a wallet.</p>
        <div>
          <button className="button primary" disabled><FolderOpen size={17} /> Import recovery JSON</button>
          <Link className="button secondary" href="/markets/demo-txline-replay">Open replay market</Link>
        </div>
        <small><Info size={14} /> Import is disabled until the deployed verifier addresses are configured.</small>
      </section>
      <section className="recovery-guide">
        <Download size={20} />
        <div><strong>Why a recovery file?</strong><p>It stores the private side, secret, nullifier, and Merkle lookup data needed to claim or refund. The server never receives the complete record.</p></div>
      </section>
    </main>
  );
}
