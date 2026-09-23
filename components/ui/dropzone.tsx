"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/* Rules and messages: usable without the component                    */
/* ------------------------------------------------------------------ */

export type FileRejectionReason = "type" | "size" | "empty" | "count";
export type FileRejection = { file: File; reason: FileRejectionReason; message: string };

export type DropzoneRules = {
  /** MIME types, wildcards and extensions, as in the input's accept attribute: "image/*", "application/pdf", ".csv". */
  accept?: string | string[];
  /** Largest file allowed, in bytes. */
  maxSize?: number;
  /** Most files taken from one drop, pick or paste. The rest are rejected by name. */
  maxFiles?: number;
  /** Allow more than one file at a time. */
  multiple?: boolean;
};

const tokensOf = (accept?: string | string[]) =>
  (Array.isArray(accept) ? accept : (accept ?? "").split(",")).map((t) => t.trim().toLowerCase()).filter(Boolean);

// Extensions whose MIME type is predictable, so a drag can be judged before the drop.
const extMime: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".heic": "image/heic", ".pdf": "application/pdf", ".csv": "text/csv", ".txt": "text/plain",
  ".json": "application/json", ".zip": "application/zip", ".mp4": "video/mp4", ".mov": "video/quicktime", ".mp3": "audio/mpeg",
};

function mimeMatches(token: string, type: string) {
  if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
  return type === token;
}

function fileMatches(file: { name: string; type: string }, tokens: string[]) {
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return tokens.some((t) => (t.startsWith(".") ? name.endsWith(t) : mimeMatches(t, type)));
}

/** A drag only exposes MIME types, not names or sizes, so it can say yes, no, or can't tell. */
function judgeDrag(types: string[], tokens: string[]): "ok" | "reject" | "unknown" {
  if (!tokens.length) return "ok";
  if (!types.length) return "unknown";
  let unknown = false;
  for (const raw of types) {
    const type = raw.toLowerCase();
    if (!type) { unknown = true; continue; }
    for (const t of tokens) {
      if (t.startsWith(".")) {
        if (!extMime[t]) unknown = true;
        else if (extMime[t] === type) return "ok";
      } else if (mimeMatches(t, type)) return "ok";
    }
  }
  return unknown ? "unknown" : "reject";
}

/** 10485760 → "10 MB". Binary units, the way file managers count them; a no-break space keeps "10 MB" on one line. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}\u00a0B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 10 || Number.isInteger(v) ? Math.round(v) : v.toFixed(1)}\u00a0${units[i]}`;
}

/** Keeps the extension visible: "q3-forecast-final-v7-approved.xlsx" → "q3-forecast-fi…approved.xlsx". */
export function middleTruncate(name: string, max = 28) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const tail = Math.max(8, dot > 0 ? name.length - dot + 4 : 8);
  return `${name.slice(0, max - tail - 1)}…${name.slice(-tail)}`;
}

const labelFor = (t: string) => {
  if (t === "image/*") return "images";
  if (t === "video/*") return "videos";
  if (t === "audio/*") return "audio";
  if (t === "text/*") return "text files";
  if (t === "image/jpeg" || t === ".jpg" || t === ".jpeg") return "JPG";
  if (t === "image/svg+xml") return "SVG";
  if (t.includes("spreadsheetml")) return "XLSX";
  if (t.includes("wordprocessingml")) return "DOCX";
  return (t.startsWith(".") ? t.slice(1) : t.split("/")[1] ?? t).toUpperCase();
};

