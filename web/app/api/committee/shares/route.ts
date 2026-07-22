import { NextResponse } from "next/server";

type Envelope = {
  memberIndex: 1 | 2 | 3;
  wrappedKey: string;
  iv: string;
  ciphertext: string;
};

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function configuration() {
  const endpoints = (process.env.NORTIA_COMMITTEE_ENDPOINTS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const tokens = (process.env.NORTIA_COMMITTEE_API_TOKENS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return { endpoints, tokens };
}

export async function GET() {
  const { endpoints, tokens } = configuration();
  if (endpoints.length !== 3 || tokens.length !== 3 || tokens.some((token) => token.length < 24) || new Set(tokens).size !== 3) {
    return NextResponse.json({ error: "Committee encryption is not configured" }, { status: 503, headers });
  }
  try {
    const keys = await Promise.all(endpoints.map(async (endpoint, index) => {
      const response = await fetch(`${endpoint.replace(/\/$/, "")}/encryption-key`, {
        headers: { Authorization: `Bearer ${tokens[index]}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const value = await response.json() as { memberIndex?: number; publicKey?: JsonWebKey };
      if (!response.ok || value.memberIndex !== index + 1 || value.publicKey?.kty !== "RSA") {
        throw new Error(`Committee member ${index + 1} encryption key is unavailable`);
      }
      return value;
    }));
    return NextResponse.json({ keys }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Committee keys are unavailable" }, { status: 502, headers });
  }
}

export async function POST(request: Request) {
  const { endpoints, tokens } = configuration();
  if (endpoints.length !== 3) return NextResponse.json({ error: "Three committee endpoints are required" }, { status: 503, headers });
  if (tokens.length !== 3 || tokens.some((token) => token.length < 24) || new Set(tokens).size !== 3) {
    return NextResponse.json({ error: "Distinct committee authentication is not configured" }, { status: 503, headers });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32 * 1024) return NextResponse.json({ error: "Committee request is too large" }, { status: 413, headers });
  try {
    const value = await request.json() as { envelopes?: Envelope[] };
    if (!Array.isArray(value.envelopes) || value.envelopes.length !== 3) {
      return NextResponse.json({ error: "Exactly three encrypted committee envelopes are required" }, { status: 400, headers });
    }
    const results = await Promise.all(value.envelopes.map(async (envelope, index) => {
      if (envelope.memberIndex !== index + 1) throw new Error("Committee envelopes must be ordered by member index");
      if (
        !/^[A-Za-z0-9+/]{342}==$/.test(envelope.wrappedKey)
        || !/^[A-Za-z0-9+/]{16}$/.test(envelope.iv)
        || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.ciphertext)
        || envelope.ciphertext.length > 8_192
      ) {
        throw new Error("Committee envelope is invalid");
      }
      const response = await fetch(`${endpoints[index]?.replace(/\/$/, "")}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[index]}` },
        body: JSON.stringify(envelope),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Committee member ${index + 1} rejected the share`);
      return response.json();
    }));
    return NextResponse.json({ accepted: true, members: results }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Committee delivery failed" }, { status: 502, headers });
  }
}
