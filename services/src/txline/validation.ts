import BN from "bn.js";
import type { Bytes32Source, TxlineProofNode, TxlineValidationResponse } from "./types.js";

export function toBytes32(value: Bytes32Source) {
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : value instanceof Uint8Array
      ? value
      : value.startsWith("0x")
        ? Buffer.from(value.slice(2), "hex")
        : Buffer.from(value, "base64");
  if (bytes.length !== 32) throw new Error(`Expected 32 bytes, received ${bytes.length}`);
  return Array.from(bytes);
}

function proofNodes(nodes: readonly TxlineProofNode[]) {
  return nodes.map((node) => ({ hash: toBytes32(node.hash), isRightSibling: node.isRightSibling }));
}

export function validationPayload(value: TxlineValidationResponse) {
  if (value.statsToProve.length !== value.statProofs.length) {
    throw new Error("TxLINE stat and proof counts do not match");
  }
  return {
    ts: new BN(value.summary.updateStats.minTimestamp),
    fixtureSummary: {
      fixtureId: new BN(value.summary.fixtureId),
      updateStats: {
        updateCount: value.summary.updateStats.updateCount,
        minTimestamp: new BN(value.summary.updateStats.minTimestamp),
        maxTimestamp: new BN(value.summary.updateStats.maxTimestamp),
      },
      eventsSubTreeRoot: toBytes32(value.summary.eventStatsSubTreeRoot),
    },
    fixtureProof: proofNodes(value.subTreeProof),
    mainTreeProof: proofNodes(value.mainTreeProof),
    eventStatRoot: toBytes32(value.eventStatRoot),
    stats: value.statsToProve.map((stat, index) => ({
      stat,
      statProof: proofNodes(value.statProofs[index] ?? []),
    })),
  };
}
