"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ease } from "@/lib/motion";
import { File, Pencil, Search, Terminal } from "@/lib/icons";
import { ToolCall, ToolCallGroup, type ToolCallStatus } from "@/components/ui/tool-call";

type Run = { test: ToolCallStatus; testStart?: number; testEnd?: number; edit?: ToolCallStatus; editStart?: number; editEnd?: number };

// An agent chasing a failing test: reads, a search, a test run that fails, then the fix.
// The last two calls play out live when the demo scrolls into view; Replay runs them again.
export default function Demo() {
  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [run, setRun] = useState<Run>({ test: "running" });
  const [started, setStarted] = useState(false);
  const reduce = useReducedMotion();

  const play = () => {
    timers.current.forEach(window.clearTimeout);
    const t0 = Date.now();
    setRun({ test: "running", testStart: t0 });
    timers.current = [
      window.setTimeout(() => setRun((r) => ({ ...r, test: "error", testEnd: Date.now(), edit: "running", editStart: Date.now() })), 2600),
      window.setTimeout(() => setRun((r) => ({ ...r, edit: "done", editEnd: Date.now() })), 4100),
    ];
  };

  // Start the first time the demo is actually on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || started) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      setStarted(true);
      play();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [started]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  return (
    <div ref={root} className="flex w-full max-w-[520px] flex-col gap-1.5">
      <p className="mb-1 text-[13px] leading-5 text-fg-2">
        <span className="text-fg">Fixing the failing Button test.</span> Checking how busy state is handled first.
      </p>

      <ToolCallGroup label="Read 3 files" status="done" summary="212ms" icon={<File />}>
        <ToolCall name="Read" target="src/components/Button.tsx" status="done" duration={84} summary="142 lines" input={{ path: "src/components/Button.tsx" }} output={buttonSource} />
        <ToolCall name="Read" target="src/components/Button.test.tsx" status="done" duration={61} summary="58 lines" input={{ path: "src/components/Button.test.tsx" }} output={testSource} />
        <ToolCall
          name="Read"
          target="src/lib/use-pending.ts"
          status="done"
          duration={67}
          summary="24 lines"
          input={{ path: "src/lib/use-pending.ts" }}
          output={"export function usePending() {\n  // …\n}"}
        />
      </ToolCallGroup>

      <ToolCall
        name="Search"
        icon={<Search />}
        target={'"aria-busy" in src/'}
        status="done"
        duration={138}
        summary="3 hits"
        input={{ query: "aria-busy", path: "src/", regex: false, maxResults: 50 }}
        output={[
          { file: "src/components/Button.tsx", line: 41, text: "aria-busy={pending || undefined}" },
          { file: "src/components/Menu.tsx", line: 88, text: 'aria-busy={state === "loading"}' },
          { file: "src/components/Table.tsx", line: 203, text: "aria-busy={isFetching}" },
        ]}
      />

      <ToolCall
        name="Run"
        icon={<Terminal />}
        target="npm test -- Button"
        status={run.test}
        startedAt={run.testStart}
        endedAt={run.testEnd}
        input={{ command: "npm test -- Button", cwd: "~/acme/web", timeoutMs: 120000 }}
        error={run.test === "error" ? "2 of 14 tests failed" : undefined}
        output={run.test === "error" ? testLog : undefined}
      />

      {/* New calls arrive in the stream: a short rise and fade, and the rows below make room. */}
      <AnimatePresence initial={false}>
        {run.edit && (
          <motion.div
            key="edit"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: 4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.16, ease: ease.in } }}
            transition={{ duration: reduce ? 0.15 : 0.28, ease: ease.out }}
            className="-m-1 overflow-hidden p-1"
          >
            <ToolCall
              name="Edit"
              icon={<Pencil />}
              target="src/components/Button.tsx"
              status={run.edit}
              startedAt={run.editStart}
              endedAt={run.editEnd}
              summary={
                <>
                  <span className="text-success">+4</span> <span className="text-danger">−1</span>
                </>
              }
              input={{ path: "src/components/Button.tsx", find: "aria-busy={pending}", replace: "aria-busy={pending || undefined}" }}
              output={run.edit === "done" ? { applied: true, hunks: 1, linesAdded: 4, linesRemoved: 1 } : undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={play}
          className="h-7 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
        >
          Replay
        </button>
      </div>
    </div>
  );
}

const buttonSource = `export function Button({ pending, children, ...rest }: ButtonProps) {
  return (
    <button aria-busy={pending} disabled={pending} {...rest}>
      {children}
    </button>
  );
}`;

const testSource = `it("announces the busy state", () => {
  render(<Button pending>Save</Button>);
  expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
});`;

const testLog = `FAIL  src/components/Button.test.tsx
  ✓ renders its label (12 ms)
  ✕ announces the busy state (9 ms)
  ✕ ignores presses while pending (7 ms)

Expected: "true"
Received: null

Tests: 2 failed, 12 passed, 14 total`;
