import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";

export type CommitteeEnvelope = {
  memberIndex: 1 | 2 | 3;
  wrappedKey: string;
  iv: string;
  ciphertext: string;
};

export type CommitteeEncryptionKeyFile = {
  format: "nortia-committee-encryption-key";
  memberIndex: 1 | 2 | 3;
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
};

function additionalData(memberIndex: number) {
  return new TextEncoder().encode(`nortia-committee-share\nmember:${memberIndex}\nnetwork:solana-devnet`);
}

function canonicalBase64(value: unknown, name: string, expectedLength?: number, maximumLength = 4_096) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(`${name} must be base64`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value || bytes.length > maximumLength || (expectedLength !== undefined && bytes.length !== expectedLength)) {
    throw new Error(`${name} has an invalid length or encoding`);
  }
  return bytes;
}

function checkedMemberIndex(value: unknown): 1 | 2 | 3 {
  if (value !== 1 && value !== 2 && value !== 3) throw new Error("memberIndex must be 1, 2, or 3");
  return value;
}

export async function generateCommitteeEncryptionKey(memberIndex: 1 | 2 | 3): Promise<CommitteeEncryptionKeyFile> {
  const pair = await webcrypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"],
  );
  const [publicKey, privateKey] = await Promise.all([
    webcrypto.subtle.exportKey("jwk", pair.publicKey),
    webcrypto.subtle.exportKey("jwk", pair.privateKey),
  ]);
  return { format: "nortia-committee-encryption-key", memberIndex, publicKey, privateKey };
}

export async function readCommitteeEncryptionKey(filePath: string, expectedMemberIndex: 1 | 2 | 3) {
  const value = JSON.parse(await readFile(filePath, "utf8")) as Partial<CommitteeEncryptionKeyFile>;
  if (
    value.format !== "nortia-committee-encryption-key"
    || value.memberIndex !== expectedMemberIndex
    || value.publicKey?.kty !== "RSA"
    || value.privateKey?.kty !== "RSA"
  ) throw new Error("Committee encryption key file is invalid for this member");
  return value as CommitteeEncryptionKeyFile;
}

export async function sealCommitteeShare(value: unknown, publicJwk: JsonWebKey, memberIndex: 1 | 2 | 3): Promise<CommitteeEnvelope> {
  const rawKey = webcrypto.getRandomValues(new Uint8Array(32));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const [aesKey, publicKey] = await Promise.all([
    webcrypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]),
    webcrypto.subtle.importKey("jwk", publicJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]),
  ]);
  const [wrappedKey, ciphertext] = await Promise.all([
    webcrypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey),
    webcrypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: additionalData(memberIndex) },
      aesKey,
      new TextEncoder().encode(JSON.stringify(value)),
    ),
  ]);
  return {
    memberIndex,
    wrappedKey: Buffer.from(wrappedKey).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    ciphertext: Buffer.from(ciphertext).toString("base64"),
  };
}

export async function openCommitteeShare(envelopeValue: unknown, privateJwk: JsonWebKey, expectedMemberIndex: 1 | 2 | 3) {
  if (!envelopeValue || typeof envelopeValue !== "object") throw new Error("Encrypted committee envelope is required");
  const envelope = envelopeValue as Partial<CommitteeEnvelope>;
  const memberIndex = checkedMemberIndex(envelope.memberIndex);
  if (memberIndex !== expectedMemberIndex) throw new Error("Encrypted share was sent to the wrong committee member");
  const wrappedKey = canonicalBase64(envelope.wrappedKey, "wrappedKey", 256);
  const iv = canonicalBase64(envelope.iv, "iv", 12);
  const ciphertext = canonicalBase64(envelope.ciphertext, "ciphertext");
  const privateKey = await webcrypto.subtle.importKey("jwk", privateJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  const rawKey = await webcrypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, wrappedKey);
  const aesKey = await webcrypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const plaintext = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(memberIndex) },
    aesKey,
    ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
}
