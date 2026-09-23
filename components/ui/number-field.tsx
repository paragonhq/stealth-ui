"use client";
import { NumberField as Base } from "@base-ui/react/number-field";
import NumberFlow, { type Format } from "@number-flow/react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Minus, Plus } from "@/lib/icons";
import { ease } from "@/lib/motion";

type BaseRootProps = React.ComponentProps<typeof Base.Root>;

export type NumberFieldProps = Omit<BaseRootProps, "children" | "className" | "render"> & {
  /** Visible label. Drag it sideways to scrub the value. */
  label: React.ReactNode;
  /** A short unit after the number, like "GB" or "seats". For currency or percent, use `format`. */
  unit?: string;
  /** A hint under the field. */
  description?: React.ReactNode;
  /** Let the label scrub the value when dragged. */
  scrub?: boolean;
  /** Pixels of drag per step while scrubbing. */
  scrubSensitivity?: number;
  size?: "sm" | "md" | "lg";
  placeholder?: string;
  className?: string;
};

const sizes = {
  sm: { group: "h-7 rounded-md", pad: "pl-2", btn: "w-7", text: "text-base sm:text-[12.5px]", icon: 12 },
  md: { group: "h-8 rounded-lg", pad: "pl-2.5", btn: "w-8", text: "text-base sm:text-[13px]", icon: 14 },
  lg: { group: "h-9 rounded-lg", pad: "pl-3", btn: "w-9", text: "text-base sm:text-[13px]", icon: 14 },
};

// Digits spin on the expo ease-out, quicker than the default so a held stepper or a fast scrub stays legible.
const roll = { duration: 420, easing: `cubic-bezier(${ease.out.join(",")})` };

type Reason = Parameters<NonNullable<BaseRootProps["onValueChange"]>>[1]["reason"];
const typedReasons: Reason[] = ["input-change", "input-clear", "input-paste"];

