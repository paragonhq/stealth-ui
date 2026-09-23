"use client";
import { type UptimeDay, UptimeBars } from "@/components/ui/uptime-bars";

// A status page's component list: an API with one bad afternoon, a steady
// dashboard, and a webhooks service that only started reporting 41 days ago.
const end = Date.UTC(2026, 8, 21);
const iso = (daysAgo: number) => new Date(end - daysAgo * 86_400_000).toISOString().slice(0, 10);

function history(length: number, events: Record<number, Partial<UptimeDay>>): UptimeDay[] {
  return Array.from({ length }, (_, i) => {
    const ago = length - 1 - i;
    return { date: iso(ago), ...events[ago] };
  });
}

const api = history(90, {
  71: { degraded: 22, incidents: [{ title: "Elevated latency in fra1", minutes: 22 }] },
  44: { downtime: 38, degraded: 15, incidents: [{ title: "Charges API returning 502s", minutes: 38 }, { title: "Recovery: queued retries draining", minutes: 15 }] },
  43: { degraded: 9, incidents: [{ title: "Webhook delivery delayed", minutes: 9 }] },
  12: { degraded: 31, incidents: [{ title: "Slow invoice exports", minutes: 31 }] },
  2: { degraded: 6, incidents: [{ title: "Elevated error rate on /v1/customers", minutes: 6 }] },
});
const dashboard = history(90, {
  58: { degraded: 14, incidents: [{ title: "Charts loading slowly", minutes: 14 }] },
  19: { degraded: 48, incidents: [{ title: "Search indexing behind by 20 minutes", minutes: 48 }] },
});
const webhooks = history(41, {
  27: { downtime: 12, incidents: [{ title: "Deliveries paused during migration", minutes: 12 }] },
  0: { degraded: 18, incidents: [{ title: "Retries delayed for eu-west endpoints", minutes: 18 }] },
});

export default function Demo() {
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-7 rounded-xl border border-line bg-raised p-5 shadow-[var(--shadow)]">
      <UptimeBars label="API" days={api} />
      <UptimeBars label="Dashboard" days={dashboard} />
      <UptimeBars label="Webhooks" days={webhooks} />
    </div>
  );
}
