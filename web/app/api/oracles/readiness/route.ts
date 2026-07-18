import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    pyth: {
      available: true,
      authenticated: Boolean(process.env.PYTH_API_KEY?.trim()),
      publicEndpoint: !process.env.PYTH_API_KEY?.trim(),
      apiKeyRequiredFrom: "2026-08-18",
    },
    switchboard: {
      available: true,
      authenticated: false,
      publicEndpoint: true,
    },
    stork: {
      available: Boolean(process.env.STORK_API_TOKEN?.trim()),
      authenticated: Boolean(process.env.STORK_API_TOKEN?.trim()),
      externalPusherRequired: true,
    },
    txline: {
      available: Boolean(process.env.TXLINE_JWT && process.env.TXLINE_API_TOKEN),
      replayAvailable: true,
    },
  });
}
