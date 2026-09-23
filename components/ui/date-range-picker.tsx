"use client";
import { Popover } from "@base-ui/react/popover";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  Calendar,
  addDays,
  addMonths,
  compareDays,
  diffDays,
  isSameDay,
  startOfMonth,
  toISODate,
  useResolvedLocale,
  useToday,
  type DateRange,
} from "@/components/ui/calendar";
import { cn } from "@/lib/cn";
import { Calendar as CalendarIcon, ChevronDown } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type CompleteRange = { start: Date; end: Date };
export type DateRangePreset = { label: string; range: (today: Date) => CompleteRange };

/** The shortcuts analytics and billing screens reach for. Pass your own to replace them. */
export const defaultPresets: DateRangePreset[] = [
  { label: "Today", range: (t) => ({ start: t, end: t }) },
  { label: "Yesterday", range: (t) => ({ start: addDays(t, -1), end: addDays(t, -1) }) },
  { label: "Last 7 days", range: (t) => ({ start: addDays(t, -6), end: t }) },
  { label: "Last 30 days", range: (t) => ({ start: addDays(t, -29), end: t }) },
  { label: "This month", range: (t) => ({ start: startOfMonth(t), end: t }) },
  { label: "Last month", range: (t) => ({ start: addMonths(startOfMonth(t), -1), end: addDays(startOfMonth(t), -1) }) },
  { label: "Last 90 days", range: (t) => ({ start: addDays(t, -89), end: t }) },
  { label: "Year to date", range: (t) => ({ start: new Date(t.getFullYear(), 0, 1), end: t }) },
];

const sameRange = (a: DateRange | null | undefined, b: DateRange | null | undefined) =>
  !!a && !!b && isSameDay(a.start, b.start) && (a.end === b.end || isSameDay(a.end, b.end));

function subscribeWide(notify: () => void) {
  const mq = window.matchMedia("(min-width: 640px)");
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
}
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 640px)").matches, () => true);

function subscribeNothing() {
  return () => {};
}
const useIsMac = () => useSyncExternalStore(subscribeNothing, () => /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent), () => true);

export type DateRangePickerProps = Omit<React.ComponentProps<"button">, "value" | "defaultValue" | "onChange" | "children"> & {
  value?: CompleteRange | null;
  defaultValue?: CompleteRange | null;
  /** Called on Apply. Picking inside the popover is a draft until then. */
  onValueChange?: (range: CompleteRange | null) => void;
  /** Shortcuts down the side. false hides the column. */
  presets?: DateRangePreset[] | false;
  min?: Date;
  max?: Date;
  /** Longest range allowed, in days. */
  maxDays?: number;
  isDateDisabled?: (date: Date) => boolean;
  locale?: string;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  placeholder?: string;
  size?: "sm" | "md";
  align?: "start" | "center" | "end";
  /** Submits start and end as YYYY-MM-DD under name[start] and name[end]. */
  name?: string;
  labels?: { apply?: string; cancel?: string; presets?: string };
};

/** Two months that show the range, keeping it in view with its end in the right-hand month. */
function placement(range: DateRange | null, today: Date | null, months: number) {
  const anchor = range ? (range.end ?? range.start) : today;
  if (!anchor) return undefined;
  return addMonths(startOfMonth(anchor), -(months - 1));
}

