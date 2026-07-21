import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nortia",
    short_name: "Nortia",
    description: "Verifiable USDC prediction markets on Solana.",
    start_url: "/",
    display: "standalone",
    background_color: "#080a07",
    theme_color: "#080a07",
    icons: [{ src: "/nortia-mark.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
