"use client";
import { useEffect, useRef, useState } from "react";
import { formatBytes, MessageComposer, type ComposerAttachment } from "@/components/ui/message-composer";

type Sent = { id: number; text: string; files: { name: string; size: number; preview?: string }[]; voice?: number };

export default function Demo() {
  const [sent, setSent] = useState<Sent[]>([]);
  const [files, setFiles] = useState<ComposerAttachment[]>([]);
  const list = useRef<HTMLUListElement>(null);
  const uploads = useRef(new Map<string, number>());

  // Pretend each new file uploads over about a second and a half, so the chip shows its progress.
  useEffect(() => {
    for (const f of files) {
      if (f.progress !== undefined || uploads.current.has(f.id)) continue;
      const started = performance.now();
      const tick = () => {
        const p = Math.min(1, (performance.now() - started) / 1600);
        setFiles((all) => all.map((x) => (x.id === f.id ? { ...x, progress: p >= 1 ? 1 : p } : x)));
        if (p < 1) uploads.current.set(f.id, window.setTimeout(tick, 120));
      };
      uploads.current.set(f.id, window.setTimeout(tick, 0));
    }
  }, [files]);
  useEffect(() => {
    const timers = uploads.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [sent]);

  return (
    <div className="flex h-[420px] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-line bg-frame shadow-[var(--shadow)]">
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <span className="grid size-6 place-items-center rounded-full bg-hover text-[10px] font-medium text-fg-2">MC</span>
        <span className="text-[13px] font-medium text-fg">Maya Chen</span>
        <span className="text-[11.5px] text-fg-4">Finance</span>
      </div>

      <ul ref={list} aria-label="Conversation with Maya Chen" className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-4 py-4">
        <li className="max-w-[80%] self-start rounded-2xl bg-fg/[0.07] px-3 py-2 text-[13px] leading-5 text-fg">
          Can you send over the Q3 forecast before the board call?
        </li>
        {sent.map((m) => (
          <li key={m.id} className="flex max-w-[80%] flex-col items-end gap-1 self-end">
            {m.files.map((f) =>
              f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview
                <img key={f.name} src={f.preview} alt={f.name} className="max-h-32 rounded-2xl border border-line object-cover" />
              ) : (
                <span key={f.name} className="rounded-2xl bg-fg px-3 py-2 text-[12.5px] leading-5 text-frame">
                  {f.name} <span className="opacity-60 tabular">· {formatBytes(f.size)}</span>
                </span>
              ),
            )}
            {m.voice != null && (
              <span className="rounded-2xl bg-fg px-3 py-2 text-[12.5px] leading-5 text-frame tabular">Voice message · 0:{String(Math.round(m.voice)).padStart(2, "0")}</span>
            )}
            {m.text && <span className="whitespace-pre-wrap rounded-2xl bg-fg px-3 py-2 text-[13px] leading-5 text-pretty text-frame [overflow-wrap:anywhere]">{m.text}</span>}
          </li>
        ))}
      </ul>

      <div className="shrink-0 px-3 pb-1">
        <MessageComposer
          placeholder="Message Maya"
          label="Message Maya Chen"
          maxLength={500}
          maxFileSize={25_000_000}
          draftKey="demo-maya"
          attachments={files}
          onAttachmentsChange={setFiles}
          onSend={({ text, attachments }) =>
            setSent((all) => [...all, { id: all.length, text, files: attachments.map((a) => ({ name: a.name, size: a.size, preview: a.preview })) }])
          }
          onVoice={(clip) => setSent((all) => [...all, { id: all.length, text: "", files: [], voice: clip.duration }])}
        />
      </div>
    </div>
  );
}
