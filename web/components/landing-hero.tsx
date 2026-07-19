"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatedNoise } from "@/components/animated-noise";
import { BitmapChevron } from "@/components/bitmap-chevron";
import { SolanaNetworkIcon, UsdcTokenIcon } from "@/components/market-icons";
import { ScrambleTextOnHover } from "@/components/scramble-text";
import { SplitFlapAudioProvider, SplitFlapMuteToggle, SplitFlapText } from "@/components/split-flap-text";

gsap.registerPlugin(ScrollTrigger);

export function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return;
    const context = gsap.context(() => {
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: { trigger: sectionRef.current, start: "top top", end: "bottom top", scrub: 1 },
      });
    }, sectionRef);
    return () => context.revert();
  }, []);

  return (
    <section ref={sectionRef} id="hero" className="landing-hero relative flex min-h-screen items-center pl-6 pr-6 md:pl-28 md:pr-12">
      <AnimatedNoise opacity={0.035} />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 md:left-6">
        <span className="block origin-left -rotate-90 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">NORTIA / SOLANA</span>
      </div>
      <div className="absolute right-6 top-6 z-20 flex items-center gap-3 md:right-12 md:top-10">
        <span className="landing-network-status hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:flex"><SolanaNetworkIcon size={15} />Devnet oracles ready</span>
        <Link href="/markets" className="landing-top-cta">Open markets <BitmapChevron /></Link>
      </div>
      <div ref={contentRef} className="w-full flex-1">
        <SplitFlapAudioProvider>
          <div className="relative">
            <SplitFlapText text="NORTIA" speed={72} />
            <div className="mt-4"><SplitFlapMuteToggle /></div>
          </div>
        </SplitFlapAudioProvider>
        <h2 className="mt-4 font-[var(--font-bebas)] text-[clamp(1rem,3vw,2.25rem)] tracking-[0.05em] text-muted-foreground/70">
          PREDICTION MARKETS / VERIFIED SETTLEMENT
        </h2>
        <p className="mt-12 max-w-lg font-mono text-sm leading-relaxed text-muted-foreground">
          Trade real-world outcomes through a collateralized LMSR. TxLINE, Pyth, Switchboard, and bonded evidence routes turn sports, prices, and long-tail facts into inspectable Solana settlement.
        </p>
        <div className="mt-14 flex flex-wrap items-center gap-7">
          <Link href="/markets" className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground transition-all duration-200 hover:border-accent hover:text-accent">
            <ScrambleTextOnHover text="Enter Markets" as="span" duration={0.55} />
            <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
          </Link>
          <a href="#protocol" className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors duration-200 hover:text-foreground">Inspect protocol</a>
        </div>
      </div>
      <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12">
        <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">NORTIA / DEVNET BUILD</div>
      </div>
      <div className="hero-readout absolute bottom-8 left-6 hidden gap-8 md:left-28 md:flex">
        <span><UsdcTokenIcon size={14} /><b>USDC</b> collateral</span><span><b>LMSR</b> live pricing</span><span><b>4</b> resolver paths</span>
      </div>
    </section>
  );
}
