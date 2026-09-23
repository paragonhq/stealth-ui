"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import { Collapsible } from "@base-ui/react/collapsible";
import { Field } from "@base-ui/react/field";
import { OTPField } from "@base-ui/react/otp-field";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useIsPresent, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { Alert, ArrowLeft, ChevronDown, Download } from "@/lib/icons";
import { ease, spring, stagger } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type TwoFactorStep = "scan" | "verify" | "recovery" | "done";
const order: TwoFactorStep[] = ["scan", "verify", "recovery", "done"];

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP", so a key typed by hand can be checked in chunks. */
export const formatSecret = (secret: string) => secret.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

export type TwoFactorSetupProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The base32 secret, for people who can't scan. */
  secret: string;
  /** Shown on the scan step and in the downloaded file, e.g. "Northwind". */
  issuer?: string;
  /** The account the authenticator will label, e.g. the email. */
  account?: string;
  /** Your real QR code (an <img> or <svg> of the otpauth URL). Without it a placeholder is drawn from the secret. */
  qrCode?: React.ReactNode;
  /** Check the code. Resolve the recovery codes (or nothing, to use `recoveryCodes`); throw with a message to show it. */
  onVerify: (code: string) => Promise<string[] | void> | string[] | void;
  recoveryCodes?: string[];
  onDone?: () => void;
  step?: TwoFactorStep;
  defaultStep?: TwoFactorStep;
  onStepChange?: (step: TwoFactorStep) => void;
  codeLength?: number;
};

