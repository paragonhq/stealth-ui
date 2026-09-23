"use client";
import { Form } from "@base-ui/react/form";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowLeft, Pencil } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type MultiStepFormStepDef = {
  id: string;
  /** The step's heading. */
  title: string;
  /** A shorter name for the progress track, e.g. "Team" for "Invite your team". */
  label?: string;
  description?: string;
};
export type MultiStepFormValues = Record<string, FormDataEntryValue | FormDataEntryValue[]>;
type Status = "idle" | "checking" | "submitting" | "done" | "error";
type ContinueHandler = (values: MultiStepFormValues) => boolean | void | Promise<boolean | void>;

type Ctx = {
  steps: MultiStepFormStepDef[];
  index: number;
  furthest: number;
  returnTo: number | null;
  status: Status;
  values: MultiStepFormValues;
  labels: Required<MultiStepFormLabels>;
  requestStep: (i: number) => void;
  back: () => void;
  edit: (id: string) => void;
  registerStep: (id: string, el: HTMLElement | null) => void;
  registerHandler: (id: string, fn: ContinueHandler | undefined) => void;
  stepEl: (i: number) => HTMLElement | undefined;
  takeFocus: () => boolean;
};
const MultiStepContext = createContext<Ctx | null>(null);

/** The form's state, for parts you compose yourself (a custom review, a step counter). */
export function useMultiStepForm() {
  const ctx = useContext(MultiStepContext);
  if (!ctx) throw new Error("useMultiStepForm must be used inside <MultiStepForm>");
  return ctx;
}

export type MultiStepFormLabels = {
  back?: string;
  continue?: string;
  backToReview?: string;
  submit?: string;
  submitting?: string;
  done?: string;
  error?: string;
};

export type MultiStepFormProps = Omit<React.ComponentProps<"form">, "onSubmit" | "children"> & {
  steps: MultiStepFormStepDef[];
  /** The current step's id, when you control it. */
  step?: string;
  defaultStep?: string;
  onStepChange?: (id: string) => void;
  /** Runs after every step validates. Return or resolve to finish; throw to show the error line. */
  onComplete?: (values: MultiStepFormValues) => void | Promise<void>;
  labels?: MultiStepFormLabels;
  children: React.ReactNode;
};

const defaultLabels: Required<MultiStepFormLabels> = {
  back: "Back",
  continue: "Continue",
  backToReview: "Back to review",
  submit: "Submit",
  submitting: "Submitting…",
  done: "Done",
  error: "Couldn’t submit. Check your connection and try again.",
};

/**
 * One native form across every step. Steps stay mounted (hidden when inactive), so
 * values, touched state and errors survive going back and forth, and the final
 * submit sees every field. Continue validates only the current step's fields.
 */