/** "image/*, .pdf" → "Images or PDF". Duplicates (jpg, jpeg, image/jpeg) collapse into one word. */
export function describeAccept(accept?: string | string[]) {
  const words = [...new Set(tokensOf(accept).map(labelFor))];
  if (!words.length) return "";
  const list = new Intl.ListFormat("en", { type: "disjunction" }).format(words);
  return list.charAt(0).toUpperCase() + list.slice(1);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Splits files into accepted and rejected, each rejection with a sentence that names the file. */
export function validateFiles(files: File[], rules: DropzoneRules = {}) {
  const tokens = tokensOf(rules.accept);
  const limit = rules.multiple === false ? 1 : rules.maxFiles;
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  for (const file of files) {
    const short = middleTruncate(file.name);
    if (!fileMatches(file, tokens)) {
      const kinds = describeAccept(rules.accept);
      rejected.push({ file, reason: "type", message: `${short} isn’t a supported type. Use ${kinds}.` });
    } else if (file.size === 0) {
      rejected.push({ file, reason: "empty", message: `${short} is empty. Choose another file.` });
    } else if (rules.maxSize != null && file.size > rules.maxSize) {
      rejected.push({ file, reason: "size", message: `${short} is ${formatBytes(file.size)}. The limit is ${formatBytes(rules.maxSize)}.` });
    } else if (limit != null && accepted.length >= limit) {
      rejected.push({ file, reason: "count", message: `${limit === 1 ? "One file" : `${limit} files`} at a time. ${short} wasn’t added.` });
    } else accepted.push(file);
  }
  return { accepted, rejected };
}

/** One line for any mix of rejections. A single file gets its own sentence; several get a tally. */
export function summarizeRejections(rejected: FileRejection[], rules: DropzoneRules = {}) {
  if (!rejected.length) return "";
  if (rejected.length === 1) return rejected[0].message;
  const count = (r: FileRejectionReason) => rejected.filter((x) => x.reason === r).length;
  const parts = [
    count("type") && `${count("type")} unsupported`,
    count("size") && `${count("size")} over ${formatBytes(rules.maxSize ?? 0)}`,
    count("empty") && `${count("empty")} empty`,
    count("count") && `${count("count")} over the ${rules.multiple === false ? 1 : rules.maxFiles}-file limit`,
  ].filter(Boolean);
  return `${rejected.length} files weren’t added: ${parts.join(", ")}.`;
}

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

type Phase = "idle" | "armed" | "over" | "reject" | "added" | "disabled";

export type DropzoneProps = Omit<React.ComponentProps<"div">, "title" | "children"> &
  DropzoneRules & {
    /** Called with the files that passed the rules. */
    onFilesAccepted?: (files: File[]) => void;
    /** Called with every file that didn't, each with a reason and a message. */
    onFilesRejected?: (rejections: FileRejection[]) => void;
    /** Where ⌘V/Ctrl+V pastes land: anywhere on the page (ignored while typing in a field), only while the zone is focused, or nowhere. */
    paste?: "document" | "focus" | false;
    size?: "sm" | "md";
    disabled?: boolean;
    /** A message from the form, such as "Attach at least one receipt". Shown in place of the hint and marks the zone invalid. */
    error?: React.ReactNode;
    /** Replaces the headline. */
    title?: React.ReactNode;
    /** Replaces the generated "PNG or PDF, up to 10 MB" line. */
    hint?: React.ReactNode;
    /** Accessible name of the zone's button. */
    label?: string;
    /** Text of the button drawn at the end of the compact size, e.g. "Replace" once a file is in. */
    browseLabel?: string;
  };

export function Dropzone({
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  onFilesAccepted,
  onFilesRejected,
  paste = "document",
  size = "md",
  disabled = false,
  error,
  title,
  hint,
  label = "Choose files",
  browseLabel = "Browse",
  className,
  onKeyDown,
  ...rest
}: DropzoneProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const zoneDepth = useRef(0);
  const addedTimer = useRef<number>(undefined);

  const [armed, setArmed] = useState(false);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<{ count: number; verdict: "ok" | "reject" | "unknown" }>({ count: 0, verdict: "unknown" });
  const [added, setAdded] = useState(0);
  const [rejection, setRejection] = useState("");
  const [announce, setAnnounce] = useState({ text: "", n: 0 });

  const tokens = tokensOf(accept);
  const kinds = describeAccept(accept);
  const tooMany = !multiple && preview.count > 1;
  const phase: Phase = disabled
    ? "disabled"
    : over
      ? preview.verdict === "reject" || tooMany
        ? "reject"
        : "over"
      : armed
        ? "armed"
        : added
          ? "added"
          : "idle";
  const message = error || rejection || null;
  const invalid = message != null && phase !== "over" && phase !== "armed";

  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const handle = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const { accepted, rejected } = validateFiles(files, { accept, maxSize, maxFiles, multiple });
      if (accepted.length) onFilesAccepted?.(accepted);
      if (rejected.length) onFilesRejected?.(rejected);
      const why = summarizeRejections(rejected, { accept, maxSize, maxFiles, multiple });
      setRejection(why);
      window.clearTimeout(addedTimer.current);
      setAdded(accepted.length);
      if (accepted.length) addedTimer.current = window.setTimeout(() => setAdded(0), 1800);
      const said = [accepted.length ? `${plural(accepted.length, "file")} added.` : "", why].filter(Boolean).join(" ");
      setAnnounce((a) => ({ text: said, n: a.n + 1 }));
    },
    [accept, maxSize, maxFiles, multiple, onFilesAccepted, onFilesRejected],
  );

  // Files dragged anywhere over the window light the zone up, so people can see where to aim.
  // A drop that misses the zone is swallowed instead of opening the file in the tab and losing the form.
  useEffect(() => {
    if (disabled) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setArmed(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setArmed(false);
    };
    const overWindow = (e: DragEvent) => {
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    const reset = (e: DragEvent) => {
      depth = 0;
      setArmed(false);
      if (e.type === "drop" && hasFiles(e) && !e.defaultPrevented) e.preventDefault();
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overWindow);
    window.addEventListener("drop", reset);
    window.addEventListener("dragend", reset);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overWindow);
      window.removeEventListener("drop", reset);
      window.removeEventListener("dragend", reset);
    };
  }, [disabled]);

  // Pasted screenshots arrive as "image.png"; give them a name someone can find later.
  const fromClipboard = useCallback(
    (data: DataTransfer | null) => {
      const files = Array.from(data?.files ?? []);
      if (!files.length) return false;
      const stamp = new Date().toTimeString().slice(0, 8).replaceAll(":", ".");
      const named = files.map((f, i) =>
        /^image\.\w+$/.test(f.name) ? new File([f], `Pasted image ${stamp}${files.length > 1 ? ` (${i + 1})` : ""}.${f.name.split(".")[1]}`, { type: f.type }) : f,
      );
      handle(named);
      return true;
    },
    [handle],
  );

  useEffect(() => {
    if (disabled || paste !== "document") return;
    const onPaste = (e: ClipboardEvent) => {
      const a = document.activeElement as HTMLElement | null;
      const typing = a && !rootRef.current?.contains(a) && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
      if (typing || e.defaultPrevented) return;
      if (fromClipboard(e.clipboardData)) e.preventDefault();
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [disabled, paste, fromClipboard]);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const lifted = phase === "over" || phase === "armed";
  const fan = phase === "over" && preview.count > 1;
  const glyph = phase === "reject" ? "reject" : phase === "added" ? "added" : "upload";

  const headline =
    phase === "over"
      ? preview.count
        ? `Release to add ${plural(preview.count, "file")}`
        : "Release to add files"
      : phase === "reject"
        ? tooMany
          ? "One file at a time"
          : `${kinds} only`
        : phase === "armed"
          ? `Drop ${multiple ? "files" : "a file"} here`
          : phase === "added"
            ? `${plural(added, "file")} added`
            : null;

  const sizeNote = maxSize != null ? `up to ${formatBytes(maxSize)}${multiple ? " each" : ""}` : "";
  const restHint = hint ?? ([kinds, sizeNote].filter(Boolean).join(", ") || "Any file type");
  const hintText = phase === "reject" ? (tooMany ? "Drop them one at a time" : preview.count > 1 ? "These files can’t be added" : "This file type can’t be added") : restHint;
  const hintId = `${id}-hint`;

  const swapIn = reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" };
  const swapOut = reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)" };
  const md = size === "md";

  return (
    <div
      ref={rootRef}
      data-slot="dropzone"
      data-state={phase}
      data-size={size}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        zoneDepth.current++;
        if (zoneDepth.current > 1) return;
        const items = Array.from(e.dataTransfer.items).filter((i) => i.kind === "file");
        setPreview({ count: items.length, verdict: judgeDrag(items.map((i) => i.type), tokens) });
        setRejection("");
        setOver(true);
      }}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (disabled || !hasFiles(e)) return;
        zoneDepth.current = Math.max(0, zoneDepth.current - 1);
        if (zoneDepth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        zoneDepth.current = 0;
        setOver(false);
        setArmed(false);
        handle(Array.from(e.dataTransfer.files));
      }}
      onPaste={(e) => {
        if (disabled || paste !== "focus") return;
        if (fromClipboard(e.clipboardData)) e.preventDefault();
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        // Escape clears a rejection message without choosing anything.
        if (e.key === "Escape" && rejection) setRejection("");
      }}
      className={cn(
        "group/dz relative isolate flex w-full min-w-0 rounded-xl text-fg",
        "transition-[background-color] duration-200 ease-out",
        md ? "min-h-44 flex-col items-center justify-center gap-3 px-6 py-7 text-center" : "min-h-16 items-center gap-3 py-3 pl-3 pr-3",
        "hover:bg-hover/50 active:bg-hover",
        "data-[state=armed]:bg-hover/50 data-[state=over]:bg-hover data-[state=reject]:bg-danger-soft",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {/* The border is drawn, not styled, so the dashes can stretch until they close into a solid line. */}
      <svg aria-hidden className="pointer-events-none absolute inset-[0.5px] -z-10 size-[calc(100%-1px)] overflow-visible">
        <rect
          width="100%"
          height="100%"
          rx="11.5"
          fill="none"
          strokeWidth="1"
          className={cn(
            "stroke-fg-4/70 [stroke-dasharray:5_4] transition-[stroke,stroke-dasharray] duration-300 ease-out-expo",
            "group-hover/dz:stroke-fg-3/80",
            "group-data-[state=armed]/dz:stroke-fg-3",
            "group-data-[state=over]/dz:stroke-fg-2 group-data-[state=over]/dz:[stroke-dasharray:9_0]",
            "group-data-[state=reject]/dz:stroke-danger/70",
            "group-data-invalid/dz:stroke-danger/60",
          )}
        />
      </svg>

      {/* The whole zone is one button: click, Enter or Space opens the file picker. */}
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
      >
        <span className="sr-only">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        tabIndex={-1}
        aria-hidden
        className="hidden"
        accept={tokens.join(",") || undefined}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          handle(Array.from(e.currentTarget.files ?? []));
          // Picking the same file twice in a row should still count.
          e.currentTarget.value = "";
        }}
      />

      <Tile glyph={glyph} lifted={lifted} fan={fan} reduce={!!reduce} size={size} />

      <div className={cn("pointer-events-none flex min-w-0 flex-col", md ? "items-center gap-1" : "flex-1 gap-0.5")}>
        <div className={cn("grid w-full", md && "justify-items-center")}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              key={headline ?? "rest"}
              initial={swapIn}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ ...swapOut, transition: { duration: 0.12, ease: ease.in } }}
              transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
              className={cn(
                "col-start-1 row-start-1 max-w-full truncate font-medium tracking-[-0.01em]",
                md ? "text-[13.5px]" : "text-[13px]",
                phase === "reject" && "text-danger",
              )}
            >
              {headline ??
                title ?? (
                  <>
                    <span className="pointer-coarse:hidden">
                      Drop {multiple ? "files" : "a file"} here or{" "}
                      <span className="underline decoration-fg-4 underline-offset-[3px] transition-[text-decoration-color] duration-150 group-hover/dz:decoration-fg-2">
                        browse
                      </span>
                    </span>
                    <span className="hidden pointer-coarse:inline">Choose {multiple ? "files" : "a file"}</span>
                  </>
                )}
            </motion.p>
          </AnimatePresence>
        </div>

        <motion.div layout={reduce ? false : "position"} transition={spring.soft} id={hintId} className={cn("min-w-0 text-[12px] leading-[18px]", md && "max-w-[34ch]")}>
          <AnimatePresence initial={false} mode="popLayout">
            {invalid ? (
              <motion.p
                key={`e-${typeof message === "string" ? message : "custom"}`}
                initial={swapIn}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: reduce ? 0.15 : 0.22, ease: ease.out }}
                className={cn("text-danger", md ? "text-balance" : "flex items-start gap-1.5")}
              >
                <AlertGlyph inline={md} />
                <span className="min-w-0">{md ? <Sentences text={message} /> : message}</span>
              </motion.p>
            ) : (
              <motion.p
                key={phase === "reject" ? "reject-hint" : "hint"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18 }}
                className={cn("text-fg-3", md ? "text-balance" : "truncate")}
              >
                {hintText}
                {paste && md && phase !== "reject" && (
                  <span className="pointer-coarse:hidden">
                    <span className="px-1.5 text-fg-4">·</span>
                    <kbd className="font-sans text-fg-3">
                      <PasteKeys /> to paste
                    </kbd>
                  </span>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {!md && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none inline-flex h-7 shrink-0 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)]",
            "transition-[background-color,border-color,scale] duration-150 ease-out group-hover/dz:border-fg-4 group-active/dz:scale-[0.97]",
          )}
        >
          {browseLabel}
        </span>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {announce.text}
        {announce.n % 2 ? " " : ""}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

