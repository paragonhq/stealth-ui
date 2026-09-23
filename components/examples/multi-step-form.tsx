"use client";
import { Field, FieldControl, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  MultiStepForm,
  MultiStepFormActions,
  MultiStepFormContent,
  MultiStepFormProgress,
  MultiStepFormStep,
  MultiStepFormSummary,
  useMultiStepForm,
} from "@/components/ui/multi-step-form";

const steps = [
  { id: "workspace", label: "Workspace", title: "Name your workspace", description: "You can change both later in settings." },
  { id: "team", label: "Team", title: "Invite your team", description: "Skip this if you’re starting alone." },
  { id: "billing", label: "Billing", title: "Add a billing email", description: "No charge until your 14-day trial ends." },
  { id: "review", label: "Review", title: "Review and create" },
];
const roles = ["Editor", "Viewer"];

// Creating a workspace: four steps, data kept while you move around, and a
// review whose Edit links bring you straight back here.
export default function Demo() {
  return (
    <MultiStepForm
      aria-label="Create a workspace"
      steps={steps}
      labels={{ submit: "Create workspace", submitting: "Creating…", done: "Workspace created" }}
      onComplete={() => new Promise((r) => setTimeout(r, 1400))}
      className="w-full max-w-[400px] rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]"
    >
      <MultiStepFormProgress />
      <MultiStepFormContent>
        <MultiStepFormStep id="workspace">
          <Field name="workspace" required>
            <FieldLabel>Workspace name</FieldLabel>
            <FieldControl placeholder="Northwind Labs" autoComplete="organization" />
            <FieldError messages={{ valueMissing: "Name your workspace" }} />
          </Field>
          <Field name="url" required>
            <FieldLabel>URL</FieldLabel>
            <FieldControl start="stealth.pm/" placeholder="northwind" pattern={"[a-z0-9\\-]{3,}"} spellCheck={false} autoCapitalize="none" />
            <FieldError messages={{ valueMissing: "Choose a URL", patternMismatch: "Use 3 or more lowercase letters, numbers or dashes" }} />
          </Field>
        </MultiStepFormStep>

        <MultiStepFormStep id="team">
          <Field name="invite">
            <FieldLabel optional>Teammate’s email</FieldLabel>
            <FieldControl type="email" placeholder="maya@northwind.com" autoComplete="off" spellCheck={false} />
            <FieldError messages={{ typeMismatch: "Enter a full address, like maya@northwind.com" }} />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[12.5px] font-medium text-fg-2">Their role</legend>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r, i) => (
                <label
                  key={r}
                  className={cn(
                    "relative flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line-2 bg-raised px-3 text-[13px] text-fg-2 shadow-[var(--shadow)]",
                    "transition-[border-color,background-color,color,scale] duration-150 ease-out hover:border-fg-4 active:scale-[0.98]",
                    "has-checked:border-fg-3 has-checked:text-fg has-focus-visible:outline-1 has-focus-visible:outline-offset-2 has-focus-visible:outline-fg-3 has-focus-visible:outline-solid",
                  )}
                >
                  <input type="radio" name="role" value={r} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="grid size-3.5 place-items-center rounded-full border border-fg-4 transition-colors duration-150 peer-checked:border-fg after:size-1.5 after:scale-0 after:rounded-full after:bg-fg after:transition-transform after:duration-200 after:ease-out-expo after:content-[''] peer-checked:after:scale-100" />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>
        </MultiStepFormStep>

        <MultiStepFormStep id="billing">
          <Field name="billingEmail" required>
            <FieldLabel>Billing email</FieldLabel>
            <FieldControl type="email" placeholder="billing@northwind.com" autoComplete="email" spellCheck={false} />
            <FieldDescription>Receipts and trial reminders go here.</FieldDescription>
            <FieldError messages={{ valueMissing: "Enter a billing email", typeMismatch: "Enter a full address, like billing@northwind.com" }} />
          </Field>
        </MultiStepFormStep>

        <MultiStepFormStep id="review">
          <Review />
        </MultiStepFormStep>
      </MultiStepFormContent>
      <MultiStepFormActions />
    </MultiStepForm>
  );
}

function Review() {
  const { values } = useMultiStepForm();
  const v = (k: string) => String(values[k] ?? "");
  return (
    <MultiStepFormSummary
      items={[
        { step: "workspace", label: "Name", value: v("workspace") },
        { step: "workspace", label: "URL", value: v("url") && <span className="font-mono text-[12px]">stealth.pm/{v("url")}</span> },
        { step: "team", label: "Invite", value: v("invite") && `${v("invite")} · ${v("role")}` },
        { step: "billing", label: "Email", value: v("billingEmail") },
      ]}
      emptyValue="Nobody yet"
    />
  );
}