export function NumberField({
  label,
  unit,
  description,
  scrub = true,
  scrubSensitivity = 4,
  size = "md",
  placeholder,
  className,
  id: idProp,
  value: valueProp,
  defaultValue,
  onValueChange,
  format,
  locale,
  ...rest
}: NumberFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descId = `${id}-description`;
  // Mirror the value so the rolling display can follow it whether or not the field is controlled.
  const [inner, setInner] = useState<number | null>(defaultValue ?? null);
  const value = valueProp !== undefined ? valueProp : inner;
  // While someone types, show the real text; any step, scrub or blur hands back to the rolling digits.
  const [typing, setTyping] = useState(false);
  const s = sizes[size];
  const rolling = !typing && value != null;

  return (
    <Base.Root
      id={id}
      value={valueProp}
      defaultValue={defaultValue}
      format={format}
      locale={locale}
      onValueChange={(next, details) => {
        setInner(next);
        setTyping(typedReasons.includes(details.reason));
        onValueChange?.(next, details);
      }}
      className={cn("group/number flex min-w-0 flex-col gap-1.5", className)}
      {...rest}
    >
      {scrub ? (
        <Base.ScrubArea
          direction="horizontal"
          pixelSensitivity={scrubSensitivity}
          className="group/scrub flex w-fit cursor-ew-resize touch-none select-none items-center gap-1 data-disabled:cursor-default data-readonly:cursor-default"
        >
          <Label id={id}>{label}</Label>
          {/* A quiet ↔ that surfaces on hover, so the scrub is discoverable without a tooltip. */}
          <svg
            aria-hidden
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="-translate-x-0.5 text-fg-4 opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover/scrub:translate-x-0 group-hover/scrub:opacity-100 group-data-disabled/scrub:hidden group-data-readonly/scrub:hidden group-data-scrubbing/scrub:translate-x-0 group-data-scrubbing/scrub:text-fg-2 group-data-scrubbing/scrub:opacity-100 pointer-coarse:hidden"
          >
            <path d="M5.5 5 2.5 8l3 3M10.5 5l3 3-3 3M3 8h10" />
          </svg>
          <Base.ScrubAreaCursor className="drop-shadow-[0_1px_1px_var(--overlay)]">
            <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden className="block">
              <path d="M18.5 4.8H5.5V1.5L1 7l4.5 5.5V9.2h13v3.3L23 7l-4.5-5.5z" fill="var(--fg)" stroke="var(--frame)" strokeWidth="1" strokeLinejoin="round" />
            </svg>
          </Base.ScrubAreaCursor>
        </Base.ScrubArea>
      ) : (
        <Label id={id}>{label}</Label>
      )}

      <Base.Group
        className={cn(
          "group/box relative flex w-full items-stretch overflow-hidden border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
          "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
          "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
          "data-scrubbing:border-fg-3 data-scrubbing:ring-3 data-scrubbing:ring-fg/8",
          "data-invalid:border-danger/70 data-invalid:focus-within:border-danger data-invalid:focus-within:ring-danger/15",
          "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:shadow-none data-disabled:hover:border-line-2",
          "data-readonly:bg-frame data-readonly:shadow-none data-readonly:hover:border-line-2",
          s.group,
        )}
      >
        <div className={cn("relative flex min-w-0 flex-1 items-center", s.pad)}>
          <Base.Input
            placeholder={placeholder}
            aria-describedby={description != null ? descId : undefined}
            onBlur={() => setTyping(false)}
            className={cn(
              "h-full w-full min-w-0 bg-transparent tabular text-fg caret-fg outline-none placeholder:text-fg-4 disabled:cursor-not-allowed",
              s.text,
              // The text stays in place for the caret and selection; the digits drawn over it roll.
              rolling && "text-transparent selection:bg-fg/20",
            )}
          />
          {rolling && (
            <span aria-hidden className={cn("pointer-events-none absolute inset-y-0 left-0 flex items-center whitespace-nowrap tabular text-fg", s.text, s.pad)}>
              <NumberFlow
                value={value}
                locales={locale}
                format={format as Format | undefined}
                spinTiming={roll}
                transformTiming={roll}
              />
            </span>
          )}
        </div>

        {unit && (
          <span aria-hidden className={cn("flex shrink-0 select-none items-center pl-1.5 pr-2.5 text-fg-3", s.text)}>
            {unit}
          </span>
        )}

        <Stepper kind="decrement" size={size} />
        <Stepper kind="increment" size={size} />
      </Base.Group>

      {description != null && (
        <p id={descId} className="text-pretty text-[12px] leading-4 text-fg-3">
          {description}
        </p>
      )}
    </Base.Root>
  );
}

function Label({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={id}
      className="cursor-[inherit] text-[12.5px] font-medium text-fg-2 transition-colors duration-150 group-hover/scrub:text-fg group-data-scrubbing/scrub:text-fg group-data-disabled/number:text-fg-3"
    >
      {children}
    </label>
  );
}

function Stepper({ kind, size }: { kind: "increment" | "decrement"; size: NonNullable<NumberFieldProps["size"]> }) {
  const Part = kind === "increment" ? Base.Increment : Base.Decrement;
  const s = sizes[size];
  const Icon = kind === "increment" ? Plus : Minus;
  return (
    <Part
      aria-label={kind === "increment" ? "Increase" : "Decrease"}
      className={cn(
        "group/step relative grid shrink-0 place-items-center border-l border-line text-fg-3 outline-none",
        "transition-[background-color,color] duration-150 ease-out hover:bg-hover hover:text-fg active:bg-hover",
        "focus-visible:bg-hover focus-visible:text-fg",
        "data-disabled:pointer-events-none data-disabled:text-fg-4 data-disabled:opacity-60",
        // Touch gets a 44px target without the button drawing any bigger.
        "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] pointer-coarse:before:-inset-y-2",
        s.btn,
      )}
    >
      <Icon
        size={s.icon}
        className="transition-transform duration-150 ease-out group-active/step:scale-[0.8] group-active/step:duration-75 motion-reduce:transition-none"
      />
    </Part>
  );
}
