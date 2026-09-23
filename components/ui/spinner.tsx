import { cn } from "@/lib/cn";

// Three spinners drawn on the icon grid (16 units, 1.5 stroke), so a spinner can
// stand in for an icon at the same size without anything around it moving.
// Everything is CSS keyframes: a spinner must keep turning while the main thread
// is busy, which is exactly when it is on screen.
const CSS = `
@keyframes stealth-spinner-in { from { opacity: 0; transform: scale(0.8); } }
@keyframes stealth-spinner-turn { to { transform: rotate(360deg); } }
@keyframes stealth-spinner-arc {
  0% { stroke-dasharray: 8 92; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 46 54; stroke-dashoffset: -22; }
  100% { stroke-dasharray: 8 92; stroke-dashoffset: -100; }
}
@keyframes stealth-spinner-dot {
  0%, 64%, 100% { transform: translateY(0); opacity: 0.32; }
  30% { transform: translateY(-2.5px); opacity: 1; }
}
@keyframes stealth-spinner-cell {
  0%, 70%, 100% { transform: scale(0.78); opacity: 0.18; }
  30% { transform: scale(1); opacity: 1; }
}
@keyframes stealth-spinner-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

.stealth-spinner { animation: stealth-spinner-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: var(--spinner-delay, 0ms); }
.stealth-spinner [data-part="turn"] { animation: stealth-spinner-turn 1.1s linear infinite; }
.stealth-spinner [data-part="arc"] { animation: stealth-spinner-arc 1.5s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
.stealth-spinner [data-part="dot"] { transform-box: fill-box; animation: stealth-spinner-dot 1.1s cubic-bezier(0.45, 0, 0.55, 1) infinite; }
.stealth-spinner [data-part="cell"] { transform-box: fill-box; transform-origin: center; animation: stealth-spinner-cell 1.2s cubic-bezier(0.45, 0, 0.55, 1) infinite; }

/* Reduced motion: nothing travels or turns. The whole mark breathes slowly instead,
   so "still working" is still said. Specific enough to outrank a global kill switch. */
@media (prefers-reduced-motion: reduce) {
  .stealth-spinner [data-part] { animation: none !important; }
  .stealth-spinner [data-part="arc"] { stroke-dasharray: 30 70; }
  .stealth-spinner [data-part="dot"] { opacity: 0.8; }
  .stealth-spinner [data-part="cell"] { opacity: 0.55; transform: scale(0.9); }
  .stealth-spinner > svg { animation: stealth-spinner-breathe 2.4s ease-in-out infinite !important; }
}
`;

const SIZES = { sm: 14, md: 16, lg: 20 } as const;

export type SpinnerProps = Omit<React.ComponentProps<"span">, "children"> & {
  variant?: "ring" | "dots" | "grid";
  /** 14, 16 or 20px, the same steps as icons. A number sets pixels directly. */
  size?: keyof typeof SIZES | number;
  /** Read by screen readers. Pass an empty string when the parent already says it is busy. */
  label?: string;
  /** Milliseconds to wait before fading in, so fast work never flashes a spinner. */
  delay?: number;
};

export function Spinner({ variant = "ring", size = "md", label = "Loading", delay = 0, className, style, ...rest }: SpinnerProps) {
  const px = typeof size === "number" ? size : SIZES[size];
  const decorative = !label;

  return (
    <span
      role={decorative ? undefined : "status"}
      aria-hidden={decorative || undefined}
      data-variant={variant}
      data-size={typeof size === "number" ? undefined : size}
      className={cn("stealth-spinner relative inline-grid shrink-0 place-items-center align-middle", className)}
      style={{ width: px, height: px, ...(delay ? { "--spinner-delay": `${delay}ms` } : null), ...style } as React.CSSProperties}
      {...rest}
    >
      <style href="stealth-spinner" precedence="default">
        {CSS}
      </style>
      <svg width={px} height={px} viewBox="0 0 16 16" fill="none" aria-hidden focusable="false" className="overflow-visible">
        {variant === "ring" && <Ring />}
        {variant === "dots" && <Dots />}
        {variant === "grid" && <Grid />}
      </svg>
      {!decorative && <span className="sr-only">{label}</span>}
    </span>
  );
}

function Ring() {
  return (
    <>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.18" />
      {/* The turn and the breathing arc run on different periods, so the loop never looks mechanical. */}
      <g data-part="turn" style={{ transformOrigin: "8px 8px" }}>
        <circle
          data-part="arc"
          cx="8"
          cy="8"
          r="6"
          pathLength={100}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="8 92"
          transform="rotate(-90 8 8)"
        />
      </g>
    </>
  );
}

function Dots() {
  return (
    <>
      {[3, 8, 13].map((cx, i) => (
        <circle key={cx} data-part="dot" cx={cx} cy="8" r="1.6" fill="currentColor" style={{ animationDelay: `${i * 0.14}s` }} />
      ))}
    </>
  );
}

function Grid() {
  const at = [1.4, 6.2, 11];
  return (
    <>
      {at.flatMap((y, row) =>
        at.map((x, col) => (
          // A diagonal wave: each cell lights one step after the cell above-left of it.
          <rect key={`${row}${col}`} data-part="cell" x={x} y={y} width="3.6" height="3.6" rx="0.9" fill="currentColor" style={{ animationDelay: `${(row + col) * 0.1}s` }} />
        )),
      )}
    </>
  );
}
