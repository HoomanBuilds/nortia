import { readFile } from "node:fs/promises";
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair } from "@solana/web3.js";
import idl from "./idl/nortia.json" with { type: "json" };
import type { Nortia } from "./idl/nortia.js";
import type { HybridPhase, HybridResolver } from "./hybrid-lifecycle.js";

export async function readKeypair(filePath: string) {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as number[];
  if (!Array.isArray(raw) || raw.length !== 64) throw new Error("NORTIA_KEYPAIR_PATH must contain a 64-byte Solana keypair array");
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function createProgram(connection: Connection, keypair: Keypair) {
  const provider = new AnchorProvider(connection, new Wallet(keypair), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program<Nortia>(idl as Nortia, provider);
}

export function phaseName(phase: Record<string, unknown>) {
  const name = Object.keys(phase)[0];
  if (!name || !["open", "batched", "resolved", "refunding", "closed"].includes(name)) {
    throw new Error("Unknown Nortia market phase");
  }
  return name as "open" | "batched" | "resolved" | "refunding" | "closed";
}

export function hybridPhaseName(phase: Record<string, unknown>): HybridPhase {
  const name = Object.keys(phase)[0];
  if (
    !name
    || !["open", "locked", "resolving", "disputed", "resolved", "closed"].includes(name)
  ) {
    throw new Error("Unknown Nortia hybrid phase");
  }
  return name as HybridPhase;
}

export function oracleResolverName(resolver: Record<string, unknown>): HybridResolver {
  const name = Object.keys(resolver)[0];
  const names: Record<string, HybridResolver> = {
    txlineStat: "txline-stat",
    pythPrice: "pyth-price",
    switchboardQuote: "switchboard-quote",
    optimistic: "optimistic",
    umaWormhole: "uma-wormhole",
    chainlinkReport: "chainlink-report",
    storkPrice: "stork-price",
  };
  const mapped = name ? names[name] : undefined;
  if (!mapped) throw new Error("Unknown Nortia oracle resolver");
  return mapped;
}
