"use client";
import { useRef } from "react";
import { ReadingProgress, ReadingProgressRing } from "@/components/ui/reading-progress";

const sections = [
  {
    heading: null,
    paragraphs: [
      "Most interfaces feel slow long before they are slow. The request takes 180 milliseconds, but nothing on screen changes for the first 150 of them, so the press feels ignored. People don’t measure latency; they measure the gap between their hand and the screen answering it.",
      "The fix is rarely a faster server. It is putting something on screen in the first fifty milliseconds: the button darkens, the row moves, the count ticks up. The result can arrive later. The acknowledgement cannot.",
      "The same is true of hover and focus. A row that lights up under the pointer, a ring that appears the moment a key moves focus: these cost nothing to render and they tell people the interface is paying attention before anything has been asked of it.",
    ],
  },
  {
    heading: "Spinners are a promise",
    paragraphs: [
      "A spinner says “this will take a while”. Shown for 80 milliseconds, it reads as a glitch, and it makes a fast action feel slower than it was. Wait 150 milliseconds before showing one. Once it’s up, keep it for at least 300 so it never flickers.",
      "For content, a spinner is almost always the wrong shape. A skeleton that matches the final layout tells people what is coming and where. When the data lands, nothing moves; it fills in.",
    ],
  },
  {
    heading: "Optimism, with a way back",
    paragraphs: [
      "Toggles, renames, reorders and likes rarely fail. Apply them on the same frame, send the request, and reconcile. If it fails, put the old value back and say what happened next to the thing that changed, not in a toast in the corner.",
      "The revert matters as much as the optimism. If a rename fails, the old name comes back where the new one was, with a short line under it saying why, and the field stays open so the person can try again without retyping.",
      "Keep this for actions people can see undone. Payments and deletes without an undo deserve an honest wait, with the busy state on the control they pressed, at the same width, so nothing around it jumps.",
    ],
  },
  {
    heading: "Where the answer goes",
    paragraphs: [
      "Feedback belongs where the eye already is. A save confirmed in a toast at the far corner of the screen asks people to look away from their work to learn that it worked. The button they pressed can say Saved for a second and a half instead, and nobody has to move their eyes.",
      "Errors follow the same rule. A field that failed validation says so underneath itself, in words, with the fix. A request that failed says so beside the control that sent it, with a way to try again that keeps everything they typed.",
    ],
  },
  {
    heading: "Motion is not a loading state",
    paragraphs: [
      "An entrance animation can make a fast response feel slower. A panel that takes 400 milliseconds to slide in after the data has already arrived is latency you added on purpose. Keep motion short where people meet it often, and let it overlap the wait rather than follow it.",
      "When something really does take time, show progress that moves with the work, not a loop that moves regardless. A bar that fills as files upload is honest; a shimmer that runs forever is decoration.",
    ],
  },
  {
    heading: "What to measure",
    paragraphs: [
      "Interaction to next paint is the number that matches the feeling. Test it on a throttled mid-range phone, not the laptop you built it on. If the first frame after a tap takes 200 milliseconds, no animation will hide it.",
      "Measure the slow path too. Cold caches, a second tab competing for the main thread, a request that retries once: these are the cases people remember, because they are the ones where the interface went quiet and they didn’t know whether to wait or press again.",
      "Then watch someone use it. The moments they press twice, or reach for the same button again, are the places the interface forgot to answer.",
    ],
  },
];

// An essay in a scroll region: a hairline under the header fills as you read,
// and the ring counts the minutes down, then closes with a tick.
export default function Demo() {
  const article = useRef<HTMLElement>(null);

  return (
    <div className="h-[420px] w-full max-w-[460px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <div
        tabIndex={0}
        aria-label="Why interfaces feel slow"
        className="h-full overflow-y-auto overscroll-contain outline-none [scroll-padding-top:48px] focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3"
      >
        <header className="sticky top-0 z-(--z-sticky) flex h-12 items-center gap-3 border-b border-line bg-[color-mix(in_oklab,var(--frame)_85%,transparent)] px-5 backdrop-blur-md">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Why interfaces feel slow</p>
          <ReadingProgressRing target={article} />
          <ReadingProgress target={article} className="absolute inset-x-0 -bottom-px" />
        </header>

        <article ref={article} className="px-5 pb-10 pt-5">
          <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Field notes · Sep 2026</p>
          <h1 className="mt-2 text-[20px] font-medium leading-[1.15] tracking-[-0.02em] text-fg text-balance">Why interfaces feel slow</h1>
          {sections.map((s, i) => (
            <section key={i} className="mt-4">
              {s.heading && <h2 className="mb-2 mt-6 text-[13.5px] font-medium tracking-[-0.01em] text-fg">{s.heading}</h2>}
              {s.paragraphs.map((p) => (
                <p key={p.slice(0, 24)} className="mt-3 text-[13px] leading-[1.65] text-fg-2 text-pretty first:mt-0">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>

        <footer className="border-t border-line px-5 py-4 text-[12px] text-fg-3">Filed under performance · 3 replies</footer>
      </div>
    </div>
  );
}
