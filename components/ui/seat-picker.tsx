"use client";
import { NumberField } from "@base-ui/react/number-field";
import { Slider } from "@base-ui/react/slider";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { Minus, Plus } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type SeatTier = {
  /** The first seat count this price applies to. The first tier should start at 1 or at min. */
  from: number;
  /** Price per seat, for every seat, once the count reaches `from`. */
  price: number;
};

/** The tier a seat count falls in, with volume pricing: every seat is charged the tier's price. */
export function tierFor(seats: number, tiers: SeatTier[]) {
  let index = 0;
  tiers.forEach((t, i) => {
    if (seats >= t.from) index = i;
  });
  return { index, tier: tiers[index], total: Math.round(seats * tiers[index].price * 100) / 100 };
}

export type SeatPickerProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (seats: number) => void;
  tiers: SeatTier[];
  /** The fewest seats allowed, usually the people already on the team. */
  min?: number;
  max?: number;
  /** Why the minimum exists, shown when the count sits on it: "7 people are on your team". */
  minReason?: React.ReactNode;
  /** Shown at the maximum: where to go for more. */
  maxReason?: React.ReactNode;
  label?: React.ReactNode;
  currency?: string;
  locale?: Intl.LocalesArgument;
  /** Unit of the total. */
  interval?: string;
  disabled?: boolean;
};

