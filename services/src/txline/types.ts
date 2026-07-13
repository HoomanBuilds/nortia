export type Bytes32Source = string | number[] | Uint8Array;

export type TxlineProofNode = {
  hash: Bytes32Source;
  isRightSibling: boolean;
};

export type TxlineScoreRecord = {
  fixtureId?: number;
  FixtureId?: number;
  seq?: number;
  Seq?: number;
  action?: string;
  Action?: string;
  statusId?: number;
  StatusId?: number;
  period?: number;
  Period?: number;
  [key: string]: unknown;
};

export type TxlineStat = {
  key: number;
  value: number;
  period: number;
};

export type TxlineValidationResponse = {
  summary: {
    fixtureId: number;
    updateStats: {
      updateCount: number;
      minTimestamp: number;
      maxTimestamp: number;
    };
    eventStatsSubTreeRoot: Bytes32Source;
  };
  subTreeProof: TxlineProofNode[];
  mainTreeProof: TxlineProofNode[];
  eventStatRoot: Bytes32Source;
  statsToProve: TxlineStat[];
  statProofs: TxlineProofNode[][];
};

export type SseMessage = {
  event: string | null;
  data: string;
};
