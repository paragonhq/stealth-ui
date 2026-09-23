"use client";
import { Input as BaseInput } from "@base-ui/react/input";
import { useCallback, useRef } from "react";
import { cn } from "@/lib/cn";
import { X } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";

export type InputProps = Omit<React.ComponentProps<"input">, "size" | "prefix" | "value" | "defaultValue"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Leading content: an icon, a unit like "$" or a fixed part like "https://". Strings are set as quiet text. */
  prefix?: React.ReactNode;
  /** Trailing content: a unit, a status icon or an `InputKbd` hint. */
  suffix?: React.ReactNode;
  /** Shows a clear button while there is a value. Clearing refocuses the field. */
  clearable?: boolean;
  /** Called after the clear button empties the field. */
  onClear?: () => void;
  /** Marks the field invalid. Also picked up automatically inside a Base UI Field. */
  invalid?: boolean;
  size?: "sm" | "md" | "lg";
  /** Classes for the inner <input>; `className` styles the outer box. */
  inputClassName?: string;
};

// The box carries the border and focus halo so prefix, text, clear and suffix
// read as one control. Invalid state comes from the prop or from Field's data-invalid.
const box = cn(
  "group/input relative flex w-full min-w-0 items-center border bg-raised text-fg shadow-[var(--shadow)]",
  "border-line-2 transition-[border-color,box-shadow,background-color] duration-150 ease-out",
  "hover:border-fg-4",
  "focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
  "data-invalid:border-danger/70 data-invalid:hover:border-danger data-invalid:focus-within:border-danger data-invalid:focus-within:ring-danger/15",
  "has-[input[data-invalid]]:border-danger/70 has-[input[data-invalid]]:focus-within:border-danger has-[input[data-invalid]]:focus-within:ring-danger/15",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:shadow-none data-disabled:hover:border-line-2",
  "data-readonly:bg-frame data-readonly:shadow-none data-readonly:hover:border-line-2 data-readonly:focus-within:border-line-2",
);

const sizes = {
  sm: { box: "h-7 gap-1.5 rounded-md px-2 text-base sm:text-[12.5px]", icon: "[&_svg]:size-3.5" },
  md: { box: "h-8 gap-2 rounded-lg px-2.5 text-base sm:text-[13px]", icon: "[&_svg]:size-4" },
  lg: { box: "h-9 gap-2 rounded-lg px-3 text-base sm:text-[13px]", icon: "[&_svg]:size-4" },
};

export function Input({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  prefix,
  suffix,
  clearable = false,
  onClear,
  invalid,
  size = "md",
  disabled,
  readOnly,
  className,
  inputClassName,
  ref,
  ...rest
}: InputProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const inner = useRef<HTMLInputElement | null>(null);
  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const showClear = clearable && value.length > 0 && !disabled && !readOnly;
  const s = sizes[size];

  return (
    <div
      data-slot="input"
      data-size={size}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      className={cn(box, s.box, className)}
      // Pressing the padding, the prefix or the suffix puts the caret in the field
      // instead of doing nothing, the way a single native control would.
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, button, a") || disabled) return;
        e.preventDefault();
        inner.current?.focus();
      }}
    >
      {prefix != null && <Affix side="prefix" className={s.icon}>{prefix}</Affix>}

      <BaseInput
        ref={setRef}
        value={value}
        onValueChange={(next) => setValue(next)}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-inherit outline-none placeholder:text-fg-4",
          "disabled:cursor-not-allowed read-only:cursor-default",
          // The browser's autofill paints its own yellow or blue; keep the surface and the ink ours.
          "autofill:shadow-[inset_0_0_0_1000px_var(--raised)] autofill:[-webkit-text-fill-color:var(--fg)]",
          "[&::-webkit-search-cancel-button]:appearance-none",
          inputClassName,
        )}
        {...rest}
      />

      {clearable && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear"
          inert={!showClear}
          data-state={showClear ? "visible" : "hidden"}
          onClick={() => {
            setValue("");
            onClear?.();
            inner.current?.focus();
          }}
          className={cn(
            "relative -mr-1 grid size-5 shrink-0 place-items-center rounded-[5px] text-fg-3 outline-none",
            "before:absolute before:-inset-1.5 before:content-[''] pointer-coarse:before:-inset-3",
            "hover:bg-hover hover:text-fg active:scale-[0.88]",
            // Arrives on the expo curve, leaves faster and simpler.
            "transition-[opacity,scale,filter,background-color,color] duration-100 ease-out",
            // At rest it stays out of the way; it shows while the field is hovered or in use.
            "pointer-events-none scale-75 opacity-0 blur-[2px] motion-reduce:scale-100 motion-reduce:blur-none",
            "data-[state=visible]:group-hover/input:pointer-events-auto data-[state=visible]:group-hover/input:scale-100 data-[state=visible]:group-hover/input:opacity-100 data-[state=visible]:group-hover/input:blur-none",
            "data-[state=visible]:group-focus-within/input:pointer-events-auto data-[state=visible]:group-focus-within/input:scale-100 data-[state=visible]:group-focus-within/input:opacity-100 data-[state=visible]:group-focus-within/input:blur-none",
            "data-[state=visible]:duration-200 data-[state=visible]:ease-out-expo",
            size === "sm" && "size-4.5",
          )}
        >
          <X size={size === "sm" ? 12 : 14} />
        </button>
      )}

      {suffix != null && <Affix side="suffix" className={s.icon}>{suffix}</Affix>}
    </div>
  );
}

function Affix({ side, className, children }: { side: "prefix" | "suffix"; className?: string; children: React.ReactNode }) {
  const text = typeof children === "string" || typeof children === "number";
  return (
    <span
      data-slot={side}
      className={cn(
        "flex shrink-0 select-none items-center text-fg-3 transition-colors duration-150",
        // Icons come up one step while the field is in use, so it reads as live.
        "group-focus-within/input:text-fg-2",
        // Text sits close to the value so "stealth.pm/" + "northwind" reads as one address.
        text && (side === "prefix" ? "-mr-1.5 whitespace-nowrap tabular group-data-[size=sm]/input:-mr-1" : "whitespace-nowrap tabular"),
        className,
      )}
    >
      {children}
    </span>
  );
}

export type InputKbdProps = React.ComponentProps<"kbd">;

/** A keycap for shortcut hints in the suffix, e.g. <InputKbd>⌘K</InputKbd>. */
export function InputKbd({ className, ...rest }: InputKbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-2 bg-frame px-1 font-mono text-[10.5px] font-normal leading-none text-fg-3",
        className,
      )}
      {...rest}
    />
  );
}
