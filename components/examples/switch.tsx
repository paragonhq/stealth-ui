"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ease } from "@/lib/motion";
import { Switch } from "@/components/ui/switch";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Project settings where each switch saves on its own: one instant, one that
// waits on the server, one the server refuses, one the plan doesn't include.
export default function Demo() {
  const reduce = useReducedMotion();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="border-b border-line px-4 pb-3 pt-3.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Deployments</h3>
        <p className="mt-0.5 text-[12.5px] text-fg-3">Changes save as you make them</p>
      </div>
      <div className="flex flex-col divide-y divide-line">
        <Switch className="px-4 py-3" defaultChecked icons label="Auto-deploy main" description="Every push to main ships to production" />
        <Switch
          className="px-4 py-3"
          label="Preview comments"
          description="Post a preview link on each pull request"
          onCheckedChange={() => wait(900)}
        />
        <div className="px-4 py-3">
          <Switch
            label="Public API access"
            description="Let tokens read deploy logs"
            onCheckedChange={async () => {
              setError(null);
              await wait(1100);
              throw new Error("forbidden");
            }}
            onError={() => setError("Couldn’t turn on API access. Only owners can change this.")}
          />
          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0, transition: { duration: 0.14, ease: ease.inOut } }}
                transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.inOut }}
              >
                <p role="alert" className="pt-1.5 text-[12px] text-danger">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Switch className="px-4 py-3" disabled label="SAML single sign-on" description="Available on the Enterprise plan" />
      </div>
    </div>
  );
}