export function SeatPicker({
  value: valueProp,
  defaultValue,
  onValueChange,
  tiers,
  min = 1,
  max = 100,
  minReason,
  maxReason,
  label = "Seats",
  currency = "USD",
  locale,
  interval = "month",
  disabled,
  className,
  ...rest
}: SeatPickerProps) {
  const [seats, setSeats] = useControllableState({ value: valueProp, defaultValue: defaultValue ?? min, onChange: onValueChange });
  const reduce = useReducedMotion();
  const inputId = useId();
  const pill = useId();
  const hintId = useId();

  const loc = locale ?? "en-US";
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const count = clamp(seats);
  const { index, tier, total } = tierFor(count, tiers);
  const base = tiers[0]?.price ?? tier.price;
  const next = tiers[index + 1];
  const money = (n: number) =>
    new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const set = (n: number | null) => {
    if (n == null || Number.isNaN(n)) return;
    setSeats(clamp(n));
  };
  const pct = (n: number) => ((Math.min(max, Math.max(min, n)) - min) / Math.max(1, max - min)) * 100;

  // Tiers clipped to the allowed range. Ticks on the track mark where each begins.
  const bands = tiers
    .map((t, i) => {
      const start = Math.max(min, t.from);
      const end = Math.min(max, (tiers[i + 1]?.from ?? max + 1) - 1);
      return { ...t, i, start, end, left: pct(start) };
    })
    .filter((b) => b.start <= b.end);

  const hint =
    count <= min && minReason != null
      ? { key: "min", node: minReason }
      : count >= max && maxReason != null
        ? { key: "max", node: maxReason }
        : next && next.from - count <= 5
          ? {
              key: `next-${next.from}`,
              node: (
                <>
                  Add {next.from - count} more {next.from - count === 1 ? "seat" : "seats"} to pay{" "}
                  <span className="text-fg tabular">{money(next.price)}</span> per seat
                </>
              ),
            }
          : index > 0
            ? {
                key: `saving-${index}`,
                node: (
                  <>
                    Volume price: saving <span className="text-fg tabular">{money(Math.round((base - tier.price) * count * 100) / 100)}</span> a {interval}
                  </>
                ),
              }
            : { key: "none", node: null };

  return (
    <div data-disabled={disabled || undefined} className={cn("flex w-full min-w-0 flex-col gap-4 data-disabled:opacity-50", className)} {...rest}>
      <div className="flex items-end justify-between gap-4">
        <NumberField.Root
          id={inputId}
          value={count}
          onValueChange={set}
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          className="flex flex-col gap-1.5"
        >
          <label htmlFor={inputId} className="text-[12.5px] font-medium tracking-[-0.005em] text-fg">
            {label}
          </label>
          <NumberField.Group
            className={cn(
              "flex h-9 items-stretch rounded-lg border border-line-2 bg-raised shadow-[var(--shadow)]",
              "transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10",
            )}
          >
            <StepButton part="decrement" label={`Remove a seat`} />
            <NumberField.Input
              aria-describedby={hint.node != null ? hintId : undefined}
              className="w-14 min-w-0 border-x border-line bg-transparent text-center text-base font-medium text-fg tabular outline-none sm:text-[13px]"
            />
            <StepButton part="increment" label={`Add a seat`} />
          </NumberField.Group>
        </NumberField.Root>

        <div className="flex min-w-0 flex-col items-end gap-0.5 text-right">
          <p className="flex items-baseline gap-1">
            <NumberFlow
              value={total}
              locales={loc}
              format={{ style: "currency", currency, maximumFractionDigits: total % 1 ? 2 : 0 }}
              className="text-[26px] font-medium leading-8 tracking-[-0.03em] text-fg"
            />
            <span className="text-[12px] text-fg-3">/{interval}</span>
          </p>
          <p className="flex items-baseline gap-1 whitespace-nowrap text-[12px] leading-4 text-fg-3 tabular">
            {tier.price < base && <s className="text-fg-4">{money(base)}</s>}
            <NumberFlow value={tier.price} locales={loc} format={{ style: "currency", currency, maximumFractionDigits: tier.price % 1 ? 2 : 0 }} className="text-fg-2" />
            <span>per seat</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Slider.Root
          value={count}
          onValueChange={(v) => set(v as number)}
          min={min}
          max={max}
          step={1}
          largeStep={10}
          // The thumb stays inside the track at both ends instead of hanging off it.
          thumbAlignment="edge"
          disabled={disabled}
          className="group/slider w-full"
        >
          <Slider.Control className="group/control relative flex h-6 cursor-pointer touch-none select-none items-center group-data-disabled/slider:pointer-events-none">
            <Slider.Track className="relative h-1.5 w-full rounded-full bg-fg/10 transition-colors duration-150 group-hover/control:bg-fg/14">
              <Slider.Indicator className="rounded-full bg-fg" />
              {bands.slice(1).map((b) => (
                <span
                  key={b.from}
                  aria-hidden
                  data-passed={count >= b.start || undefined}
                  className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-fg-3 transition-colors duration-150 data-passed:bg-frame/60"
                  // Same inset as an edge-aligned 16px thumb, so a tick sits under the thumb's center at that count.
                  style={{ left: `calc(8px + (100% - 16px) * ${b.left / 100})` }}
                />
              ))}
              <Slider.Thumb
                aria-label="Seats"
                getAriaValueText={(_, v) => {
                  const t = tierFor(v, tiers);
                  return `${v} ${v === 1 ? "seat" : "seats"}, ${money(t.tier.price)} each, ${money(t.total)} per ${interval}`;
                }}
                className="group/thumb size-4 outline-none before:absolute before:-inset-3.5 before:content-['']"
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-0 rounded-full border-2 border-raised bg-fg shadow-[var(--shadow)]",
                    "outline-offset-2 group-has-focus-visible/thumb:outline-1 group-has-focus-visible/thumb:outline-solid group-has-focus-visible/thumb:outline-fg-3",
                    "transition-[scale,box-shadow] duration-150 ease-out-expo",
                    // Grab squashes the thumb a touch and rings it, so the hold is felt before anything moves.
                    "group-hover/control:scale-110 group-data-dragging/slider:scale-x-[1.3] group-data-dragging/slider:scale-y-[1.12] group-data-dragging/slider:ring-4 group-data-dragging/slider:ring-fg/10",
                    "motion-reduce:transition-none",
                  )}
                />
              </Slider.Thumb>
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>

        {/* The price bands as a legend, equal widths so a short band stays readable. Pressing one jumps to its first seat. */}
        <div className="relative grid w-full auto-cols-fr grid-flow-col gap-1">
          {bands.map((b) => {
            const on = b.i === index;
            const range = b.end >= max && !tiers[b.i + 1] ? `${b.start}+` : b.start === b.end ? `${b.start}` : `${b.start}–${b.end}`;
            return (
              <button
                key={b.from}
                type="button"
                disabled={disabled}
                onClick={() => set(b.start)}
                aria-label={`${range} seats, ${money(b.price)} per seat`}
                aria-pressed={on}
                className={cn(
                  "group/band relative flex h-10 min-w-0 flex-col items-start justify-center rounded-md px-2 text-left outline-none",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                  "transition-[color,scale] duration-150 active:scale-[0.97] active:duration-75",
                  on ? "text-fg" : "text-fg-3 hover:text-fg-2",
                )}
              >
                {on && (
                  <motion.span
                    layoutId={pill}
                    aria-hidden
                    className="absolute inset-0 rounded-md border border-line-2 bg-hover"
                    transition={reduce ? { duration: 0 } : spring.snappy}
                  />
                )}
                <span className="relative w-full truncate text-[12px] font-medium leading-4 tabular">{money(b.price)}</span>
                <span className="relative w-full truncate text-[11px] leading-4 text-fg-3 tabular">{range}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p id={hintId} className="relative h-4 overflow-hidden text-[12px] leading-4 text-fg-3" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {hint.node != null && (
            <motion.span
              key={hint.key}
              className="absolute inset-x-0 top-0 truncate"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, transition: { duration: 0.12, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
            >
              {hint.node}
            </motion.span>
          )}
        </AnimatePresence>
      </p>
    </div>
  );
}

function StepButton({ part, label }: { part: "increment" | "decrement"; label: string }) {
  const Part = part === "increment" ? NumberField.Increment : NumberField.Decrement;
  return (
    <Part
      aria-label={label}
      className={cn(
        "group/step relative grid w-9 shrink-0 place-items-center text-fg-2 outline-none",
        part === "decrement" ? "rounded-l-[7px]" : "rounded-r-[7px]",
        "transition-[background-color,color] duration-150 hover:bg-hover hover:text-fg",
        "focus-visible:z-1 focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        "data-disabled:cursor-not-allowed data-disabled:text-fg-4 data-disabled:hover:bg-transparent",
        // Touch: 44px tall target without changing the drawing.
        "before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
      )}
    >
      <span className="transition-[scale] duration-100 ease-out group-active/step:scale-[0.8] group-data-disabled/step:scale-100">
        {part === "increment" ? <Plus size={14} /> : <Minus size={14} />}
      </span>
    </Part>
  );
}
