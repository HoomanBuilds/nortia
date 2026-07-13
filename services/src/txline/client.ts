import type { SseMessage, TxlineScoreRecord, TxlineValidationResponse } from "./types.js";

type Credentials = {
  origin: string;
  jwt: string;
  apiToken: string;
};

function scoreRecords(value: unknown): TxlineScoreRecord[] {
  if (Array.isArray(value)) return value as TxlineScoreRecord[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["data", "records", "updates", "scores"]) {
    if (Array.isArray(record[key])) return record[key] as TxlineScoreRecord[];
  }
  return [];
}

export function isFinalScore(record: TxlineScoreRecord) {
  const action = record.action ?? record.Action;
  const statusId = record.statusId ?? record.StatusId;
  const period = record.period ?? record.Period;
  const seq = record.seq ?? record.Seq;
  return action === "game_finalised" && statusId === 100 && period === 100 && Number.isInteger(seq) && Number(seq) >= 1;
}

export function latestFinalScore(value: unknown) {
  return scoreRecords(value)
    .filter(isFinalScore)
    .sort((left, right) => Number(right.seq ?? right.Seq) - Number(left.seq ?? left.Seq))[0] ?? null;
}

export class TxlineClient {
  readonly #credentials: Credentials;

  constructor(credentials: Credentials) {
    this.#credentials = { ...credentials, origin: credentials.origin.replace(/\/$/, "") };
  }

  async #get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.#credentials.origin}/api${path}`, {
      headers: this.#headers("application/json"),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`TxLINE ${path} failed with ${response.status}`);
    return response.json() as Promise<T>;
  }

  #headers(accept: string) {
    return {
      Accept: accept,
      Authorization: `Bearer ${this.#credentials.jwt}`,
      "X-Api-Token": this.#credentials.apiToken,
    };
  }

  snapshot(fixtureId: number, asOf = Date.now()) {
    return this.#get<unknown>(`/scores/snapshot/${fixtureId}?asOf=${asOf}`);
  }

  historical(fixtureId: number) {
    return this.#get<unknown>(`/scores/historical/${fixtureId}`);
  }

  updates(epochDay: number, hourOfDay: number, interval: number, fixtureId?: number) {
    const suffix = fixtureId ? `?fixtureId=${fixtureId}` : "";
    return this.#get<unknown>(`/scores/updates/${epochDay}/${hourOfDay}/${interval}${suffix}`);
  }

  validationProof(fixtureId: number, seq: number, statKeys: readonly number[]) {
    if (!Number.isInteger(seq) || seq < 1) throw new Error("TxLINE score sequence must be at least 1");
    if (statKeys.length === 0) throw new Error("At least one TxLINE stat key is required");
    const query = new URLSearchParams({
      fixtureId: String(fixtureId),
      seq: String(seq),
      statKeys: statKeys.join(","),
    });
    return this.#get<TxlineValidationResponse>(`/scores/stat-validation?${query}`);
  }

  async *scoreStream(signal?: AbortSignal): AsyncGenerator<SseMessage> {
    const response = await fetch(`${this.#credentials.origin}/api/scores/stream`, {
      headers: { ...this.#headers("text/event-stream"), "Cache-Control": "no-cache" },
      signal,
    });
    if (!response.ok || !response.body) throw new Error(`TxLINE score stream failed with ${response.status}`);

    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let event: string | null = null;
        const data: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
        }
        if (data.length > 0) yield { event, data: data.join("\n") };
        boundary = buffer.indexOf("\n\n");
      }
    }
  }
}