export function TwoFactorSetup({
  secret,
  issuer = "your account",
  account,
  qrCode,
  onVerify,
  recoveryCodes: codesProp = [],
  onDone,
  step: stepProp,
  defaultStep = "scan",
  onStepChange,
  codeLength = 6,
  className,
  ...rest
}: TwoFactorSetupProps) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [step, setStep] = useControllableState<TwoFactorStep>({ value: stepProp, defaultValue: defaultStep, onChange: onStepChange });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const [codes, setCodes] = useState<string[]>(codesProp);
  const [saved, setSaved] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [announce, setAnnounce] = useState("");

  const [shownStep, setShownStep] = useState(step);
  const [dir, setDir] = useState(1);
  if (shownStep !== step) {
    setShownStep(step);
    setDir(order.indexOf(step) >= order.indexOf(shownStep) ? 1 : -1);
  }

  const ticket = useRef(0);
  const clearTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(clearTimer.current), []);

  // Card height glides between steps; at rest it's auto so errors grow it freely.
  const card = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLElement>(null);
  const verifyRef = useRef<HTMLElement>(null);
  const recoveryRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLElement>(null);
  const stepEl = (s: TwoFactorStep) => ({ scan: scanRef, verify: verifyRef, recovery: recoveryRef, done: doneRef })[s].current;
  const settled = useRef(0);
  const moving = useRef<AnimationPlaybackControls | null>(null);
  const lastStep = useRef(step);
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!moving.current) settled.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    const el = card.current;
    const target = stepEl(step);
    const header = el?.querySelector<HTMLElement>("[data-progress]");
    if (!el || !target || reduce) return;
    const cs = getComputedStyle(el);
    const chrome = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth", "rowGap"].reduce((n, k) => n + (parseFloat(cs[k as "paddingTop"]) || 0), 0);
    const from = moving.current ? el.offsetHeight : settled.current;
    const to = chrome + (header?.offsetHeight ?? 0) + target.offsetHeight;
    moving.current?.stop();
    if (!from || Math.abs(from - to) < 1) return;
    const controls = animate(el, { height: [from, to] }, { duration: 0.36, ease: ease.inOut });
    moving.current = controls;
    controls.then(() => {
      if (moving.current !== controls) return;
      moving.current = null;
      el.style.height = "";
      settled.current = el.offsetHeight;
    });
  }, [step, reduce]);

  const focusedStep = useRef(step);
  useEffect(() => {
    if (focusedStep.current === step) return;
    focusedStep.current = step;
    stepEl(step)?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [step]);

  const go = (next: TwoFactorStep) => {
    setError(null);
    setRejected(false);
    setStep(next);
  };

  async function verify(value: string) {
    if (busy) return;
    if (value.length < codeLength) return setError(`Enter all ${codeLength} digits`);
    const mine = ++ticket.current;
    setBusy(true);
    setError(null);
    try {
      const result = await onVerify(value);
      if (mine !== ticket.current) return;
      setBusy(false);
      if (Array.isArray(result)) setCodes(result);
      go("recovery");
      setAnnounce("Code accepted. Save your recovery codes.");
    } catch (err) {
      if (mine !== ticket.current) return;
      setBusy(false);
      setError(err instanceof Error && err.message ? err.message : "That code didn’t match. Codes change every 30 seconds; try the current one.");
      setRejected(true);
      // Leave the wrong code up long enough to read, then clear it for the next one.
      clearTimer.current = window.setTimeout(() => {
        if (mine !== ticket.current) return;
        setCode("");
        setRejected(false);
        verifyRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
      }, 900);
    }
  }

  function download() {
    const lines = [
      `${issuer} recovery codes${account ? ` for ${account}` : ""}`,
      `Saved ${new Date().toLocaleString()}`,
      "",
      ...codes,
      "",
      "Each code works once. Keep this file somewhere only you can reach.",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${issuer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-recovery-codes.txt`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    markSaved();
  }
  // Copying or downloading counts as saving: the box ticks itself, and can still be unticked.
  const markSaved = () => {
    setSaved(true);
    setNudge(false);
  };

  const index = Math.min(order.indexOf(step), 2);
  const secretId = `${uid}-secret`;

  return (
    <div
      ref={card}
      data-step={step}
      className={cn(
        "relative flex w-full max-w-[380px] flex-col gap-5 overflow-hidden rounded-xl border border-line bg-raised p-5 text-left shadow-[var(--shadow)] sm:p-6",
        className,
      )}
      {...rest}
    >
      <Progress index={index} done={step === "done"} reduce={!!reduce} />

      <div className="relative">
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          {step === "scan" && (
            <Step key="scan" direction={dir} reduce={!!reduce} ref={scanRef}>
              <Header title="Scan the QR code" description={`Open your authenticator app and add ${issuer}${account ? ` for ${account}` : ""}.`} />
              <div className="flex flex-col items-center gap-3">
                <div className="grid size-[168px] place-items-center rounded-lg border border-line-2 bg-raised p-3 text-fg shadow-[var(--shadow)] dark:bg-fg dark:text-frame">
                  {qrCode ?? <QrPlaceholder seed={secret} reduce={!!reduce} />}
                </div>
              </div>
              <Collapsible.Root className="flex flex-col">
                <Collapsible.Trigger className="group/key -mx-1.5 inline-flex h-7 w-fit items-center gap-1 rounded-md px-1.5 text-[12.5px] text-fg-2 outline-none transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3">
                  Can’t scan it? Enter a key instead
                  <ChevronDown size={14} className="transition-transform duration-200 ease-out group-data-[panel-open]/key:rotate-180 motion-reduce:transition-none" />
                </Collapsible.Trigger>
                <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-220 ease-out-expo data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
                  <div className="pt-2">
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-frame py-1 pl-3 pr-1">
                      <code id={secretId} className="min-w-0 flex-1 break-all font-mono text-[12.5px] tracking-[0.04em] text-fg">
                        {formatSecret(secret)}
                      </code>
                      <CopyButton value={secret.replace(/\s+/g, "")} size="sm" variant="ghost" iconOnly label="Copy setup key" aria-describedby={secretId} />
                    </div>
                    <p className="pt-1.5 text-[12px] text-fg-3">Time-based, 6 digits. Spaces don’t matter.</p>
                  </div>
                </Collapsible.Panel>
              </Collapsible.Root>
              <PrimaryButton onClick={() => go("verify")}>Continue</PrimaryButton>
            </Step>
          )}

          {step === "verify" && (
            <Step key="verify" direction={dir} reduce={!!reduce} ref={verifyRef}>
              <Header title="Enter the code" description={`Type the ${codeLength}-digit code your authenticator shows for ${issuer}.`} />
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  verify(code);
                }}
                aria-busy={busy || undefined}
                className="flex flex-col gap-4"
              >
                <Field.Root invalid={!!error} className="flex flex-col gap-1.5">
                  <Field.Label className="sr-only">Authenticator code</Field.Label>
                  <CodeCells
                    id={`${uid}-code`}
                    length={codeLength}
                    value={code}
                    onChange={(v) => {
                      setCode(v);
                      if (error && !rejected) setError(null);
                    }}
                    onComplete={verify}
                    busy={busy}
                    rejected={rejected}
                    reduce={!!reduce}
                  />
                  <Message message={error ?? undefined} reduce={!!reduce} />
                </Field.Root>
                <PrimaryButton type="submit" busy={busy}>
                  Verify
                </PrimaryButton>
              </form>
              <div className="flex min-h-7 items-center">
                <TextButton
                  onClick={() => {
                    ticket.current++;
                    setBusy(false);
                    setCode("");
                    go("scan");
                  }}
                  className="group/back"
                >
                  <ArrowLeft size={14} className="transition-transform duration-200 ease-out group-hover/back:-translate-x-0.5" />
                  Back to the QR code
                </TextButton>
              </div>
            </Step>
          )}

          {step === "recovery" && (
            <Step key="recovery" direction={dir} reduce={!!reduce} ref={recoveryRef}>
              <Header
                title="Save your recovery codes"
                description="If you lose your phone, each of these gets you in once. Store them somewhere only you can reach."
                autoFocus
              />
              <div className="flex flex-col gap-2">
                <ol aria-label="Recovery codes" className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-line bg-frame px-4 py-3">
                  {codes.map((c, i) => (
                    <motion.li
                      key={c}
                      className="flex items-baseline gap-2 font-mono text-[12.5px] tracking-[0.02em] text-fg tabular"
                      initial={reduce ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, ease: ease.out, delay: 0.12 + Math.min(i, 8) * stagger.items * 1.5 }}
                    >
                      <span aria-hidden className="w-3 text-right text-[10.5px] text-fg-4">
                        {i + 1}
                      </span>
                      {c}
                    </motion.li>
                  ))}
                </ol>
                <div className="grid grid-cols-2 gap-2">
                  <CopyButton value={codes.join("\n")} label="Copy all" copiedLabel="Copied" className="w-full" onCopied={markSaved} />
                  <DownloadButton onDownload={download} />
                </div>
              </div>
              <label className="flex cursor-default items-start gap-2.5 text-[12.5px] leading-[18px] text-fg-2">
                <Checkbox.Root
                  checked={saved}
                  onCheckedChange={(c) => {
                    setSaved(c);
                    if (c) setNudge(false);
                  }}
                  className={cn(
                    "relative mt-px grid size-4 shrink-0 place-items-center rounded-[5px] border border-line-2 bg-raised outline-none",
                    "transition-[background-color,border-color,scale] duration-150 ease-out active:scale-90",
                    "data-checked:border-fg data-checked:bg-fg data-checked:text-frame",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    "before:absolute before:-inset-3 before:content-[''] pointer-fine:before:hidden",
                    nudge && "border-warning",
                  )}
                >
                  <Checkbox.Indicator keepMounted className="grid place-items-center">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={false} animate={{ pathLength: saved ? 1 : 0, opacity: saved ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.22, ease: ease.out }} />
                    </svg>
                  </Checkbox.Indicator>
                </Checkbox.Root>
                I’ve saved these codes somewhere safe
              </label>
              <Collapse open={nudge} reduce={!!reduce} className="-mt-2">
                <p role="alert" className="flex items-start gap-1.5 text-[12px] leading-4 text-warning">
                  <Alert size={14} className="mt-px shrink-0" />
                  Copy or download the codes first. You won’t see them again.
                </p>
              </Collapse>
              <PrimaryButton
                onClick={() => {
                  if (!saved) return setNudge(true);
                  go("done");
                  setAnnounce("Two-factor authentication is on.");
                }}
              >
                Finish setup
              </PrimaryButton>
            </Step>
          )}

          {step === "done" && (
            <Step key="done" direction={dir} reduce={!!reduce} ref={doneRef} className="items-center gap-4 py-2 text-center">
              <DoneMark reduce={!!reduce} />
              <div className="flex flex-col items-center gap-1">
                <h2 data-autofocus tabIndex={-1} className="text-[15px] font-medium tracking-[-0.015em] text-fg outline-none">
                  Two-factor authentication is on
                </h2>
                <p className="text-pretty text-[12.5px] leading-[18px] text-fg-2">
                  Next time you sign in on a new device, {issuer} will ask for a code from your authenticator.
                </p>
              </div>
              {onDone && (
                <PrimaryButton onClick={onDone} className="mt-1">
                  Done
                </PrimaryButton>
              )}
            </Step>
          )}
        </AnimatePresence>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

// Three segments; the current one fills from the left. Done fills them all.
function Progress({ index, done, reduce }: { index: number; done: boolean; reduce: boolean }) {
  const labels = ["Scan", "Verify", "Save codes"];
  return (
    <div data-progress className="flex flex-col gap-2">
      <div className="flex items-center justify-between font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
        <span className="tabular">
          {done ? (
            "Complete"
          ) : (
            <>
              Step <NumberFlow value={index + 1} animated={!reduce} /> of 3
            </>
          )}
        </span>
        <span className="text-fg-4">{done ? "" : labels[index]}</span>
      </div>
      <div className="grid grid-cols-3 gap-1" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={3} aria-valuenow={done ? 3 : index} aria-valuetext={done ? "Complete" : `Step ${index + 1} of 3, ${labels[index]}`}>
        {labels.map((l, i) => (
          <span key={l} className="h-1 overflow-hidden rounded-full bg-line-2">
            <motion.span
              className="block h-full origin-left rounded-full bg-fg"
              initial={false}
              animate={{ scaleX: done || i <= index ? 1 : 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.4, ease: ease.inOut, delay: i === index ? 0.1 : 0 }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

type StepProps = { direction: number; reduce: boolean; className?: string; children: React.ReactNode; ref?: React.Ref<HTMLElement> };

function Step({ direction, reduce, className, children, ref }: StepProps) {
  const present = useIsPresent();
  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 20 * d, filter: "blur(2px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (d: number) =>
      reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: -12 * d, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } },
  };
  return (
    <motion.section
      ref={ref}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      inert={!present}
      transition={reduce ? { duration: 0.15 } : { duration: 0.32, ease: ease.out, delay: 0.07, filter: { duration: 0.2, delay: 0.07 } }}
      className={cn("flex w-full flex-col gap-5", className)}
    >
      {children}
    </motion.section>
  );
}

function Header({ title, description, autoFocus }: { title: string; description: string; autoFocus?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 data-autofocus={autoFocus ? "" : undefined} tabIndex={autoFocus ? -1 : undefined} className="text-balance text-[15px] font-medium leading-5 tracking-[-0.015em] text-fg outline-none">
        {title}
      </h2>
      <p className="text-pretty text-[12.5px] leading-[18px] text-fg-2">{description}</p>
    </div>
  );
}

// A stand-in QR drawn from the secret: finder squares in three corners and a
// stable scatter of modules, so it looks right without encoding anything.
function QrPlaceholder({ seed, reduce }: { seed: string; reduce: boolean }) {
  const clip = useId();
  const n = 25;
  const d = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const rand = () => {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      return ((h >>> 0) % 1000) / 1000;
    };
    const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
    let path = "";
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (inFinder(x, y)) continue;
        const timing = (x === 6 || y === 6) && (x + y) % 2 === 0;
        if (timing || rand() < 0.46) path += `M${x} ${y}h1v1h-1z`;
      }
    for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]])
      path += `M${fx} ${fy}h7v7h-7zM${fx + 1} ${fy + 1}v5h5v-5zM${fx + 2} ${fy + 2}h3v3h-3z`;
    return path;
  }, [seed]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="size-full" aria-label="QR code for your authenticator app" role="img" shapeRendering="crispEdges">
      <defs>
        <clipPath id={clip}>
          {/* Draws in top to bottom once, like it's being printed for you. Same first frame on server and client. */}
          <motion.rect x="0" y="0" width={n} initial={{ height: 0 }} animate={{ height: n }} transition={reduce ? { duration: 0 } : { duration: 0.7, ease: ease.out, delay: 0.1 }} />
        </clipPath>
      </defs>
      <path d={d} fill="currentColor" fillRule="evenodd" clipPath={`url(#${clip})`} />
    </svg>
  );
}

function CodeCells({
  id,
  length,
  value,
  onChange,
  onComplete,
  busy,
  rejected,
  reduce,
}: {
  id: string;
  length: number;
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  busy: boolean;
  rejected: boolean;
  reduce: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const group = length % 3 === 0 && length > 3 ? 3 : 0;
  return (
    <OTPField.Root
      id={id}
      length={length}
      value={value}
      onValueChange={(v) => onChange(v)}
      onValueComplete={(v) => onComplete(v)}
      readOnly={busy || rejected}
      className="flex w-full items-center gap-1.5 sm:gap-2"
    >
      {Array.from({ length }, (_, i) => {
        const char = value[i] ?? "";
        return (
          <Fragment key={i}>
            {group > 0 && i > 0 && i % group === 0 && <OTPField.Separator className="h-px w-2 shrink-0 rounded-full bg-fg-4" />}
            <div className="relative h-11 min-w-0 flex-1">
              <OTPField.Input
                data-autofocus={i === 0 ? "" : undefined}
                aria-label={i === 0 ? undefined : `Digit ${i + 1} of ${length}`}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
                className={cn(
                  "block size-full rounded-lg border bg-raised text-center text-transparent caret-transparent outline-none selection:bg-transparent! selection:text-transparent!",
                  "transition-[border-color,background-color,box-shadow] duration-150 ease-out read-only:cursor-default",
                  rejected
                    ? "border-danger/60 bg-danger-soft"
                    : cn("hover:border-fg-4 focus:border-fg-3 focus:ring-3 focus:ring-fg/8", char ? "border-fg-4" : "border-line-2"),
                )}
              />
              <span aria-hidden className={cn("pointer-events-none absolute inset-0 grid place-items-center text-[17px] font-medium tabular", rejected ? "text-danger" : "text-fg")}>
                <AnimatePresence initial={false}>
                  {char && (
                    <motion.span
                      key={char + i}
                      className="col-start-1 row-start-1"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.85, filter: "blur(2px)" }}
                      animate={busy && !reduce ? { opacity: [1, 0.35, 1], y: 0, scale: 1, filter: "blur(0px)" } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, scale: 0.7, filter: "blur(2px)", transition: { duration: 0.1, ease: ease.in } }}
                      transition={
                        busy && !reduce
                          ? { opacity: { duration: 1, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 } }
                          : reduce
                            ? { duration: 0.12 }
                            : spring.pop
                      }
                    >
                      {char}
                    </motion.span>
                  )}
                </AnimatePresence>
                {active === i && !char && !busy && <span className="col-start-1 row-start-1 h-5 w-px animate-caret bg-fg" />}
              </span>
            </div>
          </Fragment>
        );
      })}
    </OTPField.Root>
  );
}

function Collapse({ open, reduce, className, children }: { open: boolean; reduce: boolean; className?: string; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.16, ease: ease.in } }}
          transition={reduce ? { duration: 0.12, height: { duration: 0 } } : { duration: 0.22, ease: ease.out }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Message({ message, reduce }: { message?: string; reduce: boolean }) {
  return (
    <Collapse open={!!message} reduce={reduce}>
      <Field.Error match className="flex items-start gap-1.5 pt-0.5 text-[12px] leading-4 text-danger">
        <Alert size={14} className="mt-px shrink-0" />
        <span className="min-w-0 text-pretty">{message}</span>
      </Field.Error>
    </Collapse>
  );
}

function PrimaryButton({ busy = false, className, children, type = "button", onClick, ...rest }: React.ComponentProps<"button"> & { busy?: boolean }) {
  return (
    <button
      type={type}
      aria-disabled={busy || undefined}
      data-busy={busy ? "" : undefined}
      onClick={(e) => (busy ? e.preventDefault() : onClick?.(e))}
      className={cn(
        "relative grid h-9 w-full select-none place-items-center rounded-lg bg-fg px-3 text-[13px] font-medium tracking-[-0.005em] text-frame outline-none pointer-coarse:h-11",
        "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.985] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "data-busy:cursor-default data-busy:bg-fg/85 data-busy:active:scale-100",
        className,
      )}
      {...rest}
    >
      <span className={cn("col-start-1 row-start-1 transition-[opacity,scale,filter] duration-150 ease-out", busy && "scale-95 opacity-0 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none")}>{children}</span>
      <span aria-hidden className={cn("col-start-1 row-start-1 grid place-items-center transition-opacity duration-150", busy ? "opacity-100" : "opacity-0")}>
        {busy && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="animate-spin [animation-duration:0.7s]">
            <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
            <path d="M13.75 8A5.75 5.75 0 0 0 8 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {busy && <span className="sr-only">Checking…</span>}
    </button>
  );
}

function TextButton({ className, children, ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "-mx-1.5 inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[12.5px] text-fg-2 outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// Matches the copy button beside it: the arrow drops into the tray, then a tick.
function DownloadButton({ onDownload }: { onDownload: () => void }) {
  const reduce = useReducedMotion();
  const [done, setDone] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      onClick={() => {
        onDownload();
        setDone(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setDone(false), 2000);
      }}
      className={cn(
        "group/dl inline-flex h-8 w-full select-none items-center justify-center gap-2 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none",
        "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
      )}
    >
      <span className="relative grid size-4 place-items-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={done ? "done" : "idle"}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            {done ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: ease.out, delay: 0.04 }} />
              </svg>
            ) : (
              <Download className="transition-transform duration-200 ease-out group-hover/dl:translate-y-px" />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="grid">
        {["Download", "Downloaded"].map((l) => (
          <span key={l} aria-hidden className="invisible col-start-1 row-start-1">
            {l}
          </span>
        ))}
        <span className="col-start-1 row-start-1 text-left">{done ? "Downloaded" : "Download"}</span>
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {done ? "Recovery codes downloaded" : ""}
      </span>
    </button>
  );
}

function DoneMark({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="grid size-11 place-items-center rounded-full bg-success-soft text-success"
      initial={reduce ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.bouncy}
    >
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        {/* A shield with a tick: the account is protected now. */}
        <path d="M8 1.9 3 3.75v3.9c0 3.1 2.1 5.4 5 6.45 2.9-1.05 5-3.35 5-6.45v-3.9z" opacity={0.5} />
        <motion.path
          d="m5.6 8.1 1.7 1.7 3.2-3.5"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: ease.out, delay: 0.14, opacity: { duration: 0.01, delay: 0.14 } }}
        />
      </svg>
    </motion.span>
  );
}
