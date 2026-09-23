"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowUp } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { Textarea } from "@/components/ui/textarea";

type Reply = { id: number; body: string };

// A review thread: the reply box grows with the text and sends on Cmd+Enter;
// the status field below is already close to its limit, so the count is showing.
export default function Demo() {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState<Reply[]>([]);

  const send = (text: string) => {
    const body = text.trim();
    if (!body) return;
    setReplies((r) => [...r, { id: Date.now(), body }].slice(-1));
    setDraft("");
  };

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-5">
      <section aria-label="Review thread" className="flex flex-col gap-3">
        <Message name="Maya Chen" time="9:41" body="The retry banner still flashes on slow connections. Can we hold it back for the first 200ms?" />
        <AnimatePresence initial={false}>
          {replies.map((r) => (
            <motion.div
              key={r.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.24, ease: ease.out }}
            >
              <Message name="You" time="now" body={r.body} />
            </motion.div>
          ))}
        </AnimatePresence>

        <Textarea
          aria-label="Reply to Maya"
          placeholder="Reply to Maya…"
          value={draft}
          onValueChange={setDraft}
          minRows={2}
          maxRows={6}
          onModEnter={send}
          actions={
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={!draft.trim()}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-fg px-2.5 text-[12px] font-medium text-frame outline-none transition-[background-color,opacity,scale] duration-150 ease-out hover:bg-fg/90 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid active:scale-[0.97] disabled:pointer-events-none disabled:bg-fg/10 disabled:text-fg-4"
            >
              <ArrowUp size={14} />
              Reply
            </button>
          }
        />
      </section>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-[12.5px] font-medium text-fg-2">
          Status message
        </label>
        <Textarea
          id="status"
          minRows={1}
          maxRows={3}
          limit={80}
          defaultValue="Heads down on the Q3 forecast until Thursday, ping me for anything urgent"
          modEnterHint={false}
        />
      </div>
    </div>
  );
}

function Message({ name, time, body }: { name: string; time: string; body: string }) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-medium text-fg-2 ring-1 ring-line-2">
        {name === "You" ? "Y" : name[0]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-[12.5px]">
          <span className="font-medium text-fg">{name}</span>
          <span className="text-[11px] tabular text-fg-4">{time}</span>
        </p>
        <p className="whitespace-pre-wrap break-words text-[13px] leading-5 text-fg-2">{body}</p>
      </div>
    </div>
  );
}
