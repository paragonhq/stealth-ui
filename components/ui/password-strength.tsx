"use client";
import { Meter } from "@base-ui/react/meter";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Warning } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export type StrengthResult = {
  /** 0 for an empty password, then 1 (weak) to 4 (strong). */
  score: StrengthScore;
  /** Estimated guessing entropy in bits, after penalties. */
  bits: number;
  /** The single most useful thing to fix, if anything stands out. */
  warning?: string;
};

export type PasswordRequirement = {
  id: string;
  label: string;
  test: (password: string, context: { userInputs: string[] }) => boolean;
};

// A short list of the passwords that show up first in every breach. Not a
// replacement for a server-side breach check, just the obvious ones.
const COMMON = new Set(
  "password passw0rd password1 123456 1234567 12345678 123456789 1234567890 qwerty qwertyuiop abc123 111111 000000 letmein welcome monkey dragon iloveyou admin login sunshine princess football baseball master hello freedom whatever trustno1 starwars superman batman changeme secret shadow michael jennifer charlie 1q2w3e4r zaq12wsx asdfghjkl"
    .split(" "),
);
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
const LEET: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

const normalize = (pw: string) => pw.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c] ?? c);
/** Common after stripping the digits and symbols people tack on the end ("Password1!"). */
export const isCommonPassword = (pw: string) => {
  const lower = pw.toLowerCase();
  const core = lower.replace(/[\d\W_]+$/, "");
  return COMMON.has(lower) || COMMON.has(core) || COMMON.has(normalize(core)) || COMMON.has(normalize(lower));
};

const tokens = (inputs: string[]) =>
  inputs.flatMap((s) => s.toLowerCase().split(/[^a-z0-9]+/)).filter((t) => t.length >= 3);

/**
 * A small, dependency-free heuristic. It estimates entropy from length and
 * character variety, then discounts the things attackers try first: repeats,
 * sequences, keyboard rows, common passwords, years and the person's own name.
 * Good enough to coach someone while they type; score on the server as well.
 */
export function scorePassword(password: string, { userInputs = [] }: { userInputs?: string[] } = {}): StrengthResult {
  if (!password) return { score: 0, bits: 0 };
  const chars = [...password];
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^\w\s]|[_\s]/.test(password)) pool += 33;
  if (/[^\x00-\x7F]/.test(password)) pool += 100;

  // Characters that continue a repeat or a run beyond two count for a quarter.
  let length = 0;
  let warning: string | undefined;
  const lower = password.toLowerCase();
  for (let i = 0; i < chars.length; i++) {
    const a = lower.charCodeAt(i - 2), b = lower.charCodeAt(i - 1), c = lower.charCodeAt(i);
    const repeat = i >= 2 && a === b && b === c;
    const run = i >= 2 && b - a === c - b && Math.abs(c - b) === 1;
    const row = i >= 3 && ROWS.some((r) => r.includes(lower.slice(i - 3, i + 1)) || [...r].reverse().join("").includes(lower.slice(i - 3, i + 1)));
    if (repeat) warning ??= "Repeated characters are easy to guess";
    else if (run || row) warning ??= "Avoid sequences like abc, 123 or qwerty";
    length += repeat || run || row ? 0.25 : 1;
  }
  let bits = length * Math.log2(Math.max(pool, 10));

  const norm = normalize(password);
  if (isCommonPassword(password)) {
    return { score: 1, bits: Math.min(bits, 10), warning: "This is one of the most used passwords" };
  }
  // Either of these is the first thing a targeted guess tries, so they cap the score at Good.
  let cap: StrengthScore = 4;
  for (const word of COMMON) {
    if (word.length >= 6 && norm.includes(word)) {
      bits -= 14;
      cap = 3;
      warning = "Avoid common passwords, even inside longer ones";
      break;
    }
  }
  if (tokens(userInputs).some((t) => lower.includes(t) || norm.includes(t))) {
    bits -= 16;
    cap = 3;
    warning = "Avoid your name or email address";
  }
  if (/(19|20)\d\d/.test(password)) {
    bits -= 5;
    warning ??= "Years are among the first things tried";
  }

  const raw: StrengthScore = password.length < 8 || bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  const score = Math.min(raw, cap) as StrengthScore;
  return { score, bits: Math.max(0, Math.round(bits)), warning: score === 4 ? undefined : warning };
}

