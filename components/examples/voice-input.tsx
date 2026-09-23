"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp } from "@/lib/icons";
import { browserVoiceEngine, VoiceInput, type VoiceEngine } from "@/components/ui/voice-input";

const SCRIPT = "Move the design review to Thursday at three and add Priya and the platform team";

// A stand-in voice so the preview works without a microphone: syllable-shaped
// levels while "speaking", room noise after, words arriving about four a second.
function simulated({ deny = false } = {}): VoiceEngine {
  return (ev) =>
    new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (deny) return reject("denied");
        const words = SCRIPT.split(" ");
        let said = 0;
        let raf = 0;
        const talk = window.setInterval(() => {
          if (said >= words.length) return;
          said++;
          ev.onTranscript(words.slice(0, said).join(" "), said === words.length);
        }, 240);
        const loop = (now: number) => {
          const speaking = said < words.length;
          const syllable = Math.abs(Math.sin(now / 85)) * (0.55 + 0.45 * Math.abs(Math.sin(now / 260 + 1)));
          ev.onLevel(speaking ? 0.18 + 0.72 * syllable : 0.03 + Math.random() * 0.04);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        const end = () => {
          window.clearInterval(talk);
          cancelAnimationFrame(raf);
        };
        resolve({
          stop() {
            end();
            window.setTimeout(() => ev.onEnd({ text: words.slice(0, said).join(" ") }), 700);
          },
          cancel: end,
        });
      }, 600);
    });
}

const sources = [
  { key: "sim", label: "Simulated", engine: simulated() },
  { key: "mic", label: "Your mic", engine: browserVoiceEngine },
  { key: "blocked", label: "Blocked", engine: simulated({ deny: true }) },
] as const;

export default function Demo() {
  const [source, setSource] = useState<(typeof sources)[number]["key"]>("sim");
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const engine = sources.find((s) => s.key === source)!.engine;

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3">
      <div className="rounded-2xl border border-line-2 bg-raised shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10">
        <label htmlFor="voice-demo" className="sr-only">Message</label>
        <textarea
          id="voice-demo"
          ref={field}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask the agent to reschedule, draft or look something up"
          className="block w-full resize-none bg-transparent px-3.5 pt-3 text-base leading-[1.5] text-fg outline-none placeholder:text-fg-4 sm:text-[13.5px]"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <span className="min-w-0 flex-1 truncate pl-1.5 text-[11.5px] text-fg-4"><span className="max-sm:hidden">Esc cancels while listening</span></span>
          <VoiceInput
            key={source}
            engine={engine}
            onTranscript={(t) => {
              setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${t}` : t));
              field.current?.focus();
            }}
          />
          <button
            type="button"
            aria-label="Send"
            disabled={!text.trim()}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-fg text-frame outline-none transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.92] disabled:opacity-30"
          >
            <ArrowUp />
          </button>
        </div>
      </div>

      <div role="group" aria-label="Voice source" className="flex items-center gap-1 self-center rounded-lg border border-line p-0.5">
        {sources.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={source === s.key}
            onClick={() => setSource(s.key)}
            className={cn(
              "h-6 rounded-md px-2 text-[11.5px] outline-none transition-[background-color,color,scale] duration-150 active:scale-[0.96]",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              source === s.key ? "bg-fg/[0.07] text-fg" : "text-fg-3 hover:text-fg",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
