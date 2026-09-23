"use client";
import { useState } from "react";
import { Check, File, Upload } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { ToastProvider, Toaster, usePromiseToast } from "@/components/ui/promise-toast";

const SIZE_MB = 6.1;
const mb = (n: number) => n.toFixed(1);

// A fake upload: uneven chunks over about three seconds, abortable, and able to fail at 70%.
function fakeUpload({ progress, signal, fail }: { progress: (v: number, d?: React.ReactNode) => void; signal: AbortSignal; fail: boolean }) {
  return new Promise<void>((resolve, reject) => {
    let done = 0;
    const steps = [0.06, 0.11, 0.04, 0.13, 0.09, 0.12, 0.05, 0.1, 0.14, 0.08, 0.08];
    let i = 0;
    const tick = window.setInterval(() => {
      done = Math.min(1, done + steps[i++ % steps.length]);
      progress(done, `${mb(done * SIZE_MB)} of ${mb(SIZE_MB)} MB`);
      if (fail && done >= 0.7) {
        window.clearInterval(tick);
        reject(new Error("The connection dropped"));
      } else if (done >= 1) {
        window.clearInterval(tick);
        resolve();
      }
    }, 280);
    signal.addEventListener("abort", () => {
      window.clearInterval(tick);
      reject(signal.reason);
    });
  });
}

export default function Demo() {
  return (
    <ToastProvider>
      <div className="relative flex h-[420px] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-line bg-frame">
        <Panel />
        <Toaster contained position="bottom-right" />
      </div>
    </ToastProvider>
  );
}

function Panel() {
  const { promise } = usePromiseToast();
  const [failNext, setFailNext] = useState(false);

  const upload = () => {
    const fail = failNext;
    setFailNext(false);
    let attempts = 0;
    promise(
      // Only the first attempt fails, so Try again shows the recovery.
      ({ progress, signal }) => fakeUpload({ progress, signal, fail: fail && attempts++ === 0 }),
      {
        loading: { title: "Uploading q3-forecast.xlsx", description: `0.0 of ${mb(SIZE_MB)} MB` },
        success: { title: "Uploaded q3-forecast.xlsx", description: "Shared with Finance" },
        error: (e) => ({ title: "Upload stopped", description: `${e instanceof Error ? e.message : "Something interrupted it"}. Your file is still on this device.` }),
        canceled: "Upload canceled",
      },
      { cancel: true, retry: true },
    );
  };

  const publish = () => {
    const fail = failNext;
    setFailNext(false);
    promise(
      () => new Promise<string>((res, rej) => setTimeout(() => (fail ? rej(new Error("Build failed")) : res("v2.4.1")), 1600)),
      {
        loading: "Publishing to production",
        success: (v) => ({ title: `Published ${v}`, description: "Live at stealth.app" }),
        error: { title: "Couldn’t publish", description: "The build failed on step 3 of 5. Check the logs, then try again." },
      },
      { retry: true },
    );
  };

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-line px-4">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Q3 close</h3>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-raised p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-frame text-fg-3">
            <File />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] leading-[18px] text-fg">q3-forecast.xlsx</span>
            <span className="text-[12px] leading-4 text-fg-3 tabular">{mb(SIZE_MB)} MB · Ready to upload</span>
          </span>
          <DemoButton onClick={upload} primary>
            <Upload size={14} />
            Upload
          </DemoButton>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label className="group flex cursor-pointer select-none items-center gap-2 text-[12.5px] text-fg-2">
            <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} className="peer sr-only" />
            <span
              className={cn(
                "grid size-4 place-items-center rounded-[5px] border transition-[background-color,border-color] duration-150 peer-focus-visible:outline-solid peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg-3",
                failNext ? "border-fg bg-fg text-frame" : "border-line-2 bg-raised group-hover:border-fg-4",
              )}
            >
              {failNext && <Check size={12} strokeWidth={2} />}
            </span>
            Fail the next request
          </label>
          <DemoButton onClick={publish}>Publish site</DemoButton>
        </div>
      </div>
    </>
  );
}

function DemoButton({ onClick, primary, children }: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium outline-none",
        "transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        primary ? "bg-fg text-frame hover:bg-fg/90" : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}
