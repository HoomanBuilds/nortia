"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { WalletControl } from "@/components/wallet-control";

const links = [
  { href: "/markets", label: "Markets" },
  { href: "/markets/create", label: "Create" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/proofs", label: "Proofs" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/") return null;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="wordmark" aria-label="Nortia home">
          <span className="wordmark-glyph">N</span>
          <span>Nortia</span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map((link) => {
            const active = pathname.startsWith(link.href.split("#")[0]!);
            return <Link key={link.href} href={link.href} className={active ? "nav-link active" : "nav-link"}>{link.label}</Link>;
          })}
        </nav>

        <div className="header-actions">
          <span className="source-pill"><i />TxLINE replay</span>
          <WalletControl />
          <button className="mobile-menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {open && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
          <span className="mobile-source"><i /> Solana devnet replay</span>
        </nav>
      )}
    </header>
  );
}
