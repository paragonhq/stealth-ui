"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Download, Heart, Trash, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { Lightbox } from "@/components/ui/lightbox";
import {
  GalleryGrid,
  GalleryGridAction,
  type GalleryItem,
} from "@/components/ui/gallery-grid";

const u = (id: string, q: string) =>
  `https://images.unsplash.com/photo-${id}?${q}`;
const photo = (
  id: string,
  width: number,
  height: number,
  color: string,
  alt: string,
  title: string,
  meta: string,
): GalleryItem => ({
  id,
  src: u(id, "w=640&q=70"),
  placeholder: u(id, "w=24&q=40"),
  color,
  width,
  height,
  alt,
  title,
  meta,
});

const library = [
  photo(
    "1433086966358-54859d0ed716",
    4000,
    6000,
    "#5e6d42",
    "A tall waterfall falling past a stone footbridge in green forest",
    "Multnomah Falls",
    "Oregon · 14 Jun",
  ),
  photo(
    "1501785888041-af3ef285b470",
    5979,
    3986,
    "#789e9a",
    "A rowing boat on a turquoise lake below steep peaks",
    "Lago di Braies",
    "Italy · 2 Jul",
  ),
  photo(
    "1519681393784-d120267933ba",
    4096,
    2733,
    "#3f4b69",
    "The Milky Way over snowy mountains",
    "Night sky",
    "Italy · 3 Jul",
  ),
  photo(
    "1518780664697-55e3ad937233",
    5105,
    6381,
    "#a1978c",
    "A small red cabin on a green hillside",
    "Red cabin",
    "Iceland · 21 Aug",
  ),
  photo(
    "1470071459604-3b5ec3a7fe05",
    7372,
    4392,
    "#6f766e",
    "Morning light over a green valley",
    "Quiraing",
    "Skye · 9 Sep",
  ),
  photo(
    "1500530855697-b586d89ba3ee",
    3648,
    5472,
    "#736260",
    "A road running between red rock walls",
    "Valley road",
    "Utah · 30 Sep",
  ),
  photo(
    "1507525428034-b723cf961d3e",
    4621,
    3072,
    "#bdbab6",
    "Waves on a pale beach at sunset",
    "Low tide",
    "Algarve · 12 Oct",
  ),
  photo(
    "1465146344425-f00d5f5c8f07",
    4928,
    3264,
    "#dfd2b7",
    "Red poppies in long grass",
    "Poppies",
    "Tuscany · 18 May",
  ),
  photo(
    "1418065460487-3e41a6c84dc5",
    2200,
    1467,
    "#909692",
    "Pine trees fading into fog",
    "Fog line",
    "Oregon · 15 Jun",
  ),
];

// A photo library: favorite from the overlay, long-press or tick to select, then act on the selection.
export default function Demo() {
  const [items, setItems] = useState(library);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([
    "1519681393784-d120267933ba",
  ]);
  const [viewing, setViewing] = useState(0);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const selecting = selectMode || selected.length > 0;
  const exit = () => {
    setSelected([]);
    setSelectMode(false);
  };

  return (
    <div
      ref={setStage}
      className="relative flex w-full max-w-[540px] flex-col gap-3 overflow-hidden rounded-2xl"
    >
      <div className="relative h-8">
        <AnimatePresence initial={false} mode="popLayout">
          {selecting ? (
            <motion.div
              key="bar"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.18, ease: ease.out }}
              className="absolute inset-0 flex items-center gap-2"
            >
              <Ghost label="Cancel selection" onClick={exit}>
                <X size={14} />
              </Ghost>
              <p
                className="flex-1 text-[13px] font-medium text-fg tabular"
                aria-live="polite"
              >
                {selected.length ? (
                  <>
                    <NumberFlow value={selected.length} /> selected
                  </>
                ) : (
                  <span className="font-normal text-fg-3">Select photos</span>
                )}
              </p>
              <Ghost label="Download" disabled={!selected.length}>
                <Download size={14} />
              </Ghost>
              <Ghost
                label="Delete"
                disabled={!selected.length}
                onClick={() => {
                  setItems((all) =>
                    all.filter((i) => !selected.includes(i.id)),
                  );
                  exit();
                }}
                className="hover:text-danger"
              >
                <Trash size={14} />
              </Ghost>
            </motion.div>
          ) : (
            <motion.div
              key="title"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.18, ease: ease.out }}
              className="absolute inset-0 flex items-center justify-between gap-3"
            >
              <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">
                Summer 2026{" "}
                <span className="font-normal text-fg-3">
                  · {items.length} photos
                </span>
              </p>
              <div className="flex items-center gap-1">
                {items.length < library.length && (
                  <button
                    type="button"
                    onClick={() => setItems(library)}
                    className={textButton}
                  >
                    Restore
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  className={textButton}
                >
                  Select
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Lightbox
        images={items.map((i) => ({
          src: u(i.id, "w=1600&q=75"),
          thumb: i.src,
          alt: i.alt,
          width: i.width,
          height: i.height,
          caption: `${i.title} · ${i.meta}`,
        }))}
        open={open}
        onOpenChange={setOpen}
        index={viewing}
        onIndexChange={setViewing}
        getThumbnail={(i) =>
          stage?.querySelector<HTMLElement>(
            `[data-gallery-image="${items[i]?.id}"]`,
          ) ?? null
        }
        container={stage}
      >
        <div className="h-[440px] overflow-y-auto overscroll-contain rounded-xl">
          <GalleryGrid
            onOpen={(_, index) => {
              setViewing(index);
              setOpen(true);
            }}
            items={items}
            selected={selected}
            onSelectedChange={setSelected}
            selectionMode={selectMode || undefined}
            onSelectionModeChange={setSelectMode}
            actions={(item) => {
              const on = favorites.includes(item.id);
              return (
                <GalleryGridAction
                  label={on ? "Remove from favorites" : "Add to favorites"}
                  active={on}
                  onClick={() =>
                    setFavorites((f) =>
                      on ? f.filter((x) => x !== item.id) : [...f, item.id],
                    )
                  }
                >
                  <motion.span
                    key={String(on)}
                    initial={reduce || !on ? false : { scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={spring.bouncy}
                    className="grid place-items-center"
                  >
                    <Heart
                      size={14}
                      className={on ? "fill-current text-danger" : undefined}
                    />
                  </motion.span>
                </GalleryGridAction>
              );
            }}
            empty={
              <div className="flex flex-col items-center gap-2">
                <p className="text-[13px] text-fg-2">No photos in this album</p>
                <button
                  type="button"
                  onClick={() => setItems(library)}
                  className={textButton}
                >
                  Restore photos
                </button>
              </div>
            }
          />
        </div>
      </Lightbox>
    </div>
  );
}

const textButton = cn(
  "h-7 rounded-md px-2 text-[12.5px] font-medium text-fg-2 outline-none",
  "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97]",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
);

function Ghost({
  label,
  className,
  children,
  ...rest
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-fg-2 outline-none",
        "transition-[background-color,color,scale,opacity] duration-150 enabled:hover:bg-hover enabled:hover:text-fg enabled:active:scale-[0.94] disabled:opacity-40",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
