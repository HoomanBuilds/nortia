"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const signals = [
  { code: "ORACLE / FACT", title: "Resolver Mesh", value: "VERIFIED", note: "TxLINE sports, timestamped Pyth prices, canonical Switchboard quotes, and bonded public evidence settle distinct market categories." },
  { code: "LMSR / CURVE", title: "Live Probability", value: "CONTINUOUS", note: "Every exact-share fill moves the public probability through deterministic integer-only LMSR pricing." },
  { code: "SOL / PDA", title: "USDC Escrow", value: "SOLVENT", note: "Creator subsidy and trader cash stay in a program-controlled vault that must cover the largest possible payout." },
  { code: "HASH / RULE", title: "Fixed Predicate", value: "IMMUTABLE", note: "Question, rules, outcome labels, resolver configuration, and observation time are committed before trading opens." },
  { code: "BPS / FEE", title: "Curve Fee", value: "1.00% MAX", note: "A probability-sensitive fill fee routes 70% to Nortia and 30% to market liquidity. Settlement and invalid claims add no second fee." },
];

export function LandingSignals() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const cursor = cursorRef.current;
    if (!section || !cursor) return;
    const move = (event: MouseEvent) => { const rect = section.getBoundingClientRect(); gsap.to(cursor, { x: event.clientX - rect.left, y: event.clientY - rect.top, duration: 0.5, ease: "power3.out" }); };
    const enter = () => setHovering(true);
    const leave = () => setHovering(false);
    section.addEventListener("mousemove", move); section.addEventListener("mouseenter", enter); section.addEventListener("mouseleave", leave);
    return () => { section.removeEventListener("mousemove", move); section.removeEventListener("mouseenter", enter); section.removeEventListener("mouseleave", leave); };
  }, []);

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !cardsRef.current) return;
    const context = gsap.context(() => {
      gsap.fromTo(headerRef.current, { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: headerRef.current, start: "top 85%", toggleActions: "play none none reverse" } });
      gsap.fromTo(cardsRef.current!.querySelectorAll("article"), { x: -100, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, stagger: 0.16, ease: "power3.out", scrollTrigger: { trigger: cardsRef.current, start: "top 90%", toggleActions: "play none none reverse" } });
    }, sectionRef);
    return () => context.revert();
  }, []);

  return (
    <section id="signals" ref={sectionRef} className="relative py-32 pl-6 md:pl-28">
      <div ref={cursorRef} className={cn("pointer-events-none absolute left-0 top-0 z-50 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-accent transition-opacity duration-300 mix-blend-difference", hovering ? "opacity-100" : "opacity-0")} />
      <div ref={headerRef} className="mb-16 pr-6 md:pr-12">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">01 / Live signals</span>
        <div className="mt-4 flex items-end justify-between gap-8"><h2 className="font-[var(--font-bebas)] text-5xl tracking-tight md:text-7xl">WHAT MOVES A MARKET</h2><p className="hidden max-w-sm text-right font-mono text-xs leading-relaxed text-muted-foreground md:block">Five signals. One auditable path from an external fact to a USDC payout.</p></div>
      </div>
      <div ref={cardsRef} className="flex gap-8 overflow-x-auto pb-8 pr-12" style={{ scrollbarWidth: "none" }}>
        {signals.map((signal, index) => <article key={signal.title} className="group relative w-80 flex-shrink-0 transition-transform duration-500 ease-out hover:-translate-y-2"><div className="relative border border-border/50 bg-card p-8"><div className="mb-8 flex items-baseline justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">No. {String(index + 1).padStart(2, "0")}</span><time className="font-mono text-[10px] text-muted-foreground/60">{signal.code}</time></div><h3 className="font-[var(--font-bebas)] text-4xl tracking-tight transition-colors duration-300 group-hover:text-accent">{signal.title}</h3><strong className="mt-2 block font-mono text-xs tracking-[0.18em] text-accent">{signal.value}</strong><div className="my-6 h-px w-12 bg-accent/60 transition-all duration-500 group-hover:w-full" /><p className="font-mono text-xs leading-relaxed text-muted-foreground">{signal.note}</p><div className="absolute bottom-0 right-0 h-6 w-6 overflow-hidden"><div className="absolute bottom-0 right-0 h-8 w-8 translate-x-4 translate-y-4 rotate-45 border-l border-t border-border/30 bg-background" /></div></div><div className="absolute inset-0 -z-10 translate-x-1 translate-y-1 bg-accent/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" /></article>)}
      </div>
    </section>
  );
}
