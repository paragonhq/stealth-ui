"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { UploadList, formatBytes, useUploads, type Uploader } from "@/components/ui/upload-list";

// A file that reports a size without holding the bytes, so the demo never allocates 40 MB.
class SampleFile extends File {
  #size: number;
  constructor(name: string, size: number, type: string) {
    super([], name, { type });
    this.#size = size;
  }
  get size() {
    return this.#size;
  }
}

const samples = () => [
  new SampleFile("q3-forecast.xlsx", 4.8 * 1024 ** 2, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  new SampleFile("brand-guidelines-2026.pdf", 18.4 * 1024 ** 2, "application/pdf"),
  new SampleFile("onboarding-walkthrough.mov", 42 * 1024 ** 2, "video/quicktime"),
  new SampleFile("team-offsite-photos.zip", 12 * 1024 ** 2, "application/zip"),
];

// Pretend network: a few MB/s with some wobble. The video drops its connection on the
// first try; archives spend a moment "processing" after the last byte.
const attempts = new Map<string, number>();
const simulate: Uploader = (file, { signal, onProgress, onProcessing }) =>
  new Promise((resolve, reject) => {
    const attempt = attempts.get(file.name) ?? 0;
    attempts.set(file.name, attempt + 1);
    const rate = (file.name.endsWith(".mov") ? 5.2 : file.name.endsWith(".pdf") ? 2.6 : 2.2) * 1024 ** 2;
    let loaded = 0;
    let tick = 0;
    const timer = window.setInterval(() => {
      tick++;
      loaded += rate * 0.12 * (0.7 + 0.6 * Math.abs(Math.sin(tick * 0.6 + file.size)));
      if (file.name.endsWith(".mov") && attempt === 0 && loaded > file.size * 0.38) {
        window.clearInterval(timer);
        reject(new Error(`Connection lost at ${formatBytes(loaded)}. Retry to start again.`));
      } else if (loaded >= file.size) {
        window.clearInterval(timer);
        onProgress(file.size);
        if (file.name.endsWith(".zip")) {
          onProcessing();
          window.setTimeout(resolve, 1600);
        } else resolve(undefined);
      } else onProgress(loaded);
    }, 120);
    signal.addEventListener("abort", () => {
      window.clearInterval(timer);
      reject(new DOMException("Upload canceled", "AbortError"));
    });
  });

export default function Demo() {
  const { add, ...list } = useUploads({ upload: simulate, concurrency: 2 });
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  // Start the sample batch the first time the demo scrolls into view.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      attempts.clear();
      setStarted(true);
      add(samples());
    });
    io.observe(el);
    return () => io.disconnect();
  }, [add]);

  return (
    <div ref={root} className="flex w-full max-w-[460px] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-[13px] font-medium tracking-[-0.01em] text-fg">Brand assets</h3>
          <p className="truncate text-[12px] text-fg-3">Shared with Design and Marketing</p>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)]",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97]",
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 10.25v-7.5M4.75 6 8 2.75 11.25 6M3 13.25h10" />
          </svg>
          Add files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            add(Array.from(e.currentTarget.files ?? []));
            e.currentTarget.value = "";
          }}
        />
      </div>

      <UploadList
        {...list}
        empty={
          started && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <p className="text-[13px] text-fg-2">No uploads in progress</p>
              <button
                type="button"
                onClick={() => {
                  attempts.clear();
                  add(samples());
                }}
                className={cn(
                  "inline-flex h-7 items-center rounded-md px-2 text-[12px] font-medium text-fg underline decoration-fg-4 underline-offset-[3px]",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "transition-[text-decoration-color,scale] duration-150 hover:decoration-fg-2 active:scale-[0.97]",
                )}
              >
                Upload the sample files again
              </button>
            </div>
          )
        }
      />
    </div>
  );
}
