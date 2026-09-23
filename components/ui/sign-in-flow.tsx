"use client";
import { Field } from "@base-ui/react/field";
import { OTPField } from "@base-ui/react/otp-field";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useIsPresent, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, ArrowLeft, Eye, EyeOff } from "@/lib/icons";
import { ease, spring, swap } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type SignInMethod = "password" | "code";
export type SignInStep = "email" | "password" | "code" | "done";
type Busy = null | "email" | "password" | "code" | "resend" | "switch";
type FieldName = "email" | "password" | "code";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rank: Record<SignInStep, number> = { email: 0, password: 1, code: 1, done: 2 };

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : typeof error === "string" && error ? error : fallback;

/** Tracks Caps Lock from key events on a field. Browsers only report it while a key is pressed. */
export function useCapsLock() {
  const [capsLock, setCapsLock] = useState(false);
  const onKey = useCallback((e: React.KeyboardEvent) => {
    // getModifierState is missing on some synthetic events from autofill.
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  }, []);
  const reset = useCallback(() => setCapsLock(false), []);
  return { capsLock, onKey, reset };
}

export type SignInFlowProps = Omit<React.ComponentProps<"div">, "title" | "onSubmit" | "children"> & {
  /** Heading on the email step. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  step?: SignInStep;
  defaultStep?: SignInStep;
  onStepChange?: (step: SignInStep) => void;
  defaultEmail?: string;
  /**
   * Look the account up. Resolve the method it signs in with; throw (or reject) with a
   * message to show it under the email field. Resolving nothing uses `defaultMethod`.
   */
  onEmailSubmit?: (email: string) => Promise<SignInMethod | void> | SignInMethod | void;
  /** Throw with a message to show it under the password field. */
  onPasswordSubmit?: (email: string, password: string) => Promise<void> | void;
  /** Throw with a message to show it under the code. */
  onCodeSubmit?: (email: string, code: string) => Promise<void> | void;
  /** Send a new code. Enables resending, and "Email me a code" on the password step. */
  onSendCode?: (email: string) => Promise<void> | void;
  onForgotPassword?: (email: string) => void;
  /** Called once a password or code is accepted, after the done state appears. */
  onSuccess?: (email: string) => void;
  defaultMethod?: SignInMethod;
  codeLength?: number;
  /** Seconds before another code can be requested. */
  resendCooldown?: number;
  /** Sign-in buttons for other providers, shown above the email field with an "or" rule. */
  providers?: React.ReactNode;
  /** Shown under the email step, e.g. a link to create an account. */
  footer?: React.ReactNode;
  doneTitle?: React.ReactNode;
  doneDescription?: React.ReactNode;
};

