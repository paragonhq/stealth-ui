"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { GenerationPreview, type GenerationVariant } from "@/components/ui/generation-preview";

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=480&h=480&fit=crop&q=70&auto=format`;
const SOURCES = [
  { src: img("1506744038136-46273834b3fb"), alt: "Lake below granite peaks in low sun", speed: 1 },
  { src: img("1470071459604-3b5ec3a7fe05"), alt: "Mist settling over forested ridges", speed: 0.82 },
  { src: img("1464822759023-fed622ff2c3b"), alt: "Snow ridge under a pale sky", speed: 1.12, failAt: 0.56 },
  { src: img("1519681393784-d120267933ba"), alt: "Mountains under a clear night sky", speed: 0.92 },
];

const fresh = (): GenerationVariant[] => SOURCES.map((_, i) => ({ id: `v${i + 1}`, status: i < 2 ? "generating" : "queued", progress: 0 }));

// Four variants resolving at their own pace, as a real queue would. The third
// fails the first time so its retry can be tried; later runs go through.
export default function Demo() {
  const root = useRef<HTMLDivElement>(null);
  const [variants, setVariants] = useState<GenerationVariant[]>(fresh);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const runs = useRef(0);

  const start = () => {
    runs.current++;
    setSelected(null);
    setVariants(fresh());
    setRunning(true);
  };

  // Runs only while on screen; the first sighting starts the first run.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting && runs.current === 0) {
        runs.current = 1;
        setRunning(true);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running || !visible) return;
    const t = window.setInterval(() => {
      setVariants((vs) => {
        if (!vs.some((v) => v.status === "queued" || v.status === "generating")) return vs;
        // Two render at once; the rest wait their turn.
        let slots = 2 - vs.filter((v) => v.status === "generating").length;
        return vs.map((v, i): GenerationVariant => {
          const s = SOURCES[i];
          if (v.status === "queued") return slots-- > 0 ? { ...v, status: "generating" } : v;
          if (v.status !== "generating") return v;
          const p = Math.min(1, (v.progress ?? 0) + (0.035 + Math.random() * 0.04) * s.speed);
          if (s.failAt && runs.current === 1 && p >= s.failAt) return { ...v, status: "failed", error: "The model timed out on this one" };
          if (p >= 1) return { ...v, status: "done", progress: 1, src: s.src, alt: s.alt };
          // Previews start arriving after the first few steps.
          return { ...v, progress: p, src: p >= 0.12 ? s.src : undefined };
        });
      });
    }, 320);
    return () => window.clearInterval(t);
  }, [running, visible]);

  return (
    <div ref={root} className="flex w-full max-w-[400px] flex-col gap-3">
      <GenerationPreview
        prompt="Alpine lake at dusk, mist in the pines, soft side light, 35mm film"
        details="1024 × 1024"
        variants={variants}
        value={selected}
        onValueChange={setSelected}
        onCancel={() => {
          setRunning(false);
          setVariants((vs) => vs.map((v) => (v.status === "queued" || v.status === "generating" ? { ...v, status: "canceled" } : v)));
        }}
        onRetry={(id) => {
          setVariants((vs) => vs.map((v) => (v.id === id ? { id: v.id, status: "generating", progress: 0 } : v)));
          runs.current++;
          setRunning(true);
        }}
        onRegenerate={start}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-fg-3">{selected ? `Variant ${selected.slice(1)} selected` : "Pick a variant when they finish"}</p>
        <button
          type="button"
          disabled={!selected}
          className={cn(
            "h-8 shrink-0 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,opacity,scale] duration-150",
            "hover:bg-fg/90 active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:opacity-40",
          )}
        >
          Use image
        </button>
      </div>
    </div>
  );
}
