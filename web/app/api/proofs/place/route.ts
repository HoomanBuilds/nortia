import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const origin = process.env.NORTIA_PROVER_URL;
  const token = process.env.NORTIA_PROVER_API_TOKEN;
  if (!origin || !token) return NextResponse.json({ error: "Nortia prover is not configured" }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16 * 1024) return NextResponse.json({ error: "Proof request is too large" }, { status: 413 });
  try {
    const payload = await request.json();
    const response = await fetch(`${origin.replace(/\/$/, "")}/place`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Prover request failed" }, { status: 502 });
  }
}
