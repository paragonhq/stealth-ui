"use client";
import { Spoiler, SpoilerBlock } from "@/components/ui/spoiler";

function Message({ initials, name, time, children }: { initials: string; name: string; time: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-frame text-[11px] font-medium text-fg-2">
        {initials}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium tracking-[-0.005em] text-fg">{name}</span>
          <time className="text-[11.5px] text-fg-4 tabular">{time}</time>
        </p>
        {children}
      </div>
    </li>
  );
}

// A watch-party channel: one message hides the twist in a sentence, the next hides a
// frame from the finale. Press either; press the text again, or the corner button, to cover it back up.
export default function Demo() {
  return (
    <section aria-label="#watch-party" className="w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <header className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-[13px] font-medium text-fg">
        <span className="text-fg-4">#</span>watch-party
      </header>
      <ul className="flex flex-col gap-5 px-4 py-4">
        <Message initials="PS" name="Priya Shah" time="9:41 PM">
          <p className="text-[13px] leading-[21px] text-fg-2 text-pretty">
            Finished episode 8 last night.{" "}
            <Spoiler label="Spoiler about episode 8">
              Mara was the one leaking the files <em>the whole time</em>
            </Spoiler>
            , which makes the lighthouse scene in episode 3 land completely differently.
          </p>
        </Message>
        <Message initials="LP" name="Leo Park" time="9:44 PM">
          <p className="text-[13px] leading-[21px] text-fg-2">Still on 6, thanks for covering it. The frame everyone’s posting:</p>
          <SpoilerBlock description="Episode 8, final scene" className="mt-1 w-full max-w-[320px] border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- a demo image, not a page asset */}
            <img
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=720&q=70"
              alt="Mountain peaks rising above a sea of cloud at dusk"
              width={720}
              height={405}
              className="block aspect-video w-full object-cover"
            />
          </SpoilerBlock>
        </Message>
      </ul>
    </section>
  );
}
