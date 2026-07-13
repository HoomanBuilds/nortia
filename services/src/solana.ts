import { readFile } from "node:fs/promises";
import { AnchorProvider, Program, Wallet } from "@anchor-lang/core";
import { Connection, Keypair } from "@solana/web3.js";
import idl from "./idl/nortia.json" with { type: "json" };
import type { Nortia } from "./idl/nortia.js";

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
