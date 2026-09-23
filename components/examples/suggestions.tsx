"use client";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { PromptInput } from "@/components/ui/prompt-input";
import { Bolt, Code, Pencil, Refresh, Search, Users } from "@/lib/icons";
import { Suggestion, Suggestions } from "@/components/ui/suggestions";

const sets = [
  [
    { icon: <Bolt />, label: "Summarize this week’s incidents", prompt: "Summarize this week’s incidents and group them by service." },
    { icon: <Search />, label: "Compare Q3 with the forecast", prompt: "How did Q3 revenue compare with the forecast? Call out the biggest misses." },
    { icon: <Pencil />, label: "Draft release notes for 2.14", prompt: "Draft release notes for 2.14 from the merged pull requests." },
    { icon: <Users />, label: "Find accounts at risk", prompt: "Which accounts show signs of churning this quarter, and why?" },
    { icon: <Code />, label: "Write a SQL query", prompt: "Write a SQL query that " },
  ],
  [
    { icon: <Search />, label: "Why did signups dip on Tuesday?", prompt: "Why did signups dip on Tuesday? Check traffic sources and the checkout funnel." },
    { icon: <Pencil />, label: "Reply to Dana’s pricing email", prompt: "Draft a reply to Dana’s email about annual pricing. Keep it short." },
    { icon: <Bolt />, label: "Plan the Friday on-call handoff", prompt: "Plan the Friday on-call handoff: open incidents, owners, and next steps." },
    { icon: <Users />, label: "Who owns the billing service?", prompt: "Who owns the billing service, and who reviewed its last three changes?" },
  ],
];

// The empty state of a chat. Picking a suggestion fills the composer with the
// full prompt and puts the caret at the end; the chips step aside while you
// write and come back when the box is empty again.
export default function Demo() {
  const [value, setValue] = useState("");
  const [set, setSet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [layout, setLayout] = useState<"chips" | "list">("chips");
  const area = useRef<HTMLTextAreaElement>(null);

  const pick = (prompt: string) => {
    setValue(prompt);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(prompt.length, prompt.length);
    });
  };

  const refresh = () => {
    setLoading(true);
    window.setTimeout(() => {
      setSet((s) => (s + 1) % sets.length);
      setLoading(false);
    }, 900);
  };

  const empty = value.length === 0;

  return (
    <div className="@container flex w-full max-w-[520px] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Try asking</span>
          <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="Layout">
            {(["chips", "list"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={layout === l}
                onClick={() => setLayout(l)}
                className="h-6 rounded-[5px] px-2 text-[11.5px] font-medium capitalize text-fg-3 outline-none transition-[background-color,color] duration-150 hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 aria-pressed:bg-hover aria-pressed:text-fg"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading || !empty}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-3 outline-none transition-[background-color,color,scale,opacity] duration-150 ease-out hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50"
        >
          <Refresh size={14} className={loading ? "animate-spin-slow motion-reduce:animate-none" : undefined} />
          More ideas
        </button>
      </div>

      {/* The chips keep their place while you write (faded and inert), so the composer never jumps. */}
      <motion.div
        initial={false}
        animate={{ opacity: empty ? 1 : 0 }}
        transition={{ duration: empty ? 0.2 : 0.12 }}
        inert={!empty}
        className={layout === "chips" ? "min-h-[112px] @max-md:min-h-0" : "min-h-[200px]"}
      >
        <Suggestions key={`${set}-${layout}`} layout={layout} loading={loading} onPick={pick} label="Suggested prompts">
          {sets[set].map((s) => (
            <Suggestion key={s.label} icon={s.icon} prompt={s.prompt}>
              {s.label}
            </Suggestion>
          ))}
        </Suggestions>
      </motion.div>

      <PromptInput
        value={value}
        onValueChange={setValue}
        textareaRef={area}
        placeholder="Ask about your workspace"
        allowAttachments={false}
        onSend={() => setValue("")}
      />
    </div>
  );
}
