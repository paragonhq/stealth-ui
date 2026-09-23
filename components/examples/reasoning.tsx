"use client";
import { useEffect, useRef, useState } from "react";
import { StreamingText } from "@/components/ui/streaming-text";
import { Refresh } from "@/lib/icons";
import { Reasoning } from "@/components/ui/reasoning";

const thoughts = `They want to drop legacy_sessions. First, what still reads from it? Auth moved to the sessions table in March, so login is fine.

Searching the codebase for "legacy_sessions": two hits, both in scripts/export-audit.ts. That script runs nightly at 02:00, so dropping the table breaks tonight's audit export.

Foreign keys: none point at legacy_sessions. 4.2M rows, all older than 90 days. The only blocker is the export.`;

const answer = `Not yet. One nightly job still reads it: \`scripts/export-audit.ts\` queries \`legacy_sessions\` for the audit export.

Point that query at \`sessions\`, let it run once tonight, then drop the table. Nothing else references it and no foreign keys point to it.`;

type Phase = "waiting" | "thinking" | "answering" | "done";

// Plays one turn: reasoning streams while the block is open, the block folds
// away as the answer starts. Open it again, or open it early, and it stays yours.
export default function Demo() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [run, setRun] = useState(0);
  const [thought, setThought] = useState("");
  const [reply, setReply] = useState("");
  const [onScreen, setOnScreen] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const pos = useRef({ thought: 0, reply: 0 });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!onScreen || phase === "done") return;
    const p = pos.current;
    const id = window.setInterval(() => {
      if (phase === "waiting") return setPhase("thinking");
      if (phase === "thinking") {
        p.thought = Math.min(thoughts.length, p.thought + 4);
        setThought(thoughts.slice(0, p.thought));
        if (p.thought >= thoughts.length) setPhase("answering");
      } else {
        p.reply = Math.min(answer.length, p.reply + 5);
        setReply(answer.slice(0, p.reply));
        if (p.reply >= answer.length) setPhase("done");
      }
    }, phase === "waiting" ? 600 : 40);
    return () => window.clearInterval(id);
  }, [phase, onScreen, run]);

  const replay = () => {
    pos.current = { thought: 0, reply: 0 };
    setThought("");
    setReply("");
    setPhase("waiting");
    setRun((r) => r + 1);
  };

  return (
    <div ref={root} className="flex w-full max-w-[440px] flex-col gap-4">
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-fg/[0.06] px-3.5 py-2 text-[13px] leading-5 text-fg">
        Is it safe to drop the legacy_sessions table?
      </div>

      <div className="flex min-h-[300px] flex-col gap-2">
        {phase !== "waiting" && (
          <Reasoning key={run} streaming={phase === "thinking"}>
            <StreamingText size="sm" text={thought} status={phase === "thinking" ? "streaming" : "done"} />
          </Reasoning>
        )}
        {phase === "waiting" && <p className="h-7 text-[13px] leading-7 text-fg-4">Sending…</p>}
        {(phase === "answering" || phase === "done") && <StreamingText text={reply} status={phase === "done" ? "done" : "streaming"} />}
      </div>

      <button
        type="button"
        onClick={replay}
        disabled={phase !== "done"}
        className="inline-flex h-7 items-center gap-1.5 self-start rounded-md border border-line-2 bg-raised px-2 text-[12px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale,opacity] duration-150 ease-out hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50"
      >
        <Refresh size={14} className="text-fg-3" />
        Ask again
      </button>
    </div>
  );
}