export function MultiStepForm({
  steps,
  step: stepProp,
  defaultStep,
  onStepChange,
  onComplete,
  labels: labelsProp,
  className,
  children,
  ref,
  ...rest
}: MultiStepFormProps) {
  const [stepId, setStepId] = useControllableState({ value: stepProp, defaultValue: defaultStep ?? steps[0]?.id ?? "", onChange: onStepChange });
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const [furthest, setFurthest] = useState(index);
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [values, setValues] = useState<MultiStepFormValues>({});
  const labels = { ...defaultLabels, ...labelsProp };

  const form = useRef<HTMLFormElement | null>(null);
  const actions = useRef<Form.Actions | null>(null);
  const stepEls = useRef(new Map<string, HTMLElement>());
  const handlers = useRef(new Map<string, ContinueHandler>());
  const busy = useRef(false);
  const focusNext = useRef(false);

  const setFormRef = useCallback(
    (node: HTMLFormElement | null) => {
      form.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const snapshot = useCallback((): MultiStepFormValues => {
    if (!form.current) return {};
    const data = new FormData(form.current);
    const out: MultiStepFormValues = {};
    for (const key of new Set(data.keys())) {
      const all = data.getAll(key);
      out[key] = all.length > 1 ? all : all[0];
    }
    return out;
  }, []);

  const go = (i: number) => {
    const target = steps[i];
    if (!target || i === index) return;
    setValues(snapshot());
    setFurthest((f) => Math.max(f, i));
    if (returnTo === i) setReturnTo(null);
    if (status === "error") setStatus("idle");
    // Focus follows the step only when the person moved it, never on mount or from props.
    focusNext.current = !!form.current?.contains(document.activeElement);
    setStepId(target.id);
  };

  // Validates one step: asks Base UI to show each named field's error, then reads the
  // browser's verdict. Focuses the first invalid control when the step is on screen.
  const validateStep = async (i: number, focus: boolean, withHandler = true) => {
    const def = steps[i];
    const el = def && stepEls.current.get(def.id);
    if (!el) return true;
    const controls = [...el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")].filter(
      (c) => !c.disabled && c.name,
    );
    for (const name of new Set(controls.map((c) => c.name))) actions.current?.validate(name);
    const invalid = controls.find((c) => !c.checkValidity());
    if (invalid) {
      if (focus) {
        invalid.focus();
        if (invalid instanceof HTMLInputElement && /^(text|email|search|tel|url)$/.test(invalid.type)) invalid.select();
      }
      return false;
    }
    const handler = withHandler ? handlers.current.get(def.id) : undefined;
    if (!handler) return true;
    const result = handler(snapshot());
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setStatus("checking");
      try {
        const ok = await result;
        return ok !== false;
      } catch {
        return false;
      } finally {
        setStatus("idle");
      }
    }
    return result !== false;
  };

  const advance = async () => {
    if (busy.current || status === "done") return;
    busy.current = true;
    try {
      if (!(await validateStep(index, true))) return;
      const last = steps.length - 1;
      if (index < last) {
        go(returnTo ?? index + 1);
        return;
      }
      // Final submit: every earlier step must still hold. Send the person to the first that doesn't.
      for (let i = 0; i < last; i++) {
        // Fields only: each step's own server check already passed when it was left.
        if (!(await validateStep(i, false, false))) {
          go(i);
          return;
        }
      }
      setStatus("submitting");
      try {
        await onComplete?.(snapshot());
        setStatus("done");
      } catch {
        setStatus("error");
      }
    } finally {
      busy.current = false;
    }
  };

  const requestStep = async (i: number) => {
    if (i <= index) return go(i);
    if (i > furthest || busy.current) return;
    busy.current = true;
    try {
      if (await validateStep(index, true)) go(i);
    } finally {
      busy.current = false;
    }
  };

  // Stable, because steps and content read them inside effects.
  const registerStep = useCallback((id: string, el: HTMLElement | null) => {
    if (el) stepEls.current.set(id, el);
    else stepEls.current.delete(id);
  }, []);
  const registerHandler = useCallback((id: string, fn: ContinueHandler | undefined) => {
    if (fn) handlers.current.set(id, fn);
    else handlers.current.delete(id);
  }, []);
  const stepEl = useCallback((i: number) => (steps[i] ? stepEls.current.get(steps[i].id) : undefined), [steps]);
  const takeFocus = useCallback(() => {
    const f = focusNext.current;
    focusNext.current = false;
    return f;
  }, []);

  const ctx: Ctx = {
    steps,
    index,
    furthest,
    returnTo,
    status,
    values,
    labels,
    requestStep: (i) => void requestStep(i),
    back: () => go(index - 1),
    edit: (id) => {
      const i = steps.findIndex((s) => s.id === id);
      if (i < 0) return;
      setReturnTo(index);
      go(i);
    },
    registerStep,
    registerHandler,
    stepEl,
    takeFocus,
  };

  return (
    <MultiStepContext value={ctx}>
      <Form
        ref={setFormRef}
        actionsRef={actions}
        data-status={status}
        // Every submit (the Continue button, Enter in a field) is handled here, so
        // Base UI never validates the steps that aren't on screen.
        onSubmitCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void advance();
        }}
        className={cn("flex w-full flex-col gap-5", className)}
        {...rest}
      >
        {children}
      </Form>
    </MultiStepContext>
  );
}

export type MultiStepFormProgressProps = React.ComponentProps<"nav">;

