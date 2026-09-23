"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AutosaveStatus, type AutosaveState } from "@/components/ui/autosave-status";

// A planning doc that saves itself 700ms after you stop typing. Take it offline
// and the edits queue; make the next save fail and it offers a retry.
export default function Demo() {
  const [text, setText] = useState(
    "Q3 goals\n\n1. Ship usage-based billing to every workspace\n2. Cut first-response time on support to under 2h\n3. Hire two design engineers",
  );
  const [status, setStatus] = useState<AutosaveState>("saved");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const [pending, setPending] = useState(0);
  const timer = useRef<number>(undefined);
  // Offline edits are counted per burst of typing, not per keystroke.
  const burst = useRef<number>(undefined);
  const latest = useRef({ offline, failNext });
  useEffect(() => {
    latest.current = { offline, failNext };
  });

  useEffect(() => {
    const t = window.setTimeout(() => setSavedAt(Date.now() - 3 * 60_000), 0);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(timer.current);
    };
  }, []);

  const save = () => {
    if (latest.current.offline) {
      setStatus("offline");
      return;
    }
    setStatus("saving");
    timer.current = window.setTimeout(() => {
      if (latest.current.failNext) {
        setFailNext(false);
        setStatus("error");
        return;
      }
      setPending(0);
      setSavedAt(Date.now());
      setStatus("saved");
    }, 500);
  };

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
        <div className="flex h-11 items-center justify-between gap-3 border-b border-line pr-2 pl-4">
          <span className="min-w-0 truncate text-[13px] font-medium text-fg">Q3 planning notes</span>
          <AutosaveStatus status={status} savedAt={savedAt} pending={pending} onRetry={save} />
        </div>
        <textarea
          aria-label="Q3 planning notes"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            window.clearTimeout(timer.current);
            if (offline) {
              if (burst.current == null) setPending((n) => n + 1);
              window.clearTimeout(burst.current);
              burst.current = window.setTimeout(() => (burst.current = undefined), 900);
              setStatus("offline");
              return;
            }
            timer.current = window.setTimeout(save, 700);
          }}
          rows={6}
          className="resize-none bg-transparent px-4 py-3 text-base leading-[1.6] text-fg-2 outline-none placeholder:text-fg-4 sm:text-[13px]"
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Chip
          on={offline}
          onClick={() => {
            const next = !offline;
            setOffline(next);
            latest.current.offline = next;
            if (next) setStatus("offline");
            else if (status === "offline") save();
          }}
        >
          Offline
        </Chip>
        <Chip on={failNext} onClick={() => setFailNext((f) => !f)}>
          Fail next save
        </Chip>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] outline-none",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.96]",
        "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
        on ? "border-fg-3 bg-hover text-fg" : "border-line-2 text-fg-3 hover:text-fg-2",
      )}
    >
      <span className={cn("size-1.5 rounded-full transition-colors duration-150", on ? "bg-fg" : "bg-fg-4")} />
      {children}
    </button>
  );
}
