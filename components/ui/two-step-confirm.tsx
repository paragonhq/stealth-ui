"use client";
import { Button } from "@base-ui/react/button";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

type Step = "idle" | "confirm" | "done";

export type TwoStepConfirmProps = Omit<React.ComponentProps<"button">, "children" | "onClick"> & {
  /** The first-step label, a verb: "Delete". */
  children: React.ReactNode;
  /** The second step asks, naming the action: "Confirm delete?". */
  confirmLabel?: string;
  confirmedLabel?: string;
  /** Called on the second press. */
  onConfirm: () => void;
  /** Milliseconds the confirm step waits before reverting on its own. Paused while hovered. */
  timeout?: number;
  /** Milliseconds the confirmed state shows before returning to rest. `null` keeps it. */
  resetAfter?: number | null;
  icon?: React.ReactNode;
  variant?: "secondary" | "ghost";
  size?: "sm" | "md";
  /** Fires when the confirm step opens or closes, so you can dim the row or show more context. */
  onArmedChange?: (armed: boolean) => void;
};

// A second press closer than this to the first is a double-click, not a decision.
const DOUBLE_CLICK_GUARD = 350;

export function TwoStepConfirm({
  children,
  confirmLabel = "Confirm",
  confirmedLabel = "Done",
  onConfirm,
  timeout = 3000,
  resetAfter = 1500,
  icon,
  variant = "secondary",
  size = "md",
  onArmedChange,
  disabled,
  className,
  ref,
  onBlur,
  onKeyDown,
  onPointerEnter,
  onPointerLeave,
  ...rest
}: TwoStepConfirmProps) {
  const [step, setStep] = useState<Step>("idle");
  const [widths, setWidths] = useState<Record<Step, number> | null>(null);
  const reduce = useReducedMotion();
  const sizers = useRef<HTMLSpanElement>(null);
  const countdown = useMotionValue(1);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const armedAt = useRef(0);
  const timer = useRef<number>(undefined);

  // Measure each step's natural width so the button can spring between them.
  useEffect(() => {
    const el = sizers.current;
    if (!el) return;
    const read = () => {
      const [a, b, c] = Array.from(el.children) as HTMLElement[];
      setWidths({ idle: a.offsetWidth, confirm: b.offsetWidth, done: c.offsetWidth });
    };
    const ro = new ResizeObserver(read);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      anim.current?.stop();
      window.clearTimeout(timer.current);
    },
    [],
  );

  const hovered = useRef(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const armed = useRef(false);
  const go = (next: Step) => {
    const now = next === "confirm";
    if (armed.current !== now) {
      armed.current = now;
      onArmedChange?.(now);
    }
    setStep(next);
  };

  const disarm = () => {
    anim.current?.stop();
    go("idle");
  };

  const arm = () => {
    armedAt.current = performance.now();
    go("confirm");
    countdown.set(1);
    anim.current?.stop();
    anim.current = animate(countdown, 0, { duration: timeout / 1000, ease: "linear", onComplete: disarm });
    // The press that armed it left the pointer on the button: start paused.
    if (hovered.current) anim.current.pause();
  };

  const commit = () => {
    anim.current?.stop();
    go("done");
    onConfirm();
    window.clearTimeout(timer.current);
    if (resetAfter != null) timer.current = window.setTimeout(() => go("idle"), resetAfter);
  };

  // A press anywhere else answers "no". Blur covers keyboard; this covers
  // browsers that don't focus a button on click.
  useEffect(() => {
    if (step !== "confirm") return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        anim.current?.stop();
        armed.current = false;
        onArmedChange?.(false);
        setStep("idle");
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [step, onArmedChange]);

  const sizeCls = size === "sm" ? "h-7 rounded-md px-2.5 text-[12px]" : "h-8 rounded-lg px-3 text-[12.5px]";
  const labels: Record<Step, React.ReactNode> = { idle: children, confirm: confirmLabel, done: confirmedLabel };
  const glyphs: Record<Step, React.ReactNode> = { idle: icon, confirm: null, done: <Tick reduce={!!reduce} /> };

  return (
    <span ref={wrap} className="relative inline-flex shrink-0 align-middle">
      {/* Invisible copies of each step, measured for the width spring. */}
      <span ref={sizers} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex w-max whitespace-nowrap">
        {(["idle", "confirm", "done"] as const).map((k) => (
          <span key={k} className={cn("inline-flex shrink-0 items-center border font-medium tracking-[-0.005em]", sizeCls)}>
            <Row glyph={glyphs[k] ? <span /> : null} size={size}>{labels[k]}</Row>
          </span>
        ))}
      </span>

      <Button
        ref={ref as React.Ref<HTMLElement>}
        type="button"
        data-state={step}
        data-size={size}
        data-variant={variant}
        disabled={disabled}
        render={
          <motion.button
            initial={false}
            animate={widths ? { width: widths[step] } : undefined}
            transition={reduce ? { duration: 0 } : spring.snappy}
          />
        }
        onClick={() => {
          if (step === "idle") arm();
          else if (step === "confirm" && performance.now() - armedAt.current > DOUBLE_CLICK_GUARD) commit();
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
          onKeyDown?.(e);
          if (e.key === "Escape" && step === "confirm") {
            e.stopPropagation();
            disarm();
          }
        }}
        onBlur={(e: React.FocusEvent<HTMLButtonElement>) => {
          onBlur?.(e);
          if (step === "confirm") disarm();
        }}
        // Reading the question shouldn't cost you the chance to answer it.
        onPointerEnter={(e: React.PointerEvent<HTMLButtonElement>) => {
          onPointerEnter?.(e);
          hovered.current = true;
          anim.current?.pause();
        }}
        onPointerLeave={(e: React.PointerEvent<HTMLButtonElement>) => {
          onPointerLeave?.(e);
          hovered.current = false;
          if (step === "confirm") anim.current?.play();
        }}
        className={cn(
          "group/two relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden whitespace-nowrap border font-medium tracking-[-0.005em]",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,scale,box-shadow] duration-150 ease-out active:scale-[0.97] active:duration-75",
          sizeCls,
          step === "confirm"
            ? "border-danger bg-danger text-frame shadow-[var(--shadow)] hover:bg-danger/90"
            : step === "done"
              ? variant === "ghost" ? "border-transparent text-fg-2" : "border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)]"
              : variant === "ghost"
                ? "border-transparent text-fg-2 hover:bg-hover hover:text-fg"
                : "border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        {...rest}
      >
        <span className="sr-only">{labels[step]}</span>
        <span aria-hidden className="grid place-items-center">
          <AnimatePresence initial={false}>
            <motion.span
              key={step}
              className="col-start-1 row-start-1 flex"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -8, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
            >
              <Row glyph={glyphs[step]} size={size}>{labels[step]}</Row>
            </motion.span>
          </AnimatePresence>
        </span>

        {/* How long the question stays open: a hairline that drains, and stops while you read. */}
        {step === "confirm" && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-frame/35"
            style={{ scaleX: countdown }}
          />
        )}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {step === "confirm" ? `${confirmLabel} Press again to confirm, or Escape to cancel.` : step === "done" ? confirmedLabel : ""}
      </span>
    </span>
  );
}

function Row({ glyph, size, children }: { glyph: React.ReactNode; size: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center", size === "sm" ? "gap-1.5" : "gap-2")}>
      {glyph && <span className={cn("grid shrink-0 place-items-center", size === "sm" ? "size-3.5 [&_svg]:size-3.5" : "size-4")}>{glyph}</span>}
      <span>{children}</span>
    </span>
  );
}

function Tick({ reduce }: { reduce: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: ease.out, delay: 0.06 }}
      />
    </svg>
  );
}
