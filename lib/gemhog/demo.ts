import { DEMO_FIXTURE } from "./demo-fixture.js";
import { assembleCertificate } from "./grade/grade.js";
import { renderCertificate } from "./certificate.js";
import type { CertificateReport } from "./grade/types.js";

/**
 * The offline walkthrough, computed by the real engine from a recorded
 * fixture — the same synthetic launch the test suite grades. Nothing here
 * touches the network, every output line is marked DEMO, and the numbers
 * change only when the fixture or the formulas do.
 */

export type DemoReport = CertificateReport & { demo: true };

export function demoReport(): DemoReport {
  const report = assembleCertificate(DEMO_FIXTURE);
  report.source = "DEMO · recorded fixture, no network";
  report.holdersSource = "fixture";
  return { ...report, demo: true };
}

export function renderDemo(report: DemoReport, markdown = false): string {
  const lines = renderCertificate(report).split("\n");
  lines.push("", "recorded-fixture walkthrough · run gemhog check <token> for a live certificate");
  // Every line carries the DEMO mark so no excerpt can pass as live chain data.
  const marked = lines.map((l) => (l ? `DEMO │ ${l}` : "DEMO │")).join("\n");
  return markdown ? ["```text", marked, "```"].join("\n") : marked;
}
