"use client";
import { Menu } from "@base-ui/react/menu";
import { Toggle } from "@base-ui/react/toggle";
import { Tooltip } from "@base-ui/react/tooltip";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ArrowUp, ChevronDown, File as FileIcon, Paperclip, Upload, Warning, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type PromptAttachment = {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** MIME type. Images get a thumbnail. */
  type: string;
  /** The picked file, when it came from this composer. */
  file?: File;
  /** An image URL for the thumbnail. The composer makes one for images it picks. */
  preview?: string;
  /** 0–1 while uploading. Send waits until every attachment is done. */
  progress?: number;
  /** A few words on why it failed. */
  error?: string;
};

export type PromptModel = { id: string; label: string; description?: string };
export type PromptTool = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** One line for the tooltip: what turning it on does. */
  description?: string;
};

export type PromptMessage = {
  text: string;
  attachments: PromptAttachment[];
  model?: string;
  tools: string[];
};

/* -------------------------------------------------------------------------------------------------
 * Small helpers
 * -----------------------------------------------------------------------------------------------*/

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

const splitName = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot > name.length - 8 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
};

let seq = 0;
const nextId = () => `att-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const matchesAccept = (file: File, accept?: string) => {
  if (!accept) return true;
  return accept.split(",").some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith("/*")) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
    return file.type.toLowerCase() === rule;
  });
};

const coarseQuery = "(pointer: coarse)";
const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia(coarseQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useCoarse = () => useSyncExternalStore(subscribeCoarse, () => window.matchMedia(coarseQuery).matches, () => false);

const subscribeNothing = () => () => {};
const useApple = () => useSyncExternalStore(subscribeNothing, () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), () => true);

function markEdges(row: HTMLElement) {
  const end = row.scrollWidth - row.clientWidth - Math.abs(row.scrollLeft);
  row.toggleAttribute("data-more-start", Math.abs(row.scrollLeft) > 2);
  row.toggleAttribute("data-more-end", end > 2);
}

function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) (ref as React.RefObject<T | null>).current = node;
}

const draft = {
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

/* -------------------------------------------------------------------------------------------------
 * PromptInput
 * -----------------------------------------------------------------------------------------------*/

export type PromptInputProps = Omit<React.ComponentProps<"form">, "onSubmit" | "children" | "defaultValue"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called with the message when it's sent. The composer clears itself and keeps focus. */
  onSend: (message: PromptMessage) => void;
  /** A reply is being generated. The send button becomes Stop and Escape stops it. */
  generating?: boolean;
  onStop?: () => void;
  placeholder?: string;
  /** The textarea's accessible name. */
  label?: string;
  disabled?: boolean;
  /** "enter": Enter sends and Shift+Enter adds a line. "mod-enter": Enter adds a line and ⌘/Ctrl+Enter sends. ⌘/Ctrl+Enter always sends. On touch screens Enter always adds a line. */
  submitOn?: "enter" | "mod-enter";
  minRows?: number;
  /** Lines before the text starts to scroll. */
  maxRows?: number;
  /** Characters. A count appears within 10% of it; past it, sending is blocked. */
  maxLength?: number;
  attachments?: PromptAttachment[];
  defaultAttachments?: PromptAttachment[];
  onAttachmentsChange?: (attachments: PromptAttachment[]) => void;
  /** Hide the attach button and ignore dropped and pasted files. */
  allowAttachments?: boolean;
  /** Same syntax as the file input's accept: "image/*,.pdf,.csv". */
  accept?: string;
  maxFiles?: number;
  /** Bytes per file. */
  maxFileSize?: number;
  models?: PromptModel[];
  model?: string;
  defaultModel?: string;
  onModelChange?: (model: string) => void;
  tools?: PromptTool[];
  activeTools?: string[];
  defaultActiveTools?: string[];
  onActiveToolsChange?: (tools: string[]) => void;
  /** Keep an unsent draft in local storage under this key. */
  persistKey?: string;
  /** The textarea, for focusing it from outside (after filling in a suggestion). */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
};

const EMPTY: PromptAttachment[] = [];
const NO_TOOLS: string[] = [];

export function PromptInput({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onSend,
  generating = false,
  onStop,
  placeholder = "Ask anything",
  label = "Message",
  disabled = false,
  submitOn = "enter",
  minRows = 1,
  maxRows = 8,
  maxLength,
  attachments: attachmentsProp,
  defaultAttachments = EMPTY,
  onAttachmentsChange,
  allowAttachments = true,
  accept,
  maxFiles = 10,
  maxFileSize = 20_000_000,
  models,
  model: modelProp,
  defaultModel,
  onModelChange,
  tools,
  activeTools: activeToolsProp,
  defaultActiveTools = NO_TOOLS,
  onActiveToolsChange,
  persistKey,
  textareaRef,
  className,
  ...rest
}: PromptInputProps) {
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [attachments, setAttachments] = useControllableState({ value: attachmentsProp, defaultValue: defaultAttachments, onChange: onAttachmentsChange });
  const [model, setModel] = useControllableState({ value: modelProp, defaultValue: defaultModel ?? models?.[0]?.id ?? "", onChange: onModelChange });
  const [activeTools, setActiveTools] = useControllableState({ value: activeToolsProp, defaultValue: defaultActiveTools, onChange: onActiveToolsChange });

  const reduce = useReducedMotion();
  const coarse = useCoarse();
  const apple = useApple();
  const id = useId();
  const area = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const madeUrls = useRef(new Set<string>());
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [notice, setNotice] = useState<string | null>(null);

  const length = value.length;
  const over = maxLength != null && length > maxLength;
  const nearLimit = maxLength != null && length >= maxLength * 0.9;
  const uploading = attachments.some((a) => a.progress != null && a.progress < 1 && !a.error);
  const hasContent = value.trim().length > 0 || attachments.some((a) => !a.error);
  const canSend = !disabled && !generating && hasContent && !uploading && !over;

  // Restore an unsent draft once, after hydration, so server and client render the same first frame.
  useEffect(() => {
    if (!persistKey || valueProp !== undefined) return;
    const saved = draft.read(persistKey);
    if (saved) setValue((v) => v || saved);
    // Only on mount and when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);
  useEffect(() => {
    if (!persistKey) return;
    const t = window.setTimeout(() => draft.write(persistKey, value), 300);
    return () => window.clearTimeout(t);
  }, [persistKey, value]);

  // Object URLs made for thumbnails live until the chip is removed or the composer unmounts.
  useEffect(() => {
    const urls = madeUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const focus = () => area.current?.focus({ preventScroll: true });

  // New chips arrive at the end of the row: bring the row to them.
  const chipRow = useRef<HTMLUListElement>(null);
  const chipCount = useRef(attachments.length);
  useEffect(() => {
    const row = chipRow.current;
    const grew = attachments.length > chipCount.current;
    chipCount.current = attachments.length;
    if (!row) return;
    if (grew) row.scrollTo({ left: row.scrollWidth, behavior: reduce ? "auto" : "smooth" });
    markEdges(row);
    const ro = new ResizeObserver(() => markEdges(row));
    ro.observe(row);
    return () => ro.disconnect();
  }, [attachments.length, reduce]);

  const addFiles = useCallback(
    (files: File[]) => {
      if (!allowAttachments || disabled || !files.length) return;
      const room = Math.max(0, maxFiles - attachments.length);
      const accepted: PromptAttachment[] = [];
      const problems: string[] = [];
      for (const file of files) {
        if (!matchesAccept(file, accept)) problems.push(`${file.name} isn’t a supported file type`);
        else if (file.size > maxFileSize) problems.push(`${file.name} is over ${formatBytes(maxFileSize)}`);
        else if (accepted.length >= room) problems.push(`You can attach up to ${maxFiles} files`);
        else {
          let preview: string | undefined;
          if (file.type.startsWith("image/")) {
            preview = URL.createObjectURL(file);
            madeUrls.current.add(preview);
          }
          accepted.push({ id: nextId(), name: file.name, size: file.size, type: file.type, file, preview });
        }
      }
      if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
      setNotice(problems.length ? (problems.length > 1 && !problems.every((p) => p === problems[0]) ? `${problems[0]}, and ${problems.length - 1} more` : problems[0]) : null);
    },
    [accept, allowAttachments, attachments.length, disabled, maxFileSize, maxFiles, setAttachments],
  );

  const remove = (a: PromptAttachment) => {
    if (a.preview && madeUrls.current.has(a.preview)) {
      URL.revokeObjectURL(a.preview);
      madeUrls.current.delete(a.preview);
    }
    setAttachments((prev) => prev.filter((x) => x.id !== a.id));
    focus();
  };

  const send = () => {
    if (!canSend) return;
    const sent = attachments.filter((a) => !a.error);
    // Sent previews now belong to the message; stop tracking them so they aren't revoked here.
    sent.forEach((a) => a.preview && madeUrls.current.delete(a.preview));
    onSend({ text: value.trim(), attachments: sent, model: model || undefined, tools: activeTools });
    setValue("");
    setAttachments(EMPTY);
    setNotice(null);
    if (persistKey) draft.write(persistKey, "");
    focus();
  };

  const stop = () => {
    onStop?.();
    focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Never send in the middle of composing a character (Japanese, Chinese, Korean input).
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Escape" && generating) {
      e.preventDefault();
      stop();
      return;
    }
    if (e.key !== "Enter") return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod || (submitOn === "enter" && !e.shiftKey && !coarse)) {
      e.preventDefault();
      send();
    }
  };

  const hasFiles = (e: React.DragEvent) => allowAttachments && !disabled && Array.from(e.dataTransfer.types).includes("Files");

  const lineHeight = 20;
  const padY = 12 + 4;
  const sizeStyle = { minHeight: minRows * lineHeight + padY, maxHeight: maxRows * lineHeight + padY } as React.CSSProperties;
  const noticeId = `${id}-notice`;
  const shortcut = submitOn === "mod-enter" || coarse ? [apple ? "⌘" : "Ctrl", "↵"] : ["↵"];

  return (
    <Tooltip.Provider delay={500}>
      <form
        data-state={generating ? "generating" : "idle"}
        data-disabled={disabled || undefined}
        data-dragging={dragging || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        onDragEnter={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!hasFiles(e)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (!dragDepth.current) setDragging(false);
        }}
        onDrop={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
          focus();
        }}
        onPointerDown={(e) => {
          // A press on the box's empty space puts the caret in the text, like a big text field.
          if (e.target === e.currentTarget) {
            e.preventDefault();
            focus();
          }
        }}
        className={cn(
          "@container relative isolate flex w-full cursor-text flex-col rounded-2xl border border-line-2 bg-raised shadow-[var(--shadow)]",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/[0.06]",
          "data-dragging:border-fg-3",
          "data-disabled:cursor-not-allowed data-disabled:opacity-60",
          className,
        )}
        {...rest}
      >
        {/* Attachments */}
        <AnimatePresence initial={false}>
          {attachments.length > 0 && (
            <motion.div
              key="attachments"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: ease.inOut }}
              className="overflow-hidden"
            >
              <ul
                ref={chipRow}
                aria-label="Attachments"
                onScroll={(e) => markEdges(e.currentTarget)}
                className={cn(
                  "flex gap-2 overflow-x-auto overscroll-x-contain px-2 pt-2 pb-0.5 [scrollbar-width:none]",
                  // Fade whichever edge has more chips beyond it.
                  "data-more-end:[mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]",
                  "data-more-start:[mask-image:linear-gradient(to_right,transparent,black_32px)]",
                  "data-more-start:data-more-end:[mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]",
                )}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {attachments.map((a) => (
                    <AttachmentChip key={a.id} attachment={a} onRemove={() => remove(a)} reduce={!!reduce} disabled={disabled} />
                  ))}
                </AnimatePresence>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The text. The invisible twin behind it sets the height, so the box grows line by line with no measuring. */}
        <div className="grid">
          <div
            aria-hidden
            style={sizeStyle}
            className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre-wrap px-3.5 pt-3 pb-1 text-base leading-5 [overflow-wrap:anywhere] sm:text-[13px]"
          >
            {value + " "}
          </div>
          <textarea
            ref={(node) => {
              area.current = node;
              assignRef(textareaRef, node);
            }}
            id={`${id}-text`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length && allowAttachments) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            rows={minRows}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={label}
            aria-describedby={notice ? noticeId : undefined}
            aria-invalid={over || undefined}
            enterKeyHint={coarse || submitOn === "mod-enter" ? "enter" : "send"}
            autoComplete="off"
            spellCheck
            style={sizeStyle}
            className={cn(
              "col-start-1 row-start-1 resize-none overflow-y-auto overscroll-contain bg-transparent px-3.5 pt-3 pb-1 text-base leading-5 text-fg outline-none [overflow-wrap:anywhere] sm:text-[13px]",
              "placeholder:text-fg-4 disabled:cursor-not-allowed [scrollbar-width:thin]",
            )}
          />
        </div>

        {/* Rejected files */}
        <div className={cn("grid transition-[grid-template-rows] duration-200 ease-in-out-quart motion-reduce:transition-none", notice ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="min-h-0 overflow-hidden">
            <p id={noticeId} role="alert" className="flex items-center gap-1.5 px-3.5 pt-1.5 text-[12px] leading-4 text-danger">
              {notice && (
                <>
                  <Warning size={14} className="shrink-0" />
                  <span className="min-w-0 truncate">{notice}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2">
          {allowAttachments && (
            <>
              <Hint label="Attach files" side="top">
                <IconButton aria-label="Attach files" disabled={disabled} onClick={() => fileInput.current?.click()}>
                  <Paperclip />
                </IconButton>
              </Hint>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={accept}
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                  focus();
                }}
              />
            </>
          )}

          {tools?.map((tool) => (
            <ToolToggle
              key={tool.id}
              tool={tool}
              disabled={disabled}
              pressed={activeTools.includes(tool.id)}
              reduce={!!reduce}
              onPressedChange={(on) => setActiveTools((prev) => (on ? [...prev.filter((t) => t !== tool.id), tool.id] : prev.filter((t) => t !== tool.id)))}
            />
          ))}

          <div className="ms-auto flex min-w-0 items-center gap-1">
            {nearLimit && maxLength != null && (
              <span className={cn("me-1 shrink-0 font-mono text-2xs tabular", over ? "text-danger" : "text-fg-3")} aria-live="polite">
                {length.toLocaleString("en-US")}/{maxLength.toLocaleString("en-US")}
              </span>
            )}
            {models && models.length > 0 && <ModelMenu models={models} value={model} onValueChange={setModel} disabled={disabled} reduce={!!reduce} />}
            <SendButton
              mode={generating ? "stop" : "send"}
              ready={canSend}
              disabled={disabled || (!generating && !canSend)}
              onSend={send}
              onStop={stop}
              reduce={!!reduce}
              hint={
                generating
                  ? { label: "Stop generating", keys: ["Esc"] }
                  : uploading
                    ? { label: "Waiting for uploads to finish" }
                    : over
                      ? { label: "Shorten your message to send it" }
                      : { label: "Send", keys: shortcut }
              }
            />
          </div>
        </div>

        {/* Drop target */}
        <AnimatePresence>
          {dragging && (
            <motion.div
              key="drop"
              aria-hidden
              initial={{ opacity: 0, scale: reduce ? 1 : 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: ease.out }}
              className="pointer-events-none absolute inset-1 z-10 grid place-items-center rounded-xl border border-dashed border-fg-3 bg-raised/95"
            >
              <div className="flex flex-col items-center gap-1 text-center">
                <motion.span
                  initial={reduce ? false : { y: 4 }}
                  animate={{ y: 0 }}
                  transition={spring.pop}
                  className="grid size-8 place-items-center rounded-lg border border-line-2 bg-frame text-fg-2"
                >
                  <Upload size={16} />
                </motion.span>
                <span className="text-[13px] font-medium text-fg">Drop to attach</span>
                <span className="text-[12px] text-fg-3">
                  Up to {maxFiles} files, {formatBytes(maxFileSize)} each
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </Tooltip.Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

const iconButton = cn(
  "relative inline-grid size-8 shrink-0 place-items-center rounded-lg text-fg-3 outline-none",
  "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
  "disabled:pointer-events-none disabled:opacity-50",
  // 32px drawn, 44px to a finger.
  "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
);

function IconButton({ className, ...rest }: React.ComponentProps<"button">) {
  return <button type="button" className={cn(iconButton, className)} {...rest} />;
}

type HintProps = { label: string; keys?: string[]; side?: "top" | "bottom"; children: React.ReactElement<Record<string, unknown>> };

/** A tooltip that grows out of its trigger, with the shortcut beside the label. */
function Hint({ label, keys, side = "top", children }: HintProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={8} collisionPadding={8} className="z-(--z-tooltip)">
          <Tooltip.Popup
            className={cn(
              "flex min-h-[26px] items-center gap-2 rounded-lg border border-line-2 bg-raised px-2 py-[3px] text-[12px] leading-4 text-fg shadow-pop outline-none",
              "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo data-ending-style:duration-100",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-[side=top]:data-starting-style:translate-y-0.5 data-[side=bottom]:data-starting-style:-translate-y-0.5",
              "data-ending-style:opacity-0 data-instant:transition-none motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-0",
            )}
          >
            <span>{label}</span>
            {keys && (
              <kbd className="-me-0.5 flex items-center gap-0.5">
                {keys.map((k) => (
                  <span
                    key={k}
                    className={cn(
                      "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-2 bg-frame px-1 leading-none text-fg-2",
                      /^[⌘⇧⌥⌃↵]$/.test(k) ? "font-sans text-[12px]" : "font-mono text-[10.5px]",
                    )}
                  >
                    {k}
                  </span>
                ))}
              </kbd>
            )}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function ToolToggle({
  tool,
  pressed,
  onPressedChange,
  disabled,
  reduce,
}: {
  tool: PromptTool;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  disabled: boolean;
  reduce: boolean;
}) {
  // Count the times it has been switched on, so the icon pops on each switch but not on first paint.
  const [pops, setPops] = useState(0);
  const [was, setWas] = useState(pressed);
  if (was !== pressed) {
    setWas(pressed);
    if (pressed) setPops((n) => n + 1);
  }
  const toggle = (
    <Toggle
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      aria-label={tool.label}
      className={cn(
        "group/tool relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-transparent px-2 text-[12.5px] font-medium text-fg-3 outline-none",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.96] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:pointer-events-none disabled:opacity-50",
        "data-pressed:border-line-2 data-pressed:bg-fg/[0.06] data-pressed:text-fg",
        "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
        // Narrow composers keep the icon and move the name to the tooltip.
        "@max-md:w-8 @max-md:justify-center @max-md:px-0",
      )}
    >
      {tool.icon && (
        // The icon gives a small pop when the tool turns on; nothing when it turns off.
        <motion.span
          key={pops}
          initial={pops > 0 && !reduce ? { scale: 0.7, rotate: -12 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={spring.bouncy}
          className="grid size-4 shrink-0 place-items-center [&_svg]:size-4"
        >
          {tool.icon}
        </motion.span>
      )}
      <span className="@max-md:sr-only">{tool.label}</span>
    </Toggle>
  );
  return <Hint label={tool.description ?? tool.label}>{toggle}</Hint>;
}

function ModelMenu({ models, value, onValueChange, disabled, reduce }: { models: PromptModel[]; value: string; onValueChange: (v: string) => void; disabled: boolean; reduce: boolean }) {
  const current = models.find((m) => m.id === value) ?? models[0];
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        disabled={disabled}
        aria-label={`Model: ${current.label}`}
        className={cn(
          "group/model relative inline-flex h-8 min-w-0 items-center gap-1 rounded-lg ps-2.5 pe-1.5 text-[12.5px] font-medium text-fg-2 outline-none",
          "transition-[background-color,color,scale] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75 data-popup-open:bg-hover data-popup-open:text-fg",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:pointer-events-none disabled:opacity-50",
          "before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
        )}
      >
        <span className="grid min-w-0 max-w-[9rem] overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={current.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="col-start-1 row-start-1 truncate"
            >
              {current.label}
            </motion.span>
          </AnimatePresence>
        </span>
        <ChevronDown size={14} className="shrink-0 text-fg-3 transition-transform duration-200 ease-out-expo group-data-popup-open/model:rotate-180 motion-reduce:transition-none" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="end" sideOffset={8} collisionPadding={8} className="z-(--z-dropdown) outline-none">
          <Menu.Popup
            className={cn(
              "w-[min(17rem,var(--available-width))] rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
              "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
              "data-starting-style:scale-96 data-starting-style:opacity-0 data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120 data-instant:duration-0",
              "motion-reduce:scale-100 motion-reduce:translate-none",
            )}
          >
            <div className="px-2 pt-1.5 pb-1 font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">Model</div>
            <Menu.RadioGroup value={current.id} onValueChange={(v) => onValueChange(String(v))}>
              {models.map((m) => (
                <Menu.RadioItem
                  key={m.id}
                  value={m.id}
                  closeOnClick
                  className={cn(
                    "group/item relative flex min-h-8 cursor-default select-none items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13px] leading-[18px] outline-none",
                    "transition-colors duration-100 data-highlighted:bg-fg/[0.06] pointer-coarse:min-h-10",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-fg">{m.label}</span>
                    {m.description && <span className="line-clamp-2 text-[12px] leading-4 text-fg-3">{m.description}</span>}
                  </span>
                  <Menu.RadioItemIndicator keepMounted className="mt-px grid size-4 shrink-0 place-items-center text-fg">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.5 6.5 11.5 12.5 4.5"
                        stroke="currentColor"
                        strokeWidth={1.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength={1}
                        className="[stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-100 ease-out in-data-checked:[stroke-dashoffset:0] in-data-checked:duration-280 in-data-checked:ease-out-expo motion-reduce:transition-none"
                      />
                    </svg>
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function SendButton({
  mode,
  ready,
  disabled,
  onSend,
  onStop,
  reduce,
  hint,
}: {
  mode: "send" | "stop";
  ready: boolean;
  disabled: boolean;
  onSend: () => void;
  onStop: () => void;
  reduce: boolean;
  hint: { label: string; keys?: string[] };
}) {
  const stop = mode === "stop";
  const [arms, setArms] = useState(0);
  const [wasReady, setWasReady] = useState(ready);
  if (wasReady !== ready) {
    setWasReady(ready);
    if (ready) setArms((n) => n + 1);
  }
  // Going to Stop, the arrow leaves upward as if sent; coming back, it rises from below.
  const variants = {
    enter: (to: "send" | "stop") => (reduce ? { opacity: 0 } : to === "stop" ? { opacity: 0, scale: 0.4, filter: "blur(2px)" } : { opacity: 0, y: 10, filter: "blur(2px)" }),
    center: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
    exit: (to: "send" | "stop") => (reduce ? { opacity: 0 } : to === "stop" ? { opacity: 0, y: -14, filter: "blur(2px)", transition: { duration: 0.16, ease: ease.in } } : { opacity: 0, scale: 0.4, transition: { duration: 0.12 } }),
  };
  return (
    <Hint label={hint.label} keys={hint.keys}>
      <button
        type={stop ? "button" : "submit"}
        aria-label={stop ? "Stop generating" : "Send message"}
        aria-disabled={disabled || undefined}
        data-mode={mode}
        data-ready={ready || undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          if (stop) {
            e.preventDefault();
            onStop();
          } else {
            e.preventDefault();
            onSend();
          }
        }}
        className={cn(
          "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg outline-none",
          "transition-[background-color,color,scale] duration-200 ease-out active:scale-[0.92] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
          disabled ? "cursor-not-allowed bg-fg/[0.08] text-fg-4 active:scale-100" : "bg-fg text-frame hover:bg-fg/85",
        )}
      >
        <AnimatePresence initial={false} custom={mode}>
          <motion.span
            key={mode}
            custom={mode}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.12 } : spring.pop}
            className="col-start-1 row-start-1 grid place-items-center"
          >
            {stop ? (
              <span className="relative grid size-5 place-items-center">
                {/* Working: a quarter arc turning around the stop square. */}
                <svg viewBox="0 0 20 20" className="absolute inset-0 animate-spin-slow motion-reduce:animate-none" aria-hidden>
                  <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.5} />
                  <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="13.35 53.4" />
                </svg>
                <span className="size-[7px] rounded-[1.5px] bg-current" />
              </span>
            ) : (
              // The arrow lifts a couple of pixels the moment there is something to send.
              <motion.span key={arms} initial={arms > 0 && !reduce ? { y: 3 } : false} animate={{ y: 0 }} transition={spring.pop} className="grid place-items-center">
                <ArrowUp size={16} strokeWidth={1.8} />
              </motion.span>
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </Hint>
  );
}

function AttachmentChip({ attachment: a, onRemove, reduce, disabled }: { attachment: PromptAttachment; onRemove: () => void; reduce: boolean; disabled: boolean }) {
  const image = a.type.startsWith("image/") && a.preview;
  const [base, ext] = splitName(a.name);
  const busy = a.progress != null && a.progress < 1 && !a.error;
  const meta = a.error ? a.error : busy ? `Uploading ${Math.round((a.progress ?? 0) * 100)}%` : formatBytes(a.size);

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(3px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.in } }}
      transition={reduce ? { duration: 0.12 } : spring.snappy}
      data-error={a.error ? "" : undefined}
      className={cn(
        "group/chip relative flex h-12 shrink-0 items-center rounded-xl border border-line-2 bg-frame",
        image ? "w-12" : "max-w-[15rem] gap-2.5 ps-1.5 pe-3",
        "data-error:border-danger/50",
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.preview} alt={a.name} width={48} height={48} className="size-full rounded-[11px] object-cover" draggable={false} />
      ) : (
        <>
          <span className={cn("relative grid size-9 shrink-0 place-items-center rounded-lg", a.error ? "bg-danger-soft text-danger" : "bg-fg/[0.06] text-fg-2")}>
            {busy ? <ProgressRing value={a.progress ?? 0} /> : a.error ? <Warning size={16} /> : <FileIcon size={16} />}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="flex min-w-0 text-[12.5px] leading-4 font-medium text-fg" title={a.name}>
              <span className="truncate">{base}</span>
              <span className="shrink-0">{ext}</span>
            </span>
            <span className={cn("truncate text-[11.5px] leading-4 tabular", a.error ? "text-danger" : "text-fg-3")}>{meta}</span>
          </span>
        </>
      )}
      <button
        type="button"
        aria-label={`Remove ${a.name}`}
        disabled={disabled}
        onClick={onRemove}
        className={cn(
          "absolute -top-1.5 -end-1.5 grid size-5 place-items-center rounded-full border border-line-2 bg-raised text-fg-2 shadow-[var(--shadow)] outline-none",
          "transition-[opacity,scale,color,background-color] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-90",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          // Always visible to a finger; revealed by hover or focus where there's a pointer.
          "pointer-fine:scale-75 pointer-fine:opacity-0 pointer-fine:group-hover/chip:scale-100 pointer-fine:group-hover/chip:opacity-100 pointer-fine:focus-visible:scale-100 pointer-fine:focus-visible:opacity-100",
          "before:absolute before:-inset-3 before:content-[''] pointer-fine:before:-inset-1",
        )}
      >
        <X size={12} strokeWidth={1.8} />
      </button>
    </motion.li>
  );
}

function ProgressRing({ value }: { value: number }) {
  const c = 2 * Math.PI * 7;
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90" aria-hidden>
      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={1.75} />
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0.04, Math.min(1, value)))}
        className="transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
      />
    </svg>
  );
}

