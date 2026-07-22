export type CommitteeShareDelivery = {
  market: string;
  orderIndex: number;
  orderCommitment: string;
  memberIndex: 1 | 2 | 3;
  sideShare: string;
  yesAmountShare: string;
  totalAmountShare: string;
  salt: string;
  expectedShareCommitment: string;
  placementSignature: string;
};

type CommitteeKey = {
  memberIndex: 1 | 2 | 3;
  publicKey: JsonWebKey;
};

const encoder = new TextEncoder();
let keyRequest: Promise<CommitteeKey[]> | null = null;

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function base64(bytes: ArrayBuffer | Uint8Array) {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function additionalData(memberIndex: number) {
  return encoder.encode(`nortia-committee-share\nmember:${memberIndex}\nnetwork:solana-devnet`);
}

async function committeeKeys() {
  if (!keyRequest) {
    keyRequest = fetch("/api/committee/shares", { cache: "no-store" }).then(async (response) => {
      const value = await response.json() as { keys?: CommitteeKey[]; error?: string };
      if (!response.ok || !Array.isArray(value.keys) || value.keys.length !== 3) {
        throw new Error(value.error ?? "Committee encryption keys are unavailable");
      }
      for (const [index, key] of value.keys.entries()) {
        if (key.memberIndex !== index + 1 || key.publicKey?.kty !== "RSA") throw new Error("Committee encryption key set is invalid");
      }
      return value.keys;
    }).catch((error) => {
      keyRequest = null;
      throw error;
    });
  }
  return keyRequest;
}

async function encryptShare(share: CommitteeShareDelivery, key: CommitteeKey) {
  if (share.memberIndex !== key.memberIndex) throw new Error("Committee share and encryption key do not match");
  const rawKey = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const [aesKey, publicKey] = await Promise.all([
    globalThis.crypto.subtle.importKey("raw", toArrayBuffer(rawKey), "AES-GCM", false, ["encrypt"]),
    globalThis.crypto.subtle.importKey("jwk", key.publicKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]),
  ]);
  const [wrappedKey, ciphertext] = await Promise.all([
    globalThis.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, toArrayBuffer(rawKey)),
    globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(additionalData(share.memberIndex)) },
      aesKey,
      toArrayBuffer(encoder.encode(JSON.stringify(share))),
    ),
  ]);
  return { memberIndex: share.memberIndex, wrappedKey: base64(wrappedKey), iv: base64(iv), ciphertext: base64(ciphertext) };
}

export async function deliverCommitteeShares(shares: readonly CommitteeShareDelivery[]) {
  if (shares.length !== 3 || shares.some((share, index) => share.memberIndex !== index + 1)) {
    throw new Error("Exactly three ordered committee shares are required");
  }
  const keys = await committeeKeys();
  const envelopes = await Promise.all(shares.map((share, index) => encryptShare(share, keys[index] as CommitteeKey)));
  const response = await fetch("/api/committee/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelopes }),
  });
  const value = await response.json() as { accepted?: boolean; error?: string };
  if (!response.ok || !value.accepted) throw new Error(value.error ?? "Committee delivery failed");
}
