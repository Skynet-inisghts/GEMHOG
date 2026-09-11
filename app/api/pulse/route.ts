import { NextResponse } from "next/server";
import pulse from "@/assets/pulse.json";

/**
 * The pulse: grade counters for the last window, written to assets/pulse.json
 * by the pulse workflow every 20 minutes. Counters only — the list of tokens
 * lives in the CLI, on purpose.
 */
export async function GET() {
  return NextResponse.json(pulse);
}
