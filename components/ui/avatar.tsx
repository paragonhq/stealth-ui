"use client";
import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import { motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { dur, ease } from "@/lib/motion";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type Presence = "online" | "away" | "busy" | "offline";
type LoadStatus = "idle" | "loading" | "loaded" | "error";

const sizes: Record<AvatarSize, number> = { xs: 20, sm: 24, md: 32, lg: 40, xl: 56 };

/** Pixel size for a named size, or the number itself. */
export const avatarPx = (size: AvatarSize | number) => (typeof size === "number" ? size : sizes[size]);

/* -------------------------------------------------------------------------------------------------
 * Initials and tone
 * -----------------------------------------------------------------------------------------------*/

/**
 * "Maya Okafor" → "MO", "maya@acme.com" → "M", "Ana María de la Cruz" → "AC", "王小明" → "王".
 * Parentheticals ("(she/her)") are dropped and emoji or accents are kept whole.
 */
export function getInitials(name: string, max: 1 | 2 = 2) {
  const clean = name.replace(/\(.*?\)|\[.*?\]/g, " ").split("@")[0].trim();
  const words = clean.split(/[\s._-]+/).filter((w) => /[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(w));
  if (!words.length) return "";
  const first = (w: string) => Array.from(w.match(/[\p{L}\p{N}]|\p{Extended_Pictographic}/u)?.[0] ?? w)[0] ?? "";
  // Names that don't split into words (most CJK names) keep their first character only.
  if (words.length === 1 || max === 1) return first(words[0]).toUpperCase();
  return (first(words[0]) + first(words[words.length - 1])).toUpperCase();
}

// Five steps of the foreground over the surface, darkest to lightest. The text steps up with the
// fill so every tone keeps its contrast in both themes. No hues: people are told apart by
// initials and names, and color is reserved for meaning.
const tones = [
  "bg-fg/[0.06] text-fg-2",
  "bg-fg/[0.09] text-fg-2",
  "bg-fg/[0.12] text-fg",
  "bg-fg/[0.16] text-fg",
  "bg-fg/[0.21] text-fg",
] as const;

/** A stable tone index for a person, so the same name always gets the same fill on every screen. */
export function avatarTone(key: string) {
  // FNV-1a: tiny, fast and well spread for short strings.
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % tones.length;
}

/* -------------------------------------------------------------------------------------------------
 * Presence
 * -----------------------------------------------------------------------------------------------*/

export const presenceLabel: Record<Presence, string> = { online: "Online", away: "Away", busy: "Busy", offline: "Offline" };

// The dot is one path: a disc with a hole in it (even-odd fill). Every state is the same hole,
// a stadium of a different size and place, so the shape can morph between any two of them.
// Online has no hole, offline a round one, busy a bar, and away a large disc pushed up and to
// the left, which the clip turns into a crescent. Each state has its own shape as well as its
// color, so presence reads without color.
const holes: Record<Presence, [cx: number, cy: number, w: number, h: number]> = {
  online: [8, 8, 0, 0],
  offline: [8, 8, 7.4, 7.4],
  busy: [8, 8, 9.4, 3.4],
  away: [4.6, 4.6, 11.2, 11.2],
};

function dotPath([cx, cy, w, h]: (typeof holes)[Presence]) {
  const r = Math.min(w, h) / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const hw = w - 2 * r;
  const hh = h - 2 * r;
  const f = (n: number) => +n.toFixed(3);
  return (
    "M0 8a8 8 0 1 0 16 0a8 8 0 1 0-16 0Z" +
    `M${f(x + r)} ${f(y)}h${f(hw)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(hh)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-hw)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-hh)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}Z`
  );
}

export type AvatarPresenceProps = Omit<React.ComponentProps<"svg">, "ref"> & {
  status: Presence;
  /** Diameter in px. */
  size?: number;
};

/**
 * The presence dot on its own, for status pickers and lists. Its holes are real holes, so it sits
 * on any surface, hover washes and photos included.
 */
export function AvatarPresence({ status, size = 10, className, ...rest }: AvatarPresenceProps) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <svg
      aria-hidden
      data-status={status}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={cn(
        "block shrink-0 overflow-visible transition-[color] duration-240 ease-out-expo",
        "data-[status=online]:text-success data-[status=away]:text-warning data-[status=busy]:text-danger data-[status=offline]:text-fg-3",
        className,
      )}
      {...rest}
    >
      <clipPath id={id}>
        <circle cx="8" cy="8" r="8" />
      </clipPath>
      <motion.path
        clipPath={`url(#${id})`}
        fillRule="evenodd"
        fill="currentColor"
        initial={false}
        animate={{ d: dotPath(holes[status]) }}
        transition={reduce ? { duration: 0 } : { duration: dur.indicator, ease: ease.out }}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Avatar
 * -----------------------------------------------------------------------------------------------*/

export type AvatarProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** The person's or team's name. Drives the initials, the tone and the accessible name. */
  name?: string;
  src?: string;
  srcSet?: string;
  /** The accessible name. Defaults to the name; pass "" when the name is printed right beside it. */
  alt?: string;
  size?: AvatarSize | number;
  /** Circles for people, rounded squares for teams, workspaces and bots. */
  shape?: "circle" | "square";
  /** Presence dot on the bottom-right edge, punched through the avatar so it works on any surface. */
  status?: Presence;
  /** Anything small for the top-right corner: a count, an app mark, a verified tick. */
  badge?: React.ReactNode;
  /** A cutout ring in `--avatar-ring` (the surface color, `--frame` by default) for placing on images or overlapping. */
  ring?: boolean;
  /** A foreground ring with a gap: selected account, the person speaking. */
  highlighted?: boolean;
  /** The person hasn't arrived yet. Draws a quiet placeholder of the same size. */
  loading?: boolean;
  /** Overrides the tone picked from the name, 0–4. */
  tone?: number;
  /** Milliseconds to wait for the image before showing initials, so fast loads never flash them. */
  fallbackDelay?: number;
  onLoadingStatusChange?: (status: LoadStatus) => void;
};

export function Avatar({
  name = "",
  src,
  srcSet,
  alt,
  size = "md",
  shape = "circle",
  status,
  badge,
  ring = false,
  highlighted = false,
  loading = false,
  tone,
  fallbackDelay = 500,
  onLoadingStatusChange,
  className,
  style,
  ...rest
}: AvatarProps) {
  const px = avatarPx(size);
  const initials = getInitials(name, px < 24 ? 1 : 2);
  const [load, setLoad] = useState<LoadStatus>("idle");
  const [instant, setInstant] = useState(false);
  const sawLoading = useRef(false);
  const startedAt = useRef(0);

  const hasImage = !!(src || srcSet) && !loading;
  // Initials: at once when there is no image or it failed; after the delay while it loads; gone once it has.
  const show = !hasImage || load === "error" ? "now" : load === "loading" ? "later" : "no";

  const radius = shape === "square" ? Math.max(4, Math.round(px * 0.25)) : px / 2;
  const dot = Math.min(14, Math.max(6, Math.round(px * 0.28)));
  // Sit the dot on the avatar's outline at 45°, wherever the curve is for this shape and size.
  const inset = shape === "square" ? 0.293 * radius - dot / 2 : 0.1464 * px - dot / 2;
  // The dot's ring is a real hole punched in the avatar, not a border in the page color, so it
  // stays right on hover washes, selected rows and photos. Opaque stops only matter for their alpha.
  const c = px - inset - dot / 2;
  const hole = dot / 2 + (px >= 32 ? 2 : 1.5);
  const cutout = status && !loading ? `radial-gradient(circle at ${c}px ${c}px, transparent ${hole}px, var(--fg) ${hole + 0.5}px)` : undefined;

  const label = alt ?? (loading ? "Loading" : name);
  // With the name printed beside it (alt=""), the avatar still says the one thing only it shows: presence.
  const spoken = status && !loading ? (label ? `${label}, ${presenceLabel[status].toLowerCase()}` : presenceLabel[status]) : label;
  const decorative = !spoken;

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : spoken}
      aria-hidden={decorative || undefined}
      aria-busy={loading || undefined}
      data-size={typeof size === "string" ? size : undefined}
      data-shape={shape}
      data-status={status}
      data-loading={loading || undefined}
      style={{ width: px, height: px, "--avatar-radius": `${radius}px`, ...style } as React.CSSProperties}
      className={cn("relative inline-flex shrink-0 select-none align-middle", className)}
      {...rest}
    >
      <BaseAvatar.Root
        style={{ maskImage: cutout, WebkitMaskImage: cutout }}
        className={cn(
          "relative isolate flex size-full items-center justify-center overflow-hidden rounded-(--avatar-radius)",
          "transition-[background-color,box-shadow] duration-200",
          loading ? "animate-pulse-soft bg-fg/[0.06]" : tones[tone ?? avatarTone(name || "?")],
          // A hairline on top of everything, so pale photos keep an edge on pale surfaces.
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-fg/[0.08]",
          ring && "shadow-[0_0_0_2px_var(--avatar-ring,var(--frame))]",
        )}
      >
        {!loading && (
          <span
            aria-hidden
            data-show={show}
            className={cn(
              "absolute inset-0 grid place-items-center font-medium leading-none tracking-[0.02em]",
              "transition-opacity duration-200 ease-out",
              "data-[show=no]:opacity-0 data-[show=later]:delay-(--avatar-delay)",
            )}
            style={{ fontSize: Math.round(px * (initials.length > 1 ? 0.36 : 0.42) * 2) / 2, "--avatar-delay": `${fallbackDelay}ms` } as React.CSSProperties}
          >
            {initials || <PersonGlyph size={Math.round(px * 0.56)} />}
          </span>
        )}
        {hasImage && (
          <BaseAvatar.Image
            src={src}
            srcSet={srcSet}
            alt=""
            width={px}
            height={px}
            draggable={false}
            data-instant={instant || undefined}
            onLoadingStatusChange={(next) => {
              // Cached images report "loaded" at once, or within a frame of "loading" from the disk cache. Those appear
              // without the fade, so revisiting a list doesn't replay it on every face.
              if (next === "loading") {
                sawLoading.current = true;
                startedAt.current = performance.now();
              }
              if (next === "loaded") {
                setInstant(!sawLoading.current || performance.now() - startedAt.current < 20);
                sawLoading.current = false;
              }
              setLoad(next);
              onLoadingStatusChange?.(next);
            }}
            className={cn(
              "absolute inset-0 size-full object-cover",
              "transition-[opacity,filter,scale] duration-300 ease-out-expo",
              "data-starting-style:scale-[1.06] data-starting-style:opacity-0 data-starting-style:blur-[3px]",
              "data-ending-style:opacity-0 data-ending-style:duration-150",
              "data-instant:transition-none",
            )}
          />
        )}
      </BaseAvatar.Root>

      {/* The highlight ring grows in from just outside the avatar. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-[3px] rounded-[calc(var(--avatar-radius)+3px)] border-[1.5px] border-fg",
          "transition-[opacity,scale] duration-200 ease-out-expo",
          highlighted ? "scale-100 opacity-100" : "scale-[1.08] opacity-0",
        )}
      />

      {status && !loading && <AvatarPresence status={status} size={dot} className="absolute" style={{ right: inset, bottom: inset }} />}

      {badge && (
        <span aria-hidden className="absolute -right-1 -top-1 flex">
          {badge}
        </span>
      )}
    </span>
  );
}

function PersonGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden className="opacity-80">
      <circle cx="8" cy="5.75" r="2.75" />
      <path d="M2.75 14c.6-2.6 2.7-4.25 5.25-4.25S12.65 11.4 13.25 14" />
    </svg>
  );
}
