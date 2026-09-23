"use client";
import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ui/progress-bar";

const SIZE_MB = 5.8;

// An upload you can pause, an export that doesn't know its size yet, an upload
// that failed, and a setup flow counted in steps.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <Upload />
        <Export />
        <Failed />
      </div>
      <Steps />
    </div>
  );
}

/** A value that climbs on a timer while running. */
function useTicker(running: boolean, step: (v: number) => number, start = 0) {
  const [v, setV] = useState(start);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setV((x) => Math.min(100, step(x))), 420);
    return () => window.clearInterval(id);
  }, [running, step]);
  return [v, setV] as const;
}

const uploadStep = (x: number) => x + 3 + ((x * 7) % 5);
function Upload() {
  const [paused, setPaused] = useState(false);
  const [v, setV] = useTicker(!paused, uploadStep, 18);
  const done = v >= 100;
  const mb = ((v / 100) * SIZE_MB).toFixed(1);
  const left = Math.max(1, Math.round((100 - v) / 6));

  return (
    <Row
      action={
        done ? (
          <IconButton label="Upload again" onClick={() => { setV(0); setPaused(false); }}>
            <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
          </IconButton>
        ) : (
          <IconButton label={paused ? "Resume upload" : "Pause upload"} onClick={() => setPaused((p) => !p)}>
            {paused ? <path d="M5.5 3.75v8.5L12 8z" /> : <path d="M5.75 4v8M10.25 4v8" />}
          </IconButton>
        )
      }
    >
      <ProgressBar
        value={v}
        paused={paused}
        label="q3-forecast.xlsx"
        description={<span className="tabular">{done ? `${SIZE_MB} MB · Uploaded` : paused ? `${mb} of ${SIZE_MB} MB · Paused` : `${mb} of ${SIZE_MB} MB · about ${left}s left`}</span>}
      />
    </Row>
  );
}

const exportStep = (x: number) => x + 4;
function Export() {
  const [preparing, setPreparing] = useState(true);
  const [v, setV] = useTicker(!preparing, exportStep, 0);
  const timer = useRef<number>(undefined);
  useEffect(() => {
    timer.current = window.setTimeout(() => setPreparing(false), 1800);
    return () => window.clearTimeout(timer.current);
  }, []);
  const restart = () => {
    setV(0);
    setPreparing(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPreparing(false), 1800);
  };
  const done = v >= 100;

  return (
    <Row
      action={
        <IconButton label="Export again" onClick={restart} disabled={!done}>
          <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
        </IconButton>
      }
    >
      <ProgressBar
        value={preparing ? null : v}
        // Frames read from disk run ahead of frames encoded.
        buffer={preparing ? undefined : Math.min(100, v + 22)}
        label="launch-film-4k.mov"
        description={preparing ? "Preparing export…" : done ? "Exported · 1.2 GB" : "Encoding · 24 fps"}
      />
    </Row>
  );
}

function Failed() {
  const [failed, setFailed] = useState(true);
  const [v, setV] = useTicker(!failed, uploadStep, 64);
  const done = v >= 100;
  return (
    <Row
      action={
        failed ? (
          <IconButton label="Retry upload" onClick={() => setFailed(false)}>
            <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
          </IconButton>
        ) : (
          <IconButton label="Upload again" onClick={() => { setV(64); setFailed(true); }} disabled={!done}>
            <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
          </IconButton>
        )
      }
    >
      <ProgressBar
        value={v}
        error={failed}
        label="design-review.fig"
        description={failed ? "Upload stopped: the connection dropped." : done ? "12.4 MB · Uploaded" : "Resuming from 64%"}
      />
    </Row>
  );
}

const steps = ["Create workspace", "Connect repository", "Invite your team", "Choose a plan"];
function Steps() {
  const [step, setStep] = useState(2);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <ProgressBar
        value={step}
        max={steps.length}
        segments={steps.length}
        showValue={false}
        label={
          <>
            {steps[step - 1]} <span className="tabular text-fg-3">· Step {step} of {steps.length}</span>
          </>
        }
        getAriaValueText={() => `Step ${step} of ${steps.length}`}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="h-7 rounded-md px-2.5 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep((s) => (s === steps.length ? 1 : s + 1))}
          className="h-7 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          {step === steps.length ? "Start over" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function Row({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex w-7 shrink-0 justify-end">{action}</div>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="relative grid size-7 place-items-center rounded-md text-fg-2 outline-none transition-[background-color,color,scale,opacity] duration-150 ease-out hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92] active:duration-75 disabled:pointer-events-none disabled:opacity-0 before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
