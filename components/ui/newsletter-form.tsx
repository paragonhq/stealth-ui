"use client";
import { Button } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import { Form } from "@base-ui/react/form";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, Loader } from "@/lib/icons";
import { ease } from "@/lib/motion";

type Status = "idle" | "submitting" | "success";

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

// Mailbox providers people actually mistype. A suggestion never blocks the
// submit; it only offers the likely address.
const DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com", "hey.com", "fastmail.com",
];
const TLD_TYPOS: Record<string, string> = { con: "com", cmo: "com", ocm: "com", comm: "com", cm: "com", vom: "com", xom: "com", cpm: "com", nte: "net", ogr: "org" };

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
}

/**
 * The address the person probably meant, or null. "ryan@gmial.com" gives
 * "ryan@gmail.com"; "ryan@acme.con" gives "ryan@acme.com"; a company domain it
 * doesn't know is left alone.
 */
export function suggestEmail(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const local = email.trim().slice(0, at);
  const domain = email.trim().slice(at + 1).toLowerCase();
  if (!domain || DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestScore = 3;
  for (const d of DOMAINS) {
    const score = distance(domain, d);
    if (score < bestScore) [best, bestScore] = [d, score];
  }
  if (best && domain.length > 4) return `${local}@${best}`;
  const dot = domain.lastIndexOf(".");
  const tld = dot > 0 ? domain.slice(dot + 1) : "";
  if (TLD_TYPOS[tld]) return `${local}@${domain.slice(0, dot + 1)}${TLD_TYPOS[tld]}`;
  return null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type NewsletterFormProps = Omit<React.ComponentProps<"div">, "onSubmit" | "children"> & {
  /** Called with a valid, trimmed address. Throw (or reject) with a message to show it under the field. */
  onSubscribe: (email: string) => Promise<void> | void;
  /** Called once the success state is showing. */
  onSuccess?: (email: string) => void;
  /** Accessible name of the field. Rendered visually hidden; the placeholder is only an example. */
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  /** One quiet line under the field: cadence, privacy. Replaced by errors and the success line. */
  hint?: React.ReactNode;
  successTitle?: string;
  successMessage?: React.ReactNode;
  /** Label of the link that brings the field back with the address selected. */
  resetLabel?: string;
  /** Offer "Did you mean …@gmail.com?" when the domain looks mistyped. */
  suggest?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
  /** Name of the field in the submitted form values. */
  name?: string;
};

/**
 * An email field with its button inside. Submitting dims the label and, if the
 * request is slow enough to notice, swaps it for a spinner at the same width.
 * On success the button grows over the whole field and becomes the confirmation.
 */
export function NewsletterForm({
  onSubscribe,
  onSuccess,
  label = "Email address",
  placeholder = "you@company.com",
  submitLabel = "Subscribe",
  hint,
  successTitle = "You’re in",
  successMessage = "Check your inbox to confirm.",
  resetLabel = "Use another email",
  suggest = true,
  size = "md",
  disabled = false,
  name = "email",
  className,
  ...rest
}: NewsletterFormProps) {
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestion, setSuggestion] = useState<string | null>(null);
  // Where the button sat when it was pressed, so the confirmation grows out of it.
  const [origin, setOrigin] = useState<{ top: number; right: number; bottom: number; left: number } | null>(null);
  const [slow, setSlow] = useState(false);

  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const reset = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const refocus = useRef<"input" | "reset" | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Focus follows the state change once the new state is on screen.
  useEffect(() => {
    if (refocus.current === "reset" && status === "success") reset.current?.focus();
    if (refocus.current === "input" && status === "idle") {
      input.current?.focus();
      input.current?.select();
    }
    refocus.current = null;
  }, [status]);

  // The spinner only appears if the request outlasts 150ms, so a fast answer never flashes it.
  useEffect(() => {
    if (status !== "submitting") return;
    const t = window.setTimeout(() => setSlow(true), 150);
    return () => {
      window.clearTimeout(t);
      setSlow(false);
    };
  }, [status]);

  const submit = async (value: string) => {
    if (status !== "idle") return;
    const b = box.current?.getBoundingClientRect();
    const k = button.current?.getBoundingClientRect();
    if (b && k) setOrigin({ top: k.top - b.top, right: b.right - k.right, bottom: b.bottom - k.bottom, left: k.left - b.left });
    setErrors({});
    setSuggestion(null);
    setStatus("submitting");
    const started = performance.now();
    // Once a spinner has shown, it stays for at least 300ms so it reads as a state, not a glitch.
    const settle = async () => {
      const elapsed = performance.now() - started;
      if (elapsed > 150 && elapsed < 450) await wait(450 - elapsed);
    };
    try {
      await onSubscribe(value);
      await settle();
      if (!alive.current) return;
      refocus.current = "reset";
      setStatus("success");
      onSuccess?.(value);
    } catch (error) {
      await settle();
      if (!alive.current) return;
      setStatus("idle");
      // A new object each time, so the same message twice still re-announces and refocuses.
      setErrors({ [name]: error instanceof Error && error.message ? error.message : "Couldn’t subscribe you. Try again." });
    }
  };

  const busy = status === "submitting";
  const done = status === "success";
  const sm = size === "sm";
  const radius = sm ? 7 : 8;
  const inner = sm ? 5 : 6;

  const clip = (o: typeof origin, r: number) => (o ? `inset(${o.top}px ${o.right}px ${o.bottom}px ${o.left}px round ${r}px)` : `inset(0px 0px 0px 0px round ${radius}px)`);

  return (
    <div
      data-slot="newsletter-form"
      data-state={status}
      data-size={size}
      className={cn("w-full min-w-0", className)}
      {...rest}
    >
      <Form
        errors={errors}
        onFormSubmit={(values) => submit(String(values[name] ?? "").trim())}
        aria-busy={busy || undefined}
      >
        <Field.Root
          name={name}
          disabled={disabled}
          validate={(v) => {
            const s = String(v ?? "").trim();
            if (!s) return "Enter your email address";
            if (!EMAIL.test(s)) return "Enter a valid email, like name@company.com";
            return null;
          }}
          className="group/nl flex flex-col gap-2"
        >
          <Field.Label className="sr-only">{label}</Field.Label>

          <div
            ref={box}
            className={cn(
              "relative flex w-full min-w-0 items-center border bg-raised shadow-[var(--shadow)]",
              "border-line-2 transition-[border-color,box-shadow] duration-150 ease-out",
              "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
              "group-data-invalid/nl:border-danger/70 group-data-invalid/nl:hover:border-danger group-data-invalid/nl:focus-within:border-danger group-data-invalid/nl:hover:focus-within:border-danger group-data-invalid/nl:focus-within:ring-danger/15",
              "group-data-disabled/nl:opacity-50 group-data-disabled/nl:shadow-none group-data-disabled/nl:hover:border-line-2",
              sm ? "h-9 rounded-[7px] pl-2.5 pr-[3px]" : "h-10 rounded-lg pl-3 pr-[3px]",
            )}
            // Pressing the padding puts the caret in the field, as a single native control would.
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest("input, button") || disabled || done) return;
              e.preventDefault();
              input.current?.focus();
            }}
          >
            <div inert={done} className="flex h-full min-w-0 flex-1 items-center gap-2">
              <Field.Control
                ref={input}
                type="text"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                placeholder={placeholder}
                value={email}
                onValueChange={(v) => {
                  setEmail(v);
                  if (suggestion) setSuggestion(null);
                }}
                onBlur={() => suggest && !done && setSuggestion(suggestEmail(email))}
                readOnly={busy}
                className={cn(
                  "h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]",
                  "transition-colors duration-150 read-only:text-fg-2 disabled:cursor-not-allowed",
                  "autofill:shadow-[inset_0_0_0_1000px_var(--raised)] autofill:[-webkit-text-fill-color:var(--fg)]",
                )}
              />

              <Button
                ref={button}
                type="submit"
                disabled={disabled}
                aria-disabled={busy || undefined}
                data-busy={busy || undefined}
                className={cn(
                  "relative inline-flex shrink-0 select-none items-center justify-center bg-fg font-medium tracking-[-0.005em] text-frame",
                  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                  "data-busy:pointer-events-none data-disabled:pointer-events-none",
                  // 28–32px to the eye, 44px to a thumb.
                  "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
                  sm ? "h-7 rounded-[5px] px-2.5 text-[12px]" : "h-8 rounded-md px-3 text-[12.5px]",
                )}
              >
                {/* Label and spinner share one cell, so the button never changes width. */}
                <span className="grid place-items-center">
                  <span
                    className={cn(
                      "col-start-1 row-start-1 transition-[opacity,filter] duration-150 ease-out",
                      busy && "opacity-60",
                      slow && "opacity-0 blur-[2px] motion-reduce:blur-none",
                    )}
                  >
                    {submitLabel}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "col-start-1 row-start-1 grid place-items-center transition-[opacity,scale] duration-200 ease-out-expo",
                      slow ? "scale-100 opacity-100" : "scale-75 opacity-0",
                    )}
                  >
                    <Loader size={sm ? 13 : 14} className={cn(slow && "animate-spin motion-reduce:animate-spin-slow")} />
                  </span>
                </span>
                {busy && <span className="sr-only">Subscribing</span>}
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {done && (
                <motion.div
                  key="done"
                  className="absolute -inset-px flex min-w-0 items-center gap-2 bg-fg text-frame"
                  style={{ borderRadius: radius, paddingInline: sm ? 10 : 12 }}
                  initial={reduce ? { opacity: 0 } : { clipPath: clip(origin, inner) }}
                  animate={reduce ? { opacity: 1 } : { clipPath: clip(null, radius), opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15, ease: ease.in } }}
                  transition={reduce ? { duration: 0.15 } : { duration: 0.46, ease: ease.out }}
                >
                  <Tick reduce={!!reduce} />
                  <motion.span
                    className="shrink-0 text-[13px] font-medium tracking-[-0.01em]"
                    initial={reduce ? false : { opacity: 0, x: -4, filter: "blur(2px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.3, ease: ease.out, delay: 0.14 }}
                  >
                    {successTitle}
                  </motion.span>
                  <motion.span
                    className="ml-auto min-w-0 truncate text-[12.5px] opacity-60"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ duration: 0.3, ease: ease.out, delay: 0.22 }}
                  >
                    {email.trim()}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Hint, suggestion, error and confirmation share one line, so nothing below the form moves. */}
          <div className="grid min-h-[18px] text-[12px] leading-[18px]">
            {hint != null && (
              <Field.Description
                className={cn(
                  "col-start-1 row-start-1 text-fg-3 transition-[opacity,translate] duration-150 ease-out text-pretty",
                  "group-data-invalid/nl:pointer-events-none group-data-invalid/nl:opacity-0",
                  (suggestion || done) && "pointer-events-none opacity-0",
                )}
              >
                {hint}
              </Field.Description>
            )}

            <div
              inert={!suggestion || done}
              className={cn(
                "col-start-1 row-start-1 flex min-w-0 items-center gap-1 text-fg-2 transition-[opacity,translate] duration-200 ease-out-expo",
                suggestion && !done ? "opacity-100" : "pointer-events-none -translate-y-0.5 opacity-0 duration-100",
                "group-data-invalid/nl:hidden",
              )}
            >
              <span className="shrink-0">Did you mean</span>
              <span className="flex min-w-0 items-center">
              <button
                type="button"
                onClick={() => {
                  if (!suggestion) return;
                  setEmail(suggestion);
                  setSuggestion(null);
                  input.current?.focus();
                }}
                className={cn(
                  "min-w-0 truncate rounded-[3px] font-medium text-fg underline decoration-fg-4 underline-offset-[3px]",
                  "outline-none transition-[text-decoration-color] duration-150 hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                )}
              >
                {suggestion}
              </button>
              <span className="shrink-0">?</span>
              </span>
            </div>

            <Field.Error
              className={cn(
                "col-start-1 row-start-1 flex items-start gap-1.5 text-danger",
                "transition-[opacity,translate] duration-200 ease-out-expo",
                "data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
                "motion-reduce:translate-y-0",
              )}
              // Keep Base UI's message (validation or server) and set an icon beside it.
              render={({ children, ...props }) => (
                <div {...props}>
                  <Alert size={14} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 text-pretty">{children}</span>
                </div>
              )}
            />

            <div
              inert={!done}
              className={cn(
                "col-start-1 row-start-1 flex flex-wrap items-center gap-x-2 text-fg-3 transition-[opacity,translate] duration-300 ease-out-expo",
                done ? "opacity-100 delay-200" : "pointer-events-none translate-y-1 opacity-0 duration-100 motion-reduce:translate-y-0",
              )}
            >
              <span>{successMessage}</span>
              <button
                ref={reset}
                type="button"
                onClick={() => {
                  refocus.current = "input";
                  setStatus("idle");
                }}
                className={cn(
                  "rounded-[3px] font-medium text-fg-2 underline decoration-fg-4 underline-offset-[3px]",
                  "outline-none transition-[color,text-decoration-color] duration-150 hover:text-fg hover:decoration-fg-2",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                )}
              >
                {resetLabel}
              </button>
            </div>
          </div>
        </Field.Root>
      </Form>

      <span role="status" aria-live="polite" className="sr-only">
        {done ? `${successTitle}. ${typeof successMessage === "string" ? successMessage : ""}` : ""}
      </span>
    </div>
  );
}

/** A ring that closes, then a tick that draws inside it. */
function Tick({ reduce }: { reduce: boolean }) {
  const draw = (delay: number, duration: number) =>
    reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration, ease: ease.out, delay } };
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <motion.circle cx="8" cy="8" r="6.25" opacity={0.35} {...draw(0.1, 0.4)} />
      <motion.path d="m5.25 8.25 1.9 1.9 3.6-4.15" {...draw(0.3, 0.3)} />
    </svg>
  );
}
