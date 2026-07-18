import type { PublicKey } from "@solana/web3.js";

export const MAX_OPTIMISTIC_EVIDENCE_URI_BYTES = 160;

export type OptimisticEvidenceRole = "assertion" | "challenge";

const DOMAINS: Readonly<Record<OptimisticEvidenceRole, string>> = {
  assertion: "nortia-optimistic-assertion",
  challenge: "nortia-optimistic-challenge",
};

export function normalizeEvidenceUri(value: string): string {
  if (!value || value.trim() !== value) throw new Error("Evidence URI must use canonical spacing");
  if (new TextEncoder().encode(value).length > MAX_OPTIMISTIC_EVIDENCE_URI_BYTES) {
    throw new Error("Evidence URI cannot exceed 160 bytes");
  }
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw new Error("Evidence URI cannot contain control characters");
  if (!/^[\x20-\x7e]+$/u.test(value)) throw new Error("Evidence URI must use printable ASCII characters");
  if (!value.startsWith("https://") && !value.startsWith("ipfs://") && !value.startsWith("ar://")) {
    throw new Error("Evidence URI must use an HTTPS, IPFS, or Arweave scheme");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Evidence URI is invalid");
  }
  if (!parsed.hostname || parsed.username || parsed.password) throw new Error("Evidence URI is invalid");
  return value;
}

export async function optimisticEvidenceHash(
  role: OptimisticEvidenceRole,
  market: PublicKey,
  outcome: 0 | 1,
  evidenceUri: string,
): Promise<Uint8Array> {
  const uri = normalizeEvidenceUri(evidenceUri);
  const encoder = new TextEncoder();
  const parts = [encoder.encode(DOMAINS[role]), market.toBytes(), Uint8Array.of(outcome), encoder.encode(uri)];
  const length = parts.reduce((total, part) => total + part.length, 0);
  const payload = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.length;
  }
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", payload));
}
