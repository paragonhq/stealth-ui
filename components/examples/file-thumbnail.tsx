"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { FileThumbnail, type FileStatus } from "@/components/ui/file-thumbnail";

type Item = { id: string; name: string; size: number; status: FileStatus; progress?: number; error?: string; preview?: string; failAt?: number; fresh?: boolean };

const PHOTO = "https://images.unsplash.com/photo-1497366216548-37526070297c?w=480&q=70&auto=format";

const QUEUE: Omit<Item, "id" | "status">[] = [
  { name: "brand-guidelines-2026.pdf", size: 8_400_000 },
  { name: "migrate_users_backfill.sql", size: 31_000_000, failAt: 0.42 },
  { name: "Onboarding interviews — synthesis.docx", size: 612_000 },
];

const START: Item[] = [
  { id: "a", name: "office-3rd-floor.jpg", size: 2_100_000, status: "idle", preview: PHOTO },
  { id: "b", name: "q3-forecast-final-reviewed-by-finance.xlsx", size: 2_400_000, status: "idle" },
  { id: "c", name: "checkout-flow.tsx", size: 18_400, status: "idle" },
];

// Attachments on a message: add a file to watch it upload, fail, retry and settle.
export default function Demo() {
  const [items, setItems] = useState<Item[]>(START);
  const next = useRef(0);

  // Advance every upload a little at a time, like a real network would.
  const uploading = items.some((i) => i.status === "uploading");
  useEffect(() => {
    if (!uploading) return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      setItems((list) =>
        list.map((i) => {
          if (i.status !== "uploading") return i;
          const p = Math.min(1, (i.progress ?? 0) + 0.06 + Math.random() * 0.12);
          if (i.failAt !== undefined && p >= i.failAt) return { ...i, status: "error", progress: undefined, error: "Over the 25 MB limit" };
          return p >= 1 ? { ...i, status: "idle", progress: undefined } : { ...i, progress: p };
        }),
      );
    }, 420);
    return () => window.clearInterval(t);
  }, [uploading]);

  const add = () => {
    const f = QUEUE[next.current % QUEUE.length];
    next.current++;
    setItems((list) => [...list, { ...f, id: `${Date.now()}`, status: "uploading" as const, progress: 0, fresh: true }].slice(-5));
  };

  const remove = (id: string) => setItems((list) => list.filter((i) => i.id !== id));
  const retry = (id: string) => setItems((list) => list.map((i) => (i.id === id ? { ...i, status: "uploading", progress: 0, failAt: undefined, error: undefined } : i)));

  const tile = items[0]?.preview ? items[0] : null;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="grid grid-cols-[132px_1fr] items-start gap-3 max-sm:grid-cols-1">
        {tile && (
          <FileThumbnail layout="tile" name={tile.name} size={tile.size} previewUrl={tile.preview} href={tile.preview} onRemove={() => remove(tile.id)} className="max-sm:max-w-[160px]" />
        )}
        <ul className="flex min-w-0 flex-col gap-2" aria-label="Attachments">
          <AnimatePresence initial={false} mode="popLayout">
            {items
              .filter((i) => i !== tile)
              .map((i) => (
                <motion.li key={i.id} layout="position" transition={{ type: "spring", stiffness: 420, damping: 36 }} className="min-w-0">
                  <FileThumbnail
                    name={i.name}
                    size={i.size}
                    status={i.status}
                    progress={i.progress}
                    error={i.error}
                    appear={i.fresh}
                    onOpen={i.status === "idle" ? () => {} : undefined}
                    onRemove={() => remove(i.id)}
                    onRetry={() => retry(i.id)}
                  />
                </motion.li>
              ))}
          </AnimatePresence>
        </ul>
      </div>
      <button
        type="button"
        onClick={add}
        className="flex h-8 items-center gap-2 self-start rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m12.75 7.5-4.9 4.9a3 3 0 0 1-4.25-4.25l5.3-5.3a2 2 0 0 1 2.85 2.85l-5.3 5.3a1 1 0 0 1-1.4-1.4L9.9 4.75" />
        </svg>
        Attach a file
      </button>
    </div>
  );
}
