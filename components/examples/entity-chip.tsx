"use client";
import { Clock, Globe, Star, User } from "@/lib/icons";
import { EntityChip } from "@/components/ui/entity-chip";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=96&h=96&fit=crop&crop=faces&q=70`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// An issue comment: mentions of a person, an issue and a repository inline, then the chips
// standing alone in the sidebar fields, including yourself and someone who has left.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <article className="rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
        <header className="mb-2 flex items-center gap-2 text-[12.5px]">
          <span className="font-medium text-fg">Maya Okafor</span>
          <span className="text-fg-4">·</span>
          <time className="text-fg-3">2h ago</time>
        </header>
        <p className="text-[13px] leading-[1.6] text-pretty text-fg-2">
          Reproduced on Safari 17. It’s the same race as{" "}
          <EntityChip
            kind="issue"
            href="#ENG-482"
            reference="ENG-482"
            status="active"
            name="Checkout fails when a promo code is applied twice"
            details={{
              subtitle: "Payments · Due Friday",
              description: "Applying a code while the total is recalculating sends two requests; the second one voids the first discount.",
              meta: [
                { icon: <User />, label: "Leo Brandt" },
                { icon: <Clock />, label: "Updated 25m ago" },
              ],
            }}
          />{" "}
          so{" "}
          <EntityChip
            name="Leo Brandt"
            href="#leo"
            avatarSrc={photo("1507003211169-0a1dd7228f2d")}
            load={async () => {
              await wait(1200);
              return {
                subtitle: "@leo · Payments engineer",
                description: "Owns checkout and the promo service. Usually replies within the hour.",
                meta: [
                  { icon: <Globe />, label: "Berlin" },
                  { icon: <Clock />, label: "16:42 local" },
                ],
              };
            }}
          />{" "}
          can take it. The fix belongs in{" "}
          <EntityChip
            kind="repo"
            href="#checkout-web"
            name="acme/checkout-web"
            details={{
              description: "The storefront checkout: cart, promo codes, payment and receipts.",
              meta: [
                { label: "TypeScript" },
                { icon: <Star />, label: "1,284" },
                { icon: <Clock />, label: "Pushed 3h ago" },
              ],
            }}
          />
          .
        </p>
      </article>

      <dl className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 rounded-xl border border-line px-4 py-3 text-[12.5px]">
        <dt className="leading-6 text-fg-3">Reviewers</dt>
        <dd className="flex flex-wrap gap-1.5">
          <EntityChip size="md" self name="You" href="#me" avatarSrc={photo("1494790108377-be9c29b29330")} />
          <EntityChip
            size="md"
            name="Priya Raghunathan-Castellanos"
            href="#priya"
            details={{ subtitle: "@priya · Design systems", meta: [{ icon: <Globe />, label: "Lisbon" }] }}
          />
        </dd>
        <dt className="leading-6 text-fg-3">Reported by</dt>
        <dd>
          <EntityChip size="md" name="Deleted user" unavailable />
        </dd>
        <dt className="leading-6 text-fg-3">Duplicate of</dt>
        <dd>
          <EntityChip size="md" kind="issue" status="closed" reference="ENG-311" href="#ENG-311" name="Promo code applied twice on slow networks" />
        </dd>
      </dl>
    </div>
  );
}
