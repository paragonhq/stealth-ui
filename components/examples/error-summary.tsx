"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Field, FieldControl, FieldError, FieldLabel } from "@/components/ui/field";
import { ease } from "@/lib/motion";
import { ErrorSummary, type ErrorSummaryItem } from "@/components/ui/error-summary";

type Values = { company: string; vat: string; email: string };
const labels: Record<keyof Values, string> = { company: "Legal company name", vat: "VAT number", email: "Billing email" };

function check(v: Values): Partial<Record<keyof Values, string>> {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.company.trim()) e.company = "Enter the name on your company registration";
  if (!/^[A-Z]{2}\d{8,12}$/i.test(v.vat.replace(/\s/g, ""))) e.vat = "Use a country code and 8–12 digits, like GB123456789";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.email = "Enter a full address, like billing@northwind.com";
  return e;
}

// Billing details on a returning account: two fields are wrong, one is empty.
// Save to see the summary; fix a field and its row leaves the list.
export default function Demo() {
  const reduce = useReducedMotion();
  const [values, setValues] = useState<Values>({ company: "", vat: "GB 1234", email: "billing@northwind" });
  const [submits, setSubmits] = useState(0);
  const [saved, setSaved] = useState(false);
  const errors = submits > 0 ? check(values) : {};
  const items: ErrorSummaryItem[] = (Object.keys(labels) as (keyof Values)[])
    .filter((k) => errors[k])
    .map((k) => ({ id: k, label: labels[k], message: errors[k] }));

  const field = (k: keyof Values) => ({
    id: k,
    name: k,
    value: values[k],
    onValueChange: (v: string) => {
      setSaved(false);
      setValues((prev) => ({ ...prev, [k]: v }));
    },
  });

  return (
    <form
      noValidate
      aria-label="Billing details"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmits((n) => n + 1);
        setSaved(Object.keys(check(values)).length === 0);
      }}
      className="flex w-full max-w-[400px] flex-col rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]"
    >
      <h3 className="mb-4 text-[14px] font-medium tracking-[-0.015em] text-fg">Billing details</h3>

      <ErrorSummary errors={items} submitCount={submits} gap={16} />

      <div className="flex flex-col gap-4">
        <Field invalid={!!errors.company}>
          <FieldLabel>{labels.company}</FieldLabel>
          <FieldControl {...field("company")} placeholder="Northwind Labs Ltd" autoComplete="organization" />
          <FieldError match={!!errors.company}>{errors.company}</FieldError>
        </Field>
        <Field invalid={!!errors.vat}>
          <FieldLabel>{labels.vat}</FieldLabel>
          <FieldControl {...field("vat")} placeholder="GB123456789" autoCapitalize="characters" spellCheck={false} inputClassName="font-mono sm:text-[12.5px]" />
          <FieldError match={!!errors.vat}>{errors.vat}</FieldError>
        </Field>
        <Field invalid={!!errors.email}>
          <FieldLabel>{labels.email}</FieldLabel>
          <FieldControl {...field("email")} type="email" placeholder="billing@northwind.com" autoComplete="email" />
          <FieldError match={!!errors.email}>{errors.email}</FieldError>
        </Field>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p aria-live="polite" className="min-w-0 text-[12px] text-fg-3">
          <AnimatePresence initial={false}>
            {saved && (
              <motion.span
                className="block"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: ease.out }}
              >
                Billing details saved
              </motion.span>
            )}
          </AnimatePresence>
        </p>
        <button
          type="submit"
          className="inline-flex h-8 shrink-0 items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame shadow-[var(--shadow)] outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid active:scale-[0.97] active:duration-75"
        >
          Save details
        </button>
      </div>
    </form>
  );
}
