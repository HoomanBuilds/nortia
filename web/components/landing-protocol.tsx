"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const layers = [
  { title: "Market Engine", medium: "Continuous prediction", description: "One collateralized binary LMSR prices sports, crypto, politics, technology, culture, and future verified categories.", span: "col-span-2 row-span-2", metric: "LMSR / USDC" },
  { title: "TxLINE Sports", medium: "Signed match data", description: "World Cup scores and match events resolve through a verifiable Solana CPI.", span: "col-span-1 row-span-1", metric: "SSE + MERKLE" },
  { title: "Pyth Prices", medium: "Pull oracle", description: "A fully verified update must uniquely bracket the market's immutable observation timestamp.", span: "col-span-1 row-span-2", metric: "PRICE + TIME" },
  { title: "Bonded Facts", medium: "Optimistic evidence", description: "Long-tail facts use public evidence, opposing bonds, a challenge window, and dispute fallback.", span: "col-span-1 row-span-1", metric: "PROPOSE + CHALLENGE" },
  { title: "USDC Vault", medium: "Solana escrow", description: "Creator subsidy bounds LMSR loss while exact liability remains reserved for unsettled positions.", span: "col-span-2 row-span-1", metric: "6 DECIMALS" },
  { title: "Public Receipt", medium: "Proof surface", description: "Every resolution exposes the source account, observation, evidence hash, outcome, and final timestamp.", span: "col-span-1 row-span-1", metric: "AUDITABLE" },
];

export function LandingProtocol() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !gridRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(headerRef.current, { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: headerRef.current, start: "top 90%", toggleActions: "play none none reverse" } });
      const cards = gridRef.current!.querySelectorAll("article");
      gsap.set(cards, { y: 60, opacity: 0 });
      gsap.to(cards, { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: gridRef.current, start: "top 90%", toggleActions: "play none none reverse" } });
    }, sectionRef);
    return () => context.revert();
  }, []);
  return (
    <section ref={sectionRef} id="protocol" className="relative py-32 pl-6 pr-6 md:pl-28 md:pr-12">
      <div ref={headerRef} className="mb-16 flex items-end justify-between"><div><span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">02 / Protocol</span><h2 className="mt-4 font-[var(--font-bebas)] text-5xl tracking-tight md:text-7xl">ONE SYSTEM / SIX LAYERS</h2></div><Link href="/markets" className="hidden border border-border px-5 py-3 font-mono text-[10px] uppercase tracking-widest transition-colors hover:border-accent hover:text-accent md:block">Launch the app</Link></div>
      <div ref={gridRef} className="grid auto-rows-[180px] grid-cols-2 gap-4 md:auto-rows-[200px] md:grid-cols-4 md:gap-6">
        {layers.map((layer, index) => <ProtocolCard key={layer.title} layer={layer} index={index} persist={index === 0} />)}
      </div>
    </section>
  );
}

function ProtocolCard({ layer, index, persist }: { layer: (typeof layers)[number]; index: number; persist: boolean }) {
  const [hovered, setHovered] = useState(false);
  const active = hovered || persist;
  return <article className={cn("group relative flex cursor-default flex-col justify-between overflow-hidden border border-border/40 p-5 transition-all duration-500", layer.span, active && "border-accent/60")} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}><div className={cn("absolute inset-0 bg-accent/5 transition-opacity duration-500", active ? "opacity-100" : "opacity-0")} />{index === 0 && <div className="protocol-odds" aria-hidden="true"><span style={{ height: "35%" }} /><span style={{ height: "52%" }} /><span style={{ height: "44%" }} /><span style={{ height: "68%" }} /><span style={{ height: "61%" }} /><span style={{ height: "82%" }} /><span style={{ height: "100%" }} /></div>}<div className="relative z-10"><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{layer.medium}</span><h3 className={cn("mt-3 font-[var(--font-bebas)] text-2xl tracking-tight transition-colors duration-300 md:text-4xl", active ? "text-accent" : "text-foreground")}>{layer.title}</h3><strong className="mt-2 block font-mono text-[9px] tracking-widest text-muted-foreground">{layer.metric}</strong></div><div className="relative z-10"><p className={cn("max-w-[300px] font-mono text-xs leading-relaxed text-muted-foreground transition-all duration-500", active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>{layer.description}</p></div><span className={cn("absolute bottom-4 right-4 font-mono text-[10px] transition-colors", active ? "text-accent" : "text-muted-foreground/40")}>{String(index + 1).padStart(2, "0")}</span><div className={cn("absolute right-0 top-0 h-12 w-12 transition-opacity duration-500", active ? "opacity-100" : "opacity-0")}><div className="absolute right-0 top-0 h-px w-full bg-accent" /><div className="absolute right-0 top-0 h-full w-px bg-accent" /></div></article>;
}
