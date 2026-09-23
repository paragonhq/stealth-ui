"use client";
import { useEffect, useState } from "react";
import { ProfileCard } from "@/components/ui/profile-card";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=160&h=160&fit=crop&crop=faces&q=70`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A teammate's full card beside a "suggested" list of compact rows. One follow request in the
// list fails, so you can watch the button and count roll back with the reason under the row.
export default function Demo() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), 2600);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex w-full max-w-[560px] flex-wrap items-start justify-center gap-4">
      <div className="w-[272px] max-w-full">
        <ProfileCard
          name="Leo Brandt"
          handle="leo"
          role="Payments engineer"
          href="#leo"
          avatarSrc={photo("1507003211169-0a1dd7228f2d")}
          presence="away"
          statusText="In a design review until 15:00"
          bio="Owns checkout and the promo service. Ask me about idempotency keys and why retries are harder than they look."
          location="Berlin"
          timeZone="Europe/Berlin"
          followers={1284}
          stats={[
            { label: "Following", value: 211 },
            { label: "Reviews", value: 36 },
          ]}
          onFollowingChange={() => wait(500)}
          onMessage={() => {}}
        />
      </div>

      <section aria-labelledby="suggested" className="flex w-[272px] max-w-full flex-col rounded-xl border border-line px-3.5 pt-3 pb-3.5">
        <h3 id="suggested" className="mb-3 font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase">
          Suggested for you
        </h3>
        <div className="flex flex-col gap-3.5">
          <ProfileCard
            variant="compact"
            name="Priya Raghunathan-Castellanos"
            role="Design systems"
            href="#priya"
            presence="online"
            onFollowingChange={() => wait(400)}
          />
          <ProfileCard
            variant="compact"
            name="Tomás Ibarra"
            role="Support lead"
            href="#tomas"
            avatarSrc={photo("1500648767791-00dcc994a43e")}
            presence="busy"
            onFollowingChange={() => wait(700).then(() => Promise.reject(new Error("offline")))}
          />
          <ProfileCard variant="compact" loading={!loaded} name="Aiko Mori" role="Data platform" href="#aiko" presence="offline" />
          <ProfileCard
            variant="compact"
            self
            name="Maya Okafor"
            role="You · Product"
            avatarSrc={photo("1494790108377-be9c29b29330")}
            presence="online"
            onEdit={() => {}}
          />
        </div>
      </section>
    </div>
  );
}
