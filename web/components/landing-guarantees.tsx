"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HighlightText } from "@/components/highlight-text";

gsap.registerPlugin(ScrollTrigger);

const guarantees = [
  { number: "01", lead: "VERIFY ", highlight: "THE RESULT", description: "TxLINE signatures and Merkle proofs make settlement a checkable instruction, not an operator promise.", align: "left" },
  { number: "02", lead: "HIDE ", highlight: "THE POSITION", description: "Noir commitments keep each user's side private while a threshold committee produces only the pool aggregate.", align: "right" },
  { number: "03", lead: "CHARGE ON ", highlight: "SUCCESS", description: "The 1% protocol fee is taken from the gross pool only after a valid outcome settles on-chain.", align: "left" },
  { number: "04", lead: "REFUND ", highlight: "WITHOUT FRICTION", description: "One-sided, cancelled, or unresolved pools return the original ticket amount with no protocol fee.", align: "right" },
];

export function LandingGuarantees() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !rowsRef.current) return;
    const context = gsap.context(() => {
      gsap.from(headerRef.current, { x: -60, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: headerRef.current, start: "top 85%", toggleActions: "play none none reverse" } });
      rowsRef.current!.querySelectorAll("article").forEach((article, index) => gsap.from(article, { x: guarantees[index]!.align === "right" ? 80 : -80, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: article, start: "top 85%", toggleActions: "play none none reverse" } }));
    }, sectionRef);
    return () => context.revert();
  }, []);
  return (
    <section ref={sectionRef} id="guarantees" className="relative py-32 pl-6 pr-6 md:pl-28 md:pr-12">
      <div ref={headerRef} className="mb-24"><span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">03 / Guarantees</span><h2 className="mt-4 font-[var(--font-bebas)] text-5xl tracking-tight md:text-7xl">WHAT NORTIA WILL NOT COMPROMISE</h2></div>
      <div ref={rowsRef} className="space-y-24 md:space-y-32">
        {guarantees.map((item) => <article key={item.number} className={`flex flex-col ${item.align === "right" ? "items-end text-right" : "items-start text-left"}`}><span className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{item.number} / Protocol rule</span><h3 className="font-[var(--font-bebas)] text-4xl leading-none tracking-tight md:text-6xl lg:text-8xl"><span>{item.lead}</span><HighlightText parallaxSpeed={0.6}>{item.highlight}</HighlightText></h3><p className="mt-6 max-w-md font-mono text-sm leading-relaxed text-muted-foreground">{item.description}</p><div className="mt-8 h-px w-24 bg-border md:w-48" /></article>)}
      </div>
    </section>
  );
}
