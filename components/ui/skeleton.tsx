"use client";
import { createContext, useContext } from "react";
import { cn } from "@/lib/cn";

// Bones are the foreground at 7%, so they read on any surface in either theme.
// The shimmer is one light passing across every bone at once: the gradient is
// pinned to the viewport (background-attachment: fixed), so a wide block and a
// short line are lit by the same sweep instead of each flashing on its own.
const CSS = `
@keyframes stealth-skeleton-in { from { opacity: 0; } }
@keyframes stealth-bone-shimmer { from { background-position: -100vw 0; } to { background-position: 100vw 0; } }
@keyframes stealth-bone-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.stealth-skeleton { animation: stealth-skeleton-in 240ms cubic-bezier(0.25, 1, 0.5, 1) both; }
/* Defaults live in a layer below utilities, so any className you pass wins. */
@layer components {
  .stealth-bone { display: block; background-color: color-mix(in oklab, var(--fg) 7%, transparent); }
  .stealth-block { width: 100%; height: 96px; border-radius: 8px; }
  .stealth-circle { flex-shrink: 0; border-radius: 9999px; }
}
[data-animation="shimmer"] .stealth-bone {
  background-image: linear-gradient(100deg, transparent 38%, color-mix(in oklab, var(--fg) 9%, transparent) 50%, transparent 62%);
  background-size: 100vw 100%;
  background-repeat: no-repeat;
  background-attachment: fixed;
  animation: stealth-bone-shimmer 2.8s linear infinite;
}
[data-animation="pulse"] .stealth-bone { animation: stealth-bone-pulse 2.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .stealth-skeleton .stealth-bone { animation: none !important; background-image: none !important; }
}
`;

type Animation = "shimmer" | "pulse" | "static";
const Ctx = createContext<{ animation: Animation } | null>(null);

export type SkeletonProps = React.ComponentProps<"div"> & {
  /** A slow light sweep, a slow opacity pulse, or nothing. */
  animation?: Animation;
  /** What is loading, for screen readers: "Loading invoices". */
  label?: string;
};

/** The loading container. Marks the region busy and sets the animation for every bone inside. */
export function Skeleton({ animation = "shimmer", label = "Loading", className, children, ...rest }: SkeletonProps) {
  return (
    <Ctx.Provider value={{ animation }}>
      <div aria-busy="true" data-animation={animation} className={cn("stealth-skeleton", className)} {...rest}>
        <style href="stealth-skeleton" precedence="default">
          {CSS}
        </style>
        <span className="sr-only">{label}</span>
        <div aria-hidden className="contents">
          {children}
        </div>
      </div>
    </Ctx.Provider>
  );
}

/** Presets used on their own bring their own container; inside a Skeleton they don't nest another. */
function Rooted({ root, children }: { root: SkeletonProps; children: React.ReactNode }) {
  const inside = useContext(Ctx);
  if (inside) return <div className={root.className} style={root.style}>{children}</div>;
  return <Skeleton {...root}>{children}</Skeleton>;
}

const len = (v: string | number | undefined) => (typeof v === "number" ? `${v}px` : v);
// Deterministic, so server and client agree and reloads don't reshuffle.
const WIDTHS = [72, 56, 84, 64, 48, 78, 60, 90, 52, 68];
const pick = (i: number) => WIDTHS[i % WIDTHS.length];

export type SkeletonLineProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Several lines, as a paragraph. The last one is shorter. */
  lines?: number;
  /** Width of a single line, or of the last line in a paragraph. */
  width?: string | number;
};

/**
 * A line of text that hasn't arrived. It is exactly one line-height tall and
 * draws a bar the height of the letters, so set the same text size and leading
 * as the real text (className="text-[13px] leading-[18px]") and nothing moves on swap.
 */
export function SkeletonLine({ lines = 1, width, className, style, ...rest }: SkeletonLineProps) {
  const one = (w: string | undefined, key?: number) => (
    <span key={key} className="flex h-[1lh] items-center" style={{ width: w }}>
      <span className="stealth-bone h-[0.72em] w-full rounded-[3px]" />
    </span>
  );
  if (lines <= 1)
    return (
      <span className={cn("block max-w-full", className)} style={{ width: len(width), ...style }} {...rest}>
        {one("100%")}
      </span>
    );
  return (
    <span className={cn("flex w-full flex-col", className)} style={style} {...rest}>
      {Array.from({ length: lines }, (_, i) => one(i === lines - 1 ? (len(width) ?? "62%") : `${[100, 96, 98, 93][i % 4]}%`, i))}
    </span>
  );
}

export type SkeletonCircleProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Diameter in pixels. Match the avatar it stands in for. */
  size?: number;
};

