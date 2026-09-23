"use client";
import { useState } from "react";
import { PasswordField } from "@/components/ui/password-field";
import { PasswordStrength } from "@/components/ui/password-strength";

// Sign-up: the meter coaches while you type and knows not to trust your own name.
export default function Demo() {
  const [email, setEmail] = useState("maya.chen@northwind.dev");
  const [password, setPassword] = useState("");

  return (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="flex w-full max-w-[340px] flex-col gap-4 rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Create your account</h3>
        <p className="text-[12px] leading-4 text-fg-3">Northwind workspace · 14-day trial</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium leading-4 text-fg">Work email</span>
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-8 rounded-lg border border-line-2 bg-raised px-2.5 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-4 hover:border-fg-4 focus:border-fg-3 focus:ring-3 focus:ring-fg/8 sm:text-[13px]"
        />
      </label>

      <div className="flex flex-col gap-2.5">
        <PasswordField label="Password" purpose="new" value={password} onValueChange={setPassword} placeholder="Try a few words together" />
        <PasswordStrength password={password} userInputs={[email, "Maya Chen"]} />
      </div>

      <button
        type="submit"
        className="mt-1 h-8 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
      >
        Create account
      </button>
    </form>
  );
}
