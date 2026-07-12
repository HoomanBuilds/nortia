import { NextResponse } from "next/server";

import { replayEvents } from "../../../../lib/demo-data";

export function GET() {
  return NextResponse.json({
    mode: "simulation",
    disclosure: "Simulated TxLINE-format World Cup fixture. Not licensed live feed data.",
    fixtures: [{
      fixtureId: 20260719,
      competition: "World Cup Final - Simulation",
      participant1: "Brazil",
      participant2: "France",
      events: replayEvents,
    }],
  });
}
