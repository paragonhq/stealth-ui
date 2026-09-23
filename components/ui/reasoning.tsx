"use client";
import { Collapsible } from "@base-ui/react/collapsible";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ShimmerText } from "@/components/ui/shimmer-text";
import { cn } from "@/lib/cn";
import { ChevronRight } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/** Seconds since `running` last became true, ticking while it stays true and frozen after. */
export function useThinkingTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const started = useRef(0);

  useEffect(() => {
    if (!running) return;
    started.current = performance.now();
    // Measured from the start, not counted, so a throttled background tab stays accurate.
    const tick = () => setSeconds((performance.now() - started.current) / 1000);
    const id = window.setInterval(tick, 250);
    const raf = requestAnimationFrame(tick);
    return () => {
      window.clearInterval(id);
      cancelAnimationFrame(raf);
      tick();
    };
  }, [running]);

  return seconds;
}

export type ReasoningProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The reasoning text, or a node that renders it (a streaming text component). Leave empty when the model shows none. */
  children?: React.ReactNode;
  /** The model is thinking right now. */
  streaming?: boolean;
  /** Seconds it thought for, when you already know (a message from history). Otherwise it is measured. */
  duration?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Open while thinking and fold away when it finishes, unless the person has opened, closed or scrolled it themselves. */
  autoCollapse?: boolean;
  /** Label while thinking. */
  thinkingLabel?: string;
};

