"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NortiaMark } from "@/components/nortia-mark";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "hero", label: "Index" },
  { id: "signals", label: "Signals" },
  { id: "protocol", label: "Protocol" },
  { id: "guarantees", label: "Guarantees" },
  { id: "stack", label: "Stack" },
];

export function LandingSideNav() {
  const [activeSection, setActiveSection] = useState("hero");
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && setActiveSection(entry.target.id)), { threshold: 0.3 });
    navItems.forEach(({ id }) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, []);
  return (
    <nav className="fixed left-0 top-0 z-50 hidden h-screen w-20 flex-col justify-center border-r border-border/30 bg-background/80 px-4 backdrop-blur-sm md:flex" aria-label="Landing sections">
      <Link href="/" className="landing-brand-mark" aria-label="Nortia home"><NortiaMark size={25} /></Link>
      <div className="flex flex-col gap-6">
        {navItems.map(({ id, label }) => <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })} className="group relative flex items-center gap-3" aria-label={`Scroll to ${label}`}><span className={cn("h-1.5 w-1.5 rounded-full transition-all duration-300", activeSection === id ? "scale-125 bg-accent" : "bg-muted-foreground/40 group-hover:bg-foreground/60")} /><span className={cn("absolute left-6 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest opacity-0 transition-all duration-200 group-hover:left-8 group-hover:opacity-100", activeSection === id ? "text-accent" : "text-muted-foreground")}>{label}</span></button>)}
      </div>
    </nav>
  );
}
