"use client";
import { useEffect, useRef, useState } from "react";
import { File as FileIcon, Globe, Sparkle } from "@/lib/icons";
import { PromptInput, type PromptAttachment, type PromptMessage } from "@/components/ui/prompt-input";

const models = [
  { id: "auto", label: "Auto", description: "Picks the right model for each message" },
  { id: "fast", label: "Fast", description: "Quick answers for everyday questions" },
  { id: "thinking", label: "Thinking", description: "Reasons step by step before it answers" },
];

const tools = [
  { id: "search", label: "Search", icon: <Globe />, description: "Search the web for recent sources" },
  { id: "research", label: "Research", icon: <Sparkle />, description: "Run a longer, multi-step investigation" },
];

const seed: PromptAttachment[] = [{ id: "seed", name: "q3-forecast.xlsx", size: 184_320, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }];

const reply = "Q3 lands at $4.2M against a $4.0M plan. The gap is almost all enterprise renewals that slipped from June into July.";

// A composer at the foot of a thread. Sending posts the message and streams a
// short reply; the send button is Stop until it's done (Escape works too).
// Picked files upload with progress before Send unlocks.
export default function Demo() {
  const [attachments, setAttachments] = useState<PromptAttachment[]>(seed);
  const [sent, setSent] = useState<PromptMessage | null>(null);
  const [answer, setAnswer] = useState("");
  const [generating, setGenerating] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Fake uploads: new non-image files fill their ring over about a second and a half.
  const uploading = attachments.some((a) => a.progress != null && a.progress < 1);
  useEffect(() => {
    if (!uploading || !onScreen) return;
    const t = window.setInterval(() => {
      setAttachments((list) => list.map((a) => (a.progress != null && a.progress < 1 ? { ...a, progress: Math.min(1, a.progress + 0.09) } : a)));
    }, 120);
    return () => window.clearInterval(t);
  }, [uploading, onScreen]);

  // Fake reply: a short pause, then the text streams in.
  useEffect(() => {
    if (!generating || !onScreen) return;
    let n = 0;
    const t = window.setInterval(() => {
      n += 3;
      // A beat of "reading" before the first words.
      if (n < 30) return;
      const shown = n - 30;
      setAnswer(reply.slice(0, shown));
      if (shown >= reply.length) setGenerating(false);
    }, 45);
    return () => window.clearInterval(t);
  }, [generating, onScreen]);

  return (
    <div ref={root} className="flex w-full max-w-[520px] flex-col gap-4">
      <div className="flex min-h-[148px] flex-col justify-end gap-3">
        {sent ? (
          <>
            <div className="flex max-w-[85%] flex-col items-end gap-1.5 self-end">
              {sent.attachments.length > 0 && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {sent.attachments.map((a) => (
                    <span key={a.id} className="inline-flex h-7 max-w-[12rem] items-center gap-1.5 rounded-lg border border-line bg-raised px-2 text-[12px] text-fg-2">
                      <FileIcon size={14} className="shrink-0 text-fg-3" />
                      <span className="truncate">{a.name}</span>
                    </span>
                  ))}
                </div>
              )}
              {sent.text && <div className="rounded-2xl rounded-br-md bg-fg/[0.06] px-3.5 py-2 text-[13px] leading-5 text-fg [overflow-wrap:anywhere]">{sent.text}</div>}
            </div>
            <p className="min-h-5 text-[13px] leading-5 text-fg">
              {answer || <span className="text-fg-3">Reading q3-forecast.xlsx…</span>}
            </p>
          </>
        ) : (
          <p className="text-center text-[12.5px] text-fg-3">Type, drop a file on the box, or press Send.</p>
        )}
      </div>

      <PromptInput
        placeholder="Ask about your numbers"
        defaultValue="How did Q3 compare with the forecast?"
        attachments={attachments}
        onAttachmentsChange={(next) =>
          setAttachments(next.map((a) => (a.file && !a.type.startsWith("image/") && a.progress == null && !attachments.some((b) => b.id === a.id) ? { ...a, progress: 0 } : a)))
        }
        models={models}
        defaultModel="auto"
        tools={tools}
        defaultActiveTools={["search"]}
        generating={generating}
        onStop={() => setGenerating(false)}
        onSend={(message) => {
          setSent(message);
          setAnswer("");
          setGenerating(true);
        }}
      />
    </div>
  );
}
