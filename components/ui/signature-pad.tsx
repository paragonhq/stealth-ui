"use client";
import { Tabs } from "@base-ui/react/tabs";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/* Strokes                                                             */
/* ------------------------------------------------------------------ */

// Points are stored as fractions of the pad's width, so a signature survives resizes and rotation.
type Pt = { x: number; y: number; w: number };
type Stroke = Pt[];

export type Signature = {
  kind: "drawn" | "typed";
  /** The typed name, for kind "typed". */
  name?: string;
  /** A trimmed PNG with a transparent background. Ink defaults to near-black because signatures land on white documents. */
  toPNG: (options?: { color?: string; scale?: number }) => Promise<Blob>;
  /** A trimmed SVG string. */
  toSVG: (options?: { color?: string }) => string;
};

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: (a.w + b.w) / 2 });
const EXPORT_INK = "rgb(21 21 21)";

/**
 * Draws with quadratic curves through the midpoints of the samples, which turns
 * jagged pointer input into smooth ink. Each segment takes the width of its
 * control point, so speed shows as thinner line and hesitation as thicker.
 */
function paint(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number, from = 0) {
  const p = stroke;
  const X = (v: number) => v * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (p.length === 1) {
    ctx.beginPath();
    ctx.arc(X(p[0].x), X(p[0].y), Math.max(0.6, (p[0].w * scale) / 1.6), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = Math.max(1, from); i < p.length; i++) {
    const a = i === 1 ? p[0] : mid(p[i - 2], p[i - 1]);
    const c = p[i - 1];
    const b = mid(p[i - 1], p[i]);
    ctx.beginPath();
    ctx.lineWidth = c.w * scale;
    ctx.moveTo(X(a.x), X(a.y));
    ctx.quadraticCurveTo(X(c.x), X(c.y), X(b.x), X(b.y));
    ctx.stroke();
  }
}

function finish(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number) {
  if (stroke.length < 2) return;
  const a = mid(stroke[stroke.length - 2], stroke[stroke.length - 1]);
  const b = stroke[stroke.length - 1];
  ctx.beginPath();
  ctx.lineWidth = b.w * scale;
  ctx.moveTo(a.x * scale, a.y * scale);
  ctx.lineTo(b.x * scale, b.y * scale);
  ctx.stroke();
}

function bounds(strokes: Stroke[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes)
    for (const p of s) {
      x0 = Math.min(x0, p.x - p.w);
      y0 = Math.min(y0, p.y - p.w);
      x1 = Math.max(x1, p.x + p.w);
      y1 = Math.max(y1, p.y + p.w);
    }
  return { x0, y0, x1, y1 };
}

function drawnSignature(strokes: Stroke[], width: number): Signature {
  const b = bounds(strokes);
  const pad = 8 / width;
  const box = { x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + pad * 2, h: b.y1 - b.y0 + pad * 2 };
  return {
    kind: "drawn",
    toSVG({ color = EXPORT_INK } = {}) {
      const W = Math.round(box.w * width);
      const H = Math.round(box.h * width);
      const f = (v: number) => Math.round(v * width * 10) / 10;
      const parts: string[] = [];
      for (const s of strokes) {
        const t = s.map((p) => ({ x: p.x - box.x, y: p.y - box.y, w: p.w }));
        if (t.length === 1) {
          parts.push(`<circle cx="${f(t[0].x)}" cy="${f(t[0].y)}" r="${f(t[0].w / 1.6)}" fill="${color}"/>`);
          continue;
        }
        for (let i = 1; i < t.length; i++) {
          const a = i === 1 ? t[0] : mid(t[i - 2], t[i - 1]);
          const c = t[i - 1];
          const e = mid(t[i - 1], t[i]);
          parts.push(`<path d="M${f(a.x)} ${f(a.y)}Q${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}" stroke-width="${f(c.w)}"/>`);
        }
        const last = t[t.length - 1];
        const m = mid(t[t.length - 2], last);
        parts.push(`<path d="M${f(m.x)} ${f(m.y)}L${f(last.x)} ${f(last.y)}" stroke-width="${f(last.w)}"/>`);
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">${parts.join("")}</g></svg>`;
    },
    toPNG({ color = EXPORT_INK, scale = 2 } = {}) {
      const c = document.createElement("canvas");
      c.width = Math.ceil(box.w * width * scale);
      c.height = Math.ceil(box.h * width * scale);
      const ctx = c.getContext("2d")!;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.translate(-box.x * width * scale, -box.y * width * scale);
      for (const s of strokes) {
        paint(ctx, s, width * scale);
        finish(ctx, s, width * scale);
      }
      return new Promise((resolve, reject) => c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))), "image/png"));
    },
  };
}

