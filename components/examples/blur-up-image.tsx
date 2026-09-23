"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { BlurUpImage } from "@/components/ui/blur-up-image";

const unsplash = (id: string, q: string) => `https://images.unsplash.com/photo-${id}?${q}`;

// Delays stand in for a slow connection so each strategy is visible. A real app passes src straight away.
const photos = [
  { id: "1470071459604-3b5ec3a7fe05", alt: "Morning light over a green valley, cloud pouring over the ridge", delay: 1100, strategy: "blur" as const },
  { id: "1501785888041-af3ef285b470", alt: "A wooden boat on a turquoise lake below steep peaks", delay: 1600, strategy: "color" as const, color: "#789e9a" },
  { id: "1506905925346-21bda4d32df4", alt: "Mountain tops above a sea of cloud at dusk", delay: 900, strategy: "fail" as const, color: "#6a6b7f" },
];

// A shared trip album, loading on a slow connection: a blurred preview, a dominant
// color, and one photo that fails and recovers on retry.
export default function Demo() {
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState<number[]>([]);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    const timers = photos.map((p, i) => window.setTimeout(() => setReady((r) => [...r, i]), p.delay));
    return () => timers.forEach(window.clearTimeout);
  }, [run]);

  const srcFor = (i: number) => {
    const p = photos[i];
    if (!ready.includes(i)) return undefined;
    // A broken JPEG fails to decode without a network error, standing in for a dropped request.
    if (p.strategy === "fail" && !recovered) return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ";
    return unsplash(p.id, `w=${i === 0 ? 960 : 480}&q=70&v=${run}`);
  };

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">Hiking trip, day 3</p>
          <p className="truncate text-[12px] text-fg-3">Shared by Maya Chen · 3 photos</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setReady([]);
            setRecovered(false);
            setRun((r) => r + 1);
          }}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-2",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
          )}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
          </svg>
          Replay load
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <figure className="col-span-2 flex flex-col gap-1.5">
          <BlurUpImage
            key={`a${run}`}
            src={srcFor(0)}
            alt={photos[0].alt}
            width={960}
            height={600}
            placeholder={unsplash(photos[0].id, "w=24&q=40")}
            priority
            className="rounded-xl"
          />
          <Caption>Blurred preview, 0.6 KB</Caption>
        </figure>
        <figure className="flex min-w-0 flex-col gap-1.5">
          <BlurUpImage key={`b${run}`} src={srcFor(1)} alt={photos[1].alt} aspectRatio={1} color={photos[1].color} className="rounded-xl" />
          <Caption>Dominant color</Caption>
        </figure>
        <figure className="flex min-w-0 flex-col gap-1.5">
          <BlurUpImage
            key={`c${run}`}
            src={srcFor(2)}
            alt={photos[2].alt}
            aspectRatio={1}
            placeholder={unsplash(photos[2].id, "w=24&q=40")}
            onRetry={() => setRecovered(true)}
            className="rounded-xl"
          />
          <Caption>{recovered ? "Recovered on retry" : "Request failed"}</Caption>
        </figure>
      </div>
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <figcaption className="truncate px-0.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{children}</figcaption>;
}
