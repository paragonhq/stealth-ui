"use client";
import {
  HoverCard,
  HoverCardContent,
  HoverCardLink,
  HoverCardProfile,
  HoverCardTrigger,
  type HoverCardLinkPreview,
  type HoverCardPerson,
} from "@/components/ui/hover-card";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const people: Record<string, HoverCardPerson> = {
  maya: {
    name: "Maya Chen",
    handle: "maya",
    role: "Staff engineer · Platform",
    bio: "Owns the public API and the rate limiter. Ask about quotas, retries and anything that returns a 429.",
    timeZone: "America/Los_Angeles",
    status: "Available",
    available: true,
  },
  dev: {
    name: "Dev Patel",
    handle: "devp",
    role: "Engineer · Billing",
    bio: "Usage metering and invoices. Back from leave on Monday.",
    timeZone: "Europe/London",
    status: "In a meeting until 3:30 PM",
    available: false,
  },
  sam: {
    name: "Sam Okafor",
    handle: "sam",
    role: "Support lead",
    bio: "Triages API tickets and turns the repeat ones into docs.",
    timeZone: "Africa/Lagos",
    status: "Available",
    available: true,
  },
};

const guide: HoverCardLinkPreview = {
  url: "https://docs.northwind.co/api/rate-limits",
  siteName: "Northwind Docs",
  title: "Rate limits and retry headers",
  description:
    "How requests are counted per key, what the X-RateLimit headers mean, and how to back off after a 429.",
  meta: "Updated 3 days ago",
};

// Sam's first load fails, so the error and retry are there to try.
let samAttempts = 0;
const loadSam = async () => {
  await wait(700);
  if (samAttempts++ === 0) throw new Error("Network");
  return people.sam;
};

// A review comment with the three things people hover in one: an author, a mention, a link.
// Dev's profile is slow on purpose, so the skeleton shows.
export default function Demo() {
  return (
    <div className="flex min-h-[400px] w-full max-w-[440px] flex-col">
      <article className="w-full rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <header className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-frame text-[11px] font-medium text-fg-2"
          >
            MC
          </span>
          <p className="min-w-0 flex-1 truncate text-[12.5px] text-fg-3">
            <HoverCard load={() => wait(250).then(() => people.maya)}>
              <HoverCardTrigger
                href="#maya"
                onClick={(e) => e.preventDefault()}
                className="font-medium"
              >
                Maya Chen
              </HoverCardTrigger>
              <HoverCardContent>
                <HoverCardProfile />
              </HoverCardContent>
            </HoverCard>{" "}
            commented on{" "}
            <span className="font-mono text-[12px] text-fg-2">#482</span>
          </p>
          <time className="shrink-0 text-[12px] text-fg-4">2h</time>
        </header>

        <p className="mt-3 text-[13px] leading-[21px] text-fg-2 text-pretty">
          <HoverCard load={() => wait(1600).then(() => people.dev)}>
            <HoverCardTrigger
              variant="mention"
              href="#dev"
              onClick={(e) => e.preventDefault()}
            >
              @Dev Patel
            </HoverCardTrigger>
            <HoverCardContent>
              <HoverCardProfile />
            </HoverCardContent>
          </HoverCard>{" "}
          this changes how retries are counted. Can you check it against the{" "}
          <HoverCard load={() => wait(600).then(() => guide)}>
            <HoverCardTrigger
              href={guide.url}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.preventDefault()}
            >
              rate limits guide
            </HoverCardTrigger>
            <HoverCardContent size="lg">
              <HoverCardLink />
            </HoverCardContent>
          </HoverCard>{" "}
          before Friday? cc{" "}
          <HoverCard load={loadSam}>
            <HoverCardTrigger
              variant="mention"
              href="#sam"
              onClick={(e) => e.preventDefault()}
            >
              @Sam Okafor
            </HoverCardTrigger>
            <HoverCardContent>
              <HoverCardProfile />
            </HoverCardContent>
          </HoverCard>
        </p>
      </article>
    </div>
  );
}