function typedSignature(name: string, font: string): Signature {
  const size = 44;
  const measure = () => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `italic 500 ${size}px ${font}`;
    return Math.ceil(ctx.measureText(name).width) + 24;
  };
  return {
    kind: "typed",
    name,
    toSVG({ color = EXPORT_INK } = {}) {
      const W = measure();
      const esc = name.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 72" width="${W}" height="72"><text x="12" y="50" font-family="${font.replace(/"/g, "'")}" font-size="${size}" font-style="italic" font-weight="500" letter-spacing="-0.02em" fill="${color}">${esc}</text></svg>`;
    },
    toPNG({ color = EXPORT_INK, scale = 2 } = {}) {
      const W = measure();
      const c = document.createElement("canvas");
      c.width = W * scale;
      c.height = 72 * scale;
      const ctx = c.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.font = `italic 500 ${size}px ${font}`;
      ctx.fillStyle = color;
      ctx.fillText(name, 12, 50);
      return new Promise((resolve, reject) => c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))), "image/png"));
    },
  };
}

// Mac check that agrees between server and first client render.
const noop = () => () => {};
const useIsMac = () => useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), () => true);

/* ------------------------------------------------------------------ */
/* The component                                                       */
/* ------------------------------------------------------------------ */

export type SignaturePadProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  /** Called with the current signature after every stroke, undo, clear or edit to the typed name; null when empty. */
  onSignatureChange?: (signature: Signature | null) => void;
  /** Accessible name and the label over the pad. */
  label?: string;
  /** Offer typing a name instead of drawing. */
  allowTyping?: boolean;
  /** Prefills the typed name, e.g. from the account. */
  defaultName?: string;
  defaultMode?: "draw" | "type";
  /** Pad height in pixels. */
  height?: number;
  disabled?: boolean;
  /** A message from the form, such as "Sign to continue". */
  error?: React.ReactNode;
};

