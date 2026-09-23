"use client";
import { Field } from "@base-ui/react/field";
import { Alert } from "@/lib/icons";
import { Input } from "@/components/ui/input";

const label = "text-[12.5px] font-medium text-fg-2";
const hint = "text-[12px] text-fg-3";

// Workspace settings: a clearable name, a fixed URL prefix, a unit on both
// sides, and an email that checks itself when you leave it.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-4">
      <Field.Root className="flex flex-col gap-1.5">
        <Field.Label className={label}>Workspace name</Field.Label>
        <Input defaultValue="Northwind Labs" placeholder="Acme Inc" clearable autoComplete="organization" />
      </Field.Root>

      <Field.Root className="flex flex-col gap-1.5">
        <Field.Label className={label}>Workspace URL</Field.Label>
        <Input prefix="stealth.pm/" defaultValue="northwind" spellCheck={false} autoCapitalize="none" />
      </Field.Root>

      <Field.Root
        validationMode="onBlur"
        validate={(v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v)) ? null : "Enter a full address, like finance@northwind.com")}
        className="flex flex-col gap-1.5"
      >
        <Field.Label className={label}>Billing email</Field.Label>
        <Input type="email" required placeholder="finance@company.com" defaultValue="finance@northwind" clearable autoComplete="email" />
        <FieldMessage />
      </Field.Root>

      <Field.Root className="flex flex-col gap-1.5">
        <Field.Label className={label}>Monthly budget</Field.Label>
        <Input prefix="$" suffix="USD" defaultValue="2,400" inputMode="decimal" inputClassName="tabular" />
      </Field.Root>
    </div>
  );
}

// The hint gives way to the error in the same slot, so the form below never jumps.
function FieldMessage() {
  return (
    <div className="grid">
      <Field.Description className={`${hint} col-start-1 row-start-1 transition-opacity duration-150 data-invalid:opacity-0`}>
        Invoices and receipts go here
      </Field.Description>
      <Field.Error
        className="col-start-1 row-start-1 flex items-center gap-1.5 text-[12px] text-danger transition-[opacity,translate] duration-200 ease-out-expo data-ending-style:opacity-0 data-starting-style:-translate-y-1 data-starting-style:opacity-0 data-ending-style:duration-100"
      >
        <Alert size={14} className="shrink-0" />
        <Field.Validity>
          {(s) => (s.validity.valueMissing ? "Enter an email for invoices" : s.error)}
        </Field.Validity>
      </Field.Error>
    </div>
  );
}