// "x.jpg is 24 MB. The limit is 10 MB." reads best as two lines in the tall zone: the problem, then the rule.
function Sentences({ text }: { text: React.ReactNode }) {
  if (typeof text !== "string") return <>{text}</>;
  const at = text.search(/\. [A-Z]/);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at + 1)} <span className="sm:block">{text.slice(at + 2)}</span>
    </>
  );
}

const svg = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function AlertGlyph({ inline }: { inline?: boolean }) {
  return (
    <svg {...svg} width={14} height={14} className={inline ? "mr-1.5 inline-block align-[-2.5px]" : "mt-0.5 shrink-0"}>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 5v3.5" />
      <circle cx="8" cy="10.9" r=".6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ⌘V on Apple keyboards, Ctrl+V elsewhere. Rendered as text after mount so the server and client agree.
const noop = () => () => {};
function PasteKeys() {
  const mac = useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), () => true);
  return <>{mac ? "⌘V" : "Ctrl+V"}</>;
}

/**
 * The icon tile. It lifts while files hover the window, fans a stack of pages
 * behind it when several files are over the zone, and swaps its glyph for a
 * drawn tick on success or a stop sign on a wrong type.
 */
function Tile({ glyph, lifted, fan, reduce, size }: { glyph: "upload" | "reject" | "added"; lifted: boolean; fan: boolean; reduce: boolean; size: "sm" | "md" }) {
  const md = size === "md";
  const box = md ? "size-10 rounded-[10px]" : "size-9 rounded-lg";
  const page = cn("absolute inset-0 border border-line-2 bg-raised", box);
  return (
    <div aria-hidden className={cn("pointer-events-none relative shrink-0", box)}>
      {[-1, 1].map((side) => (
        <motion.span
          key={side}
          className={page}
          initial={false}
          animate={fan && !reduce ? { opacity: 1, rotate: side * 9, x: side * 7, y: 1 } : { opacity: 0, rotate: 0, x: 0, y: 0 }}
          transition={spring.snappy}
        />
      ))}
      <motion.span
        className={cn(
          page,
          "grid place-items-center text-fg-2 shadow-[var(--shadow)] transition-[color,border-color] duration-200",
          "group-hover/dz:text-fg group-data-[state=over]/dz:text-fg group-data-[state=armed]/dz:text-fg",
          "group-data-[state=reject]/dz:border-danger/40 group-data-[state=reject]/dz:text-danger group-data-[state=added]/dz:text-fg",
          "group-active/dz:scale-[0.96]",
        )}
        initial={false}
        // Same keys either way so the server render and a reduced-motion client agree.
        animate={{ y: lifted && !reduce ? -4 : 0, scale: fan && !reduce ? 1.04 : 1 }}
        transition={spring.snappy}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={glyph}
            className="grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(3px)" }}
            transition={reduce ? { duration: 0.15 } : spring.pop}
          >
            {glyph === "added" ? (
              <svg {...svg}>
                <motion.path d="M3.5 8.5 6.5 11.5 12.5 4.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: ease.out, delay: 0.05 }} />
              </svg>
            ) : glyph === "reject" ? (
              <svg {...svg}>
                <circle cx="8" cy="8" r="5.25" />
                <path d="m4.4 11.6 7.2-7.2" />
              </svg>
            ) : (
              <svg {...svg}>
                {/* The arrow rides up a little further than the tile, so the lift reads as "send it up". */}
                <path d="M3 10.5v1.75c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V10.5" />
                <g
                  className={cn(
                    "transition-transform duration-300 ease-out-expo motion-reduce:transition-none",
                    "group-hover/dz:-translate-y-px",
                    lifted && "-translate-y-[1.5px] group-hover/dz:-translate-y-[1.5px]",
                  )}
                >
                  <path d="M8 9.75V2.75M5 5.5 8 2.5l3 3" />
                </g>
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </div>
  );
}
