"use client";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { Eye, EyeOff } from "@/lib/icons";
import { spring, swap } from "@/lib/motion";
import { TextScramble } from "@/components/ui/text-scramble";

const keys = {
  live: { prefix: "sk_demo_", secret: "51Hq8vT2mXr94f2a", meta: "Created 12 Aug · Last used 2 min ago" },
  test: { prefix: "sk_demo_", secret: "4eC39HqLyjWDp7Vb", meta: "Created 3 Jun · Last used yesterday" },
} as const;
type Env = keyof typeof keys;

// An API keys panel. Switching environment decodes only the characters that
// differ; revealing decodes the masked secret in place, at the same width.
export default function Demo() {
  const [env, setEnv] = useState<Env>("live");
  const [shown, setShown] = useState(false);
  const reduce = useReducedMotion();
  const key = keys[env];
  const full = key.prefix + key.secret;
  const masked = key.prefix + "•".repeat(key.secret.length - 4) + key.secret.slice(-4);

  return (
    <section aria-labelledby="keys-title" className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-line-2 bg-raised p-4 shadow-[var(--shadow)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <TextScramble trigger="mount" className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
            Restricted · eu-west-2
          </TextScramble>
          <h3 id="keys-title" className="text-[14px] font-medium tracking-[-0.015em] text-fg">
            Secret key
          </h3>
        </div>

        <ToggleGroup
          aria-label="Environment"
          value={[env]}
          onValueChange={(v) => v[0] && setEnv(v[0] as Env)}
          className="relative flex h-7 shrink-0 items-center rounded-md border border-line-2 bg-frame p-0.5"
        >
          {(["live", "test"] as const).map((e) => (
            <Toggle
              key={e}
              value={e}
              className="relative h-full rounded-[4px] px-2.5 text-[12px] font-medium text-fg-3 outline-none transition-[color,scale] duration-150 hover:text-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 active:scale-[0.96] data-pressed:text-fg"
            >
              {env === e && (
                <motion.span
                  layoutId="env-pill"
                  transition={reduce ? { duration: 0 } : spring.snappy}
                  className="absolute inset-0 rounded-[4px] border border-line-2 bg-raised shadow-[var(--shadow)]"
                />
              )}
              <span className="relative">{e === "live" ? "Live" : "Test"}</span>
            </Toggle>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex h-9 items-center gap-1 rounded-lg border border-line bg-frame pl-3 pr-1">
          <TextScramble
            trigger="none"
            duration={0.7}
            className="min-w-0 flex-1 overflow-hidden font-mono text-[12px] tracking-[0.01em] text-fg"
          >
            {shown ? full : masked}
          </TextScramble>
          <Toggle
            pressed={shown}
            onPressedChange={setShown}
            aria-label="Reveal secret key"
            className="relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 before:absolute before:-inset-2 before:content-[''] hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92] active:duration-75 pointer-fine:before:hidden data-pressed:text-fg"
          >
            <span className="relative grid size-4 place-items-center">
              <AnimatePresence initial={false}>
                <motion.span
                  key={shown ? "hide" : "show"}
                  className="absolute inset-0 grid place-items-center"
                  initial={reduce ? { opacity: 0 } : swap.initial}
                  animate={swap.animate}
                  exit={reduce ? { opacity: 0 } : swap.exit}
                  transition={reduce ? { duration: 0.15 } : spring.pop}
                >
                  {shown ? <EyeOff size={15} /> : <Eye size={15} />}
                </motion.span>
              </AnimatePresence>
            </span>
          </Toggle>
          <CopyButton value={full} iconOnly variant="ghost" size="sm" label="Copy secret key" copiedLabel="Secret key copied" />
        </div>
        <p className="text-[12px] text-fg-3 tabular">{key.meta}</p>
      </div>
    </section>
  );
}