export function SignInFlow({
  title = "Sign in",
  description,
  step: stepProp,
  defaultStep = "email",
  onStepChange,
  defaultEmail = "",
  onEmailSubmit,
  onPasswordSubmit,
  onCodeSubmit,
  onSendCode,
  onForgotPassword,
  onSuccess,
  defaultMethod = "password",
  codeLength = 6,
  resendCooldown = 30,
  providers,
  footer,
  doneTitle = "Signed in",
  doneDescription = "Taking you to your workspace…",
  className,
  ...rest
}: SignInFlowProps) {
  const reduce = useReducedMotion();
  const uid = useId();
  const [step, setStep] = useControllableState<SignInStep>({ value: stepProp, defaultValue: defaultStep, onChange: onStepChange });
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ field: FieldName; message: string } | null>(null);
  const [codeRejected, setCodeRejected] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [cooldown, setCooldown] = useState({ until: 0, now: 0 });
  const [sent, setSent] = useState(false);

  // Direction of travel: forward slides in from the right, back from the left.
  const [shownStep, setShownStep] = useState(step);
  const [dir, setDir] = useState(1);
  if (shownStep !== step) {
    setShownStep(step);
    setDir(rank[step] >= rank[shownStep] ? 1 : -1);
  }

  // Each request gets a ticket. Going back or starting another one voids the old ticket,
  // so a slow answer for an address you've already changed can't move you forward.
  const ticket = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const card = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLElement>(null);
  const passwordRef = useRef<HTMLElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLElement>(null);
  // Read only in effects and handlers.
  const stepEl = (s: SignInStep) => ({ email: emailRef, password: passwordRef, code: codeRef, done: doneRef })[s].current;
  const settled = useRef(0);
  const moving = useRef<AnimationPlaybackControls | null>(null);
  const lastStep = useRef(step);

  // At rest the card is height:auto, so errors and hints can grow it freely.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!moving.current) settled.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Between steps the card glides from the old height to the new one. An interrupted
  // glide starts again from wherever it is now.
  useLayoutEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    const el = card.current;
    const target = stepEl(step);
    if (!el || !target || reduce) return;
    const cs = getComputedStyle(el);
    const chrome = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce((n, k) => n + parseFloat(cs[k as "paddingTop"]), 0);
    const from = moving.current ? el.offsetHeight : settled.current;
    const to = chrome + target.offsetHeight;
    moving.current?.stop();
    if (!from || Math.abs(from - to) < 1) return;
    const controls = animate(el, { height: [from, to] }, { duration: 0.34, ease: ease.inOut });
    moving.current = controls;
    controls.then(() => {
      if (moving.current !== controls) return;
      moving.current = null;
      el.style.height = "";
      settled.current = el.offsetHeight;
    });
  }, [step, reduce]);

  // Focus follows the step, so the keyboard never has to hunt for the next field.
  const focusedStep = useRef(step);
  useEffect(() => {
    if (focusedStep.current === step) return;
    focusedStep.current = step;
    const el = stepEl(step)?.querySelector<HTMLElement>("[data-autofocus]");
    el?.focus({ preventScroll: true });
    if (el instanceof HTMLInputElement && step === "email") el.select();
  }, [step]);

  const go = (next: SignInStep) => {
    setError(null);
    setCodeRejected(false);
    setStep(next);
  };
  const fail = (field: FieldName, message: string) => {
    setError({ field, message });
    setBusy(null);
  };
  const startCooldown = () => {
    const now = Date.now();
    setCooldown({ until: now + resendCooldown * 1000, now });
  };

  // The countdown is measured against the clock, not counted, so a throttled
  // background tab still lands on the right second.
  useEffect(() => {
    if (!cooldown.until) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setCooldown((c) => ({ ...c, now }));
      if (now >= cooldown.until) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [cooldown.until]);
  const remaining = Math.max(0, Math.ceil((cooldown.until - cooldown.now) / 1000));

  const succeed = () => {
    setBusy(null);
    go("done");
    setAnnouncement(`Signed in as ${email.trim()}`);
    onSuccess?.(email.trim());
  };

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!value) return fail("email", "Enter your email address");
    if (!EMAIL.test(value)) return fail("email", "Enter a full email address, like name@company.com");
    const mine = ++ticket.current;
    setBusy("email");
    setError(null);
    try {
      const method = (await onEmailSubmit?.(value)) || defaultMethod;
      if (mine !== ticket.current) return;
      setEmail(value);
      setPassword("");
      setCode("");
      setBusy(null);
      if (method === "code") startCooldown();
      go(method);
      setAnnouncement(method === "code" ? `We sent a ${codeLength}-digit code to ${value}` : `Enter the password for ${value}`);
    } catch (err) {
      if (mine === ticket.current) fail("email", messageOf(err, "Couldn’t check that address. Try again."));
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!password) return fail("password", "Enter your password");
    const mine = ++ticket.current;
    setBusy("password");
    setError(null);
    try {
      await onPasswordSubmit?.(email.trim(), password);
      if (mine === ticket.current) succeed();
    } catch (err) {
      if (mine !== ticket.current) return;
      fail("password", messageOf(err, "That password isn’t right. Try again or reset it."));
      // Keep what they typed but select it, so the next attempt replaces it in one go.
      const input = stepEl("password")?.querySelector<HTMLInputElement>("[data-autofocus]");
      input?.focus();
      input?.select();
    }
  }

  async function submitCode(value: string) {
    if (busy === "code") return;
    if (value.length < codeLength) return fail("code", `Enter all ${codeLength} digits`);
    const mine = ++ticket.current;
    setBusy("code");
    setError(null);
    try {
      await onCodeSubmit?.(email.trim(), value);
      if (mine === ticket.current) succeed();
    } catch (err) {
      if (mine !== ticket.current) return;
      fail("code", messageOf(err, "That code didn’t work. Check it, or send a new one."));
      setCodeRejected(true);
      // Hold the wrong code long enough to be seen, then clear it for the next try.
      later(() => {
        if (mine !== ticket.current) return;
        setCode("");
        setCodeRejected(false);
        stepEl("code")?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
      }, 900);
    }
  }

  async function sendCode(from: "resend" | "switch") {
    if (busy || !onSendCode) return;
    const mine = ++ticket.current;
    setBusy(from);
    setError(null);
    try {
      await onSendCode(email.trim());
      if (mine !== ticket.current) return;
      setBusy(null);
      setCode("");
      startCooldown();
      setAnnouncement(`We sent a new code to ${email.trim()}`);
      if (from === "switch") go("code");
      else {
        setSent(true);
        later(() => setSent(false), 1600);
      }
    } catch (err) {
      if (mine === ticket.current) fail(from === "switch" ? "password" : "code", messageOf(err, "Couldn’t send a code. Try again in a moment."));
    }
  }

  const back = () => {
    ticket.current++;
    setBusy(null);
    setPassword("");
    setCode("");
    go("email");
    setAnnouncement("");
  };

  const errorFor = (f: FieldName) => (error?.field === f ? error.message : undefined);
  const identity = <Identity email={email.trim()} />;
  const backRow = (right?: React.ReactNode) => (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <TextButton onClick={back} className="group/back">
        <ArrowLeft size={14} className="shrink-0 transition-transform duration-200 ease-out group-hover/back:-translate-x-0.5" />
        Use a different email
      </TextButton>
      {right}
    </div>
  );

  return (
    <div
      ref={card}
      data-step={step}
      className={cn(
        "relative w-full max-w-[360px] overflow-hidden rounded-xl border border-line bg-raised p-5 text-left shadow-[var(--shadow)] sm:p-6",
        className,
      )}
      {...rest}
    >
      <div className="relative">
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          {step === "email" && (
            <Step key="email" direction={dir} reduce={!!reduce} ref={emailRef}>
              <Header title={title} description={description} />
              {providers && (
                <>
                  <div className="flex flex-col gap-2">{providers}</div>
                  <div className="flex items-center gap-3" aria-hidden>
                    <span className="h-px flex-1 bg-line" />
                    <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">or</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                </>
              )}
              <form noValidate onSubmit={submitEmail} aria-busy={busy === "email" || undefined} className="flex flex-col gap-4">
                <Field.Root invalid={!!errorFor("email")} className="flex flex-col gap-1.5">
                  <Field.Label className="w-fit text-[12.5px] font-medium text-fg">Email</Field.Label>
                  <Field.Control
                    data-autofocus
                    type="email"
                    name="email"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="next"
                    placeholder="name@company.com"
                    value={email}
                    readOnly={busy === "email"}
                    onValueChange={(v) => {
                      setEmail(v);
                      if (error?.field === "email") setError(null);
                    }}
                    className={inputClass}
                  />
                  <Message message={errorFor("email")} reduce={!!reduce} />
                </Field.Root>
                <Submit busy={busy === "email"}>Continue</Submit>
              </form>
              {footer && <div className="text-center text-[12.5px] text-fg-3">{footer}</div>}
            </Step>
          )}

          {step === "password" && (
            <Step key="password" direction={dir} reduce={!!reduce} ref={passwordRef}>
              <Header title="Enter your password">{identity}</Header>
              <PasswordForm
                email={email.trim()}
                password={password}
                setPassword={(v) => {
                  setPassword(v);
                  if (error?.field === "password") setError(null);
                }}
                busy={busy === "password"}
                error={errorFor("password")}
                reduce={!!reduce}
                onSubmit={submitPassword}
                onForgot={onForgotPassword ? () => onForgotPassword(email.trim()) : undefined}
              />
              {backRow(
                onSendCode && onCodeSubmit ? (
                  <TextButton onClick={() => sendCode("switch")} aria-busy={busy === "switch" || undefined} className="relative">
                    <span className={cn("transition-opacity duration-150", busy === "switch" && "opacity-0")}>Email me a code</span>
                    {busy === "switch" && (
                      <span className="absolute inset-0 grid place-items-center">
                        <Spinner />
                      </span>
                    )}
                  </TextButton>
                ) : null,
              )}
            </Step>
          )}

          {step === "code" && (
            <Step key="code" direction={dir} reduce={!!reduce} ref={codeRef}>
              <Header title="Check your email" description={`Enter the ${codeLength}-digit code we sent to`}>
                {identity}
              </Header>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  submitCode(code);
                }}
                aria-busy={busy === "code" || undefined}
                className="flex flex-col gap-4"
              >
                <Field.Root invalid={!!errorFor("code")} className="flex flex-col gap-1.5">
                  <Field.Label className="sr-only">Sign-in code</Field.Label>
                  <CodeCells
                    id={`${uid}-code`}
                    length={codeLength}
                    value={code}
                    onChange={(v) => {
                      setCode(v);
                      if (error?.field === "code" && !codeRejected) setError(null);
                    }}
                    onComplete={submitCode}
                    busy={busy === "code"}
                    rejected={codeRejected}
                    reduce={!!reduce}
                  />
                  <Message message={errorFor("code")} reduce={!!reduce} />
                </Field.Root>
                <Submit busy={busy === "code"}>Verify code</Submit>
              </form>
              {backRow(
                onSendCode ? (
                  <Resend remaining={remaining} busy={busy === "resend"} sent={sent} disabled={!!busy && busy !== "resend"} onResend={() => sendCode("resend")} />
                ) : null,
              )}
            </Step>
          )}

          {step === "done" && (
            <Step key="done" direction={dir} reduce={!!reduce} ref={doneRef} className="items-center gap-4 py-3 text-center">
              <DoneMark reduce={!!reduce} />
              <div className="flex max-w-full flex-col items-center gap-1">
                <h2 data-autofocus tabIndex={-1} className="text-[15px] font-medium tracking-[-0.015em] text-fg outline-none">
                  {doneTitle}
                </h2>
                <p className="max-w-full truncate text-[12.5px] text-fg-2" title={email.trim()}>
                  {email.trim()}
                </p>
                {doneDescription && <p className="mt-2 text-[12px] text-fg-3">{doneDescription}</p>}
              </div>
            </Step>
          )}
        </AnimatePresence>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

