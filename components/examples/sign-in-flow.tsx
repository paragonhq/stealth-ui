"use client";
import { useState } from "react";
import { SignInFlow, type SignInStep } from "@/components/ui/sign-in-flow";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Signing in to a team workspace. Every path is live: a wrong password, the
// switch to an emailed code, a wrong code, a resend, and going back.
export default function Demo() {
  const [run, setRun] = useState(0);
  const [step, setStep] = useState<SignInStep>("email");

  return (
    // The column keeps its height so the card stays anchored while it grows and shrinks.
    <div className="flex min-h-[392px] w-full max-w-[360px] flex-col items-center gap-3">
      <SignInFlow
        key={run}
        onStepChange={setStep}
        title="Sign in to Northwind"
        description="Use the email you were invited with."
        defaultEmail="maya@northwind.dev"
        onEmailSubmit={async (email) => {
          await wait(700);
          if (email.endsWith("@example.com")) throw new Error("No account uses that email. Check it, or ask your admin for an invite.");
          return email.startsWith("sam") ? "code" : "password";
        }}
        onPasswordSubmit={async (_, password) => {
          await wait(900);
          if (password === "password") throw new Error("That password isn’t right. Try again or reset it.");
        }}
        onSendCode={async () => { await wait(800); }}
        onCodeSubmit={async (_, code) => {
          await wait(900);
          if (code !== "424242") throw new Error("That code didn’t work. Check it, or send a new one.");
        }}
        onForgotPassword={() => {}}
        doneDescription="Taking you to Northwind…"
        footer={
          <>
            New to Northwind?{" "}
            <a href="#" onClick={(e) => e.preventDefault()} className="rounded-sm text-fg underline decoration-fg-4 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-fg-2">
              Request an invite
            </a>
          </>
        }
      />
      <p className="h-4 text-center text-[11.5px] text-fg-4">
        {step === "done" ? (
          <button type="button" onClick={() => { setRun((r) => r + 1); setStep("email"); }} className="rounded-sm text-fg-3 underline decoration-fg-4 underline-offset-[3px] outline-none transition-colors hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3">
            Start over
          </button>
        ) : (
          <>Any password but “password” works. The code is 424242.</>
        )}
      </p>
    </div>
  );
}
