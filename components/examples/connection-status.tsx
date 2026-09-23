"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ConnectionStatus, type ConnectionState } from "@/components/ui/connection-status";

const modes: { value: "online" | "offline" | "flaky"; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "flaky", label: "Flaky" },
];

/** Epoch ms, `ms` from now. Only ever called from events and timers. */
const fromNow = (ms: number) => Date.now() + ms;

// A shared doc whose connection you control: go offline and keep editing, or
// drop the socket and watch it back off and reconnect on its own.
export default function Demo() {
  const [status, setStatus] = useState<ConnectionState>("online");
  const [retryAt, setRetryAt] = useState<number>();
  const [pending, setPending] = useState(0);
  const [edits, setEdits] = useState(0);
  const attempts = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Back online: the queue drains one change at a time.
  useEffect(() => {
    if (status !== "online" || pending === 0) return;
    const t = window.setTimeout(() => setPending((n) => Math.max(0, n - 1)), 450);
    return () => window.clearTimeout(t);
  }, [status, pending]);

  const attempt = useCallback(() => {
    attempts.current += 1;
    // The first automatic attempt fails and backs off; the next one gets through.
    const t = window.setTimeout(() => {
      if (attempts.current >= 2) {
        setStatus("online");
        setRetryAt(undefined);
      } else setRetryAt(fromNow(8000));
    }, 1100);
    timers.current.push(t);
  }, []);

  // An automatic retry fires when the countdown reaches zero.
  useEffect(() => {
    if (status !== "reconnecting" || retryAt === undefined) return;
    const t = window.setTimeout(attempt, Math.max(0, retryAt - Date.now()));
    return () => window.clearTimeout(t);
  }, [status, retryAt, attempt]);

  const choose = (mode: (typeof modes)[number]["value"]) => {
    clearTimers();
    attempts.current = 0;
    if (mode === "online") {
      setStatus("online");
      setRetryAt(undefined);
    } else if (mode === "offline") {
      setStatus("offline");
      setRetryAt(undefined);
    } else {
      setStatus("reconnecting");
      setRetryAt(fromNow(5000));
    }
  };

  const edit = () => {
    setEdits((n) => n + 1);
    if (status !== "online") setPending((n) => n + 1);
  };

  const mode = status === "online" ? "online" : status === "offline" ? "offline" : "flaky";

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-3">
      <div className="relative h-[300px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Q3 planning notes</p>
          <span className="shrink-0 text-[12px] text-fg-3 tabular">
            {status === "online" ? (pending ? "Syncing…" : "Saved") : pending ? `${pending} unsynced` : status === "offline" ? "Offline" : "Reconnecting…"}
          </span>
        </div>
        <div className="flex flex-col gap-2.5 px-4 py-4 text-[13px] leading-[1.55] text-fg-2">
          <p className="text-fg">Goals for the quarter</p>
          <p>Ship usage-based billing to every workspace on the Team plan by 14 Nov.</p>
          <p>Cut p95 dashboard load to under 800 ms on accounts with 10k+ projects.</p>
          {edits > 0 && <p className="text-fg-3">{edits === 1 ? "1 edit" : `${edits} edits`} by you since opening.</p>}
        </div>
        <ConnectionStatus
          position="absolute"
          status={status}
          retryAt={retryAt}
          pending={pending}
          onRetry={() => {
            clearTimers();
            attempts.current = 1;
            attempt();
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label="Network" className="flex gap-0.5 rounded-lg bg-hover p-0.5">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => choose(m.value)}
              className={cn(
                "h-7 rounded-md px-2.5 text-[12px] outline-none transition-[background-color,color,box-shadow,scale] duration-150 active:scale-[0.96] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                mode === m.value ? "bg-raised text-fg shadow-[var(--shadow),inset_0_0_0_1px_var(--line-2)]" : "text-fg-3 hover:text-fg",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={edit}
          className="inline-flex h-8 shrink-0 items-center rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          Make an edit
        </button>
      </div>
    </div>
  );
}