const inputClass = cn(
  "h-9 w-full min-w-0 rounded-lg border border-line-2 bg-raised px-3 text-base text-fg outline-none sm:text-[13px]",
  "placeholder:text-fg-4 transition-[border-color,box-shadow] duration-150 ease-out",
  "hover:border-fg-4 focus:border-fg-3 focus:ring-3 focus:ring-fg/8",
  "read-only:text-fg-2 data-invalid:border-danger/60 data-invalid:focus:border-danger/80 data-invalid:focus:ring-danger/15",
);

type StepProps = { direction: number; reduce: boolean; className?: string; children: React.ReactNode; ref?: React.Ref<HTMLElement> };

// One step of the flow. Leaving steps go inert at once so a stray click or Tab
// can't land on something already on its way out.
function Step({ direction, reduce, className, children, ref }: StepProps) {
  const present = useIsPresent();
  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: 20 * d, filter: "blur(2px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    // The old step clears out quickly so the two never read as one muddy layer.
    exit: (d: number) =>
      reduce
        ? { opacity: 0, transition: { duration: 0.1 } }
        : { opacity: 0, x: -12 * d, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } },
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
      transition={
        reduce
          ? { duration: 0.15 }
          : { duration: 0.32, ease: ease.out, delay: 0.07, filter: { duration: 0.2, delay: 0.07 } }
      }
      className={cn("flex w-full flex-col gap-5", className)}
    >
      {children}
    </motion.section>
  );
}

