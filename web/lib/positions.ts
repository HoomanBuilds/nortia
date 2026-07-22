export type PrivatePosition = {
  version: 1;
  owner: string;
  marketId: string;
  marketAddress?: string;
  question: string;
  side: "yes" | "no";
  amount: string;
  stakeAmount: string;
  commitment: string;
  secret: string;
  nullifier: string;
  transactionSignature?: string;
  settlementSignature?: string;
  committeeShares?: Array<{
    memberIndex: 1 | 2 | 3;
    sideShare: string;
    yesAmountShare: string;
    totalAmountShare: string;
    salt: string;
    expectedShareCommitment: string;
  }>;
  createdAt: string;
  status: "prepared" | "delivery-pending" | "open" | "claimable" | "claimed" | "refundable" | "refunded";
};

type EncryptedVault = {
  format: "nortia-private-positions";
  network: "solana-devnet";
  wallet: string;
  iv: string;
  ciphertext: string;
};

type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const STORAGE_PREFIX = "nortia.private-position-vault.";
const LEGACY_STORAGE_KEY = "nortia.private-positions";
const NETWORK = "solana-devnet";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function vaultMessage(wallet: string) {
  return [
    "Nortia private position vault",
    `Network: ${NETWORK}`,
    `Wallet: ${wallet}`,
    "Purpose: encrypt and recover private market positions",
    "This signature does not submit a transaction or authorize spending.",
  ].join("\n");
}

function additionalData(wallet: string) {
  return encoder.encode(`nortia-private-positions\n${NETWORK}\n${wallet}`);
}

async function deriveVaultKey(wallet: string, signature: Uint8Array) {
  const message = encoder.encode(vaultMessage(wallet));
  const material = new Uint8Array(message.length + signature.length);
  material.set(message);
  material.set(signature, message.length);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", toArrayBuffer(material));
  return globalThis.crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function parsePositions(value: unknown, owner: string): PrivatePosition[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizePosition(item, owner))
    .filter((item): item is PrivatePosition => item !== null);
}

function normalizePosition(value: unknown, owner: string): PrivatePosition | null {
  if (!value || typeof value !== "object") return null;
  const position = value as Partial<PrivatePosition>;
  const legacy = position as Partial<PrivatePosition> & { ticketUsdc?: unknown };
  const normalizedOwner = typeof position.owner === "string" ? position.owner : owner;
  const amount = typeof position.amount === "string"
    ? position.amount
    : legacy.ticketUsdc === 1
      ? "1000000"
      : null;
  const stakeAmount = typeof position.stakeAmount === "string" ? position.stakeAmount : amount;
  if (
    position.version !== 1
    || normalizedOwner !== owner
    || typeof position.marketId !== "string"
    || typeof position.question !== "string"
    || (position.side !== "yes" && position.side !== "no")
    || typeof position.commitment !== "string"
    || typeof position.secret !== "string"
    || typeof position.nullifier !== "string"
    || typeof amount !== "string"
    || typeof stakeAmount !== "string"
    || !/^\d+$/.test(amount)
    || !/^\d+$/.test(stakeAmount)
  ) return null;
  return { ...position, owner: normalizedOwner, amount, stakeAmount } as PrivatePosition;
}

function dedupe(positions: PrivatePosition[]) {
  const unique = new Map<string, PrivatePosition>();
  for (const position of positions) {
    if (!unique.has(position.commitment)) unique.set(position.commitment, position);
  }
  return [...unique.values()];
}

function storageKey(wallet: string) {
  return `${STORAGE_PREFIX}${wallet}`;
}

function parseVault(value: unknown): EncryptedVault | null {
  if (!value || typeof value !== "object") return null;
  const vault = value as Partial<EncryptedVault>;
  if (
    vault.format !== "nortia-private-positions"
    || vault.network !== NETWORK
    || typeof vault.wallet !== "string"
    || typeof vault.iv !== "string"
    || typeof vault.ciphertext !== "string"
  ) return null;
  return vault as EncryptedVault;
}

function readVault(wallet: string): EncryptedVault | null {
  if (typeof window === "undefined") return null;
  try {
    return parseVault(JSON.parse(window.localStorage.getItem(storageKey(wallet)) ?? "null") as unknown);
  } catch {
    return null;
  }
}

async function decryptVault(vault: EncryptedVault, key: CryptoKey) {
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64(vault.iv)), additionalData: toArrayBuffer(additionalData(vault.wallet)) },
    key,
    toArrayBuffer(fromBase64(vault.ciphertext)),
  );
  return parsePositions(JSON.parse(decoder.decode(plaintext)) as unknown, vault.wallet);
}

async function encryptVault(wallet: string, positions: PrivatePosition[], key: CryptoKey) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(dedupe(positions)));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: toArrayBuffer(additionalData(wallet)) },
    key,
    toArrayBuffer(plaintext),
  );
  const vault: EncryptedVault = {
    format: "nortia-private-positions",
    network: NETWORK,
    wallet,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  window.localStorage.setItem(storageKey(wallet), JSON.stringify(vault));
}

function readLegacyPositions(owner: string) {
  if (typeof window === "undefined") return [];
  try {
    return parsePositions(JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]") as unknown, owner);
  } catch {
    return [];
  }
}

export async function unlockPrivatePositions(wallet: string, signMessage: SignMessage) {
  const signature = await signMessage(encoder.encode(vaultMessage(wallet)));
  const key = await deriveVaultKey(wallet, signature);
  const vault = readVault(wallet);
  const encrypted = vault ? await decryptVault(vault, key) : [];
  const legacy = readLegacyPositions(wallet);
  const positions = dedupe([...encrypted, ...legacy]);
  if (legacy.length > 0 || !vault) {
    await encryptVault(wallet, positions, key);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  return { key, positions, migrated: legacy.length };
}

export async function loadPrivatePositions(wallet: string, key: CryptoKey) {
  const vault = readVault(wallet);
  if (!vault) return [];
  if (vault.wallet !== wallet) throw new Error("This browser vault belongs to a different wallet");
  return decryptVault(vault, key);
}

export async function savePrivatePosition(position: PrivatePosition, key: CryptoKey) {
  const existing = await loadPrivatePositions(position.owner, key);
  await encryptVault(position.owner, [position, ...existing.filter((item) => item.commitment !== position.commitment)], key);
}

export function findPrivatePosition(positions: readonly PrivatePosition[], value: string) {
  const query = value.trim().toLowerCase();
  return positions.find((position) => position.secret.toLowerCase() === query || position.commitment.toLowerCase() === query);
}

export async function exportPrivatePositionVault(wallet: string, key: CryptoKey) {
  const positions = await loadPrivatePositions(wallet, key);
  await encryptVault(wallet, positions, key);
  return window.localStorage.getItem(storageKey(wallet)) ?? "";
}

export async function importPrivatePositionVault(wallet: string, key: CryptoKey, backup: string) {
  let vault: EncryptedVault | null;
  try {
    vault = parseVault(JSON.parse(backup) as unknown);
  } catch {
    vault = null;
  }
  if (!vault) throw new Error("Private position backup is invalid");
  if (vault.wallet !== wallet) throw new Error("Private position backup belongs to a different wallet");
  const [imported, existing] = await Promise.all([decryptVault(vault, key), loadPrivatePositions(wallet, key)]);
  const positions = dedupe([...imported, ...existing]);
  await encryptVault(wallet, positions, key);
  return positions;
}
