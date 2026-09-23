"use client";
import { useState } from "react";
import { PasswordField } from "@/components/ui/password-field";

// A change-password form: one field the manager fills, one it generates.
// Submitting masks both again, and the errors take the hint's place.
export default function Demo() {
  const [current, setCurrent] = useState("correct-horse-battery");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const found = {
          current: current ? undefined : "Enter your current password",
          next: next.length < 12 ? "Use at least 12 characters" : next === current ? "Choose a password you haven’t used here" : undefined,
        };
        setErrors(found);
        if (found.current || found.next) return;
        setState("saving");
        window.setTimeout(() => setState("saved"), 900);
        window.setTimeout(() => setState("idle"), 2600);
      }}
      className="flex w-full max-w-[340px] flex-col gap-4 rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Change password</h3>
        <p className="text-[12px] leading-4 text-fg-3">You’ll stay signed in on this device.</p>
      </div>

      <PasswordField
        label="Current password"
        purpose="current"
        value={current}
        onValueChange={(v) => {
          setCurrent(v);
          if (errors.current) setErrors((e) => ({ ...e, current: undefined }));
        }}
        error={errors.current}
      />
      <PasswordField
        label="New password"
        purpose="new"
        name="new-password"
        placeholder="12 or more characters"
        value={next}
        onValueChange={(v) => {
          setNext(v);
          if (errors.next) setErrors((e) => ({ ...e, next: undefined }));
        }}
        description="Longer beats clever. A passphrase works well."
        error={errors.next}
      />

      <button
        type="submit"
        aria-busy={state === "saving" || undefined}
        className="relative mt-1 grid h-8 place-items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75 aria-busy:pointer-events-none"
      >
        {/* All three labels share one cell so the button never changes width. */}
        {["Update password", "Updating…", "Password updated"].map((l, i) => (
          <span
            key={l}
            aria-hidden={i !== ["idle", "saving", "saved"].indexOf(state)}
            className={
              "col-start-1 row-start-1 transition-[opacity,translate] duration-200 ease-out-expo motion-reduce:translate-y-0 " +
              (i === ["idle", "saving", "saved"].indexOf(state) ? "opacity-100" : "translate-y-1 opacity-0")
            }
          >
            {l}
          </span>
        ))}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "saved" ? "Password updated" : ""}
      </span>
    </form>
  );
}
