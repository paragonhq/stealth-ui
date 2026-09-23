"use client";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AvatarUpload, type AvatarUploader } from "@/components/ui/avatar-upload";

// Pretend storage: about 1.8s of uneven progress, or a dropped connection when asked for.
function fakeUpload(willFail: boolean): AvatarUploader {
  return (_blob, { signal, onProgress }) =>
    new Promise((resolve, reject) => {
      let p = 0;
      const timer = window.setInterval(() => {
        p += 0.05 + 0.08 * Math.abs(Math.sin(p * 9));
        if (willFail && p > 0.55) {
          window.clearInterval(timer);
          reject(new Error("Network error"));
        } else if (p >= 1) {
          window.clearInterval(timer);
          onProgress(1);
          resolve();
        } else onProgress(p);
      }, 110);
      signal.addEventListener("abort", () => {
        window.clearInterval(timer);
        reject(new DOMException("Canceled", "AbortError"));
      });
    });
}

// Account settings: the photo row, with the crop dialog kept inside the preview.
export default function Demo() {
  const region = useRef<HTMLDivElement>(null);
  const [failNext, setFailNext] = useState(false);

  const upload = useCallback<AvatarUploader>(
    (blob, ctx) => {
      if (failNext) setFailNext(false);
      return fakeUpload(failNext)(blob, ctx);
    },
    [failNext],
  );

  return (
    <div ref={region} className="relative isolate flex min-h-[460px] w-full max-w-[460px] flex-col justify-center gap-4 rounded-2xl">
      <div className="flex flex-col gap-5 rounded-xl border border-line-2 bg-raised p-5 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Account</h3>
          <p className="text-[12.5px] text-fg-3">Your photo shows on comments, mentions and the members list.</p>
        </div>
        <AvatarUpload name="Dana Whitfield" size="lg" upload={upload} container={region} />
      </div>

      <label className="flex cursor-pointer items-center gap-2 self-center text-[12px] text-fg-3 select-none">
        <span className="relative grid size-3.5 place-items-center">
          <input
            type="checkbox"
            checked={failNext}
            onChange={(e) => setFailNext(e.currentTarget.checked)}
            className={cn(
              "peer col-start-1 row-start-1 size-3.5 appearance-none rounded-[4px] border border-line-2 bg-raised transition-colors duration-150",
              "checked:border-fg checked:bg-fg",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            )}
          />
          <svg
            aria-hidden
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none col-start-1 row-start-1 text-frame opacity-0 peer-checked:opacity-100"
          >
            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
        </span>
        Drop the connection on the next upload
      </label>
    </div>
  );
}