/** Length first, then variety, then the obvious traps. The name check appears only when you pass userInputs. */
export const defaultRequirements: PasswordRequirement[] = [
  { id: "length", label: "12 or more characters", test: (pw) => [...pw].length >= 12 },
  { id: "mix", label: "Letters and a number or symbol", test: (pw) => /\p{L}/u.test(pw) && /[^\p{L}]/u.test(pw) },
  { id: "common", label: "Not a commonly used password", test: (pw) => pw.length > 0 && !isCommonPassword(pw) },
  {
    id: "personal",
    label: "Doesn’t include your name or email",
    test: (pw, { userInputs }) => pw.length > 0 && !tokens(userInputs).some((t) => pw.toLowerCase().includes(t)),
  },
];

export function usePasswordStrength(
  password: string,
  { userInputs = [], requirements = defaultRequirements, scorer = scorePassword }: { userInputs?: string[]; requirements?: PasswordRequirement[]; scorer?: typeof scorePassword } = {},
) {
  const key = userInputs.join("\u0000");
  return useMemo(() => {
    const inputs = key ? key.split("\u0000") : [];
    const result = scorer(password, { userInputs: inputs });
    const list = requirements
      .filter((r) => r.id !== "personal" || inputs.length > 0)
      .map((r) => ({ id: r.id, label: r.label, met: r.test(password, { userInputs: inputs }) }));
    return { ...result, requirements: list, metCount: list.filter((r) => r.met).length };
  }, [password, key, requirements, scorer]);
}

export type PasswordStrengthProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The password to score. Pass the field's current value. */
  password: string;
  /** Things the password shouldn't contain: the person's name, email, company. */
  userInputs?: string[];
  /** The checklist. Pass `[]` to show only the meter. */
  requirements?: PasswordRequirement[];
  /** Words for scores 1–4. */
  labels?: [string, string, string, string];
  /** Swap in your own scorer, for example one backed by a larger dictionary. */
  scorer?: typeof scorePassword;
};

const tints = ["", "bg-danger", "bg-warning", "bg-success", "bg-success"] as const;
const texts = ["text-fg-4", "text-danger", "text-warning", "text-success", "text-success"] as const;

