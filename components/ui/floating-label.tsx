"use client";
import { Field } from "@base-ui/react/field";
import { Input as BaseInput } from "@base-ui/react/input";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Alert } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";

export type FloatingLabelFieldProps = Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "size" | "children"> & {
  /** Sits inside the field like a placeholder, then floats above the text. */
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** A hint under the field. The error takes its place while there is one. */
  description?: React.ReactNode;
  /** An error message. Setting it marks the field invalid and slides the message in. */
  error?: string;
  /** Trailing content inside the field, e.g. a reveal button or a status icon. */
  suffix?: React.ReactNode;
  /** Passed to the Base UI Field for its own validation, when you don't manage `error` yourself. */
  validate?: React.ComponentProps<typeof Field.Root>["validate"];
  validationMode?: React.ComponentProps<typeof Field.Root>["validationMode"];
  /** Classes for the outer Field root; `inputClassName` styles the input. */
  inputClassName?: string;
};

export function FloatingLabelField({
  label,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  description,
  error,
  suffix,
  validate,
  validationMode,
  disabled,
  readOnly,
  name,
  placeholder,
  className,
  inputClassName,
  ref,
  ...rest
}: FloatingLabelFieldProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  // Keep the last message on screen while it animates out, instead of emptying mid-exit.
  const [lastError, setLastError] = useState(error);
  if (error && error !== lastError) setLastError(error);

  return (
    <Field.Root
      name={name}
      disabled={disabled}
      invalid={error ? true : undefined}
      validate={validate}
      validationMode={validationMode}
      className={cn("flex w-full min-w-0 flex-col", className)}
    >
      <div
        data-slot="floating-label"
        className={cn(
          "group/float relative h-13 w-full rounded-lg border border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
          "transition-[border-color,box-shadow,background-color] duration-150 ease-out",
          "hover:border-fg-4 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8 hover:focus-within:border-fg-3",
          "has-[input[data-invalid]]:border-danger/70 has-[input[data-invalid]]:hover:border-danger has-[input[data-invalid]]:focus-within:border-danger has-[input[data-invalid]]:focus-within:ring-danger/15",
          "has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50 has-[input:disabled]:shadow-none has-[input:disabled]:hover:border-line-2",
          "has-[input:read-only]:bg-frame has-[input:read-only]:shadow-none has-[input:read-only]:hover:border-line-2",
        )}
      >
        <BaseInput
          ref={ref}
          value={value}
          onValueChange={(next) => setValue(next)}
          readOnly={readOnly}
          // A real placeholder is required for :placeholder-shown, which is how the
          // label knows the field is empty without JavaScript (and through autofill).
          placeholder={placeholder ?? " "}
          className={cn(
            "peer absolute inset-0 size-full rounded-[inherit] bg-transparent px-3 pb-1.5 pt-[21px] text-base leading-5 text-fg outline-none sm:text-[14px]",
            "placeholder:text-transparent placeholder:transition-colors placeholder:duration-150 focus:placeholder:text-fg-4 focus:placeholder:delay-75",
            "disabled:cursor-not-allowed",
            "autofill:shadow-[inset_0_0_0_1000px_var(--raised)] autofill:[-webkit-text-fill-color:var(--fg)]",
            suffix != null && "pr-11",
            inputClassName,
          )}
          {...rest}
        />
        <Field.Label
          className={cn(
            "pointer-events-none absolute left-3 top-4 max-w-[calc(100%-1.5rem)] origin-top-left truncate text-base leading-5 text-fg-3 sm:text-[14px]",
            // Transform only: the label moves and shrinks, nothing around it reflows.
            "transition-[translate,scale,color] duration-200 ease-out-quart motion-reduce:transition-[color]",
            "peer-focus:-translate-y-[9px] peer-focus:scale-[0.85] peer-focus:text-fg-2",
            "peer-[:not(:placeholder-shown)]:-translate-y-[9px] peer-[:not(:placeholder-shown)]:scale-[0.85]",
            "peer-autofill:-translate-y-[9px] peer-autofill:scale-[0.85]",
            "data-invalid:text-danger peer-focus:data-invalid:text-danger",
            suffix != null && "max-w-[calc(100%-3.5rem)]",
          )}
        >
          {label}
        </Field.Label>
        {suffix != null && <div className="absolute inset-y-0 right-1.5 flex items-center text-fg-3">{suffix}</div>}
      </div>

      {/* The message row grows from nothing on the first error, so the form below
          eases down instead of jumping; a hint and an error share one slot. */}
      <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out-quart has-[[data-msg]]:grid-rows-[1fr] motion-reduce:transition-none">
        <div className="min-h-0 overflow-hidden">
          <div className="grid pl-3 pt-1.5">
            {description != null && (
              <Field.Description
                data-msg=""
                className="col-start-1 row-start-1 text-[12px] leading-4 text-fg-3 transition-opacity duration-150 data-invalid:opacity-0"
              >
                {description}
              </Field.Description>
            )}
            <Field.Error
              data-msg=""
              match={error ? true : undefined}
              className={cn(
                "col-start-1 row-start-1 flex items-start gap-1.5 text-[12px] leading-4 text-danger",
                "transition-[opacity,translate] duration-200 ease-out-expo",
                "data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
                "motion-reduce:translate-y-0",
              )}
            >
              <Alert size={14} className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0">{error || lastError || <Field.Validity>{(s) => s.error}</Field.Validity>}</span>
            </Field.Error>
          </div>
        </div>
      </div>
    </Field.Root>
  );
}