function Header({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-balance text-[15px] font-medium leading-5 tracking-[-0.015em] text-fg">{title}</h2>
      {description && <p className="text-pretty text-[12.5px] leading-[18px] text-fg-2">{description}</p>}
      {children && <div className="mt-1.5 flex min-w-0">{children}</div>}
    </div>
  );
}

// The account you're signing in to stays visible on every step after the first.
function Identity({ email }: { email: string }) {
  return (
    <span className="inline-flex h-7 min-w-0 max-w-full items-center gap-2 rounded-full border border-line bg-frame pl-1 pr-3" title={email}>
      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-line-2 text-[10.5px] font-medium uppercase text-fg">
        {email.charAt(0) || "?"}
      </span>
      <span className="min-w-0 truncate text-[12.5px] text-fg">{email}</span>
    </span>
  );
}

function PasswordForm({
  email,
  password,
  setPassword,
  busy,
  error,
  reduce,
  onSubmit,
  onForgot,
}: {
  email: string;
  password: string;
  setPassword: (v: string) => void;
  busy: boolean;
  error?: string;
  reduce: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onForgot?: () => void;
}) {
  const [shown, setShown] = useState(false);
  const { capsLock, onKey, reset } = useCapsLock();
  const EyeIcon = shown ? EyeOff : Eye;
  return (
    <form noValidate onSubmit={onSubmit} aria-busy={busy || undefined} className="flex flex-col gap-4">
      {/* Lets password managers pair the saved password with the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden className="sr-only" />
      <Field.Root invalid={!!error} className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <Field.Label className="w-fit text-[12.5px] font-medium text-fg">Password</Field.Label>
          {onForgot && (
            <button
              type="button"
              onClick={onForgot}
              className="relative -my-1 rounded-sm text-[12px] text-fg-3 outline-none transition-colors duration-150 before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
            >
              Forgot password?
            </button>
          )}
        </div>
        <div className="relative">
          <Field.Control
            data-autofocus
            type={shown ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            value={password}
            readOnly={busy}
            onValueChange={(v) => setPassword(v)}
            onKeyDown={onKey}
            onKeyUp={onKey}
            onBlur={reset}
            className={cn(inputClass, "pr-10")}
          />
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={shown}
            onClick={() => setShown((s) => !s)}
            className={cn(
              "absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-3 outline-none",
              "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92]",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
              "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <span className="relative grid size-4 place-items-center">
              <AnimatePresence initial={false}>
                <motion.span
                  key={shown ? "hide" : "show"}
                  className="absolute inset-0 grid place-items-center"
                  initial={reduce ? { opacity: 0 } : swap.initial}
                  animate={swap.animate}
                  exit={reduce ? { opacity: 0 } : swap.exit}
                  transition={reduce ? { duration: 0.12 } : spring.pop}
                >
                  <EyeIcon />
                </motion.span>
              </AnimatePresence>
            </span>
          </button>
        </div>
        <Message message={error} reduce={reduce} />
        <Collapse open={capsLock && !error} reduce={reduce}>
          <p className="flex items-center gap-1.5 pt-0.5 text-[12px] text-fg-2">
            <CapsGlyph />
            Caps Lock is on
          </p>
        </Collapse>
      </Field.Root>
      <Submit busy={busy}>Sign in</Submit>
    </form>
  );
}

// Height-to-content reveal, so a message pushes the button down smoothly instead of snapping it.
function Collapse({ open, reduce, children }: { open: boolean; reduce: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.16, ease: ease.in } }}
          transition={reduce ? { duration: 0.12, height: { duration: 0 } } : { duration: 0.22, ease: ease.out }}
          className="overflow-hidden"
        >
          <motion.div initial={reduce ? false : { y: -4 }} animate={{ y: 0 }} transition={{ duration: 0.22, ease: ease.out }}>
            {children}
          </motion.div>
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

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      aria-disabled={busy || undefined}
      data-busy={busy ? "" : undefined}
      onClick={(e) => busy && e.preventDefault()}
      className={cn(
        "relative grid h-9 w-full select-none place-items-center rounded-lg bg-fg px-3 text-[13px] font-medium tracking-[-0.005em] text-frame outline-none",
        "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.985] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "data-busy:cursor-default data-busy:bg-fg/85 data-busy:active:scale-100",
      )}
    >
      <span
        className={cn(
          "col-start-1 row-start-1 transition-[opacity,scale,filter] duration-150 ease-out",
          busy && "scale-95 opacity-0 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none",
        )}
      >
        {children}
      </span>
      <span aria-hidden className={cn("col-start-1 row-start-1 grid place-items-center transition-opacity duration-150", busy ? "opacity-100" : "opacity-0")}>
        {busy && <Spinner />}
      </span>
      {busy && <span className="sr-only">Working…</span>}
    </button>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin [animation-duration:0.7s] motion-reduce:[animation-duration:1.6s]!">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M13.75 8A5.75 5.75 0 0 0 8 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TextButton({ className, children, ...rest }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "-mx-1.5 inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[12.5px] text-fg-2 outline-none",
        "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97]",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "disabled:pointer-events-none disabled:text-fg-3",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// The resend control lives in one fixed-width cell, so the countdown, "Sending…" and "Code sent" swap without moving the row.
function Resend({ remaining, busy, sent, disabled, onResend }: { remaining: number; busy: boolean; sent: boolean; disabled: boolean; onResend: () => void }) {
  const reduce = useReducedMotion();
  const state = busy ? "busy" : sent ? "sent" : remaining > 0 ? "wait" : "ready";
  const labels = ["Resend in 0:00", "Resend code", "Sending…", "Code sent"];
  return (
    <TextButton
      onClick={onResend}
      disabled={disabled || state !== "ready"}
      aria-busy={busy || undefined}
      aria-label={state === "wait" ? `Resend code, available in ${remaining} seconds` : undefined}
      className="justify-end disabled:text-fg-3"
    >
      <span className="grid justify-items-end">
        {labels.map((l) => (
          <span key={l} aria-hidden className="invisible col-start-1 row-start-1 tabular">
            {l}
          </span>
        ))}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={state}
            className="col-start-1 row-start-1 inline-flex items-center gap-1 tabular"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12 } }}
            transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
          >
            {state === "wait" && (
              <span>
                Resend in 0:
                <NumberFlow value={remaining} format={{ minimumIntegerDigits: 2 }} trend={-1} animated={!reduce} />
              </span>
            )}
            {state === "ready" && "Resend code"}
            {state === "busy" && "Sending…"}
            {state === "sent" && (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-success">
                  <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }} />
                </svg>
                Code sent
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </TextButton>
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
  const group = length % 3 === 0 && length > 3 ? 3 : length % 4 === 0 && length > 4 ? 4 : 0;
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
        const caret = active === i && !char && !busy;
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
                  "transition-[border-color,background-color,box-shadow] duration-150 ease-out",
                  rejected
                    ? "border-danger/60 bg-danger-soft"
                    : cn("hover:border-fg-4 focus:border-fg-3 focus:ring-3 focus:ring-fg/8", char ? "border-fg-4" : "border-line-2"),
                  "read-only:cursor-default",
                )}
              />
              <span aria-hidden className={cn("pointer-events-none absolute inset-0 grid place-items-center text-[17px] font-medium tabular", rejected ? "text-danger" : "text-fg")}>
                <AnimatePresence initial={false}>
                  {char && (
                    <motion.span
                      key={char + i}
                      className="col-start-1 row-start-1"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.85, filter: "blur(2px)" }}
                      animate={
                        busy && !reduce
                          ? { opacity: [1, 0.35, 1], y: 0, scale: 1, filter: "blur(0px)" }
                          : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
                      }
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
                {caret && <span className="col-start-1 row-start-1 h-5 w-px animate-caret bg-fg" />}
              </span>
            </div>
          </Fragment>
        );
      })}
    </OTPField.Root>
  );
}

function DoneMark({ reduce }: { reduce: boolean }) {
  const draw = (delay: number) =>
    reduce
      ? { initial: false as const }
      : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 0.4, ease: ease.out, delay, opacity: { duration: 0.01, delay } } };
  return (
    <motion.span
      aria-hidden
      className="grid size-11 place-items-center rounded-full bg-success-soft text-success"
      initial={reduce ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={spring.bouncy}
    >
      <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        <motion.path d="M4 8.4 6.8 11.2 12 5" {...draw(0.12)} />
      </svg>
    </motion.span>
  );
}

function CapsGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-warning">
      <path d="M8 2.75 3.25 7.75h2.5v3h4.5v-3h2.5z" />
      <path d="M5.75 13.25h4.5" />
    </svg>
  );
}
