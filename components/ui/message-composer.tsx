"use client";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp, Mic, Paperclip, Trash, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Types and small helpers
 * -----------------------------------------------------------------------------------------------*/

export type ComposerAttachment = {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** MIME type. Images get a thumbnail. */
  type: string;
  /** The picked file, when it came from this composer. */
  file?: File;
  /** A URL to preview an image. The composer makes an object URL for picked images. */
  preview?: string;
  /** 0–1 while uploading. Leave undefined once it's done. */
  progress?: number;
  /** Why the upload failed, in a few words. */
  error?: string;
};

export type ComposerMessage = {
  text: string;
  attachments: ComposerAttachment[];
};

export type VoiceRecording = {
  blob: Blob;
  /** An object URL for the blob, ready for an audio element. Revoke it when you're done. */
  url: string;
  /** Seconds. */
  duration: number;
  /** 48 loudness samples, 0–1, for drawing a waveform without decoding the audio. */
  peaks: number[];
};

const units = ["B", "KB", "MB", "GB"];
/** "940 KB", "2.4 MB". */
export function formatBytes(bytes: number) {
  let n = bytes;
  let u = 0;
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000;
    u++;
  }
  return `${u === 0 ? n : n < 10 ? n.toFixed(1) : Math.round(n)} ${units[u]}`;
}

const clockFormat = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const splitName = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot > name.length - 8 ? [name.slice(0, dot), name.slice(dot + 1)] : [name, ""];
};

