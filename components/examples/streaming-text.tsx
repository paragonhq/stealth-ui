"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Refresh, Stop } from "@/lib/icons";
import { StreamingText, type StreamStatus } from "@/components/ui/streaming-text";

const reply = `Yesterday’s deploy \`dpl_8f2a\` introduced the checkout regression. You can roll back **without a rebuild**:

1. Find the last healthy build, \`dpl_71c9\` from Monday.
2. Promote it to production. Traffic moves over in about 30 seconds.

\`\`\`bash
stealth deploy promote dpl_71c9 --prod
\`\`\`

> Promoting keeps your environment variables, so the secrets you rotated on Tuesday stay put.`;

// Tokens of 2–7 characters with a network's rhythm: mostly steady, sometimes a
// burst, now and then a pause long enough for the caret to start blinking.
function tokenize(text: string, seed: number) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: { text: string; wait: number }[] = [];
  for (let i = 0; i < text.length; ) {
    const n = 2 + Math.floor(rand() * 6);
    const r = rand();
    out.push({ text: text.slice(i, i + n), wait: r < 0.03 ? 700 : r < 0.15 ? 0 : 18 + rand() * 40 });
    i += n;
  }
  return out;
}

export default function Demo() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("streaming");
  const [run, setRun] = useState({ id: 1, fail: false });
  const [onScreen, setOnScreen] = useState(true);
  const pos = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Feed the reply token by token. Pauses while the demo is off screen.
  useEffect(() => {
    if (status !== "streaming" || !onScreen) return;
    const tokens = tokenize(reply, 7 + run.id * 13);
    let t = 0;
    const next = () => {
      const tok = tokens[pos.current];
      if (!tok) return setStatus("done");
      if (run.fail && pos.current > tokens.length * 0.55) return setStatus("error");
      t = window.setTimeout(() => {
        pos.current++;
        setText((prev) => prev + tok.text);
        next();
      }, tok.wait);
    };
    t = window.setTimeout(next, pos.current === 0 ? 450 : 0);
    return () => window.clearTimeout(t);
  }, [status, onScreen, run]);

  const start = useCallback((fail = false) => {
    pos.current = 0;
    setText("");
    setStatus("streaming");
    setRun((r) => ({ id: r.id + 1, fail }));
  }, []);

  const streaming = status === "streaming";

  return (
    <div ref={root} className="flex w-full max-w-[460px] flex-col gap-4">
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-fg/[0.06] px-3.5 py-2 text-[13px] leading-5 text-fg">
        Checkout broke after yesterday’s deploy. How do I roll back?
      </div>

      {/* The finished reply, invisible, holds the space so the controls below never move. */}
      <div className="grid">
        <StreamingText aria-hidden text={reply} className="invisible col-start-1 row-start-1" />
        <StreamingText
          className="col-start-1 row-start-1"
          text={text}
          status={status}
          onContinue={() => setStatus("streaming")}
          onRetry={() => start(false)}
          errorLabel="Connection lost. The reply stopped partway."
        />
      </div>

      <div className="flex items-center gap-2 border-t border-line pt-3">
        <DemoButton onClick={() => (streaming ? setStatus("stopped") : start(false))}>
          {streaming ? <Stop size={14} className="text-fg-3" /> : <Refresh size={14} className="text-fg-3" />}
          <span className="grid text-left">
            <span className={streaming ? "col-start-1 row-start-1" : "invisible col-start-1 row-start-1"}>Stop</span>
            <span className={streaming ? "invisible col-start-1 row-start-1" : "col-start-1 row-start-1"}>Regenerate</span>
          </span>
        </DemoButton>
        <DemoButton ghost disabled={streaming} onClick={() => start(true)}>
          Simulate a dropped connection
        </DemoButton>
      </div>
    </div>
  );
}

function DemoButton({ ghost, className, ...rest }: React.ComponentProps<"button"> & { ghost?: boolean }) {
  return (
    <button
      type="button"
      className={[
        "inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium outline-none",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:pointer-events-none disabled:opacity-50",
        ghost ? "truncate text-fg-3 hover:bg-hover hover:text-fg" : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
        className,
      ].join(" ")}
      {...rest}
    />
  );
}
