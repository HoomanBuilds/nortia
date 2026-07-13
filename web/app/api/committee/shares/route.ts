import { NextResponse } from "next/server";

type Share = {
  market: string;
  orderIndex: number;
  orderCommitment: string;
  memberIndex: number;
  share: string;
  salt: string;
  expectedShareCommitment: string;
  placementSignature: string;
};

export async function POST(request: Request) {
  const endpoints = (process.env.NORTIA_COMMITTEE_ENDPOINTS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (endpoints.length !== 3) return NextResponse.json({ error: "Three committee endpoints are required" }, { status: 503 });
  const value = await request.json() as { shares?: Share[] };
  if (!Array.isArray(value.shares) || value.shares.length !== 3) {
    return NextResponse.json({ error: "Exactly three committee shares are required" }, { status: 400 });
  }
  try {
    const results = await Promise.all(value.shares.map(async (share, index) => {
      if (share.memberIndex !== index + 1) throw new Error("Committee shares must be ordered by member index");
      const response = await fetch(`${endpoints[index]?.replace(/\/$/, "")}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(share),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Committee member ${index + 1} rejected the share`);
      return response.json();
    }));
    return NextResponse.json({ accepted: true, members: results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Committee delivery failed" }, { status: 502 });
  }
}
