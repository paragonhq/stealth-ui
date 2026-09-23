"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Paperclip, Send } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { AttachmentTray, type Attachment } from "@/components/ui/attachment-tray";

// Paint stand-in screenshots from the theme's own tokens, so the demo needs no network.
function paint(kind: "dashboard" | "sketch"): Promise<string | null> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (!g) return Promise.resolve(null);
  if (kind === "dashboard") {
    g.fillStyle = v("--raised");
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = v("--hover");
    g.fillRect(0, 0, 34, 128);
    g.fillStyle = v("--fg-4");
    [18, 30, 42, 54].forEach((y) => g.fillRect(8, y, 18, 4));
    g.fillStyle = v("--fg-3");
    [40, 62, 50, 84, 70, 96].forEach((h, i) => g.fillRect(44 + i * 13, 112 - h, 8, h));
    g.fillStyle = v("--fg");
    g.fillRect(44, 12, 40, 6);
  } else {
    g.fillStyle = v("--fg");
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = v("--frame");
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(18, 88);
    g.bezierCurveTo(40, 30, 70, 110, 108, 40);
    g.stroke();
    g.strokeRect(20, 20, 34, 24);
    g.beginPath();
    g.arc(92, 94, 14, 0, Math.PI * 2);
    g.stroke();
  }
  return new Promise((resolve) => c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null)));
}

// flaky: this one drops its connection once, so there is something to retry.
type Item = Attachment & { flaky?: boolean };

const seed: Item[] = [
  { id: "a1", name: "dashboard-v2.png", type: "image/png", size: 1_840_000, progress: 0.18 },
  { id: "a2", name: "q3-forecast.xlsx", type: "application/vnd.ms-excel", size: 2_400_000 },
  { id: "a3", name: "brand-guidelines-2026-final-revised.pdf", type: "application/pdf", size: 18_200_000, progress: 0.34, flaky: true },
  { id: "a4", name: "whiteboard.jpg", type: "image/jpeg", size: 920_000 },
];

export default function Demo() {
  const reduce = useReducedMotion();
  const [items, setItems] = useState(seed);
  const [text, setText] = useState("Here’s everything for Thursday’s review.");
  const [visible, setVisible] = useState(false);
  const urls = useRef(new Set<string>());
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    Promise.all([paint("dashboard"), paint("sketch")]).then(([a, b]) => {
      [a, b].forEach((u) => u && urls.current.add(u));
      if (live) setItems((list) => list.map((x) => (x.id === "a1" && a ? { ...x, preview: a } : x.id === "a4" && b ? { ...x, preview: b } : x)));
    });
    const all = urls.current;
    return () => {
      live = false;
      all.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  // Uploads only tick while the demo is on screen.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const uploading = items.some((a) => a.progress !== undefined && a.progress < 1 && a.status !== "error");
  useEffect(() => {
    if (!visible || !uploading) return;
    const t = window.setInterval(() => {
      setItems((list) =>
        list.map((a) => {
          if (a.progress === undefined || a.progress >= 1 || a.status === "error") return a;
          const next = Math.min(1, a.progress + 0.03 + Math.random() * 0.07);
          if (a.flaky && next > 0.62) return { ...a, flaky: false, progress: 0.62, status: "error", error: "Connection lost" };
          return { ...a, progress: next };
        }),
      );
    }, 180);
    return () => window.clearInterval(t);
  }, [visible, uploading]);

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const next = Array.from(files).map((f, i): Item => {
      const preview = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
      if (preview) urls.current.add(preview);
      return { id: `${Date.now()}-${i}-${f.name}`, name: f.name, size: f.size, type: f.type, preview, progress: 0 };
    });
    setItems((list) => [...list, ...next]);
  };

  const pending = items.filter((a) => a.status !== "error" && a.progress !== undefined && a.progress < 1).length;
  const failed = items.filter((a) => a.status === "error").length;

  return (
    <div ref={root} className="w-full max-w-[520px]">
      <div className="rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-2 focus-within:ring-fg/10">
        <AnimatePresence initial={false}>
          {items.length > 0 && (
            <motion.div
              key="tray"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: ease.inOut }}
              className="overflow-hidden"
            >
              <AttachmentTray
                items={items}
                className="px-1 pt-1"
                onRemove={(id) =>
                  setItems((list) => {
                    const gone = list.find((a) => a.id === id);
                    // Let the exit animation finish with the image before freeing it.
                    const url = gone?.preview;
                    if (url && !seed.some((s) => s.id === id)) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                    return list.filter((a) => a.id !== id);
                  })
                }
                onReorder={(next) => setItems(next as Item[])}
                onRetry={(id) => setItems((list) => list.map((a) => (a.id === id ? { ...a, status: undefined, error: undefined, progress: 0 } : a)))}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <label className="sr-only" htmlFor="attachment-tray-demo-message">
          Message
        </label>
        <textarea
          id="attachment-tray-demo-message"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message #design-review"
          className="block w-full resize-none bg-transparent px-3 pt-2 text-base leading-[1.45] text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
        />

        <div className="flex items-center gap-2 px-2 pb-2">
          <input ref={input} type="file" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
          <button
            type="button"
            aria-label="Attach files"
            onClick={() => input.current?.click()}
            className="grid size-8 place-items-center rounded-lg text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.06] hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92]"
          >
            <Paperclip />
          </button>
          <p className="min-w-0 flex-1 truncate text-[12px] text-fg-3" aria-live="polite">
            {failed ? `${failed} upload failed` : pending ? `Uploading ${pending} ${pending === 1 ? "file" : "files"}…` : items.length ? `${items.length} ${items.length === 1 ? "file" : "files"} ready` : ""}
          </p>
          <button
            type="button"
            disabled={pending > 0 || failed > 0 || (!text.trim() && !items.length)}
            onClick={() => {
              setItems([]);
              setText("");
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