export function SkeletonCircle({ size = 32, className, style, ...rest }: SkeletonCircleProps) {
  return <span className={cn("stealth-bone stealth-circle", className)} style={{ width: size, height: size, ...style }} {...rest} />;
}

export type SkeletonBlockProps = Omit<React.ComponentProps<"span">, "children">;

/** Any rectangle: an image, a chart, a button. Full width and 96px tall until your className says otherwise. */
export function SkeletonBlock({ className, ...rest }: SkeletonBlockProps) {
  return <span className={cn("stealth-bone stealth-block", className)} {...rest} />;
}

export type SkeletonRowProps = SkeletonProps & {
  /** How many rows. Widths vary row to row so it reads as a list, not a stamp. */
  count?: number;
  avatar?: boolean;
  /** A second, quieter line under the name. */
  meta?: boolean;
  /** A short value at the end of the row: a time, an amount. */
  trailing?: boolean;
};

/** A list row: 32px avatar, a 13px name, a 12px meta line and a trailing value. */
export function SkeletonRow({ count = 3, avatar = true, meta = true, trailing = true, className, ...root }: SkeletonRowProps) {
  return (
    <Rooted root={{ ...root, className: cn("flex flex-col", className) }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          {avatar && <SkeletonCircle size={32} />}
          <div className="flex min-w-0 flex-1 flex-col">
            <SkeletonLine className="text-[13px] leading-[18px]" width={`${pick(i) * 0.6}%`} />
            {meta && <SkeletonLine className="text-[12px] leading-[18px]" width={`${pick(i + 3) * 0.9}%`} />}
          </div>
          {trailing && <SkeletonLine className="text-[12px] leading-[18px]" width={28 + (i % 3) * 6} />}
        </div>
      ))}
    </Rooted>
  );
}

export type SkeletonCardProps = SkeletonProps & {
  /** A media area on top: true for 16:9, or a width-to-height ratio such as 2 or 4 / 3. */
  media?: boolean | number;
  /** Lines of body text under the title. */
  lines?: number;
  /** An avatar, a name and an action along the bottom. */
  footer?: boolean;
};

/** A card: media, a 15px title, body lines and a footer with an action. */
export function SkeletonCard({ media = true, lines = 2, footer = true, className, ...root }: SkeletonCardProps) {
  return (
    <Rooted root={{ ...root, className: cn("flex flex-col overflow-hidden rounded-xl border border-line", className) }}>
      {media !== false && <SkeletonBlock className="h-auto rounded-none" style={{ aspectRatio: media === true ? 16 / 9 : media }} />}
      <div className="flex flex-col gap-1.5 p-4">
        <SkeletonLine className="text-[15px] leading-[20px]" width="58%" />
        {lines > 0 && <SkeletonLine className="text-[13px] leading-[19px]" lines={lines} width="70%" />}
      </div>
      {footer && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <SkeletonCircle size={20} />
          <SkeletonLine className="mr-auto text-[12px] leading-[18px]" width="34%" />
          <SkeletonBlock className="h-7 w-16 rounded-md" />
        </div>
      )}
    </Rooted>
  );
}

export type SkeletonTableProps = SkeletonProps & {
  rows?: number;
  columns?: number;
  /** Draw the header row. Real headers are usually known before the data, so pass false and render yours. */
  header?: boolean;
};

/** A table: a mono header, then 36px rows. The first column is widest, the last is right-aligned like a number. */
export function SkeletonTable({ rows = 5, columns = 4, header = true, className, ...root }: SkeletonTableProps) {
  const grid = { gridTemplateColumns: `minmax(0,1.6fr) repeat(${Math.max(columns - 1, 0)}, minmax(0,1fr))` };
  const cell = (r: number, c: number, head: boolean) => (
    <div key={c} className={cn("flex min-w-0 items-center", c === columns - 1 && c > 0 && "justify-end")}>
      <SkeletonLine
        className={head ? "text-[10.5px] leading-[14px]" : "text-[13px] leading-[18px]"}
        width={head ? `${38 + ((c * 17) % 24)}%` : c === columns - 1 && c > 0 ? `${40 + ((r * 13) % 22)}%` : `${pick(r * 3 + c)}%`}
      />
    </div>
  );
  return (
    <Rooted root={{ ...root, className: cn("flex flex-col text-left", className) }}>
      {header && (
        <div className="grid h-9 items-center gap-4 border-b border-line px-3" style={grid}>
          {Array.from({ length: columns }, (_, c) => cell(0, c, true))}
        </div>
      )}
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid h-9 items-center gap-4 border-b border-line px-3 last:border-b-0" style={grid}>
          {Array.from({ length: columns }, (_, c) => cell(r, c, false))}
        </div>
      ))}
    </Rooted>
  );
}
