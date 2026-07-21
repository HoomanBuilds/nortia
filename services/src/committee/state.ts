import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type EncryptedCommitteeState = {
  format: "nortia-committee-state";
  cipher: "aes-256-gcm";
  memberIndex: 1 | 2 | 3;
  iv: string;
  tag: string;
  ciphertext: string;
};

function keyBytes(keyHex: string) {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) throw new Error("COMMITTEE_STATE_KEY must be a 32-byte hex value");
  return Buffer.from(keyHex, "hex");
}

function aad(memberIndex: 1 | 2 | 3) {
  return Buffer.from(`nortia-committee-state\nmember:${memberIndex}`);
}

export function sealCommitteeState(value: unknown, keyHex: string, memberIndex: 1 | 2 | 3) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(keyHex), iv);
  cipher.setAAD(aad(memberIndex));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const state: EncryptedCommitteeState = {
    format: "nortia-committee-state",
    cipher: "aes-256-gcm",
    memberIndex,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return `${JSON.stringify(state)}\n`;
}

export function openCommitteeState(contents: string, keyHex: string, memberIndex: 1 | 2 | 3) {
  const value = JSON.parse(contents) as Partial<EncryptedCommitteeState> | unknown[];
  if (Array.isArray(value)) return { value, legacy: true };
  if (
    value.format !== "nortia-committee-state"
    || value.cipher !== "aes-256-gcm"
    || value.memberIndex !== memberIndex
    || typeof value.iv !== "string"
    || typeof value.tag !== "string"
    || typeof value.ciphertext !== "string"
  ) throw new Error("Committee state envelope is invalid");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(keyHex), Buffer.from(value.iv, "base64"));
  decipher.setAAD(aad(memberIndex));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]);
  return { value: JSON.parse(plaintext.toString("utf8")) as unknown, legacy: false };
}
