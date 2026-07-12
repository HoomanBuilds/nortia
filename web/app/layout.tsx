import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TopNav } from "../components/top-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nortia | Private World Cup Markets",
  description: "Private USDC prediction pools settled from verifiable TxLINE sports data on Solana.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