const formatSpoken = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m} minute${m === 1 ? "" : "s"}${r ? ` ${r} second${r === 1 ? "" : "s"}` : ""}` : `${r} second${r === 1 ? "" : "s"}`;
};

/**
 * A model's thinking, collapsed to one line: "Thinking…" with a timer while it
 * runs, "Thought for 12s" after. It opens to show the reasoning stream and folds
 * itself away when the answer starts, unless the reader took it over.
 */
export function Reasoning({
  children,
  streaming = false,
  duration,
  open: openProp,
  defaultOpen,
  onOpenChange,
  autoCollapse = true,
  thinkingLabel = "Thinking…",
  className,
  ...rest
}: ReasoningProps) {
  const reduce = useReducedMotion();
  const hasContent = children != null && children !== false && children !== "";
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen ?? (autoCollapse && streaming && hasContent), onChange: onOpenChange });
  const measured = useThinkingTimer(streaming);
  const seconds = duration ?? measured;
  const whole = streaming ? Math.floor(seconds) : Math.max(1, Math.round(seconds));
  const known = streaming || duration != null || measured > 0;
  const showTimer = known && (!streaming || whole >= 2);

  // Who is in charge of open: us, until the reader toggles or scrolls it. A new
  // round of thinking hands control back.
  const [touched, setTouched] = useState(false);
  const [prevStreaming, setPrevStreaming] = useState(streaming);
  if (prevStreaming !== streaming) {
    setPrevStreaming(streaming);
    if (streaming) setTouched(false);
  }
  const auto = autoCollapse && !touched;
  const want = streaming && hasContent;
  useEffect(() => {
    if (auto && open !== want) setOpen(want);
  }, [auto, want, open, setOpen]);

  const label = streaming ? thinkingLabel : known ? "Thought for" : "Reasoning";
  const spoken = streaming ? `${thinkingLabel.replace(/…$/, "")}${showTimer ? `, ${formatSpoken(whole)}` : ""}` : known ? `Thought for ${formatSpoken(whole)}` : "Reasoning";

  // Label and timer share a baseline; the digits' box is taller than the text's.
  const line = (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <ShimmerText active={streaming} className={cn("min-w-0 transition-colors duration-150", streaming ? "text-fg-2" : "text-fg-3 group-hover/reasoning:text-fg-2")}>
        {label}
      </ShimmerText>
      <AnimatePresence initial={false}>
        {showTimer && (
          <motion.span
            key="timer"
            aria-hidden
            initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.24, ease: ease.out }}
            className={cn("tabular transition-colors duration-150", streaming ? "text-fg-3" : "text-fg-3 group-hover/reasoning:text-fg-2")}
          >
            <Elapsed seconds={whole} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );

  return (
    <Collapsible.Root
      open={hasContent && open}
      onOpenChange={(next) => {
        setTouched(true);
        setOpen(next);
      }}
      disabled={!hasContent}
      data-state={streaming ? "thinking" : "done"}
      className={cn("flex min-w-0 flex-col", className)}
      {...rest}
    >
      {hasContent ? (
        <Collapsible.Trigger
          aria-label={spoken}
          className={cn(
            "group/reasoning relative -mx-1.5 inline-flex h-7 max-w-full cursor-default select-none items-center gap-1.5 self-start rounded-md px-1.5 text-[13px]",
            "outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-hover active:scale-[0.98] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
          )}
        >
          {line}
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 text-fg-4 transition-[rotate,color] duration-200 ease-out-expo group-hover/reasoning:text-fg-3 motion-reduce:transition-none",
              "group-data-panel-open/reasoning:rotate-90",
            )}
          />
        </Collapsible.Trigger>
      ) : (
        // The model shared nothing to read: just the elapsed line, nothing to open.
        <div className="inline-flex h-7 max-w-full items-center gap-1.5 self-start text-[13px]">
          <span aria-hidden className="contents">
            {line}
          </span>
          <span className="sr-only">{spoken}</span>
        </div>
      )}

      {hasContent && (
        <Collapsible.Panel
          keepMounted
          className={cn(
            "h-(--collapsible-panel-height) overflow-hidden [&[hidden]:not([hidden='until-found'])]:hidden",
            "transition-[height,opacity] duration-240 ease-in-out-quart data-ending-style:duration-180",
            "data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0",
            "motion-reduce:transition-[opacity] motion-reduce:duration-150",
          )}
        >
          <ReasoningBody streaming={streaming} onReaderScroll={() => setTouched(true)}>
            {children}
          </ReasoningBody>
        </Collapsible.Panel>
      )}

      <span role="status" className="sr-only">
        {!streaming && measured > 0 && duration == null ? `Finished thinking after ${formatSpoken(whole)}` : ""}
      </span>
    </Collapsible.Root>
  );
}

/** "12s", "1m 4s". Digits roll as they change. */
function Elapsed({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <NumberFlowGroup>
      <span className="inline-flex items-baseline gap-[0.25em]">
        {m > 0 && <NumberFlow value={m} suffix="m" />}
        <NumberFlow value={s} suffix="s" />
      </span>
    </NumberFlowGroup>
  );
}

// The reasoning reads as a quiet margin note under the line. While it streams it
// keeps a short window pinned to the newest line; scroll up and it stops
// following you and stays put.
function ReasoningBody({ children, streaming, onReaderScroll }: { children: React.ReactNode; streaming: boolean; onReaderScroll: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner || !streaming) return;
    pinned.current = true;
    const follow = () => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    };
    follow();
    const ro = new ResizeObserver(follow);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [streaming]);

  return (
    <div className="pt-1 pb-2">
      <div
        ref={scroller}
        data-streaming={streaming || undefined}
        tabIndex={0}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
          el.toggleAttribute("data-scrolled", el.scrollTop > 2);
          // Following the stream only ever scrolls to the bottom, so leaving the
          // bottom is always the reader's doing.
          if (streaming && pinned.current && !atBottom) {
            pinned.current = false;
            onReaderScroll();
          } else if (atBottom) pinned.current = true;
        }}
        className={cn(
          "relative overflow-y-auto overscroll-contain border-s-2 border-line ps-3 pe-1 outline-none",
          "text-[12.5px] leading-5 text-fg-2 [scrollbar-width:thin]",
          "focus-visible:rounded-e-md focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "data-streaming:max-h-[140px] max-h-[280px]",
          // A soft top edge once there is text above, so the window reads as a window.
          "data-scrolled:[mask-image:linear-gradient(to_bottom,transparent,black_28px)]",
        )}
      >
        <div ref={content} className={cn("[overflow-wrap:anywhere]", typeof children === "string" && "whitespace-pre-wrap")}>
          {children}
        </div>
      </div>
    </div>
  );
}
