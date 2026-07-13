export type PrivatePosition = {
  version: 1;
  marketId: string;
  marketAddress?: string;
  question: string;
  side: "yes" | "no";
  ticketUsdc: 1;
  commitment: string;
  secret: string;
  nullifier: string;
  transactionSignature?: string;
  settlementSignature?: string;
  committeeShares?: Array<{
    memberIndex: 1 | 2 | 3;
    share: string;
    salt: string;
    expectedShareCommitment: string;
  }>;
  createdAt: string;
  status: "prepared" | "open" | "claimable" | "claimed" | "refundable" | "refunded" | "lost";
};

const STORAGE_KEY = "nortia.private-positions.v1";

export function loadPrivatePositions(): PrivatePosition[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(isPrivatePosition);
  } catch {
    return [];
  }
}

export function savePrivatePosition(position: PrivatePosition) {
  const existing = loadPrivatePositions();
  const next = [position, ...existing.filter((item) => item.commitment !== position.commitment)];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function findPrivatePosition(value: string) {
  const query = value.trim().toLowerCase();
  return loadPrivatePositions().find((position) => position.secret.toLowerCase() === query || position.commitment.toLowerCase() === query);
}

function isPrivatePosition(value: unknown): value is PrivatePosition {
  if (!value || typeof value !== "object") return false;
  const position = value as Partial<PrivatePosition>;
  return position.version === 1
    && typeof position.marketId === "string"
    && typeof position.question === "string"
    && (position.side === "yes" || position.side === "no")
    && typeof position.commitment === "string"
    && typeof position.secret === "string"
    && typeof position.nullifier === "string";
}
