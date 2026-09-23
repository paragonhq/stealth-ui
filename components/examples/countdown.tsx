"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Countdown } from "@/components/ui/countdown";

// Targets are set from when the page opened, on the client only, so the server
// render and the first client render agree.
let opened = 0;
const noop = () => () => {};
const getOpened = () => opened || (opened = Date.now());

// Three real countdowns: a launch, a seat hold that warns in its last minute,
// and a resend link that the countdown turns into once it runs out.
export default function Demo() {
  const base = useSyncExternalStore(noop, getOpened, () => 0);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [sent, setSent] = useState(1);
  const [canResend, setCanResend] = useState(false);
  const resendRow = useRef<HTMLSpanElement>(null);
  // The button disappears once pressed, so keep keyboard focus in the row instead of dropping it on the page.
  useEffect(() => {
    if (resendAt) resendRow.current?.focus();
  }, [resendAt]);
  const launch = base + ((2 * 24 + 4) * 60 + 12) * 60_000 + 9_000;
  const hold = base + 65_000;
  const resend = resendAt ?? base + 12_000;

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-4">
      <section className="flex flex-col items-center gap-3 rounded-xl border border-line px-4 py-5">
        <p className="text-[12px] text-fg-3">Launch week starts in</p>
        <Countdown to={launch} label="Launch week starts in" ended={<span className="text-[15px] font-medium text-fg">Launch week is live</span>} />
      </section>

      <div className="flex flex-col divide-y divide-line rounded-xl border border-line">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] text-fg">2 seats held</p>
            <p className="truncate text-[12px] text-fg-3">Row F, 11–12 · Finish checkout to keep them</p>
          </div>
          <Countdown
            to={hold}
            variant="compact"
            warnBelow={60}
            label="Seats held for"
            ended={<span className="text-[13px] text-fg-3">Released</span>}
            className="shrink-0 text-[15px] font-medium text-fg"
          />
        </div>
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <p className="min-w-0 truncate text-[13px] text-fg-2">
            Code sent to <span className="text-fg">maya@northwind.io</span>
            {sent > 1 && <span className="text-fg-3"> · {sent}×</span>}
          </p>
          <span ref={resendRow} tabIndex={-1} className="flex shrink-0 items-center gap-1 text-[12.5px] text-fg-3 outline-none">
            {!canResend && <span>Resend in</span>}
            <Countdown
              key={resend}
              to={resend}
              variant="compact"
              label="Resend available in"
              onComplete={() => setCanResend(true)}
              ended={
                <button
                  type="button"
                  onClick={() => {
                    setResendAt(Date.now() + 12_000);
                    setCanResend(false);
                    setSent((n) => n + 1);
                  }}
                  className="h-7 whitespace-nowrap rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
                >
                  Resend code
                </button>
              }
              className="text-fg-2"
            />
          </span>
        </div>
      </div>
    </div>
  );
}
