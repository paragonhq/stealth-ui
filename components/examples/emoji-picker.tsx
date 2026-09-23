"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { EmojiPicker, type SkinTone } from "@/components/ui/emoji-picker";

type Reaction = { emoji: string; count: number; mine: boolean };

// A release note in a team channel: react to it, or reply with emoji inline.
export default function Demo() {
  const reduce = useReducedMotion();
  const [reactions, setReactions] = useState<Reaction[]>([
    { emoji: "🎉", count: 4, mine: false },
    { emoji: "🚀", count: 2, mine: true },
  ]);
  const [recent, setRecent] = useState(["👍", "🎉", "🙏", "😂", "🚀", "👀", "✅", "🔥"]);
  const [tone, setTone] = useState<SkinTone>(0);
  const [reply, setReply] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const react = (emoji: string) =>
    setReactions((all) => {
      const hit = all.find((r) => r.emoji === emoji);
      if (!hit) return [...all, { emoji, count: 1, mine: true }];
      return all
        .map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r))
        .filter((r) => r.count > 0);
    });

  const insert = (emoji: string) => {
    const el = input.current;
    const at = el?.selectionStart ?? reply.length;
    const next = reply.slice(0, at) + emoji + reply.slice(el?.selectionEnd ?? at);
    setReply(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + emoji.length, at + emoji.length);
    });
  };

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3 rounded-xl border border-line bg-raised p-3.5 shadow-[var(--shadow)]">
      <div className="flex gap-2.5">
        <div aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-fg/[0.08] text-[12px] font-medium text-fg-2">MO</div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[12.5px] text-fg-3">
            <span className="font-medium text-fg">Maya Okafor</span> · 10:42
          </p>
          <p className="text-[13px] leading-[1.5] text-fg-2">
            Billing v2 is live for every workspace. Invoices now show usage by project, and the old export is gone.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {reactions.map((r) => (
                <motion.button
                  key={r.emoji}
                  layout={reduce ? false : "position"}
                  type="button"
                  aria-pressed={r.mine}
                  aria-label={`${r.emoji} ${r.count}${r.mine ? ", including you" : ""}`}
                  onClick={() => react(r.emoji)}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", stiffness: 520, damping: 30, mass: 0.7 }}
                  className="flex h-7 items-center gap-1.5 rounded-full border border-line-2 px-2 text-[13px] outline-none transition-[background-color,border-color] duration-150 hover:border-fg-4 active:scale-[0.94] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 aria-pressed:border-fg-4 aria-pressed:bg-fg/[0.08]"
                >
                  <span className="leading-none">{r.emoji}</span>
                  <NumberFlow value={r.count} className="text-[12px] font-medium tabular text-fg-2" />
                </motion.button>
              ))}
            </AnimatePresence>
            <EmojiPicker onEmojiSelect={(p) => react(p.emoji)} recent={recent} onRecentChange={setRecent} skinTone={tone} onSkinToneChange={setTone} className="size-7" />
          </div>
        </div>
      </div>

      <div className="flex h-9 items-center gap-1 rounded-lg border border-line-2 bg-frame pl-3 pr-1 transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10">
        <input
          ref={input}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply to Maya"
          aria-label="Reply to Maya"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
        />
        <EmojiPicker
          label="Insert emoji"
          closeOnSelect={false}
          side="top"
          align="end"
          onEmojiSelect={(p) => insert(p.emoji)}
          recent={recent}
          onRecentChange={setRecent}
          skinTone={tone}
          onSkinToneChange={setTone}
          className="size-7"
        />
      </div>
    </div>
  );
}
