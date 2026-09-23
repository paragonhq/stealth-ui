"use client";
import { useEffect, useRef, useState } from "react";
import { Stepper, StepperStep } from "@/components/ui/stepper";

const steps = [
  { title: "Account", description: "maya@northwind.io", body: "Signed in as Maya Chen. We'll send receipts to this address." },
  { title: "Workspace", description: "northwind.stealth.app", body: "Your team will find the workspace at northwind.stealth.app." },
  { title: "Billing", description: "Pro plan, monthly", body: "Pro plan, $24 per seat each month. Visa ending 4242." },
  { title: "Invite team", description: "3 invites", optional: true, body: "Invites go to priya@, jonas@ and elif@northwind.io." },
];

// Setting up a workspace. The first card is declined, so Billing shows its error before it goes through.
export default function Demo() {
  const [orientation, setOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const declined = useRef(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const done = step >= steps.length;
  const go = (next: number) => {
    setError(null);
    setStep(next);
  };
  const next = () => {
    if (step !== 2) return go(step + 1);
    setSaving(true);
    setError(null);
    timer.current = window.setTimeout(() => {
      setSaving(false);
      if (!declined.current) {
        declined.current = true;
        setError("Card declined. Try another card.");
      } else go(3);
    }, 900);
  };

  const body = done ? "Northwind is ready. Your invites are on their way." : steps[step].body;

  const actions = (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => {
          if (!done) return go(step - 1);
          declined.current = false;
          go(0);
        }}
        disabled={(step === 0 && !done) || saving}
        className="h-8 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
      >
        {done ? "Start over" : "Back"}
      </button>
      {!done && (
        <button
          type="button"
          onClick={next}
          aria-disabled={saving || undefined}
          className="grid h-8 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid active:scale-[0.97] aria-disabled:pointer-events-none aria-disabled:opacity-70"
        >
          {/* Every label shares one cell, so the button keeps its width while it saves. */}
          {["Continue", "Pay and continue", "Charging card…", "Finish setup"].map((l) => (
            <span
              key={l}
              aria-hidden={l !== label(step, saving)}
              className={l === label(step, saving) ? "col-start-1 row-start-1 self-center" : "invisible col-start-1 row-start-1 self-center"}
            >
              {l}
            </span>
          ))}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex w-full max-w-[540px] flex-col gap-4">
      <div role="radiogroup" aria-label="Layout" className="flex self-center rounded-lg border border-line bg-frame p-0.5">
        {(["horizontal", "vertical"] as const).map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={orientation === o}
            onClick={() => setOrientation(o)}
            className="h-6 rounded-md px-2.5 text-[12px] capitalize text-fg-3 outline-none transition-colors duration-150 hover:text-fg focus-visible:outline-1 focus-visible:outline-fg-3 focus-visible:outline-solid aria-checked:bg-raised aria-checked:text-fg aria-checked:shadow-[var(--shadow)]"
          >
            {o}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-frame p-4 sm:p-5">
        {orientation === "horizontal" ? (
          <div className="flex flex-col gap-5">
            <Stepper value={step} onValueChange={go}>
              {steps.map((s, i) => (
                <StepperStep key={s.title} title={s.title} optional={s.optional} loading={i === 2 && saving} error={i === 2 ? error : undefined} />
              ))}
            </Stepper>
            <div className="min-h-[64px] rounded-xl border border-line bg-raised px-3.5 py-3">
              <p className="text-[13px] font-medium tracking-[-0.01em]">{done ? "All set" : steps[step].title}</p>
              <p className="mt-1 text-[12.5px] text-fg-3">{error && step === 2 ? error : body}</p>
            </div>
            {actions}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Stepper value={step} onValueChange={go} orientation="vertical">
              {steps.map((s, i) => (
                <StepperStep
                  key={s.title}
                  title={s.title}
                  description={s.description}
                  optional={s.optional}
                  loading={i === 2 && saving}
                  error={i === 2 ? error : undefined}
                >
                  <p className="text-[12.5px] text-fg-2">{s.body}</p>
                </StepperStep>
              ))}
            </Stepper>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

function label(step: number, saving: boolean) {
  if (step === 2) return saving ? "Charging card…" : "Pay and continue";
  return step === 3 ? "Finish setup" : "Continue";
}
