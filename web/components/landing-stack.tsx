"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BitmapChevron } from "@/components/bitmap-chevron";
import { ScrambleTextOnHover } from "@/components/scramble-text";

gsap.registerPlugin(ScrollTrigger);

const columns = [
  { label: "Chain", values: ["Solana", "Anchor", "SPL Token"] },
  { label: "Data", values: ["TxLINE", "Pyth", "Switchboard"] },
  { label: "Markets", values: ["Binary LMSR", "Exact shares", "Guarded fills"] },
  { label: "Collateral", values: ["Devnet USDC", "PDA escrow", "Liability reserve"] },
  { label: "Settlement", values: ["Bonded facts", "Timeout fallback", "Receipts"] },
  { label: "Build", values: ["Next.js", "Noir", "Rust"] },
];

export function LandingStack() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sectionRef.current) return;
    const context = gsap.context(() => {
      if (headerRef.current) gsap.from(headerRef.current, { x: -60, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: headerRef.current, start: "top 85%", toggleActions: "play none none reverse" } });
      if (gridRef.current) gsap.from(gridRef.current.children, { y: 40, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: gridRef.current, start: "top 85%", toggleActions: "play none none reverse" } });
    }, sectionRef);
    return () => context.revert();
  }, []);
  return (
    <section ref={sectionRef} id="stack" className="relative border-t border-border/30 py-32 pl-6 pr-6 md:pl-28 md:pr-12">
      <div ref={headerRef} className="mb-16"><span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">04 / Stack</span><div className="mt-4 flex flex-col justify-between gap-8 md:flex-row md:items-end"><h2 className="font-[var(--font-bebas)] text-5xl tracking-tight md:text-7xl">BUILT TO SETTLE</h2><p className="max-w-md font-mono text-xs leading-relaxed text-muted-foreground">A working devnet protocol with continuous prices, category-specific evidence, optional private sports pools, and exact USDC accounting.</p></div></div>
      <div ref={gridRef} className="grid grid-cols-2 gap-8 md:grid-cols-3 md:gap-12 lg:grid-cols-6">
        {columns.map((column) => <div key={column.label}><h4 className="mb-4 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">{column.label}</h4><ul className="space-y-2">{column.values.map((value) => <li key={value} className="font-mono text-xs text-foreground/80">{value}</li>)}</ul></div>)}
      </div>
      <div className="landing-final-cta mt-24 border-t border-border/20 pt-12"><div><span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">The market is open</span><h3 className="mt-4 font-[var(--font-bebas)] text-5xl leading-none md:text-8xl">PREDICT. VERIFY. SETTLE.</h3></div><Link href="/markets" className="group inline-flex items-center gap-3 border border-foreground/30 px-6 py-4 font-mono text-xs uppercase tracking-widest transition-colors hover:border-accent hover:text-accent"><ScrambleTextOnHover text="Explore Nortia" as="span" duration={0.55} /><BitmapChevron className="transition-transform duration-[400ms] group-hover:rotate-45" /></Link></div>
      <footer className="mt-24 flex flex-col gap-4 border-t border-border/20 pt-8 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:flex-row md:items-center md:justify-between"><p>2026 Nortia / general prediction markets</p><p><span className="landing-live-dot" />TxLINE sports / Solana devnet</p></footer>
    </section>
  );
}
