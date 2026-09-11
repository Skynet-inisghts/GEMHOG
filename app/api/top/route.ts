import { NextResponse } from "next/server";
import pulse from "@/assets/pulse.json";
import { indexLaunches, rankCandidates, WINDOWS } from "@/lib/gemhog/hunt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Counters only, never the list: `{ graded, byGrade, vs2plus }` comes from the
 * latest pulse snapshot, and when the snapshot is stale the launch counters
 * are re-read live while the grade counters honestly stay from the snapshot.
 * The ranked list itself lives in the CLI — `gemhog hunt` — by design.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const window = url.searchParams.get("window") ?? "6h";
  if (!WINDOWS[window]) {
    return NextResponse.json({ error: `unknown window; use one of ${Object.keys(WINDOWS).join(", ")}` }, { status: 400 });
  }
  const pulseFresh = pulse.generatedAt !== null && Date.now() - Date.parse(pulse.generatedAt) < 40 * 60_000 && pulse.window === window;
  if (pulseFresh) {
    return NextResponse.json({ ...pulse, source: "pulse" });
  }
  try {
    const { launches } = await indexLaunches(WINDOWS[window]);
    const withBuyers = rankCandidates(launches).length;
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      window,
      launches: launches.length,
      withBuyers,
      graded: pulse.window === window ? pulse.graded : 0,
      byGrade: pulse.window === window ? pulse.byGrade : {},
      vs2plus: pulse.window === window ? pulse.vs2plus : 0,
      source: "live-index, grade counters from the last pulse; the full list lives in the CLI",
    });
  } catch {
    return NextResponse.json({ ...pulse, source: "pulse (stale; live index unavailable)" }, { status: 200 });
  }
}
