import { NextResponse } from "next/server";
import { runDoctor } from "@/lib/gemhog/doctor";

export const dynamic = "force-dynamic";

/** Same checks as `gemhog doctor`: RPC endpoints, factory addresses, Pons API, Blockscout, DexScreener. */
export async function GET() {
  try {
    const report = await runDoctor();
    return NextResponse.json({ service: "gemhog", ...report }, { status: report.ok ? 200 : 503 });
  } catch {
    return NextResponse.json(
      { service: "gemhog", ok: false, checkedAt: new Date().toISOString() },
      { status: 503 },
    );
  }
}
