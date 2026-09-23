"use client";
import { useState } from "react";
import { Lightbox, LightboxTrigger, type LightboxImage } from "@/components/ui/lightbox";

const u = (id: string, w: number) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75`;
const thumb = (id: string) => `https://images.unsplash.com/photo-${id}?w=480&q=70`;

const photo = (id: string, width: number, height: number, alt: string, caption: string): LightboxImage => ({
  src: u(id, 2000),
  thumb: thumb(id),
  width,
  height,
  alt,
  caption,
});

const photos = [
  photo("1600596542815-ffad4c1539a9", 4712, 3126, "White two-storey house with a long pool in front", "Front elevation and pool, late afternoon"),
  photo("1600585154340-be6161a56a0c", 4500, 3000, "Timber-clad house lit from inside at dusk, under a large tree", "Rear garden at dusk"),
  photo("1564013799919-ab600027ffc6", 6720, 4480, "Colonial-style house with palms beside a pool", "Guest house and terrace"),
  photo("1502672260266-1c1ef2d93688", 3000, 2232, "Bright living room with a gray sofa, plants and shelving", "Living room, south-facing"),
  photo("1522708323590-d24dbb6b0267", 5274, 3517, "Open-plan kitchen and dining area with red chairs", "Kitchen and dining"),
  photo("1518780664697-55e3ad937233", 5105, 6381, "A small red cabin on a green hillside", "Studio cabin at the top of the plot"),
];

// A property listing's photos. The viewer opens inside the stage so it never covers the docs page.
export default function Demo() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setStage} className="relative flex h-[480px] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-2xl">
      <div className="flex w-full max-w-[400px] flex-col gap-3 px-1">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">14 Harbour Lane</p>
            <p className="truncate text-[12px] text-fg-3">4 bed · 3 bath · 2,480 sq ft</p>
          </div>
          <p className="shrink-0 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{photos.length} photos</p>
        </div>
        <Lightbox images={photos} container={stage}>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p, i) => (
              <LightboxTrigger key={p.src} index={i} className={i === 0 ? "col-span-2 row-span-2" : "aspect-square"} />
            ))}
          </div>
        </Lightbox>
      </div>
    </div>
  );
}
