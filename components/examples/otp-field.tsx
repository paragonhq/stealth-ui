"use client";
import { useEffect, useRef, useState } from "react";
import { OTPField, type OTPStatus } from "@/components/ui/otp-field";

const CODE = "424242";

// Email verification: paste, type or autofill the code; a wrong one clears itself.
export default function Demo() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<OTPStatus>("idle");
  const [wait, setWait] = useState(24);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const verify = (value: string) => {
    setStatus("verifying");
    timers.current.push(window.setTimeout(() => setStatus(value === CODE ? "success" : "error"), 900));
  };

  return (
    <div className="flex w-full max-w-[340px] flex-col items-center gap-3">
      <div className="flex w-full flex-col gap-4 rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-1">
          <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Check your email</h3>
          <p className="text-[12px] leading-4 text-fg-3">
            We sent a 6-digit code to <span className="text-fg-2">maya@northwind.dev</span>
          </p>
        </div>

        <OTPField
          label="Verification code"
          value={code}
          onValueChange={(v) => {
            setCode(v);
            if (status === "error" && v) setStatus("idle");
          }}
          onValueComplete={verify}
          status={status}
          description={status === "success" ? "Verified. Taking you to your workspace…" : "The code expires in 10 minutes."}
          error="That code didn’t work. Try again or resend it."
          className="w-full"
        />

        <div className="flex items-center justify-between border-t border-line pt-3 text-[12px] text-fg-3">
          <span>Didn’t get it?</span>
          <button
            type="button"
            disabled={wait > 0}
            onClick={() => {
              setWait(30);
              setCode("");
              setStatus("idle");
            }}
            className="relative -mr-1.5 rounded-md px-1.5 py-1 font-medium text-fg outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.97] disabled:text-fg-4"
          >
            {wait > 0 ? <span className="tabular">Resend in 0:{String(wait).padStart(2, "0")}</span> : "Resend code"}
          </button>
        </div>
      </div>
      <p className="text-center text-[11px] text-fg-4">
        Try <span className="font-mono text-fg-3">424242</span>, or anything else to see it fail.
      </p>
    </div>
  );
}