/** Step count, a segmented track that fills as you go, and labels you can press to go back. */
export function MultiStepFormProgress({ className, ...rest }: MultiStepFormProgressProps) {
  const { steps, index, furthest, requestStep, status } = useMultiStepForm();
  const reduce = useReducedMotion();
  const locked = status === "submitting" || status === "done";
  return (
    <nav aria-label="Progress" className={cn("@container/progress flex flex-col gap-2.5", className)} {...rest}>
      <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
        Step <NumberFlow value={index + 1} className="tabular text-fg-2" /> of {steps.length}
      </p>
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => {
          const state = i < index ? "complete" : i === index ? "current" : i <= furthest ? "visited" : "upcoming";
          const reachable = !locked && i !== index && i <= furthest;
          return (
            <li key={s.id} className="min-w-0">
              <button
                type="button"
                data-state={state}
                disabled={!reachable}
                aria-current={i === index ? "step" : undefined}
                onClick={() => requestStep(i)}
                className={cn(
                  "group/seg relative flex w-full min-w-0 flex-col gap-2 rounded-md text-left outline-none",
                  "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
                  "disabled:cursor-default enabled:active:scale-[0.98] transition-[scale] duration-100",
                  "before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']",
                )}
              >
                <span className="relative h-1 overflow-hidden rounded-full bg-fg/10">
                  <motion.span
                    className="absolute inset-0 origin-left rounded-full bg-fg"
                    initial={false}
                    animate={{ scaleX: i <= index ? 1 : 0, opacity: i < index ? 0.55 : 1 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.42, ease: ease.inOut, delay: i === index ? 0.08 : 0 }}
                  />
                </span>
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1 text-[11.5px] transition-colors duration-150",
                    state === "current" && "font-medium text-fg",
                    (state === "complete" || state === "visited") && "text-fg-2 group-enabled/seg:group-hover/seg:text-fg",
                    state === "upcoming" && "text-fg-4",
                    // In a narrow form only the current label shows; the rest stay readable to screen readers.
                    state !== "current" && "@max-[22rem]/progress:sr-only",
                  )}
                >
                  <AnimatePresence initial={false}>
                    {state === "complete" && (
                      <motion.svg
                        key="tick"
                        width="12"
                        height="12"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        className="shrink-0 text-fg-2"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, width: 0, marginRight: -4 }}
                        animate={{ opacity: 1, width: 12, marginRight: 0 }}
                        exit={{ opacity: 0, width: 0, marginRight: -4, transition: { duration: 0.14 } }}
                        transition={reduce ? { duration: 0.15 } : spring.snappy}
                      >
                        <motion.path
                          d="M3.5 8.5 6.5 11.5 12.5 4.5"
                          initial={reduce ? false : { pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.3, ease: ease.out, delay: 0.12 }}
                        />
                      </motion.svg>
                    )}
                  </AnimatePresence>
                  <span className="truncate">{s.label ?? s.title}</span>
                  {state === "complete" && <span className="sr-only">, done</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export type MultiStepFormContentProps = React.ComponentProps<"div">;

/** Holds the steps. Its height glides between steps while the content slides the way you're going. */
export function MultiStepFormContent({ className, children, ...rest }: MultiStepFormContentProps) {
  const { index, stepEl } = useMultiStepForm();
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const settled = useRef(0);
  const moving = useRef<AnimationPlaybackControls | null>(null);
  const first = useRef(true);

  // At rest the height is auto (errors can grow a step freely); remember it for the next move.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!moving.current) settled.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = box.current;
    const target = stepEl(index);
    if (first.current) {
      first.current = false;
      return;
    }
    if (!el || !target || reduce) return;
    // Interrupted mid-move: start from wherever the height is now.
    const from = moving.current ? el.offsetHeight : settled.current;
    moving.current?.stop();
    const to = target.offsetHeight;
    el.dataset.moving = "";
    const controls = animate(el, { height: [from, to] }, { duration: 0.34, ease: ease.inOut });
    moving.current = controls;
    controls.then(() => {
      if (moving.current !== controls) return;
      moving.current = null;
      el.style.height = "";
      delete el.dataset.moving;
      settled.current = el.offsetHeight;
    });
  }, [index, stepEl, reduce]);

  return (
    <div ref={box} className={cn("grid data-moving:overflow-hidden", className)} {...rest}>
      {children}
    </div>
  );
}

