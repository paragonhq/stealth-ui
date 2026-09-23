"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Alert, ArrowRight, CircleCheck } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type ErrorSummaryItem = {
  /** The control's id, or its name when it has no id. Used to focus it. */
  id: string;
  /** The field's label, as the user saw it. */
  label: React.ReactNode;
  /** What's wrong and how to fix it. */
  message: React.ReactNode;
};

export type ErrorSummaryProps = Omit<React.ComponentProps<"div">, "title" | "onSelect"> & {
  /** The current problems, in the order the fields appear. An empty list closes the summary. */
  errors: ErrorSummaryItem[];
  /** Increment on every submit. Each new count with errors moves focus to the summary. */
  submitCount?: number;
  /** Heading. Receives the count; defaults to “Fix 3 problems to continue”. */
  title?: (count: number) => React.ReactNode;
  /** Shown briefly after the last problem is fixed, before the summary closes. Pass null to close at once. */
  resolvedTitle?: React.ReactNode;
  /** Space kept below the summary while it is open, animated with it so the form never jumps. */
  gap?: number;
  /** Called when a link is followed, after the field has focus. */
  onSelect?: (item: ErrorSummaryItem) => void;
};

/** Moves to a field by id or name: scrolls its label into view, then focuses the control. */
export function focusField(id: string, smooth = true) {
  const el =
    document.getElementById(id) ??
    (document.getElementsByName(id)[0] as HTMLElement | undefined) ??
    null;
  if (!el) return null;
  const anchor = (el as HTMLInputElement).labels?.[0] ?? el;
  anchor.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  el.focus({ preventScroll: true });
  if (el instanceof HTMLInputElement && /^(text|email|search|tel|url|password)$/.test(el.type)) el.select();
  return el;
}

const defaultTitle = (n: number) => (
  <>
    Fix <NumberFlow value={n} className="tabular" /> {n === 1 ? "problem" : "problems"} to continue
  </>
);

export function ErrorSummary({
  errors,
  submitCount = 0,
  title = defaultTitle,
  resolvedTitle = "Everything’s fixed",
  gap = 0,
  onSelect,
  className,
  ...rest
}: ErrorSummaryProps) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const card = useRef<HTMLDivElement>(null);
  const count = errors.length;

  // "Resolved" is the short moment after the last fix: the same card says so, then closes.
  const [prevCount, setPrevCount] = useState(count);
  const [resolved, setResolved] = useState(false);
  // Rows stagger in only when the list opens, never when one is added or removed later.
  const [opening, setOpening] = useState(count > 0);
  if (prevCount !== count) {
    setPrevCount(count);
    setResolved(prevCount > 0 && count === 0 && resolvedTitle != null);
    setOpening(prevCount === 0 && count > 0);
  }
  useEffect(() => {
    if (!resolved) return;
    const t = window.setTimeout(() => setResolved(false), 1800);
    return () => window.clearTimeout(t);
  }, [resolved]);

  // A submit with errors takes focus, so screen readers read the list and keyboard users start from it.
  const hasErrors = count > 0;
  useEffect(() => {
    if (submitCount > 0 && hasErrors) card.current?.focus({ preventScroll: false });
  }, [submitCount, hasErrors]);

  const open = count > 0 || resolved;
  const tone = count > 0 ? "danger" : "success";

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="summary"
          // Bleeds 3px past its box so the focus halo is never clipped by the height animation.
          className="-mx-[3px] -mt-[3px] -mb-[3px] overflow-hidden"
          initial={{ height: 0, opacity: reduce ? 0 : 1 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.12 : 0.22, ease: ease.inOut } }}
          transition={{ duration: reduce ? 0.15 : 0.32, ease: ease.out }}
        >
          <div style={{ paddingBottom: gap + 3 }} className={cn("px-[3px] pt-[3px]", className)} {...rest}>
            <motion.div
              ref={card}
              tabIndex={-1}
              role="region"
              aria-labelledby={titleId}
              data-tone={tone}
              initial={reduce ? false : { y: -6, scale: 0.985 }}
              animate={{ y: 0, scale: 1 }}
              transition={reduce ? { duration: 0 } : spring.soft}
              className={cn(
                "rounded-xl border p-1.5 outline-none transition-[background-color,border-color,box-shadow] duration-300 ease-out",
                "data-[tone=danger]:border-danger/25 data-[tone=danger]:bg-danger-soft data-[tone=danger]:focus:ring-3 data-[tone=danger]:focus:ring-danger/15",
                "data-[tone=success]:border-success/25 data-[tone=success]:bg-success-soft",
              )}
            >
              <div className={cn("flex items-center gap-2 px-2 pt-1.5 transition-[padding] duration-200", count > 0 ? "pb-1" : "pb-1.5")}>
                <span className="relative grid size-4 shrink-0 place-items-center">
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={tone}
                      className={cn("absolute inset-0 grid place-items-center", tone === "danger" ? "text-danger" : "text-success")}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: -30 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, transition: { duration: 0.12 } }}
                      transition={reduce ? { duration: 0.15 } : spring.pop}
                    >
                      {tone === "danger" ? <Alert /> : <CircleCheck />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <h2 id={titleId} className="min-w-0 text-[13px] font-medium tracking-[-0.01em] text-fg">
                  {count > 0 ? title(count) : resolvedTitle}
                </h2>
              </div>

              <ul className="flex flex-col">
                <AnimatePresence initial={false}>
                  {errors.map((item, i) => (
                    <motion.li
                      key={item.id}
                      layout={reduce ? false : "position"}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, transition: { duration: reduce ? 0.1 : 0.2, ease: ease.inOut } }}
                      transition={{ duration: reduce ? 0.15 : 0.26, ease: ease.out, delay: opening && !reduce ? 0.06 + Math.min(i, 7) * 0.025 : 0 }}
                      className="overflow-hidden"
                    >
                      <a
                        href={`#${item.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          if (focusField(item.id, !reduce)) onSelect?.(item);
                        }}
                        className={cn(
                          "group/row relative flex items-start gap-2 rounded-lg px-2 py-1.5 outline-none",
                          "transition-[background-color,scale] duration-150 ease-out hover:bg-fg/[0.045] active:scale-[0.99] active:duration-75",
                          "focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid",
                        )}
                      >
                        {/* Aligns row text with the title's text, past the icon. */}
                        <span aria-hidden className="w-4 shrink-0" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[12.5px] font-medium text-fg underline decoration-fg-4 underline-offset-[3px] transition-[text-decoration-color] duration-150 group-hover/row:decoration-fg-2">
                            {item.label}
                          </span>
                          <span className="text-[12px] leading-[1.45] text-fg-2 [text-wrap:pretty]">{item.message}</span>
                        </span>
                        <ArrowRight
                          size={14}
                          className="mt-[3px] shrink-0 text-fg-3 transition-[translate,color] duration-200 ease-out-expo group-hover/row:translate-x-0.5 group-hover/row:text-fg-2 group-focus-visible/row:translate-x-0.5 group-focus-visible/row:text-fg-2"
                        />
                      </a>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
