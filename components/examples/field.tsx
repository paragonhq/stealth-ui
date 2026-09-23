"use client";
import { Form } from "@base-ui/react/form";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ease } from "@/lib/motion";
import { Field, FieldControl, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

const personal = /@(gmail|yahoo|outlook|hotmail|icloud|proton)\./i;

// Inviting a teammate: errors wait for you to leave a field or press Send,
// then clear the moment the value is right.
export default function Demo() {
  const reduce = useReducedMotion();
  const [sent, setSent] = useState<string | null>(null);

  return (
    <Form
      aria-label="Invite a teammate"
      onFormSubmit={(values) => setSent(String(values.email))}
      className="flex w-full max-w-[380px] flex-col gap-4 rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Invite a teammate</h3>
        <p className="text-[12px] text-fg-3">They’ll join Northwind with editor access.</p>
      </div>

      <Field name="name" required>
        <FieldLabel>Full name</FieldLabel>
        <FieldControl placeholder="Maya Chen" autoComplete="name" />
        <FieldError match="valueMissing">Enter their name</FieldError>
      </Field>

      <Field
        name="email"
        required
        validate={(v) => (personal.test(String(v)) ? "Use a work address, not a personal one" : null)}
      >
        <FieldLabel>Work email</FieldLabel>
        <FieldControl type="email" placeholder="maya@northwind.com" autoComplete="email" spellCheck={false} autoCapitalize="none" />
        <FieldDescription>The invite link goes here and expires in 7 days.</FieldDescription>
        <FieldError messages={{ valueMissing: "Enter their work email", typeMismatch: "Enter a full address, like maya@northwind.com" }} />
      </Field>

      <Field name="team" disabled>
        <FieldLabel>Team</FieldLabel>
        <FieldControl defaultValue="Design" />
        <FieldDescription>Set by your workspace admin.</FieldDescription>
      </Field>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p aria-live="polite" className="min-w-0 truncate text-[12px] text-fg-3">
          <AnimatePresence mode="wait" initial={false}>
            {sent && (
              <motion.span
                key={sent}
                className="block truncate"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: ease.out }}
              >
                Invite sent to <span className="text-fg-2">{sent}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </p>
        <button
          type="submit"
          className="inline-flex h-8 shrink-0 items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame shadow-[var(--shadow)] outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid active:scale-[0.97] active:duration-75"
        >
          Send invite
        </button>
      </div>
    </Form>
  );
}
