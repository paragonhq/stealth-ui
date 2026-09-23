"use client";
import { useEffect, useRef, useState } from "react";
import { MessageComposer } from "@/components/ui/message-composer";
import type { MessageStatusValue } from "@/components/ui/message-status";
import { ReplyPreview, type ReplyTarget } from "@/components/ui/reply-preview";
import { VoiceMessage } from "@/components/ui/voice-message";
import { ChatThread, type ChatAuthor, type ChatMessage } from "@/components/ui/chat-thread";

const authors: ChatAuthor[] = [
  { id: "me", name: "You" },
  { id: "maya", name: "Maya Chen", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces&q=70" },
];

const answers = ["Perfect, that’s what Priya needed.", "Thanks. I’ll forward it to the board list.", "Got it. Talk at standup."];

// A few seconds of soft hum shaped into syllables, so the voice note has something to play.
function voiceNote(seconds: number) {
  const rate = 12000;
  const n = seconds * rate;
  const buffer = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const syllable = Math.max(0, Math.sin(t * Math.PI * 3.1)) * (0.55 + 0.45 * Math.sin(t * 1.7)) * (t % 3.2 > 2.8 ? 0 : 1);
    const s = 0.5 * Math.sin(2 * Math.PI * 160 * t) + 0.25 * Math.sin(4 * Math.PI * 160 * t);
    v.setInt16(44 + i * 2, s * syllable * 0.45 * 32767, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

const voicePeaks = Array.from({ length: 48 }, (_, i) => {
  const t = (i / 48) * 12;
  return Math.max(0, Math.sin(t * Math.PI * 3.1)) * (0.55 + 0.45 * Math.sin(t * 1.7)) * (t % 3.2 > 2.8 ? 0.1 : 1);
});

function seed(now: number): ChatMessage[] {
  const min = 60_000;
  const today = new Date(now);
  const at = (h: number, m: number, daysAgo = 0) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, h, m).getTime();
  return [
    { id: "y1", authorId: "maya", at: at(18, 2, 1), text: "Board deck is locked. Thanks for turning the forecast around so fast." },
    { id: "y2", authorId: "me", at: at(18, 5, 1), text: "Anytime. I’ll send the appendix in the morning.", status: "read" },
    { id: "t1", authorId: "maya", at: now - 14 * min, text: "Morning. Did the EMEA numbers move after the FX update?" },
    { id: "t2", authorId: "maya", at: now - 14 * min, text: "Priya’s asking before standup." },
    { id: "t3", authorId: "me", at: now - 11 * min, text: "A little. Revenue is down 1.8% in euros, flat in dollars.", status: "read" },
    {
      id: "t4",
      authorId: "me",
      at: now - 11 * min,
      text: "I’ll put both in the appendix.",
      status: "read",
      replyTo: { id: "t1", author: "Maya Chen", text: "Morning. Did the EMEA numbers move after the FX update?" },
    },
    { id: "t5", authorId: "maya", at: now - 6 * min, content: null, bare: true },
    { id: "t6", authorId: "me", at: now - 2 * min, text: "Sending the updated appendix now.", status: "failed" },
  ];
}

export default function Demo() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => seed(Math.floor(Date.now() / 60_000) * 60_000));
  const [voiceUrl, setVoiceUrl] = useState<string>();
  const [typing, setTyping] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const timers = useRef<number[]>([]);
  const sent = useRef(0);
  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = voiceNote(12);
    const t = window.setTimeout(() => setVoiceUrl(url), 0);
    const all = timers.current;
    return () => {
      window.clearTimeout(t);
      URL.revokeObjectURL(url);
      all.forEach((x) => window.clearTimeout(x));
    };
  }, []);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const setStatus = (id: string, status: MessageStatusValue) => setMessages((all) => all.map((m) => (m.id === id ? { ...m, status } : m)));

  // A believable round trip: the ticks advance, Maya reads it, types, and answers.
  const deliver = (id: string, answer: boolean) => {
    setStatus(id, "sending");
    later(700, () => setStatus(id, "sent"));
    later(1500, () => setStatus(id, "delivered"));
    later(2400, () => {
      setStatus(id, "read");
      if (!answer) return;
      setTyping(["maya"]);
      later(2200, () => {
        setTyping([]);
        setMessages((all) => [...all, { id: `a-${id}`, authorId: "maya", at: Date.now(), text: answers[sent.current % answers.length] }]);
      });
    });
  };

  const add = (m: Omit<ChatMessage, "id" | "authorId" | "at" | "status">) => {
    sent.current += 1;
    const id = `me-${sent.current}`;
    setMessages((all) => [...all, { ...m, id, authorId: "me", at: Date.now(), status: "sending" }]);
    deliver(id, true);
  };

  const withVoice = messages.map((m) =>
    m.id === "t5" ? { ...m, content: <VoiceMessage src={voiceUrl} peaks={voicePeaks} duration={12} preload="auto" label="Voice message from Maya Chen" /> } : m,
  );

  return (
    <div ref={shell} className="flex h-[520px] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-line bg-frame shadow-[var(--shadow)]">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- demo avatar */}
        <img src={authors[1].avatar} alt="" width={28} height={28} className="size-7 rounded-full bg-hover object-cover" />
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] font-medium leading-4 text-fg">Maya Chen</span>
          <span className="text-[11px] leading-4 text-fg-3">Finance · Active now</span>
        </div>
      </div>

      <ChatThread
        className="min-h-0 flex-1"
        label="Conversation with Maya Chen"
        messages={withVoice}
        authors={authors}
        currentUserId="me"
        typing={typing}
        onReply={(m) => {
          setReplyTo({ id: m.id, author: m.authorId === "me" ? "You" : "Maya Chen", text: m.text, kind: m.text ? "text" : "voice", detail: m.text ? undefined : "0:12" });
          shell.current?.querySelector("textarea")?.focus();
        }}
        onRetry={(m) => deliver(m.id, false)}
        footer={
          <div className="shrink-0 px-3 pb-3">
            <MessageComposer
              placeholder="Message Maya"
              label="Message Maya Chen"
              header={<ReplyPreview target={replyTo} onCancel={() => setReplyTo(null)} />}
              onSend={({ text }) => {
                add({ text, replyTo: replyTo ?? undefined });
                setReplyTo(null);
              }}
              onVoice={(clip) =>
                add({ content: <VoiceMessage src={clip.url} peaks={clip.peaks} duration={clip.duration} own defaultPlayed label="Your voice message" />, bare: true })
              }
            />
          </div>
        }
      />
    </div>
  );
}