export function PasswordStrength({
  password,
  userInputs,
  requirements = defaultRequirements,
  labels = ["Weak", "Fair", "Good", "Strong"],
  scorer,
  className,
  ...rest
}: PasswordStrengthProps) {
  const reduce = useReducedMotion();
  const { score, warning, requirements: list, metCount } = usePasswordStrength(password, { userInputs, requirements, scorer });
  const label = score ? labels[score - 1] : "";

  // Announce once typing settles, not on every keystroke.
  const summary = score
    ? `Password strength ${label.toLowerCase()}.${list.length ? ` ${metCount} of ${list.length} requirements met.` : ""}`
    : "";
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setAnnounced(summary), 800);
    return () => window.clearTimeout(t);
  }, [summary]);

  return (
    <div data-score={score} className={cn("flex w-full min-w-0 flex-col gap-2.5", className)} {...rest}>
      <Meter.Root
        value={score}
        min={0}
        max={4}
        aria-valuetext={score ? label : "No password entered"}
        className="flex items-center gap-3"
      >
        <Meter.Label className="sr-only">Password strength</Meter.Label>
        <Meter.Track className="grid flex-1 grid-cols-4 gap-1">
          {[0, 1, 2, 3].map((i) => {
            const on = i < score;
            return (
              <span key={i} className="relative h-1 overflow-hidden rounded-full bg-line-2">
                <span
                  data-on={on || undefined}
                  className={cn(
                    "absolute inset-0 origin-left scale-x-0 rounded-full transition-[scale,background-color] duration-300 ease-out-expo data-[on]:scale-x-100",
                    "[transition-delay:var(--delay),0ms] motion-reduce:[transition-delay:0ms]",
                    tints[score] || "bg-fg-4",
                  )}
                  // Filling walks left to right, emptying walks back, one bar at a time.
                  // The tint changes on every bar at once, so the meter never shows two verdicts.
                  style={{ "--delay": `${(on ? i : 3 - i) * 45}ms` } as React.CSSProperties}
                />
              </span>
            );
          })}
        </Meter.Track>
        {/* Every label is stacked in one cell, so the meter's width never changes. */}
        <span aria-hidden className="grid shrink-0 justify-items-end text-[12px] font-medium leading-4">
          {labels.map((l) => (
            <span key={l} className="invisible col-start-1 row-start-1">{l}</span>
          ))}
          <AnimatePresence initial={false}>
            {label && (
              <motion.span
                key={label}
                className={cn("col-start-1 row-start-1 transition-colors duration-200", texts[score])}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
                transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </Meter.Root>

      {list.length > 0 && (
        <ul aria-label="Password requirements" className="flex flex-col gap-1.5">
          {list.map((r) => (
            <li
              key={r.id}
              data-met={r.met || undefined}
              className="flex items-start gap-2 text-[12px] leading-4 text-fg-3 transition-colors duration-200 data-[met]:text-fg-2"
            >
              <Tick met={r.met} reduce={!!reduce} />
              <span className="min-w-0">
                {r.label}
                <span className="sr-only">{r.met ? ", met" : ", not met"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence initial={false}>
        {warning && (
          <motion.p
            key="warning"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.14, ease: ease.in } }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
            className="-mt-1 overflow-hidden"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={warning}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.16 }}
                className="flex items-start gap-2 pt-1 text-[12px] leading-4 text-fg-2"
              >
                <span aria-hidden className="grid size-4 shrink-0 place-items-center text-warning">
                  <Warning size={14} />
                </span>
                {warning}
              </motion.span>
            </AnimatePresence>
          </motion.p>
        )}
      </AnimatePresence>

      <span role="status" aria-live="polite" className="sr-only">
        {announced}
      </span>
    </div>
  );
}

// Unmet is a quiet ring; met draws a tick over a soft success disc. Unmeeting
// retracts the tick faster than it drew, because losing it is not an event.
function Tick({ met, reduce }: { met: boolean; reduce: boolean }) {
  return (
    <span aria-hidden className="relative grid size-4 shrink-0 place-items-center">
      <motion.span
        className="absolute inset-0 rounded-full bg-success-soft"
        initial={false}
        animate={{ scale: met ? 1 : 0.4, opacity: met ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : met ? spring.pop : { duration: 0.12, ease: ease.in }}
      />
      <motion.span
        className="absolute size-[7px] rounded-full border border-fg-4"
        initial={false}
        animate={{ scale: met ? 0.4 : 1, opacity: met ? 0 : 1 }}
        transition={{ duration: reduce ? 0 : 0.14 }}
      />
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="relative text-success">
        <motion.path
          d="M4 8.5 6.75 11.25 12 5"
          initial={false}
          animate={{ pathLength: met ? 1 : 0, opacity: met ? 1 : 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : met
                ? { pathLength: { duration: 0.28, ease: ease.out, delay: 0.05 }, opacity: { duration: 0.05 } }
                : { pathLength: { duration: 0.12, ease: ease.in }, opacity: { duration: 0.06, delay: 0.08 } }
          }
        />
      </svg>
    </span>
  );
}
