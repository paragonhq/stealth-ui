"use client";
import { useState } from "react";
import { TwoFactorSetup, type TwoFactorStep } from "@/components/ui/two-factor-setup";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const codes = ["k7f2-9qxd", "m3pa-t8wn", "r6vc-2hjs", "b9ue-q4lk", "x2tz-7fmr", "h5nd-c1yg", "p8wq-6ebv", "d4sk-z3ha", "f1ym-8rup", "w6gc-5nxt"];

// Turning on two-factor from security settings. Any six digits work except 000000.
export default function Demo() {
  const [run, setRun] = useState(0);
  const [step, setStep] = useState<TwoFactorStep>("scan");

  return (
    <div className="flex w-full max-w-[380px] flex-col items-center gap-3">
      <TwoFactorSetup
        key={run}
        onStepChange={setStep}
        issuer="Northwind"
        account="maya@northwind.dev"
        secret="JBSWY3DPEHPK3PXPNW4Q"
        onVerify={async (code) => {
          await wait(900);
          if (code === "000000") throw new Error("That code didn’t match. Codes change every 30 seconds; try the current one.");
          return codes;
        }}
        onDone={() => {
          setRun((r) => r + 1);
          setStep("scan");
        }}
      />
      <p className="h-4 text-center text-[11.5px] text-fg-4">{step === "verify" ? "Any six digits work except 000000." : ""}</p>
    </div>
  );
}