export function SignaturePad({
  onSignatureChange,
  label = "Signature",
  allowTyping = true,
  defaultName = "",
  defaultMode = "draw",
  height = 168,
  disabled = false,
  error,
  className,
  ...rest
}: SignaturePadProps) {
  const reduce = useReducedMotion();
  const mac = useIsMac();
  const id = useId();
  const [mode, setMode] = useState<"draw" | "type">(allowTyping ? defaultMode : "draw");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // Undo covers clearing too: a clear is pushed as the strokes it removed.
  const [history, setHistory] = useState<Array<{ kind: "stroke" } | { kind: "clear"; strokes: Stroke[] }>>([]);
  const [name, setName] = useState(defaultName);
  const [started, setStarted] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [said, setSaid] = useState("");

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const live = useRef<{ stroke: Stroke; last: { x: number; y: number; t: number }; id: number } | null>(null);
  const widthRef = useRef(0);
  const strokesRef = useRef<Stroke[]>([]);
  const onChangeRef = useRef(onSignatureChange);
  useEffect(() => {
    onChangeRef.current = onSignatureChange;
  });

  const inkColor = () => (canvasRef.current ? getComputedStyle(canvasRef.current).color : EXPORT_INK);

  // Full redraw at the current size and theme. Cheap: a signature is a few hundred segments.
  const redraw = useCallback((list: Stroke[]) => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    widthRef.current = w;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = ctx.fillStyle = getComputedStyle(canvas).color;
    for (const s of list) {
      paint(ctx, s, w);
      finish(ctx, s, w);
    }
  }, []);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw(strokes);
  }, [strokes, redraw]);

  // Resizes and theme switches redraw from the stored points.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => redraw(strokesRef.current));
    ro.observe(wrap);
    const mo = new MutationObserver(() => redraw(strokesRef.current));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => redraw(strokesRef.current);
    mq.addEventListener("change", onScheme);
    return () => {
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onScheme);
    };
  }, [redraw]);

  const emit = useCallback(
    (nextMode: "draw" | "type", list: Stroke[], typed: string) => {
      const cb = onChangeRef.current;
      if (!cb) return;
      if (nextMode === "type") {
        const font = nameRef.current ? getComputedStyle(nameRef.current).fontFamily : "sans-serif";
        cb(typed.trim() ? typedSignature(typed.trim(), font) : null);
      } else cb(list.length ? drawnSignature(list, widthRef.current || 1) : null);
    },
    [],
  );

  const commitStrokes = (next: Stroke[], note?: string) => {
    setStrokes(next);
    emit("draw", next, name);
    if (note) setSaid(note);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    if (last.kind === "clear") commitStrokes(last.strokes, "Signature restored");
    else {
      if (strokes.length === 1) setStarted(false);
      commitStrokes(strokes.slice(0, -1), strokes.length === 1 ? "Signature empty" : "Stroke undone");
    }
  };

  const clear = () => {
    if (!strokes.length) return;
    setHistory((h) => [...h, { kind: "clear", strokes }]);
    // The ink fades before it goes, so the clear is seen rather than a blink.
    if (reduce) {
      commitStrokes([], "Signature cleared");
      setStarted(false);
      return;
    }
    setClearing(true);
    window.setTimeout(() => {
      commitStrokes([], "Signature cleared");
      setStarted(false);
      setClearing(false);
    }, 170);
  };

  const point = (e: React.PointerEvent | PointerEvent, prev?: { x: number; y: number; t: number; w: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const W = r.width;
    const x = (e.clientX - r.left) / W;
    const y = (e.clientY - r.top) / W;
    const t = e.timeStamp;
    const min = 1.1 / W;
    const max = 3.4 / W;
    let target: number;
    if (e.pointerType === "pen" && e.pressure > 0) target = min + (max - min) * e.pressure;
    else if (!prev) target = (min + max) / 2;
    else {
      // Faster strokes draw thinner, the way a nib lifts at speed.
      const v = (Math.hypot(x - prev.x, y - prev.y) * W) / Math.max(1, t - prev.t);
      target = Math.min(max, Math.max(min, max - v * 1.1 * (max - min)));
    }
    const w = prev ? prev.w * 0.72 + target * 0.28 : target;
    return { x, y, t, w };
  };

  const empty = mode === "draw" ? strokes.length === 0 : !name.trim();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div
      data-slot="signature-pad"
      data-mode={mode}
      data-empty={empty || undefined}
      data-invalid={error ? true : undefined}
      data-disabled={disabled || undefined}
      className={cn("flex w-full min-w-0 flex-col gap-2", disabled && "pointer-events-none opacity-50", className)}
      {...rest}
    >
      <Tabs.Root
        value={mode}
        onValueChange={(v) => {
          const next = v as "draw" | "type";
          setMode(next);
          emit(next, strokes, name);
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex min-h-7 items-center justify-between gap-3">
          <span id={`${id}-label`} className="text-[13px] font-medium tracking-[-0.01em] text-fg">
            {label}
          </span>
          {allowTyping && (
            <Tabs.List aria-label="Signature method" className="relative flex rounded-lg bg-hover p-0.5">
              <Tabs.Indicator
                className={cn(
                  "absolute left-0 top-1/2 h-6 w-(--active-tab-width) -translate-y-1/2 translate-x-(--active-tab-left) rounded-md border border-line-2 bg-raised shadow-[var(--shadow)]",
                  "transition-[translate,width] duration-200 ease-in-out-quart",
                )}
              />
              {(["draw", "type"] as const).map((m) => (
                <Tabs.Tab
                  key={m}
                  value={m}
                  className={cn(
                    "relative z-1 inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-3",
                    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                    "transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.97] data-active:text-fg",
                  )}
                >
                  {m === "draw" ? <PenGlyph /> : <KeyboardGlyph />}
                  {m === "draw" ? "Draw" : "Type"}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          )}
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-xl border bg-raised shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-150",
            error
              ? "border-danger/60 has-[canvas:focus-visible]:border-danger has-[canvas:focus-visible]:ring-3 has-[canvas:focus-visible]:ring-danger/15"
              : "border-line-2 has-[canvas:focus-visible]:border-fg-3 has-[canvas:focus-visible]:ring-3 has-[canvas:focus-visible]:ring-fg/8",
          )}
          style={{ height }}
        >
          <Tabs.Panel value="draw" keepMounted className="group/draw absolute inset-0 outline-none">
            <div ref={wrapRef} className="absolute inset-0">
              <canvas
                ref={canvasRef}
                tabIndex={mode === "draw" ? 0 : -1}
                role="img"
                aria-label={`${label}. ${strokes.length ? "Signed." : "Empty."}`}
                aria-describedby={[hintId, error ? errorId : ""].filter(Boolean).join(" ")}
                data-clearing={clearing || undefined}
                onPointerDown={(e) => {
                  if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const p = point(e);
                  live.current = { stroke: [{ x: p.x, y: p.y, w: p.w }], last: p, id: e.pointerId };
                  setStarted(true);
                  const ctx = e.currentTarget.getContext("2d")!;
                  ctx.strokeStyle = ctx.fillStyle = inkColor();
                }}
                onPointerMove={(e) => {
                  const cur = live.current;
                  if (!cur || cur.id !== e.pointerId) return;
                  const ctx = e.currentTarget.getContext("2d")!;
                  // Coalesced events keep fast strokes smooth on 120Hz screens and pens.
                  const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
                  for (const ev of events.length ? events : [e.nativeEvent]) {
                    const prev = { ...cur.last, w: cur.stroke[cur.stroke.length - 1].w };
                    const p = point(ev, prev);
                    if (Math.hypot(p.x - prev.x, p.y - prev.y) * widthRef.current < 1.2) continue;
                    cur.stroke.push({ x: p.x, y: p.y, w: p.w });
                    cur.last = p;
                    paint(ctx, cur.stroke, widthRef.current, cur.stroke.length - 1);
                  }
                }}
                onPointerUp={(e) => {
                  const cur = live.current;
                  if (!cur || cur.id !== e.pointerId) return;
                  live.current = null;
                  const next = [...strokes, cur.stroke];
                  setHistory((h) => [...h, { kind: "stroke" }]);
                  commitStrokes(next, strokes.length === 0 ? "Signature added" : "");
                }}
                onPointerCancel={() => {
                  live.current = null;
                  redraw(strokes);
                }}
                onKeyDown={(e) => {
                  if (e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                    e.preventDefault();
                    undo();
                  } else if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    clear();
                  } else if (allowTyping && e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    setMode("type");
                    emit("type", strokes, name);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }
                }}
                className={cn(
                  "absolute inset-0 size-full cursor-crosshair touch-none text-fg outline-none select-none",
                  "transition-opacity duration-150 ease-out data-clearing:opacity-0",
                )}
              />
            </div>

            {/* The baseline and the × stay as a guide; the words fade once the pen touches down. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-5 bottom-[30%] flex items-end gap-2">
              <span className="pb-0.5 text-[13px] leading-none text-fg-4">×</span>
              <span className="h-px flex-1 bg-line-2" />
            </div>
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute bottom-[30%] left-10 mb-2 text-[12px] text-fg-4 transition-[opacity,translate] duration-200 ease-out",
                started || strokes.length ? "translate-y-1 opacity-0 duration-150" : "opacity-100",
              )}
            >
              Sign here
            </span>
            <span
              id={hintId}
              className={cn(
                "pointer-events-none absolute bottom-2.5 left-5 right-5 text-[11px] text-fg-4 opacity-0 transition-opacity duration-150",
                // Keyboard users land here and learn the alternatives; pointer users never see it.
                "group-has-[canvas:focus-visible]/draw:opacity-100",
              )}
            >
              Draw with a mouse, finger or pen.{allowTyping ? " Press T to type your name instead." : ""} {mac ? "⌘Z" : "Ctrl+Z"} undoes.
            </span>
          </Tabs.Panel>

          {allowTyping && (
            <Tabs.Panel value="type" keepMounted className="absolute inset-0 flex flex-col justify-end outline-none">
              <label htmlFor={`${id}-name`} className="sr-only">
                Type your full name
              </label>
              {/* The typed name is set large on the same baseline as the drawn one. */}
              <div className="pointer-events-none absolute inset-x-5 bottom-[30%] flex items-end gap-2">
                <span aria-hidden className="pb-0.5 text-[13px] leading-none text-fg-4">×</span>
                <span className="relative min-w-0 flex-1">
                  <span
                    ref={nameRef}
                    aria-hidden
                    className={cn(
                      "block truncate pb-1 leading-none font-medium italic tracking-[-0.02em] text-fg",
                      // Long names step down a size before they would truncate.
                      name.length > 26 ? "text-[22px]" : name.length > 18 ? "text-[28px]" : "text-[34px]",
                    )}
                  >
                    {name || " "}
                  </span>
                  <span aria-hidden className="block h-px bg-line-2" />
                </span>
              </div>
              <div className="relative m-2 flex h-9 items-center rounded-lg border border-line-2 bg-frame px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-fg-3 focus-within:ring-3 focus-within:ring-fg/8">
                <input
                  ref={inputRef}
                  id={`${id}-name`}
                  value={name}
                  tabIndex={mode === "type" ? 0 : -1}
                  onChange={(e) => {
                    setName(e.currentTarget.value);
                    emit("type", strokes, e.currentTarget.value);
                  }}
                  placeholder="Type your full name"
                  autoComplete="name"
                  autoCapitalize="words"
                  spellCheck={false}
                  enterKeyHint="done"
                  maxLength={80}
                  aria-describedby={error ? errorId : undefined}
                  className="w-full min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
                />
              </div>
            </Tabs.Panel>
          )}
        </div>
      </Tabs.Root>

      <div className="flex min-h-7 items-center justify-between gap-3">
        <div className="grid min-w-0 text-[12px] leading-[18px]">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={error ? "error" : mode === "type" ? "type" : "draw"}
              id={error ? errorId : undefined}
              className={cn("col-start-1 row-start-1 min-w-0 text-pretty", error ? "text-danger" : "text-fg-3")}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: ease.out }}
            >
              {error ?? (mode === "type" ? "Typing your name is as binding as drawing it." : "Your signature stays on this device until you submit.")}
            </motion.span>
          </AnimatePresence>
        </div>
        {mode === "draw" && (
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton label="Undo" shortcut={mac ? "⌘Z" : "Ctrl+Z"} disabled={!history.length} onClick={undo}>
              <path d="M5.5 5H10a3.25 3.25 0 0 1 0 6.5H6M5.5 5 7.75 2.75M5.5 5l2.25 2.25" />
            </IconButton>
            <button
              type="button"
              disabled={!strokes.length}
              onClick={clear}
              className={cn(
                "relative inline-flex h-7 items-center rounded-md px-2 text-[12px] font-medium text-fg-2",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                "transition-[background-color,color,scale,opacity] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
                "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {said}
      </span>
    </div>
  );
}

function IconButton({ label, shortcut, children, ...rest }: React.ComponentProps<"button"> & { label: string; shortcut?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-keyshortcuts={shortcut === "⌘Z" ? "Meta+Z" : shortcut ? "Control+Z" : undefined}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        "relative grid size-7 place-items-center rounded-md text-fg-2",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "transition-[background-color,color,scale,opacity] duration-150 ease-out hover:bg-hover hover:text-fg active:scale-[0.9] disabled:pointer-events-none disabled:opacity-40",
        "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
      )}
      {...rest}
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function PenGlyph() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 3.25a1.4 1.4 0 0 1 2 2L5.75 12 3 12.75 3.75 10z" />
    </svg>
  );
}

function KeyboardGlyph() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.75" y="4" width="12.5" height="8" rx="1.5" />
      <path d="M4.5 6.75h.01M7 6.75h.01M9.5 6.75h.01M12 6.75h-.5M5.5 9.25h5" />
    </svg>
  );
}
