import { NextRequest, NextResponse } from "next/server";

const origin = (process.env.STORK_REST_ORIGIN ?? "https://rest.dev.stork-oracle.network").replace(/\/+$/, "");

function headers(token: string) {
  return { Authorization: `Basic ${token}`, Accept: "application/json" };
}

export async function GET(request: NextRequest) {
  const token = process.env.STORK_API_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ configured: false, error: "STORK_API_TOKEN is required" }, { status: 503 });
  }
  const asset = request.nextUrl.searchParams.get("asset")?.trim() ?? "";
  if (asset && !/^[A-Z0-9_.-]{2,80}$/.test(asset)) {
    return NextResponse.json({ error: "Invalid Stork asset ID" }, { status: 400 });
  }
  const path = asset
    ? `/v1/prices/latest?assets=${encodeURIComponent(asset)}`
    : "/v1/prices/assets";
  try {
    const response = await fetch(`${origin}${path}`, {
      headers: headers(token),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Stork returned ${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    if (!asset) {
      const values = (payload.data as unknown[] | undefined) ?? [];
      const assets = values
        .filter((value): value is string => typeof value === "string" && /^[A-Z0-9_.-]{2,80}$/.test(value))
        .sort()
        .slice(0, 1_000);
      return NextResponse.json({ configured: true, assets });
    }
    const data = payload.data as { value?: Record<string, Record<string, unknown>> } | undefined;
    const value = data?.value?.[asset];
    const signed = value?.stork_signed_price as Record<string, unknown> | undefined;
    const feedId = String(signed?.encoded_asset_id ?? "").toLowerCase().replace(/^0x/, "");
    const price = String(value?.price ?? "");
    const timestampNs = String(value?.timestamp ?? "");
    if (value?.asset_id !== asset || !/^[0-9a-f]{64}$/.test(feedId) || !/^\d+$/.test(price) || !/^\d+$/.test(timestampNs)) {
      throw new Error("Stork returned malformed asset metadata");
    }
    return NextResponse.json({ configured: true, asset: { assetId: asset, feedId, price, timestampNs } });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      error: error instanceof Error ? error.message : "Stork request failed",
    }, { status: 502 });
  }
}