let seq = 0;
const nextId = () => `att-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const coarseQuery = "(pointer: coarse)";
const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia(coarseQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

const storage = {
  read(key: string) {
    try {
      return window.localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  },
  write(key: string, value: string) {
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch {
      /* Private mode or blocked storage: the draft just isn't kept. */
    }
  },
};

// Inserts through the editing pipeline so the browser's undo still works.
function insertAtCaret(el: HTMLTextAreaElement, text: string) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.focus({ preventScroll: true });
  el.setSelectionRange(start, end);
  let ok = false;
  try {
    ok = document.execCommand("insertText", false, text);
  } catch {
    ok = false;
  }
  if (!ok) {
    el.setRangeText(text, start, end, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export const defaultEmojis: { emoji: string; label: string }[] = [
  { emoji: "😀", label: "Grinning" },
  { emoji: "😂", label: "Tears of joy" },
  { emoji: "😊", label: "Smiling" },
  { emoji: "😍", label: "Heart eyes" },
  { emoji: "🥲", label: "Smiling with tear" },
  { emoji: "😅", label: "Sweat smile" },
  { emoji: "🤔", label: "Thinking" },
  { emoji: "🙃", label: "Upside down" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "😭", label: "Crying" },
  { emoji: "😴", label: "Sleeping" },
  { emoji: "🫡", label: "Salute" },
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "👎", label: "Thumbs down" },
  { emoji: "👏", label: "Clapping" },
  { emoji: "🙌", label: "Raised hands" },
  { emoji: "🙏", label: "Thank you" },
  { emoji: "🤝", label: "Handshake" },
  { emoji: "💪", label: "Flexed arm" },
  { emoji: "👀", label: "Eyes" },
  { emoji: "🎉", label: "Party popper" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "✨", label: "Sparkles" },
  { emoji: "💯", label: "Hundred" },
  { emoji: "✅", label: "Done" },
  { emoji: "❌", label: "Cross" },
  { emoji: "⚠️", label: "Warning" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "☕", label: "Coffee" },
  { emoji: "🍕", label: "Pizza" },
  { emoji: "🚀", label: "Rocket" },
  { emoji: "💡", label: "Idea" },
  { emoji: "📌", label: "Pin" },
  { emoji: "📎", label: "Paperclip" },
  { emoji: "📅", label: "Calendar" },
  { emoji: "📈", label: "Chart up" },
  { emoji: "🐛", label: "Bug" },
  { emoji: "🧪", label: "Test tube" },
  { emoji: "🔒", label: "Lock" },
  { emoji: "🎯", label: "Target" },
];

/* -------------------------------------------------------------------------------------------------
 * useVoiceRecorder: microphone, live levels and the finished clip, without any UI
 * -----------------------------------------------------------------------------------------------*/

export type RecorderState = "idle" | "starting" | "recording";

/** Records from the microphone. Live `levels` (0–1) update about 16 times a second while recording. */
export function useVoiceRecorder({ onError }: { onError?: (message: string) => void } = {}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [levels, setLevels] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const session = useRef<{
    stream: MediaStream;
    recorder: MediaRecorder;
    ctx: AudioContext;
    chunks: Blob[];
    all: number[];
    started: number;
    raf: number;
  } | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const teardown = useCallback(() => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    cancelAnimationFrame(s.raf);
    s.stream.getTracks().forEach((t) => t.stop());
    void s.ctx.close().catch(() => {});
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    if (session.current) return;
    setState("starting");
    setLevels([]);
    setElapsed(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new DOMException("", "NotSupportedError");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const recorder = new MediaRecorder(stream);
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      const s = {
        stream,
        recorder,
        ctx,
        chunks: [] as Blob[],
        all: [] as number[],
        started: performance.now(),
        raf: 0,
      };
      session.current = s;
      recorder.ondataavailable = (e) => e.data.size && s.chunks.push(e.data);
      recorder.start(250);
      setState("recording");

      // Sample loudness ~16 times a second: enough for bars that feel live, cheap enough to re-render.
      let last = 0;
      const tick = (now: number) => {
        s.raf = requestAnimationFrame(tick);
        if (now - last < 60) return;
        last = now;
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const level = Math.min(1, Math.sqrt(sum / buffer.length) * 4.5);
        s.all.push(level);
        setLevels((l) => (l.length >= 72 ? [...l.slice(1), level] : [...l, level]));
        setElapsed((now - s.started) / 1000);
      };
      s.raf = requestAnimationFrame(tick);
    } catch (error) {
      teardown();
      setState("idle");
      const name = error instanceof DOMException ? error.name : "";
      onErrorRef.current?.(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access is blocked. Allow it in your browser’s site settings."
          : name === "NotFoundError"
            ? "No microphone found. Connect one and try again."
            : name === "NotSupportedError"
              ? "This browser can’t record audio."
              : "Couldn’t start recording. Try again.",
      );
    }
  }, [teardown]);

  const cancel = useCallback(() => {
    session.current?.recorder.state !== "inactive" && session.current?.recorder.stop();
    teardown();
    setState("idle");
  }, [teardown]);

  /** Stops and resolves with the clip, or null if nothing usable was recorded. */
  const stop = useCallback(
    () =>
      new Promise<VoiceRecording | null>((resolve) => {
        const s = session.current;
        if (!s) return resolve(null);
        const duration = (performance.now() - s.started) / 1000;
        s.recorder.onstop = () => {
          const blob = new Blob(s.chunks, {
            type: s.recorder.mimeType || "audio/webm",
          });
          const peaks = Array.from({ length: 48 }, (_, i) => {
            const from = Math.floor((i / 48) * s.all.length);
            const to = Math.max(from + 1, Math.floor(((i + 1) / 48) * s.all.length));
            const slice = s.all.slice(from, to);
            return slice.length ? Math.max(...slice) : 0;
          });
          resolve(blob.size ? { blob, url: URL.createObjectURL(blob), duration, peaks } : null);
        };
        s.recorder.stop();
        teardown();
        setState("idle");
      }),
    [teardown],
  );

  return { state, levels, elapsed, start, stop, cancel };
}

/* -------------------------------------------------------------------------------------------------
 * MessageComposer
 * -----------------------------------------------------------------------------------------------*/

export type MessageComposerProps = Omit<React.ComponentProps<"form">, "onSubmit" | "defaultValue" | "onChange"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (text: string) => void;
  attachments?: ComposerAttachment[];
  defaultAttachments?: ComposerAttachment[];
  onAttachmentsChange?: (attachments: ComposerAttachment[]) => void;
  /** Called with the trimmed text and the attachments. The composer clears itself straight away. */
  onSend: (message: ComposerMessage) => void;
  /** Turns on voice notes: the button shows a mic while the field is empty. */
  onVoice?: (recording: VoiceRecording) => void;
  /** Fires true while someone is typing and false 3s after they stop, send or leave. */
  onTypingChange?: (typing: boolean) => void;
  placeholder?: string;
  /** Soft limit. A count appears in the last 10% and sending stops past it. */
  maxLength?: number;
  /** Lines before the field scrolls instead of growing. */
  maxRows?: number;
  /** File types the picker offers, as for an input's accept. */
  accept?: string;
  /** Bytes. Larger files are refused with a message that names them. */
  maxFileSize?: number;
  /** Keep the draft in localStorage under this key, so a reload doesn't lose it. */
  draftKey?: string;
  /** Emoji in the picker, in order. */
  emojis?: { emoji: string; label: string }[];
  /** Above the field, inside the box: a reply preview, an editing banner. */
  header?: React.ReactNode;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Where the emoji picker and tooltips portal. Defaults to document.body. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  /** The field's accessible name. */
  label?: string;
};

type Notice = { id: number; text: string };

/**
 * A chat composer that grows with its text, takes files by picker, paste or drop, inserts
 * emoji at the caret, and turns its mic into a send button the moment there's something to send.
 */
export function MessageComposer({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  attachments: attachmentsProp,
  defaultAttachments = [],
  onAttachmentsChange,
  onSend,
  onVoice,
  onTypingChange,
  placeholder = "Message",
  maxLength,
  maxRows = 8,
  accept,
  maxFileSize,
  draftKey,
  emojis = defaultEmojis,
  header,
  disabled = false,
  autoFocus = false,
  container,
  label = "Message",
  className,
  ...rest
}: MessageComposerProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const noticeId = `${uid}-notice`;
  const coarse = useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia(coarseQuery).matches,
    () => false,
  );

  const [text, setText] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange: onValueChange,
  });
  const [files, setFiles] = useControllableState({
    value: attachmentsProp,
    defaultValue: defaultAttachments,
    onChange: onAttachmentsChange,
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [atMax, setAtMax] = useState(false);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const replicaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number>(undefined);
  const typingTimer = useRef<number>(undefined);
  const typing = useRef(false);
  const dragDepth = useRef(0);
  const madeUrls = useRef(new Set<string>());
  const pickedEmoji = useRef(false);

  const say = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice((n) => ({ id: (n?.id ?? 0) + 1, text: message }));
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6000);
  }, []);

  const recorder = useVoiceRecorder({ onError: say });
  const recording = recorder.state !== "idle";

  /* ----- draft ----- */
  const draftStorageKey = draftKey ? `stealth:message-draft:${draftKey}` : null;
  const restored = useRef(false);
  useEffect(() => {
    if (!draftStorageKey || restored.current) return;
    restored.current = true;
    if (valueProp !== undefined || text) return;
    const saved = storage.read(draftStorageKey);
    // A one-time sync from storage after hydration.
    if (saved) setText(saved);
  }, [draftStorageKey, valueProp, text, setText]);
  useEffect(() => {
    if (!draftStorageKey || !restored.current) return;
    const t = window.setTimeout(() => storage.write(draftStorageKey, text), 300);
    return () => window.clearTimeout(t);
  }, [draftStorageKey, text]);

  /* ----- typing signal ----- */
  const onTypingRef = useRef(onTypingChange);
  useEffect(() => {
    onTypingRef.current = onTypingChange;
  }, [onTypingChange]);
  const stopTyping = useCallback(() => {
    window.clearTimeout(typingTimer.current);
    if (!typing.current) return;
    typing.current = false;
    onTypingRef.current?.(false);
  }, []);
  const markTyping = () => {
    if (!typing.current) {
      typing.current = true;
      onTypingRef.current?.(true);
    }
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(stopTyping, 3000);
  };

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimer.current);
      window.clearTimeout(typingTimer.current);
    },
    [],
  );

  /* ----- height: follows the replica; grows upward so the caret line never leaves view ----- */
  const lineHeight = 20;
  const maxHeight = maxRows * lineHeight + 12;
  const height = useMotionValue<number | "auto">("auto");
  useEffect(() => {
    const el = replicaRef.current;
    if (!el) return;
    let last = el.offsetHeight;
    let running: AnimationPlaybackControls | undefined;
    const ro = new ResizeObserver(() => {
      const next = el.offsetHeight;
      setAtMax(el.scrollHeight > el.clientHeight + 1);
      if (next === last) return;
      const from = last;
      last = next;
      running?.stop();
      if (reduce) return height.set(next);
      if (height.get() === "auto") height.set(from);
      running = animate(height, next, { duration: 0.12, ease: ease.out });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      running?.stop();
    };
  }, [height, reduce]);

  /* ----- attachments ----- */
  const addFiles = (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (!picked.length) return;
    const tooBig = maxFileSize ? picked.filter((f) => f.size > maxFileSize) : [];
    const ok = picked.filter((f) => !tooBig.includes(f));
    if (tooBig.length) {
      const limit = formatBytes(maxFileSize!);
      say(tooBig.length === 1 ? `${tooBig[0].name} is over ${limit}. Choose a smaller file.` : `${tooBig.length} files are over ${limit}. Choose smaller files.`);
    }
    if (!ok.length) return;
    const added = ok.map<ComposerAttachment>((file) => {
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (preview) madeUrls.current.add(preview);
      return {
        id: nextId(),
        name: file.name || "Pasted image",
        size: file.size,
        type: file.type,
        file,
        preview,
      };
    });
    setFiles((prev) => [...prev, ...added]);
    areaRef.current?.focus({ preventScroll: true });
  };

  const removeFile = (id: string) => {
    const gone = files.find((f) => f.id === id);
    if (gone?.preview && madeUrls.current.has(gone.preview)) {
      URL.revokeObjectURL(gone.preview);
      madeUrls.current.delete(gone.preview);
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
    areaRef.current?.focus({ preventScroll: true });
  };

  /* ----- send ----- */
  const trimmed = text.trim();
  const over = maxLength != null && text.length > maxLength;
  const near = maxLength != null && text.length >= maxLength * 0.9;
  const hasContent = trimmed.length > 0 || files.length > 0;
  const canSend = hasContent && !over && !disabled;
  const showMic = !!onVoice && !hasContent;

  const send = () => {
    if (!canSend) return;
    onSend({ text: trimmed, attachments: files });
    // Sent previews now belong to the message; stop tracking them so they aren't revoked.
    for (const f of files) if (f.preview) madeUrls.current.delete(f.preview);
    setText("");
    setFiles([]);
    if (draftStorageKey) storage.write(draftStorageKey, "");
    stopTyping();
    setNotice(null);
    areaRef.current?.focus({ preventScroll: true });
  };

  const startRecording = () => {
    setNotice(null);
    void recorder.start();
  };

  const finishRecording = async () => {
    const clip = await recorder.stop();
    if (!clip || clip.duration < 1) {
      if (clip) URL.revokeObjectURL(clip.url);
      say("Too short to send. Record for at least a second.");
    } else onVoice?.(clip);
  };

  const cancelRecording = () => recorder.cancel();

  // When a recording ends either way, the caret goes back to the text. It waits for the
  // row to stop being inert, because an inert field can't take focus.
  const wasRecording = useRef(false);
  useEffect(() => {
    if (wasRecording.current && !recording) areaRef.current?.focus({ preventScroll: true });
    wasRecording.current = recording;
  }, [recording]);

  const counter = maxLength != null && near && !recording;
  const noticeText = notice?.text ?? (counter ? (over ? `${text.length - maxLength!} over the ${maxLength} character limit` : `${maxLength! - text.length} characters left`) : "");

  const iconButton = cn(
    "relative grid size-8 shrink-0 place-items-center rounded-full text-fg-3 outline-none",
    "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
    "disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-hover data-popup-open:text-fg",
    // 32px circles; on touch the target grows to 44px without changing the drawing.
    "before:absolute before:-inset-1.5 before:rounded-full before:content-[''] pointer-fine:before:hidden",
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      data-disabled={disabled || undefined}
      data-state={recording ? "recording" : hasContent ? "ready" : "empty"}
      className={cn("flex w-full min-w-0 flex-col gap-1.5", className)}
      {...rest}
    >
      <Tooltip.Provider delay={500} closeDelay={0}>
        <div
          onDragEnter={(e) => {
            if (disabled || recording || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            dragDepth.current++;
            setDragging(true);
          }}
          onDragOver={(e) => {
            if (dragging) e.preventDefault();
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (!dragDepth.current) setDragging(false);
          }}
          onDrop={(e) => {
            if (!dragging) return;
            e.preventDefault();
            dragDepth.current = 0;
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onMouseDown={(e) => {
            // A press on the box's padding puts the caret in the text rather than doing nothing.
            if (e.target === e.currentTarget && !recording) {
              e.preventDefault();
              areaRef.current?.focus();
            }
          }}
          className={cn(
            "relative flex min-w-0 flex-col rounded-[20px] border bg-raised shadow-[var(--shadow)]",
            "transition-[border-color,box-shadow,opacity] duration-150 ease-out",
            "has-[textarea:focus-visible]:ring-3",
            over
              ? "border-danger/50 has-[textarea:focus-visible]:border-danger/60 has-[textarea:focus-visible]:ring-danger/12"
              : cn(dragging ? "border-fg-3" : "border-line-2 hover:border-fg-4", "has-[textarea:focus-visible]:border-fg-4 has-[textarea:focus-visible]:ring-fg/8"),
            disabled && "pointer-events-none opacity-50",
          )}
        >
          {header}

          {/* Attachments: a strip that opens above the text and closes when the last one goes. */}
          <AnimatePresence initial={false}>
            {files.length > 0 && !recording && (
              <motion.div
                key="strip"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: { duration: reduce ? 0 : 0.16, ease: ease.inOut },
                }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        height: { duration: 0.22, ease: ease.out },
                        opacity: { duration: 0.16 },
                      }
                }
                className="overflow-hidden"
              >
                <ul aria-label="Attachments" className="flex gap-2 overflow-x-auto overscroll-x-contain px-2 pb-1 pt-2.5 [scrollbar-width:none]">
                  <AnimatePresence initial={false} mode="popLayout">
                    {files.map((f) => (
                      <Chip key={f.id} file={f} reduce={reduce} onRemove={() => removeFile(f.id)} />
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex min-w-0 items-end gap-0.5 p-1">
            {/* The text row stays mounted under the recorder, so the draft, the caret and the
                measured height are all still there when recording ends. */}
            <AnimatePresence initial={false}>
              {recording && (
                <RecordingRow
                  key="rec"
                  reduce={reduce}
                  starting={recorder.state === "starting"}
                  levels={recorder.levels}
                  elapsed={recorder.elapsed}
                  onCancel={cancelRecording}
                  onSend={finishRecording}
                  iconButton={iconButton}
                  container={container}
                />
              )}
            </AnimatePresence>
            <motion.div
              inert={recording || undefined}
              className="flex min-w-0 flex-1 items-end gap-0.5"
              initial={false}
              animate={recording ? { opacity: 0, filter: reduce ? "blur(0px)" : "blur(2px)" } : { opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: recording ? 0.1 : 0.18, ease: ease.out }}
            >
              <Tip label="Attach files" container={container}>
                <button type="button" aria-label="Attach files" disabled={disabled} onClick={() => fileRef.current?.click()} className={iconButton}>
                  <Paperclip className="transition-transform duration-200 ease-out-expo group-hover:rotate-0" />
                </button>
              </Tip>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={accept}
                tabIndex={-1}
                aria-hidden
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {/* The replica sets the height; the textarea fills it. Both share every text metric. */}
              <motion.div style={{ height }} className="relative min-w-0 flex-1 overflow-hidden">
                <div
                  ref={replicaRef}
                  aria-hidden
                  style={{ maxHeight }}
                  className="invisible overflow-hidden whitespace-pre-wrap px-2 py-1.5 text-base leading-5 [overflow-wrap:anywhere] sm:text-[13px]"
                >
                  {text + " "}
                </div>
                <textarea
                  ref={areaRef}
                  value={text}
                  rows={1}
                  disabled={disabled}
                  autoFocus={autoFocus}
                  placeholder={placeholder}
                  aria-label={label}
                  aria-invalid={over || undefined}
                  aria-describedby={noticeText ? noticeId : undefined}
                  aria-keyshortcuts={coarse ? undefined : "Enter"}
                  enterKeyHint={coarse ? "enter" : "send"}
                  autoComplete="off"
                  onChange={(e) => {
                    setText(e.target.value);
                    if (e.target.value) markTyping();
                    else stopTyping();
                    if (notice) setNotice(null);
                  }}
                  onBlur={stopTyping}
                  onPaste={(e) => {
                    if (e.clipboardData.files.length) {
                      e.preventDefault();
                      addFiles(e.clipboardData.files);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key !== "Enter") return;
                    // Enter sends on a keyboard; on a phone it's a new line and the button sends.
                    const mod = e.metaKey || e.ctrlKey;
                    if (e.shiftKey || e.altKey || (coarse && !mod)) return;
                    e.preventDefault();
                    send();
                  }}
                  className={cn(
                    "absolute inset-0 block size-full resize-none bg-transparent px-2 py-1.5 text-base leading-5 text-fg outline-none [overflow-wrap:anywhere] sm:text-[13px]",
                    "placeholder:text-fg-4 disabled:cursor-not-allowed",
                    // Past the last row it scrolls, and the top edge fades so a cut line reads as "more above".
                    atMax ? "overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_14px)]" : "overflow-y-hidden",
                  )}
                />
              </motion.div>

              <Popover.Root open={emojiOpen} onOpenChange={setEmojiOpen}>
                <Tip label="Emoji" container={container} disabled={emojiOpen}>
                  <Popover.Trigger aria-label="Add emoji" disabled={disabled} className={cn(iconButton, "group/emoji")}>
                    <SmileGlyph />
                  </Popover.Trigger>
                </Tip>
                <Popover.Portal container={container}>
                  <Popover.Positioner side="top" align="end" sideOffset={10} collisionPadding={8} className="z-(--z-popover)">
                    <Popover.Popup
                      finalFocus={() => {
                        // After a pick the caret goes back to the text; Escape returns to the button.
                        if (pickedEmoji.current) {
                          pickedEmoji.current = false;
                          return areaRef.current;
                        }
                        return true;
                      }}
                      className={cn(
                        "rounded-xl border border-line-2 bg-raised p-1.5 text-fg shadow-pop outline-none",
                        "origin-(--transform-origin) transition-[opacity,scale,translate,filter] duration-180 ease-out-expo",
                        "data-starting-style:scale-[0.94] data-starting-style:opacity-0 data-starting-style:blur-[2px] data-[side=top]:data-starting-style:translate-y-1",
                        "data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-120 data-ending-style:ease-out-quart",
                        "data-instant:transition-none motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:blur-none",
                      )}
                    >
                      <Popover.Title className="sr-only">Emoji</Popover.Title>
                      <EmojiGrid
                        emojis={emojis}
                        onPick={(emoji) => {
                          pickedEmoji.current = true;
                          setEmojiOpen(false);
                          const el = areaRef.current;
                          if (el) insertAtCaret(el, emoji);
                        }}
                      />
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>

              <SendButton
                mic={showMic}
                ready={canSend}
                disabled={disabled || (!showMic && !canSend)}
                reduce={reduce}
                shortcut={coarse ? undefined : "Enter"}
                container={container}
                onMic={startRecording}
              />
            </motion.div>
          </div>

          {/* Drop target: the whole box, said plainly. */}
          <AnimatePresence>
            {dragging && (
              <motion.div
                key="drop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.14 }}
                className="pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] bg-raised/95"
              >
                <span className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
                  <Paperclip className="text-fg-3" />
                  Drop to attach
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Tooltip.Provider>

      {/* One line under the box for anything that needs saying: a refused file, the mic, the limit.
          It opens only when there's something to say, so the composer sits flush the rest of the time. */}
      <div
        className={cn(
          "-mt-1.5 grid transition-[grid-template-rows,margin] duration-200 ease-out-expo motion-reduce:transition-none",
          noticeText ? "mt-0 grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="relative min-h-0 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            {noticeText && (
              <motion.p
                key={notice ? `n${notice.id}` : "count"}
                id={noticeId}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18, ease: ease.out }}
                className={cn("truncate px-3 text-[11.5px] leading-4 tabular", notice || over ? "text-danger" : "text-fg-3", !notice && "text-right")}
              >
                {noticeText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {notice?.text ?? (over ? "Over the character limit" : "")}
      </span>
    </form>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The send button: a mic while there's nothing to send, a filled disc the moment there is
 * -----------------------------------------------------------------------------------------------*/

function SendButton({
  mic,
  ready,
  disabled,
  reduce,
  shortcut,
  container,
  onMic,
}: {
  mic: boolean;
  ready: boolean;
  disabled: boolean;
  reduce: boolean;
  shortcut?: string;
  container?: MessageComposerProps["container"];
  onMic: () => void;
}) {
  const filled = ready && !mic;
  const tip = mic ? "Record voice message" : "Send";
  return (
    <Tip label={tip} keys={!mic ? shortcut && "↵" : undefined} container={container}>
      <button
        type={mic ? "button" : "submit"}
        aria-label={mic ? "Record voice message" : "Send message"}
        aria-keyshortcuts={!mic ? shortcut : undefined}
        disabled={disabled}
        data-state={mic ? "mic" : filled ? "ready" : "empty"}
        onClick={mic ? onMic : undefined}
        className={cn(
          "group/send relative grid size-8 shrink-0 place-items-center rounded-full outline-none",
          "transition-[color,scale] duration-150 ease-out active:scale-[0.9] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          "before:absolute before:-inset-1.5 before:rounded-full before:content-[''] pointer-fine:before:hidden",
          filled ? "text-frame" : mic ? "text-fg-3 hover:bg-hover hover:text-fg" : "text-fg-4",
          "disabled:pointer-events-none",
        )}
      >
        {/* The disc fills from the centre when there's something to send, and drains when there isn't. */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-fg transition-[background-color] duration-150 group-hover/send:bg-fg/90"
          initial={false}
          animate={filled ? { scale: 1, opacity: 1 } : mic ? { scale: 0.4, opacity: 0 } : { scale: 1, opacity: 0.1 }}
          transition={reduce ? { duration: 0.12 } : filled ? spring.pop : { duration: 0.16, ease: ease.out }}
        />
        <span className="relative grid size-4 place-items-center">
          <AnimatePresence initial={false}>
            <motion.span
              key={mic ? "mic" : "send"}
              className="absolute inset-0 grid place-items-center"
              initial={
                reduce
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      scale: 0.5,
                      rotate: mic ? 0 : -45,
                      filter: "blur(3px)",
                    }
              }
              animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      scale: 0.5,
                      filter: "blur(3px)",
                      transition: { duration: 0.12 },
                    }
              }
              transition={reduce ? { duration: 0.12 } : spring.pop}
            >
              {mic ? <Mic /> : <ArrowUp strokeWidth={1.7} />}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
    </Tip>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Recording row: cancel, a live clock, bars that scroll in from the right, send
 * -----------------------------------------------------------------------------------------------*/

function RecordingRow({
  reduce,
  starting,
  levels,
  elapsed,
  onCancel,
  onSend,
  iconButton,
  container,
}: {
  reduce: boolean;
  starting: boolean;
  levels: number[];
  elapsed: number;
  onCancel: () => void;
  onSend: () => void;
  iconButton: string;
  container?: MessageComposerProps["container"];
}) {
  const sendRef = useRef<HTMLButtonElement>(null);
  // Focus lands on send once the mic is live, so Enter sends and Escape discards.
  useEffect(() => {
    if (!starting) sendRef.current?.focus({ preventScroll: true });
  }, [starting]);

  return (
    <motion.div
      className="absolute inset-1 z-1 flex min-w-0 items-center gap-0.5"
      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.18, ease: ease.out }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <Tip label="Discard recording" keys="Esc" container={container}>
        <button type="button" aria-label="Discard recording" onClick={onCancel} className={cn(iconButton, "hover:text-danger")}>
          <Trash />
        </button>
      </Tip>

      <div className="flex h-8 min-w-0 flex-1 items-center gap-2.5 px-1.5">
        <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-fg tabular">
          <span aria-hidden className="relative grid size-2 place-items-center">
            <span className="size-2 rounded-full bg-danger" />
            {!starting && <span className="absolute inset-0 rounded-full bg-danger motion-safe:animate-ping-soft" />}
          </span>
          <span className="w-9">{starting ? "0:00" : clockFormat(elapsed)}</span>
        </span>
        {starting ? (
          <span className="truncate text-[12.5px] text-fg-3">Waiting for the microphone…</span>
        ) : (
          <span aria-hidden className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
            {levels.map((l, i) => (
              <span key={levels.length - i} className="w-[2px] shrink-0 rounded-full bg-fg/70" style={{ height: `${Math.max(2, Math.round(2 + l * 20))}px` }} />
            ))}
          </span>
        )}
      </div>

      <Tip label="Send voice message" keys="↵" container={container}>
        <button
          ref={sendRef}
          type="button"
          aria-label="Send voice message"
          disabled={starting}
          onClick={onSend}
          className={cn(
            "relative grid size-8 shrink-0 place-items-center rounded-full bg-fg text-frame outline-none",
            "transition-[background-color,scale,opacity] duration-150 ease-out hover:bg-fg/90 active:scale-[0.9] active:duration-75 disabled:opacity-40",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
            "before:absolute before:-inset-1.5 before:rounded-full before:content-[''] pointer-fine:before:hidden",
          )}
        >
          <ArrowUp strokeWidth={1.7} />
        </button>
      </Tip>
      <span role="status" aria-live="polite" className="sr-only">
        {starting ? "Waiting for the microphone" : "Recording. Press Enter to send or Escape to discard."}
      </span>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Attachment chip
 * -----------------------------------------------------------------------------------------------*/

function Chip({ file, reduce, onRemove }: { file: ComposerAttachment; reduce: boolean; onRemove: () => void }) {
  const image = !!file.preview && file.type.startsWith("image/");
  const [base, ext] = splitName(file.name);
  const uploading = file.progress != null && file.progress < 1 && !file.error;
  const [broken, setBroken] = useState(false);

  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, filter: "blur(2px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.1 } }
          : {
              opacity: 0,
              scale: 0.85,
              filter: "blur(2px)",
              transition: { duration: 0.12, ease: ease.in },
            }
      }
      transition={reduce ? { duration: 0.12 } : { ...spring.pop, layout: spring.snappy }}
      data-error={file.error ? "" : undefined}
      className="group/chip relative shrink-0"
    >
      <div
        className={cn(
          "relative flex h-12 items-center overflow-hidden rounded-xl border bg-frame",
          file.error ? "border-danger/50" : "border-line-2",
          image ? "w-12" : "max-w-[220px] gap-2.5 pl-1.5 pr-3",
        )}
      >
        {image && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={file.preview} alt="" onError={() => setBroken(true)} className="size-full object-cover" />
        ) : (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-hover font-mono text-[9.5px] uppercase tracking-[0.04em] text-fg-2">
              {(ext || (image ? "img" : "file")).slice(0, 4)}
            </span>
            {!image && (
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 text-[12.5px] leading-4 text-fg">
                  <span className="truncate">{base}</span>
                  {ext && <span className="shrink-0">.{ext}</span>}
                </span>
                <span className={cn("text-[11px] leading-4 tabular", file.error ? "text-danger" : "text-fg-3")}>
                  {file.error ?? (uploading ? `${Math.round((file.progress ?? 0) * 100)}% of ${formatBytes(file.size)}` : formatBytes(file.size))}
                </span>
              </span>
            )}
          </>
        )}
        {uploading && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] bg-fg/10">
            <span className="block h-full origin-left bg-fg transition-transform duration-200 ease-out" style={{ transform: `scaleX(${file.progress})` }} />
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
        className={cn(
          "absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] outline-none",
          "transition-[opacity,scale,color,background-color] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.88] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
          // Hidden until the chip is hovered or focused on a mouse; always there on touch.
          "pointer-fine:opacity-0 pointer-fine:group-hover/chip:opacity-100 pointer-fine:focus-visible:opacity-100",
          "before:absolute before:-inset-3 before:rounded-full before:content-[''] pointer-fine:before:-inset-1",
        )}
      >
        <X size={12} />
      </button>
    </motion.li>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Emoji grid: arrow keys, one tab stop
 * -----------------------------------------------------------------------------------------------*/

const COLUMNS = 8;

function EmojiGrid({ emojis, onPick }: { emojis: { emoji: string; label: string }[]; onPick: (emoji: string) => void }) {
  const [active, setActive] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const move = (e: React.KeyboardEvent) => {
    const last = emojis.length - 1;
    const next =
      e.key === "ArrowRight"
        ? Math.min(last, active + 1)
        : e.key === "ArrowLeft"
          ? Math.max(0, active - 1)
          : e.key === "ArrowDown"
            ? Math.min(last, active + COLUMNS)
            : e.key === "ArrowUp"
              ? Math.max(0, active - COLUMNS)
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? last
                  : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    grid.current?.querySelectorAll<HTMLElement>("[role=gridcell]")[next]?.focus();
  };
  const rows = Array.from({ length: Math.ceil(emojis.length / COLUMNS) }, (_, i) => emojis.slice(i * COLUMNS, i * COLUMNS + COLUMNS));
  return (
    <div ref={grid} role="grid" aria-label="Emoji" onKeyDown={move} className="flex flex-col gap-0.5">
      {rows.map((row, ri) => (
        <div key={ri} role="row" className="flex gap-0.5">
          {row.map((c, ci) => {
            const i = ri * COLUMNS + ci;
            return (
              <button
                key={c.emoji}
                type="button"
                role="gridcell"
                aria-label={c.label}
                tabIndex={i === active ? 0 : -1}
                onFocus={() => setActive(i)}
                onClick={() => onPick(c.emoji)}
                className={cn(
                  "group/cell grid size-8 place-items-center rounded-lg outline-none",
                  "transition-[background-color,scale] duration-150 ease-out hover:bg-hover active:scale-[0.9] active:duration-75",
                  "focus-visible:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-4",
                )}
              >
                <span
                  aria-hidden
                  className="text-[18px] leading-none transition-transform duration-200 ease-out-expo group-hover/cell:scale-[1.18] group-focus-visible/cell:scale-[1.18] motion-reduce:transition-none motion-reduce:group-hover/cell:scale-100"
                >
                  {c.emoji}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Tooltip and the one glyph the shared set doesn't have
 * -----------------------------------------------------------------------------------------------*/

function Tip({
  label,
  keys,
  disabled,
  container,
  children,
}: {
  label: string;
  keys?: string;
  disabled?: boolean;
  container?: MessageComposerProps["container"];
  children: React.ReactElement;
}) {
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner side="top" sideOffset={8} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex items-center gap-2 rounded-md border border-line-2 bg-raised py-1 pl-2 text-[12px] leading-4 text-fg shadow-pop outline-none",
              keys ? "pr-1" : "pr-2",
              "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-100",
              "data-instant:transition-none motion-reduce:data-starting-style:scale-100",
            )}
          >
            {label}
            {keys && <kbd className="rounded-[4px] border border-line-2 bg-frame px-1 font-mono text-[10.5px] leading-[14px] text-fg-3">{keys}</kbd>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function SmileGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="5.75" />
      {/* The smile widens a touch on hover: the button answers before it's pressed. */}
      <path
        d="M5.9 9.4a2.6 2.6 0 0 0 4.2 0"
        className="origin-[8px_9.6px] transition-transform duration-200 ease-out-expo group-hover/emoji:scale-x-[1.18] group-data-popup-open/emoji:scale-x-[1.18]"
      />
      <circle cx="6.1" cy="6.6" r=".7" fill="currentColor" stroke="none" />
      <circle cx="9.9" cy="6.6" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}