export type MultiStepFormStepProps = Omit<React.ComponentProps<"section">, "id"> & {
  id: string;
  /** Runs after the step's fields pass. Return false (or resolve false) to stay, e.g. after a server check. */
  onContinue?: ContinueHandler;
  /** Hide the built-in title and description, when the step renders its own. */
  hideHeader?: boolean;
};

export function MultiStepFormStep({ id, onContinue, hideHeader = false, className, children, ...rest }: MultiStepFormStepProps) {
  const ctx = useMultiStepForm();
  const { steps, index, registerStep, registerHandler, takeFocus } = ctx;
  const reduce = useReducedMotion();
  const mine = steps.findIndex((s) => s.id === id);
  const def = steps[mine];
  const active = mine === index;
  const heading = useRef<HTMLHeadingElement>(null);

  // Mounted always, displayed only while active or leaving.
  const [shown, setShown] = useState(active);
  if (active && !shown) setShown(true);

  useEffect(() => {
    registerHandler(id, onContinue);
    return () => registerHandler(id, undefined);
  }, [id, onContinue, registerHandler]);

  useEffect(() => {
    if (active && takeFocus()) heading.current?.focus({ preventScroll: true });
  }, [active, takeFocus]);

  const side = mine < index ? -1 : mine > index ? 1 : 0;
  const titleId = `${id}-step-title`;

  return (
    <motion.section
      ref={(el: HTMLElement | null) => registerStep(id, el)}
      aria-labelledby={hideHeader ? undefined : titleId}
      hidden={!shown}
      inert={!active}
      data-state={active ? "active" : "inactive"}
      initial={false}
      // The same values render on the server and the client; reduced motion only zeroes the travel's duration.
      animate={{ x: side * 28, opacity: active ? 1 : 0, filter: active ? "blur(0px)" : "blur(2px)" }}
      transition={
        reduce
          ? { duration: 0.15, x: { duration: 0 }, filter: { duration: 0 } }
          : active
            ? { duration: 0.34, ease: ease.out, delay: 0.04 }
            : { duration: 0.2, ease: ease.in }
      }
      onAnimationComplete={() => {
        if (!active) setShown(false);
      }}
      className={cn("col-start-1 row-start-1 flex min-w-0 flex-col gap-4 self-start", className)}
      {...(rest as object)}
    >
      {!hideHeader && def && (
        <header className="flex flex-col gap-0.5">
          <h3 ref={heading} id={titleId} tabIndex={-1} className="text-[14px] font-medium tracking-[-0.015em] text-fg outline-none [text-wrap:balance]">
            {def.title}
          </h3>
          {def.description && <p className="text-[12px] leading-[1.45] text-fg-3 [text-wrap:pretty]">{def.description}</p>}
        </header>
      )}
      {children}
    </motion.section>
  );
}

export type MultiStepFormActionsProps = React.ComponentProps<"div">;

