import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/bebas-neue";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SolanaProvider } from "@/components/solana-provider";

export const metadata: Metadata = {
  title: "Nortia | Verifiable Prediction Markets",
  description: "USDC prediction markets with LMSR trading, private pools, and verifiable multi-oracle settlement on Solana.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SolanaProvider><SiteHeader />{children}</SolanaProvider></body></html>;
}
