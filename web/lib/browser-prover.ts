import type { CompiledCircuit, InputMap } from "@noir-lang/noir_js";

export type SunspotCircuit = "place_order" | "redeem";
export type NoirInputs = InputMap;

type WorkerResult = {
  id: number;
  proof?: ArrayBuffer;
  publicWitness?: ArrayBuffer;
  error?: string;
};

type PendingProof = {
  resolve(value: { proof: string; publicWitness: string }): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

let worker: Worker | null = null;
let requestId = 0;
const pending = new Map<number, PendingProof>();
const circuits = new Map<SunspotCircuit, CompiledCircuit>();

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function failPending(message: string) {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(new Error(message));
  }
  pending.clear();
}

function proverWorker() {
  if (worker) return worker;
  worker = new Worker("/zk/sunspot-worker.js");
  worker.onmessage = (event: MessageEvent<WorkerResult>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    clearTimeout(request.timer);
    if (event.data.error || !event.data.proof || !event.data.publicWitness) {
      request.reject(new Error(event.data.error ?? "Browser prover returned an incomplete result"));
      return;
    }
    request.resolve({
      proof: base64(new Uint8Array(event.data.proof)),
      publicWitness: base64(new Uint8Array(event.data.publicWitness)),
    });
  };
  worker.onerror = () => {
    failPending("Browser prover worker stopped unexpectedly");
    worker?.terminate();
    worker = null;
  };
  return worker;
}

async function circuit(name: SunspotCircuit) {
  const existing = circuits.get(name);
  if (existing) return existing;
  const response = await fetch(`/zk/${name}.json`, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Failed to load the ${name} circuit`);
  const value = await response.json() as CompiledCircuit;
  circuits.set(name, value);
  return value;
}

export async function generateBrowserProof(name: SunspotCircuit, inputs: NoirInputs) {
  const [{ Noir }, program] = await Promise.all([import("@noir-lang/noir_js"), circuit(name)]);
  const { witness } = await new Noir(program).execute(inputs);
  const id = ++requestId;
  return new Promise<{ proof: string; publicWitness: string }>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Browser proof generation timed out"));
    }, 120_000);
    pending.set(id, { resolve, reject, timer });
    const bytes = witness.buffer.slice(witness.byteOffset, witness.byteOffset + witness.byteLength) as ArrayBuffer;
    proverWorker().postMessage({ id, circuit: name, witness: bytes }, [bytes]);
  });
}

export const proofMode = process.env.NEXT_PUBLIC_NORTIA_PROOF_MODE === "hosted" ? "hosted" : "browser";
