"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Alert, Link } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { PresenceSwap } from "@/components/ui/presence-swap";

const steps = ["name", "invite", "review"] as const;
type Step = (typeof steps)[number] | "done";
const titles = { name: "Name your workspace", invite: "Invite your team", review: "Review and create" } as const;

const focusRing = "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";
const field =
  "h-8 w-full min-w-0 rounded-lg border border-line-2 bg-frame px-2.5 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-4 focus:border-fg-4 focus:ring-2 focus:ring-fg/10 aria-invalid:border-danger/60 sm:text-[13px]";
const secondary = `inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;
const primary = `inline-flex h-8 items-center justify-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50 ${focusRing}`;

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// A workspace setup flow: steps slide the way you're going, the card follows each
// step's height, and the invite method inside step two crossfades on its own.
export default function Demo() {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("Northwind Labs");
  const [touched, setTouched] = useState(false);
  const [method, setMethod] = useState<"email" | "link">("email");
  const [emails, setEmails] = useState("priya@northwind.io, sam@northwind.io");
  const id = useId();
  const reduce = useReducedMotion();

  const index = step === "done" ? steps.length : steps.indexOf(step);
  const nameError = touched && !name.trim() ? "Enter a workspace name" : null;
  const invited = emails.split(/[\s,]+/).filter((e) => e.includes("@")).length;

  const next = () => {
    if (step === "name" && !name.trim()) return setTouched(true);
    setStep(step === "name" ? "invite" : step === "invite" ? "review" : "done");
  };
  const back = () => setStep(step === "review" ? "invite" : "name");

  return (
    // Anchored to the top, so the stage never re-centres while the card grows.
    <div className="flex min-h-[400px] w-full max-w-[400px] flex-col justify-start">
      <div className="rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
        <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3.5">
          <p aria-live="polite" className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3 tabular">
            {step === "done" ? "Done" : `Step ${index + 1} of ${steps.length}`}
          </p>
          <div aria-hidden className="flex gap-1">
            {steps.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1 w-5 rounded-full transition-colors duration-300 ease-out-quart",
                  i <= index ? "bg-fg" : "bg-line-2",
                )}
              />
            ))}
          </div>
        </div>

        <PresenceSwap value={step} order={[...steps, "done"]} className="px-4">
          {step === "name" && (
            <form
              noValidate
              className="flex flex-col gap-1.5 pb-4 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                next();
              }}
            >
              <h3 className="mb-1.5 text-[15px] font-medium tracking-[-0.015em] text-fg">{titles.name}</h3>
              <label htmlFor={`${id}-name`} className="text-[12px] text-fg-2">
                Workspace name
              </label>
              <input
                id={`${id}-name`}
                data-autofocus
                value={name}
                autoComplete="organization"
                enterKeyHint="next"
                aria-invalid={!!nameError || undefined}
                aria-describedby={`${id}-name-hint`}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                className={field}
              />
              <p id={`${id}-name-hint`} className={cn("flex min-w-0 items-center gap-1.5 text-[12px]", nameError ? "text-danger" : "text-fg-3")}>
                {nameError ? (
                  <>
                    <Alert size={14} className="shrink-0" />
                    {nameError}
                  </>
                ) : (
                  <span className="truncate">
                    app.acme.dev/<span className="text-fg-2">{slugify(name) || "your-workspace"}</span>
                  </span>
                )}
              </p>
            </form>
          )}

          {step === "invite" && (
            <div className="flex flex-col gap-3 pb-4 pt-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-medium tracking-[-0.015em] text-fg">{titles.invite}</h3>
                <ToggleGroup
                  aria-label="Invite by"
                  value={[method]}
                  // One is always chosen: pressing the pressed one does nothing.
                  onValueChange={(v) => v[0] && setMethod(v[0] as "email" | "link")}
                  className="flex shrink-0 rounded-lg border border-line bg-frame p-0.5"
                >
                  {(["email", "link"] as const).map((m) => (
                    <Toggle
                      key={m}
                      value={m}
                      className={cn(
                        "relative h-6 rounded-md px-2 text-[12px] font-medium text-fg-3 transition-[background-color,color,scale] duration-150 hover:text-fg-2 active:scale-[0.97] active:duration-75",
                        // 24px to the eye, 44px under a finger.
                        "before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] pointer-fine:before:hidden",
                        "data-pressed:bg-raised data-pressed:text-fg data-pressed:shadow-[var(--shadow)]",
                        focusRing,
                      )}
                    >
                      {m === "email" ? "Email" : "Link"}
                    </Toggle>
                  ))}
                </ToggleGroup>
              </div>
              <PresenceSwap value={method} variant="fade">
                {method === "email" ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${id}-emails`} className="text-[12px] text-fg-2">
                      Email addresses
                    </label>
                    <textarea
                      id={`${id}-emails`}
                      data-autofocus
                      rows={2}
                      value={emails}
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(e) => setEmails(e.target.value)}
                      className={cn(field, "h-auto resize-none py-1.5 leading-[1.45]")}
                    />
                    <p className="text-[12px] text-fg-3">Separate addresses with commas. They join as members.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[12px] text-fg-2">Invite link</p>
                    <div className="flex h-8 items-center gap-2 rounded-lg border border-line-2 bg-frame pl-2.5 pr-0.5">
                      <Link size={14} className="shrink-0 text-fg-3" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">acme.dev/join/nw-7f3k2q</span>
                      <CopyButton value="https://acme.dev/join/nw-7f3k2q" iconOnly variant="ghost" size="sm" label="Copy invite link" />
                    </div>
                  </div>
                )}
              </PresenceSwap>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-2.5 pb-4 pt-2">
              <h3 className="text-[15px] font-medium tracking-[-0.015em] text-fg">{titles.review}</h3>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-[13px]">
                <dt className="text-fg-3">Workspace</dt>
                <dd className="truncate text-right text-fg">{name.trim()}</dd>
                <dt className="text-fg-3">Invites</dt>
                <dd className="text-right text-fg tabular">
                  {method === "link" ? "Invite link" : invited === 0 ? "None yet" : invited === 1 ? "1 person" : `${invited} people`}
                </dd>
                <dt className="text-fg-3">Plan</dt>
                <dd className="text-right text-fg">Team trial, 14 days</dd>
              </dl>
            </div>
          )}

          {step === "done" && (
            <div className="flex items-center gap-3 pb-4 pt-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <motion.path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.36, ease: ease.out, delay: 0.12 }}
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-medium tracking-[-0.015em] text-fg">{name.trim()} is ready</h3>
                <p className="truncate text-[12px] text-fg-3">
                  {method === "link" || invited === 0 ? "Share the invite link to add people" : invited === 1 ? "1 invite sent" : `${invited} invites sent`}
                </p>
              </div>
            </div>
          )}
        </PresenceSwap>

        <div className="flex h-12 items-center justify-between gap-2 border-t border-line px-2.5">
          {step === "done" ? (
            <button type="button" onClick={() => setStep("name")} className={cn(secondary, "border-0 bg-transparent text-fg-2 shadow-none hover:text-fg")}>
              Start over
            </button>
          ) : (
            <button
              type="button"
              onClick={back}
              disabled={step === "name"}
              className={cn(secondary, "border-0 bg-transparent text-fg-2 shadow-none hover:text-fg")}
            >
              Back
            </button>
          )}
          {step === "done" ? (
            <button type="button" className={primary}>
              Open workspace
            </button>
          ) : (
            <button type="button" onClick={next} className={primary}>
              {/* Every label in one cell, so the button keeps its width across steps. */}
              <span className="grid justify-items-center">
                {["Continue", "Create workspace"].map((l) => (
                  <span key={l} aria-hidden className="invisible col-start-1 row-start-1">
                    {l}
                  </span>
                ))}
                <span className="col-start-1 row-start-1">{step === "review" ? "Create workspace" : "Continue"}</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
