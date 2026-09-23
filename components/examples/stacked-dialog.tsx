"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Check, CreditCard } from "@/lib/icons";
import {
  StackedDialog,
  StackedDialogBody,
  StackedDialogClose,
  StackedDialogContent,
  StackedDialogFooter,
  StackedDialogTrigger,
} from "@/components/ui/stacked-dialog";

const plans = [
  { id: "starter", name: "Starter", price: 0, seats: "Up to 3 seats" },
  { id: "pro", name: "Pro", price: 96, seats: "Up to 10 seats" },
  { id: "business", name: "Business", price: 240, seats: "Unlimited seats, SSO" },
] as const;
type PlanId = (typeof plans)[number]["id"];
const usd = (n: number) => (n === 0 ? "Free" : `$${n}/mo`);

const btn = (variant: "primary" | "secondary") =>
  cn(
    "relative inline-flex h-8 shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium tracking-[-0.005em]",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    "transition-[background-color,border-color,color,scale,opacity] duration-150 ease-out-quart active:scale-[0.97] active:duration-75",
    "disabled:pointer-events-none disabled:opacity-45",
    variant === "primary"
      ? "bg-fg text-frame shadow-[var(--shadow)] hover:bg-fg/90"
      : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover",
  );

export default function Demo() {
  const [plan, setPlan] = useState<PlanId>("pro");
  const [choice, setChoice] = useState<PlanId>("business");
  const [planOpen, setPlanOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const current = plans.find((p) => p.id === plan)!;
  const next = plans.find((p) => p.id === choice)!;
  const upgrade = next.price > current.price;

  return (
    <div className="flex w-full max-w-[360px] items-center justify-between gap-3 rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-fg">Acme Studio</p>
        <p className="mt-0.5 text-[12px] text-fg-3">
          {current.name} plan · 8 members
        </p>
      </div>
      <StackedDialog>
        <StackedDialogTrigger className={btn("secondary")}>Settings</StackedDialogTrigger>
        <StackedDialogContent title="Workspace settings" description="Acme Studio · 8 members">
          <StackedDialogBody>
            <dl className="divide-y divide-line rounded-xl border border-line">
              <Row label="Plan" value={`${current.name} · ${usd(current.price)}`}>
                <StackedDialog
                  open={planOpen}
                  onOpenChange={(o) => {
                    if (o) setChoice(plan === "business" ? "pro" : "business");
                    setPlanOpen(o);
                  }}
                >
                  <StackedDialogTrigger className={btn("secondary")}>Change plan</StackedDialogTrigger>
                  <StackedDialogContent title="Change plan" description="Billed monthly. Changes are prorated to the day.">
                    <StackedDialogBody>
                      <fieldset className="flex flex-col gap-2">
                        <legend className="sr-only">Plan</legend>
                        {plans.map((p) => (
                          <label
                            key={p.id}
                            className={cn(
                              "relative flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-[border-color,background-color] duration-150",
                              "has-focus-visible:outline-solid has-focus-visible:outline-1 has-focus-visible:outline-offset-2 has-focus-visible:outline-fg-3",
                              choice === p.id ? "border-fg-3 bg-hover" : "border-line-2 hover:border-fg-4",
                            )}
                          >
                            <input type="radio" name="plan" value={p.id} checked={choice === p.id} onChange={() => setChoice(p.id)} className="sr-only" />
                            <span
                              aria-hidden
                              className={cn(
                                "grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-150",
                                choice === p.id ? "border-fg bg-fg text-frame" : "border-line-2",
                              )}
                            >
                              {choice === p.id && <span className="size-1.5 rounded-full bg-frame" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
                                {p.name}
                                {p.id === plan && <span className="rounded-full bg-hover px-1.5 py-px text-[10.5px] font-normal text-fg-3 ring-1 ring-line-2">Current</span>}
                              </span>
                              <span className="block truncate text-[12px] text-fg-3">{p.seats}</span>
                            </span>
                            <span className="tabular shrink-0 text-[12.5px] text-fg-2">{usd(p.price)}</span>
                          </label>
                        ))}
                      </fieldset>
                    </StackedDialogBody>
                    <StackedDialogFooter>
                      <StackedDialogClose>Cancel</StackedDialogClose>
                      <StackedDialog open={payOpen} onOpenChange={(o) => !paying && setPayOpen(o)}>
                        <StackedDialogTrigger className={btn("primary")} disabled={choice === plan}>
                          Continue
                        </StackedDialogTrigger>
                        <StackedDialogContent
                          size="sm"
                          title={upgrade ? `Upgrade to ${next.name}` : `Switch to ${next.name}`}
                          description={upgrade ? "You’re charged the difference for the rest of this month." : "The change takes effect on your next invoice."}
                        >
                          <StackedDialogBody>
                            <div className="flex flex-col gap-2 rounded-xl border border-line p-3.5 text-[12.5px]">
                              <p className="flex justify-between text-fg-2">
                                <span>{next.name} plan</span>
                                <span className="tabular text-fg">{usd(next.price)}</span>
                              </p>
                              <p className="flex justify-between text-fg-2">
                                <span>Due today, prorated</span>
                                <span className="tabular text-fg">{upgrade ? `$${((next.price - current.price) * 0.52).toFixed(2)}` : "$0.00"}</span>
                              </p>
                              <p className="mt-1 flex items-center gap-2 border-t border-line pt-3 text-fg-2">
                                <CreditCard className="text-fg-3" />
                                Visa ending 4242
                              </p>
                            </div>
                          </StackedDialogBody>
                          <StackedDialogFooter>
                            <StackedDialogClose disabled={paying}>Back</StackedDialogClose>
                            <button
                              type="button"
                              aria-busy={paying || undefined}
                              className={btn("primary")}
                              onClick={async () => {
                                setPaying(true);
                                await new Promise((r) => setTimeout(r, 800));
                                setPaying(false);
                                setPlan(choice);
                                // Both levels step back at once, so the settings underneath come forward with the new plan.
                                setPayOpen(false);
                                setPlanOpen(false);
                              }}
                            >
                              <span className={cn("transition-opacity duration-150", paying && "opacity-0")}>{upgrade ? "Upgrade" : "Switch plan"}</span>
                              {paying && <Spinner className="absolute" />}
                            </button>
                          </StackedDialogFooter>
                        </StackedDialogContent>
                      </StackedDialog>
                    </StackedDialogFooter>
                  </StackedDialogContent>
                </StackedDialog>
              </Row>
              <Row label="Seats" value="8 of 10 used" />
              <Row label="Billing email" value="billing@acme.studio" />
            </dl>
          </StackedDialogBody>
          <StackedDialogFooter>
            <StackedDialogClose variant="primary">
              <Check size={14} />
              Done
            </StackedDialogClose>
          </StackedDialogFooter>
        </StackedDialogContent>
      </StackedDialog>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-3.5 py-2">
      <div className="min-w-0 flex-1">
        <dt className="text-[12px] text-fg-3">{label}</dt>
        <dd className="truncate text-[13px] text-fg">{value}</dd>
      </div>
      {children}
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={cn("animate-[spin_0.7s_linear_infinite]", className)}>
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M8 2.25A5.75 5.75 0 0 1 13.75 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
