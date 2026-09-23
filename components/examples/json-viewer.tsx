"use client";
import { JsonViewer } from "@/components/ui/json-viewer";

// A webhook payload, as it lands in a delivery log: nested, with a long commit
// message, a header that needs bracket paths, a null and a long array.
const payload = {
  id: "evt_01J8Z3K4M2QW",
  type: "deployment.succeeded",
  created: 1758537600,
  livemode: true,
  project: { id: "prj_7Hq2Lx", name: "acme-web", framework: "nextjs", region: "fra1" },
  deployment: {
    id: "dpl_4f2a9c1e",
    url: "https://acme-web-4f2a9c.stealth.app",
    target: "production",
    commit: {
      sha: "4f2a9c1e8b7d6a5f4e3d2c1b0a9f8e7d6c5b4a39",
      message: "Fix invoice rounding for EUR totals so line items and the grand total always agree\n\nCloses #412",
      author: { name: "Maya Okafor", email: "maya@acme.dev" },
    },
    duration_ms: 48213,
    regions: ["fra1", "iad1", "sfo1"],
    checks: [
      { name: "Build", status: "passed", duration_ms: 31840 },
      { name: "Type check", status: "passed", duration_ms: 9120 },
      { name: "E2E smoke", status: "passed", duration_ms: 7253 },
    ],
    // 140 samples, so the array pages at 100.
    latency_ms: Array.from({ length: 140 }, (_, i) => 38 + ((i * 37) % 23) + (i % 11 === 0 ? 41 : 0)),
  },
  delivery: {
    attempt: 1,
    retry_after: null,
    headers: { "content-type": "application/json", "x-signature": "t=1758537600,v1=9b1c…e4d2" },
  },
};

export default function Demo() {
  return (
    <div className="w-full max-w-[520px]">
      <JsonViewer data={payload} label="Webhook payload" maxHeight={336} />
    </div>
  );
}
