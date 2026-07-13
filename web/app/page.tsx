import { LandingGuarantees } from "@/components/landing-guarantees";
import { LandingHero } from "@/components/landing-hero";
import { LandingProtocol } from "@/components/landing-protocol";
import { LandingSideNav } from "@/components/landing-side-nav";
import { LandingSignals } from "@/components/landing-signals";
import { LandingStack } from "@/components/landing-stack";
import { SmoothScroll } from "@/components/smooth-scroll";

export default function LandingPage() {
  return (
    <SmoothScroll>
      <main className="relative min-h-screen overflow-x-hidden">
        <LandingSideNav />
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
        <div className="relative z-10"><LandingHero /><LandingSignals /><LandingProtocol /><LandingGuarantees /><LandingStack /></div>
      </main>
    </SmoothScroll>
  );
}