/** Back and Continue. Continue becomes Back to review after an edit, and the submit label on the last step. */
export function MultiStepFormActions({ className, ...rest }: MultiStepFormActionsProps) {
  const { index, steps, back, returnTo, status, labels } = useMultiStepForm();
  const reduce = useReducedMotion();
  const last = index === steps.length - 1;
  const locked = status === "submitting" || status === "done";
  const label =
    status === "submitting" ? labels.submitting : status === "done" ? labels.done : last ? labels.submit : returnTo != null ? labels.backToReview : labels.continue;
  const glyph = status === "submitting" || status === "checking" ? "spin" : status === "done" ? "tick" : null;

  return (
    <div className={cn("flex flex-col gap-3", className)} {...rest}>
      <AnimatePresence initial={false}>
        {status === "error" && (
          <motion.p
            role="alert"
            className="overflow-hidden text-[12px] leading-[1.45] text-danger"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
          >
            {labels.error}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={back}
          inert={index === 0 || locked}
          className={cn(
            "group/back relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-2 outline-none",
            "transition-[background-color,color,opacity,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
            "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
            (index === 0 || locked) && "pointer-events-none opacity-0",
          )}
        >
          <ArrowLeft size={14} className="-ml-0.5 transition-transform duration-200 ease-out-expo group-hover/back:-translate-x-0.5" />
          {labels.back}
        </button>
        <ContinueButton label={label} glyph={glyph} busy={status === "submitting" || status === "checking"} done={status === "done"} />
      </div>
    </div>
  );
}

// The primary button's width glides between "Continue" and the longer submit label,
// while the label itself slides and the spinner or tick takes its place in front.
function ContinueButton({ label, glyph, busy, done }: { label: string; glyph: "spin" | "tick" | null; busy: boolean; done: boolean }) {
  const reduce = useReducedMotion();
  const sizer = useRef<HTMLSpanElement>(null);
  // -1 until measured, so the first paint is simply auto.
  const width = useMotionValue(-1);
  const cssWidth = useTransform(width, (w) => (w < 0 ? "auto" : w));
  useLayoutEffect(() => {
    const w = sizer.current?.offsetWidth;
    if (!w) return;
    if (width.get() < 0 || reduce) width.set(w);
    else animate(width, w, spring.snappy);
  }, [label, glyph, width, reduce]);

  const content = (
    <>
      {glyph && (
        <span className="grid size-4 place-items-center">
          {glyph === "spin" ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden className="animate-spin [animation-duration:0.75s]">
              <circle cx="8" cy="8" r="5.75" opacity="0.25" />
              <path d="M8 2.25a5.75 5.75 0 0 1 5.75 5.75" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.08 }} />
            </svg>
          )}
        </span>
      )}
      <span>{label}</span>
    </>
  );

  return (
    <>
      <button
        type="submit"
        aria-busy={busy || undefined}
        aria-disabled={busy || done || undefined}
        className={cn(
          "relative inline-flex h-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame shadow-[var(--shadow)] outline-none",
          "transition-[background-color,scale] duration-150 ease-out focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
          busy || done ? "bg-fg/85" : "hover:bg-fg/90 active:scale-[0.97] active:duration-75",
        )}
      >
        <motion.span className="relative block h-5" style={{ width: cssWidth }}>
          <span ref={sizer} aria-hidden className="invisible absolute left-0 top-0 inline-flex h-5 items-center gap-1.5 whitespace-nowrap">
            {content}
          </span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={`${label}-${glyph}`}
              className="absolute inset-0 flex items-center justify-center gap-1.5 whitespace-nowrap"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.24, ease: ease.out }}
            >
              {content}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {busy ? label : done ? label : ""}
      </span>
    </>
  );
}

export type MultiStepFormSummaryItem = { step: string; label: string; value: React.ReactNode };
export type MultiStepFormSummaryProps = React.ComponentProps<"div"> & {
  items: MultiStepFormSummaryItem[];
  /** Shown for values that are empty. */
  emptyValue?: React.ReactNode;
};

/** The review: answers grouped by step, each group with an Edit that returns here when done. */
export function MultiStepFormSummary({ items, emptyValue = "Not set", className, ...rest }: MultiStepFormSummaryProps) {
  const { steps, edit, status } = useMultiStepForm();
  const groups = steps.map((s) => ({ step: s, rows: items.filter((it) => it.step === s.id) })).filter((g) => g.rows.length);
  const locked = status === "submitting" || status === "done";
  return (
    <div className={cn("flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-raised", className)} {...rest}>
      {groups.map(({ step, rows }) => (
        <section key={step.id} aria-label={step.title} className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">{step.label ?? step.title}</h4>
            <button
              type="button"
              disabled={locked}
              onClick={() => edit(step.id)}
              aria-label={`Edit ${(step.label ?? step.title).toLowerCase()}`}
              className={cn(
                "group/edit relative -my-1 -mr-1.5 inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] text-fg-2 outline-none",
                "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.95] active:duration-75 disabled:opacity-50",
                "focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
                "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              <Pencil size={12} className="transition-transform duration-200 ease-out-expo group-hover/edit:-rotate-12" />
              Edit
            </button>
          </div>
          <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1 text-[12.5px]">
            {rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="truncate text-fg-3">{r.label}</dt>
                <dd className="min-w-0 break-words text-fg">{r.value === "" || r.value == null ? <span className="text-fg-4">{emptyValue}</span> : r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
