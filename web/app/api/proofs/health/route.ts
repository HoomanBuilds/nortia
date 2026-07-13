import { NextResponse } from "next/server";

export async function GET() {
  const origin = process.env.NORTIA_PROVER_URL;
  if (!origin) return NextResponse.json({ ok: false, configured: false }, { status: 503 });
  try {
    const response = await fetch(`${origin.replace(/\/$/, "")}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    return NextResponse.json({ ok: response.ok, configured: true, runtime: await response.json() }, { status: response.ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ ok: false, configured: true, runtime: "unreachable" }, { status: 503 });
  }
}
