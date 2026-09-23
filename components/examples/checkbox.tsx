"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { ease } from "@/lib/motion";
import { Checkbox, CheckboxGroup } from "@/components/ui/checkbox";

const events = [
  { value: "mentions", label: "Someone mentions me" },
  { value: "deploys", label: "A deploy fails", description: "Production and preview environments" },
  { value: "reviews", label: "A pull request needs my review" },
  { value: "digest", label: "Weekly usage summary" },
];
const all = events.map((e) => e.value);

// Notification preferences: a select-all that goes mixed, a locked row, and a
// consent box that only turns red after a save attempt.
export default function Demo() {
  const reduce = useReducedMotion();
  const errorId = useId();
  const [value, setValue] = useState<string[]>(["mentions", "deploys"]);
  const [agreed, setAgreed] = useState(false);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);
  const invalid = tried && !agreed;

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(t);
  }, [saved]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (agreed) setSaved(true);
      }}
      className="w-full max-w-[400px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]"
    >
      <div className="px-4 pb-3 pt-3.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Email me when</h3>
        <p className="mt-0.5 text-[12.5px] text-fg-3">Sent to maya@northwind.dev</p>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pb-4">
        <CheckboxGroup aria-label="Email notifications" value={value} onValueChange={setValue} allValues={all}>
          <Checkbox parent label="Any of these happen" />
          <div className="flex flex-col gap-2.5 pl-[26px]">
            {events.map((e) => (
              <Checkbox key={e.value} value={e.value} label={e.label} description={e.description} />
            ))}
          </div>
        </CheckboxGroup>
        <Checkbox
          className="pl-[26px]"
          checked
          disabled
          label="A security alert is raised"
          description="Always on for workspace owners"
        />
      </div>

      <div className="flex flex-col border-t border-line px-4 py-3.5">
        <Checkbox
          name="dpa"
          checked={agreed}
          onCheckedChange={setAgreed}
          invalid={invalid}
          aria-errormessage={invalid ? errorId : undefined}
          aria-describedby={invalid ? errorId : undefined}
          label="I agree to the data processing addendum"
        />
        {/* The message opens its own room instead of shoving the card. */}
        <AnimatePresence initial={false}>
          {invalid && (
            <motion.div
              className="overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.16, ease: ease.inOut } }}
              transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.inOut }}
            >
              <p id={errorId} role="alert" className="pb-0.5 pl-[26px] pt-1.5 text-[12px] text-danger">
                Accept the addendum to save these settings
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="text-[12px] tabular text-fg-3">
          {value.length} of {all.length} selected
        </span>
        <button
          type="submit"
          className="relative inline-grid h-8 select-none items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
        >
          {/* Both labels share a cell so the button never changes width. */}
          <span aria-hidden className="invisible col-start-1 row-start-1">Save preferences</span>
          <span className="col-start-1 row-start-1 text-center">{saved ? "Saved" : "Save preferences"}</span>
        </button>
        <span role="status" aria-live="polite" className="sr-only">
          {saved ? "Preferences saved" : ""}
        </span>
      </div>
    </form>
  );
}
