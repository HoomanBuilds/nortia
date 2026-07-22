importScripts("/zk/wasm_exec.js");

const artifactCache = new Map();
let runtimePromise;

async function bytes(url) {
  const cached = artifactCache.get(url);
  if (cached) return cached;
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Failed to load proving artifact ${url}`);
  const value = new Uint8Array(await response.arrayBuffer());
  artifactCache.set(url, value);
  return value;
}

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const go = new self.Go();
      const response = await fetch("/zk/sunspot-prover.wasm", { cache: "force-cache" });
      if (!response.ok) throw new Error("Failed to load the browser prover");
      let module;
      try {
        module = await WebAssembly.instantiateStreaming(response.clone(), go.importObject);
      } catch {
        module = await WebAssembly.instantiate(await response.arrayBuffer(), go.importObject);
      }
      void go.run(module.instance);
      const startedAt = Date.now();
      while (typeof self.nortiaSunspotProve !== "function") {
        if (Date.now() - startedAt > 15_000) throw new Error("Browser prover runtime did not initialize");
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    })();
  }
  await runtimePromise;
}

self.onmessage = async (event) => {
  const { id, circuit, witness } = event.data;
  try {
    if (circuit !== "place_order" && circuit !== "redeem") throw new Error("Unknown circuit");
    await runtime();
    const [acir, ccs, provingKey] = await Promise.all([
      bytes(`/zk/${circuit}.json`),
      bytes(`/zk/${circuit}.ccs`),
      bytes(`/zk/${circuit}.pk`),
    ]);
    const result = self.nortiaSunspotProve(acir, new Uint8Array(witness), ccs, provingKey);
    if (result.error) throw new Error(result.error);
    const proof = result.proof.slice().buffer;
    const publicWitness = result.publicWitness.slice().buffer;
    self.postMessage({ id, proof, publicWitness }, [proof, publicWitness]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Browser proof failed" });
  }
};
