import { NextResponse } from "next/server";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  const origin = process.env.NORTIA_PROVER_URL;
  const token = process.env.NORTIA_PROVER_API_TOKEN;
  if (!origin || !token) return NextResponse.json({ error: "Nortia prover is not configured" }, { status: 503, headers });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32 * 1024) return NextResponse.json({ error: "Proof request is too large" }, { status: 413, headers });
  try {
    const response = await fetch(`${origin.replace(/\/$/, "")}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(await request.json()),
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    });
    return NextResponse.json(await response.json(), { status: response.status, headers });
  } catch {
    return NextResponse.json({ error: "Prover request failed" }, { status: 502, headers });
  }
}