export function DateRangePicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  presets = defaultPresets,
  min,
  max,
  maxDays,
  isDateDisabled,
  locale: localeProp,
  weekStartsOn,
  placeholder = "Pick dates",
  size = "md",
  align = "start",
  name,
  labels,
  disabled,
  className,
  ...rest
}: DateRangePickerProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const today = useToday();
  const locale = useResolvedLocale(localeProp);
  const wide = useWide();
  const mac = useIsMac();
  const months = wide ? 2 : 1;

  const [value, setValue] = useControllableState<CompleteRange | null>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | null>(null);
  const [draftMonth, setDraftMonth] = useState<Date | undefined>(undefined);

  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }), [locale]);
  const brief = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);
  const say = (r: CompleteRange, short = false) => {
    const f = short && today && r.start.getFullYear() === today.getFullYear() && r.end.getFullYear() === today.getFullYear() ? brief : fmt;
    return isSameDay(r.start, r.end) ? f.format(r.start) : f.formatRange(r.start, r.end);
  };

  const refuses = (r: CompleteRange) =>
    (min && compareDays(r.start, min) < 0) || (max && compareDays(r.end, max) > 0) || (!!maxDays && diffDays(r.start, r.end) + 1 > maxDays);
  const presetList = presets && today ? presets.map((p) => ({ label: p.label, range: p.range(today) })) : [];
  const presetOf = (r: DateRange | null) => presetList.find((p) => sameRange(p.range, r));
  const valuePreset = presetOf(value);
  const draftPreset = presetOf(draft);

  function onOpenChange(next: boolean) {
    if (next) {
      if (disabled) return;
      setDraft(value);
      setDraftMonth(placement(value, today, months));
    }
    setOpen(next);
  }

  function choosePreset(r: CompleteRange) {
    setDraft(r);
    setDraftMonth(placement(r, today, months));
  }

  const complete = draft?.end ? (draft as CompleteRange) : null;
  function apply() {
    if (!complete) return;
    setValue({ start: complete.start, end: complete.end });
    setOpen(false);
  }

  const days = complete ? diffDays(complete.start, complete.end) + 1 : 0;
  const sm = size === "sm";
  const labelKey = value ? (valuePreset?.label ?? toISODate(value.start) + toISODate(value.end)) : "empty";

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        disabled={disabled}
        render={<motion.button layout transition={reduce ? { duration: 0 } : spring.snappy} />}
        aria-label={value ? `Date range, ${say(value)}${valuePreset ? ` (${valuePreset.label})` : ""}` : `Date range, ${placeholder}`}
        className={cn(
          "group/trigger inline-flex max-w-full items-center border border-line-2 bg-raised text-fg shadow-[var(--shadow)] outline-none",
          "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.98] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "data-popup-open:border-fg-3 data-popup-open:bg-hover disabled:pointer-events-none disabled:opacity-50",
          sm ? "h-7 gap-1.5 rounded-md px-2 text-[12.5px]" : "h-8 gap-2 rounded-lg px-2.5 text-[13px]",
          className,
        )}
        {...rest}
      >
        <motion.span layout="position" className="flex shrink-0 text-fg-3 transition-colors group-hover/trigger:text-fg-2 group-data-popup-open/trigger:text-fg">
          <CalendarIcon size={sm ? 14 : 16} />
        </motion.span>
        {/* The trigger springs to the width of its new label; the label itself only fades, so it never stretches. */}
        <motion.span layout="position" className="relative flex min-w-0 items-center overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={labelKey}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.22, ease: ease.out }}
              className="flex min-w-0 items-center gap-1.5 whitespace-nowrap"
            >
              {value ? (
                valuePreset ? (
                  <>
                    <span className="font-medium">{valuePreset.label}</span>
                    <span className="hidden truncate tabular text-fg-3 sm:inline">{say(value, true)}</span>
                  </>
                ) : (
                  <span className="truncate tabular font-medium">{say(value)}</span>
                )
              ) : (
                <span className="text-fg-3">{placeholder}</span>
              )}
            </motion.span>
          </AnimatePresence>
        </motion.span>
        <motion.span layout="position" className="flex shrink-0 text-fg-3">
          <ChevronDown size={sm ? 12 : 14} className="transition-transform duration-200 ease-out-expo group-data-popup-open/trigger:rotate-180" />
        </motion.span>
      </Popover.Trigger>

      {name && (
        <>
          <input type="hidden" name={`${name}[start]`} value={value ? toISODate(value.start) : ""} />
          <input type="hidden" name={`${name}[end]`} value={value ? toISODate(value.end) : ""} />
        </>
      )}

      <Popover.Portal>
        <Popover.Positioner side="bottom" align={align} sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
          <Popover.Popup
            initialFocus={false}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                apply();
              }
            }}
            className={cn(
              "flex max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none sm:flex-row",
              "origin-[var(--transform-origin)] transition-[opacity,scale,translate] duration-200 ease-out-expo",
              "data-starting-style:-translate-y-1 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out",
              "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
            )}
          >
            {presetList.length > 0 && (
              <ToggleGroup
                aria-label={labels?.presets ?? "Presets"}
                orientation={wide ? "vertical" : "horizontal"}
                value={draftPreset ? [draftPreset.label] : []}
                onValueChange={(v) => {
                  const p = presetList.find((x) => x.label === v[0]);
                  if (p) choosePreset(p.range);
                }}
                className={cn(
                  "flex shrink-0 gap-0.5 p-2",
                  wide
                    ? "w-40 flex-col border-r border-line"
                    : // Narrow: a scrolling row that never widens the popover, fading at the edge to say there's more.
                      "w-0 min-w-full overflow-x-auto overscroll-x-contain border-b border-line mask-r-from-85% [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                )}
              >
                {presetList.map((p) => {
                  const on = draftPreset?.label === p.label;
                  return (
                    <Toggle
                      key={p.label}
                      value={p.label}
                      disabled={!!refuses(p.range)}
                      title={say(p.range)}
                      className={cn(
                        "relative flex h-8 shrink-0 items-center rounded-md px-2.5 text-left text-[13px] outline-none",
                        "transition-[color,scale] duration-150 active:scale-[0.97] active:duration-75",
                        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-fg-3",
                        "text-fg-2 hover:text-fg data-pressed:text-fg data-disabled:pointer-events-none data-disabled:text-fg-4",
                        !wide && "whitespace-nowrap",
                      )}
                    >
                      {/* One pill slides to the active preset, whichever way the range was chosen. */}
                      {on && (
                        <motion.span
                          layoutId={`${uid}-preset`}
                          transition={reduce ? { duration: 0 } : spring.snappy}
                          className="absolute inset-0 rounded-md bg-fg/[0.08]"
                        />
                      )}
                      <span className="relative">{p.label}</span>
                    </Toggle>
                  );
                })}
              </ToggleGroup>
            )}

            <div className="flex min-w-0 flex-col">
              <Calendar
                mode="range"
                bare
                autoFocus
                className="p-3"
                numberOfMonths={months}
                month={draftMonth}
                onMonthChange={setDraftMonth}
                value={draft}
                onValueChange={setDraft}
                min={min}
                max={max}
                maxDays={maxDays}
                isDateDisabled={isDateDisabled}
                locale={locale}
                weekStartsOn={weekStartsOn}
              />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-3 py-2.5">
                <p aria-live="polite" className="min-w-0 text-[12.5px] text-fg-3">
                  {complete ? (
                    <>
                      <span className="tabular text-fg">{say(complete, true)}</span>
                      <span className="text-fg-4"> · </span>
                      <NumberFlow value={days} className="tabular" />
                      <span className="ml-[0.3em]">{days === 1 ? "day" : "days"}</span>
                    </>
                  ) : draft ? (
                    <>
                      <span className="tabular text-fg">{brief.format(draft.start)} – </span>
                      pick an end date
                    </>
                  ) : (
                    "Pick a start date"
                  )}
                </p>
                <div className="ml-auto flex items-center gap-2">
                  <Popover.Close
                    className={cn(
                      "h-8 rounded-lg px-3 text-[13px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150",
                      "hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    )}
                  >
                    {labels?.cancel ?? "Cancel"}
                  </Popover.Close>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={!complete}
                    className={cn(
                      "inline-flex h-8 items-center gap-2 rounded-lg bg-fg px-3 text-[13px] font-medium text-frame outline-none",
                      "transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                      "disabled:pointer-events-none disabled:opacity-40",
                    )}
                  >
                    {labels?.apply ?? "Apply"}
                    <kbd aria-hidden className="hidden font-sans text-[11px] text-frame/60 pointer-fine:inline">
                      {mac ? "⌘↵" : "Ctrl ↵"}
                    </kbd>
                  </button>
                </div>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
