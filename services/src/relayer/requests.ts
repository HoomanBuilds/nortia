import { PublicKey } from "@solana/web3.js";

export type RelayRedeemRequest = {
  market: string;
  recipient: string;
  nullifierHash: string;
  proof: string;
  publicWitness: string;
};

function canonicalBase64(value: unknown, name: string, byteLength: number) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(`${name} must be base64`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== byteLength || bytes.toString("base64") !== value) throw new Error(`${name} has an invalid length or encoding`);
  return value;
}

function publicKey(value: unknown, name: string) {
  if (typeof value !== "string") throw new Error(`${name} is required`);
  const key = new PublicKey(value);
  if (!PublicKey.isOnCurve(key.toBytes())) throw new Error(`${name} must be a wallet address`);
  return key.toBase58();
}

export function checkedRelayRedeem(value: unknown): RelayRedeemRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid relay request");
  const input = value as Partial<RelayRedeemRequest>;
  const market = publicKey(input.market, "market");
  const recipient = publicKey(input.recipient, "recipient");
  if (typeof input.nullifierHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(input.nullifierHash)) {
    throw new Error("nullifierHash must be a 32-byte field");
  }
  return {
    market,
    recipient,
    nullifierHash: input.nullifierHash.toLowerCase(),
    proof: canonicalBase64(input.proof, "proof", 324),
    publicWitness: canonicalBase64(input.publicWitness, "publicWitness", 236),
  };
}
