"use client";
import { Avatar } from "@base-ui/react/avatar";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";
import { Clock, Globe, Message, Pencil, Plus, X } from "@/lib/icons";

export type Presence = "online" | "away" | "busy" | "offline";
export const presenceLabel: Record<Presence, string> = { online: "Online", away: "Away", busy: "Do not disturb", offline: "Offline" };

/* -------------------------------------------------------------------------------------------------
 * useFollow: optimistic follow with rollback
 * -----------------------------------------------------------------------------------------------*/

export type UseFollowOptions = {
  following?: boolean;
  defaultFollowing?: boolean;
  /** Called with the new value. Return a promise to keep the change only if it resolves. */
  onFollowingChange?: (following: boolean) => void | Promise<unknown>;
  /** The follower count as it was when the card mounted. The local follow adds or removes one. */
  followers?: number;
};

/**
 * Follow flips on the same frame and the count moves with it. The flip is an optimistic layer
 * over the confirmed value (your `following` prop, or internal state): if the request fails the
 * layer drops and both snap back, and `error` says which way it failed. Rapid presses settle on
 * the last one, and a late answer never overwrites a newer confirmed one.
 */
export function useFollow({ following: controlled, defaultFollowing = false, onFollowingChange, followers }: UseFollowOptions) {
  const [inner, setInner] = useState(defaultFollowing);
  const confirmed = controlled ?? inner;
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const following = optimistic ?? confirmed;
  const [initial] = useState(confirmed);
  const [error, setError] = useState<"follow" | "unfollow" | null>(null);
  const request = useRef(0);
  const committed = useRef(0);
  const clear = useRef<number>(undefined);
  const handler = useRef(onFollowingChange);
  useEffect(() => {
    handler.current = onFollowingChange;
  });
  useEffect(() => () => window.clearTimeout(clear.current), []);

  const toggle = useCallback(() => {
    const next = !following;
    const id = ++request.current;
    setError(null);
    window.clearTimeout(clear.current);
    const result = handler.current?.(next);
    if (!result || typeof (result as Promise<unknown>).then !== "function") {
      setInner(next);
      setOptimistic(null);
      return;
    }
    setOptimistic(next);
    (result as Promise<unknown>).then(
      () => {
        if (id > committed.current) {
          committed.current = id;
          setInner(next);
        }
        if (id === request.current) setOptimistic(null);
      },
      () => {
        // A newer press owns the state now; this failure is old news.
        if (id !== request.current) return;
        setOptimistic(null);
        setError(next ? "follow" : "unfollow");
        clear.current = window.setTimeout(() => setError(null), 5000);
      },
    );
  }, [following]);

  const count = followers === undefined ? undefined : followers + Number(following) - Number(initial);
  return { following, toggle, error, followers: count };
}

/* -------------------------------------------------------------------------------------------------
 * FollowButton
 * -----------------------------------------------------------------------------------------------*/

export type FollowButtonProps = Omit<React.ComponentProps<"button">, "onClick"> & {
  following: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  /** Who, for the accessible name: “Follow Leo Brandt”. */
  name?: string;
};

export function FollowButton({ following, onToggle, size = "md", name, className, onPointerEnter, onPointerLeave, ...rest }: FollowButtonProps) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(false);
  // Right after following, the pointer is still on the button. It must leave once before
  // the label offers “Unfollow”, or the confirmation is replaced by its own undo.
  const [armed, setArmed] = useState(true);
  const mode = !following ? "follow" : hover && armed ? "unfollow" : "following";
  const label = mode === "follow" ? "Follow" : mode === "unfollow" ? "Unfollow" : "Following";

  return (
    <button
      type="button"
      aria-pressed={following}
      aria-label={name ? `Follow ${name}` : "Follow"}
      data-state={mode}
      data-size={size}
      onClick={() => {
        if (!following) setArmed(false);
        onToggle();
      }}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHover(true);
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        setHover(false);
        setArmed(true);
        onPointerLeave?.(e);
      }}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.005em]",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color,border-color,color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] active:duration-75 motion-reduce:active:scale-100",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 gap-1.5 rounded-md px-2.5 text-[12px]" : "h-8 gap-2 rounded-lg px-3 text-[12.5px]",
        "border",
        mode === "follow" && "border-transparent bg-fg text-frame hover:bg-fg/90",
        mode === "following" && "border-line-2 bg-raised text-fg shadow-[var(--shadow)]",
        mode === "unfollow" && "border-danger/40 bg-danger-soft text-danger",
        className,
      )}
      {...rest}
    >
      {/* The tick draws only to confirm a press, not when hover hands the label back. */}
      <span className="relative grid size-3.5 place-items-center">
        <AnimatePresence initial={false}>
          <motion.span
            key={mode}
            className="absolute inset-0 grid place-items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: mode === "follow" ? -45 : 0 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
            transition={reduce ? { duration: 0.12 } : spring.pop}
          >
            {mode === "follow" ? <Plus size={14} /> : mode === "unfollow" ? <X size={14} /> : <DrawnCheck draw={!reduce && !armed} />}
          </motion.span>
        </AnimatePresence>
      </span>
      {/* Every label shares one grid cell, so the button keeps the width of the longest. */}
      <span className="grid text-left">
        {["Follow", "Following", "Unfollow"].map((l) => (
          <span key={l} aria-hidden className="invisible col-start-1 row-start-1">
            {l}
          </span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={label}
            aria-hidden
            className="col-start-1 row-start-1"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12 } }}
            transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

function DrawnCheck({ draw }: { draw: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }}
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ProfileCard
 * -----------------------------------------------------------------------------------------------*/

export type ProfileStat = { label: string; value: number };

export type ProfileCardProps = Omit<React.ComponentProps<"div">, "children"> & {
  name: string;
  /** Without the @. */
  handle?: string;
  role?: string;
  avatarSrc?: string;
  /** Link for the name, usually the full profile. */
  href?: string;
  presence?: Presence;
  /** A custom status: “In a meeting until 15:00”. */
  statusText?: string;
  bio?: string;
  location?: string;
  /** IANA zone, for the person's local time next to their location: "Europe/Berlin". */
  timeZone?: string;
  /** Shown first in the stats, and moves by one as you follow and unfollow. */
  followers?: number;
  stats?: ProfileStat[];
  following?: boolean;
  defaultFollowing?: boolean;
  onFollowingChange?: (following: boolean) => void | Promise<unknown>;
  /** Shows the Message button. */
  onMessage?: () => void;
  /** The card is you: Edit profile replaces Follow and Message. */
  self?: boolean;
  onEdit?: () => void;
  /** `full` for profiles and popovers, `compact` for lists of people. */
  variant?: "full" | "compact";
  /** A skeleton in the card's own shape while the person loads. */
  loading?: boolean;
  locale?: string;
};

export function ProfileCard({
  name,
  handle,
  role,
  avatarSrc,
  href,
  presence,
  statusText,
  bio,
  location,
  timeZone,
  followers: followerCount,
  stats = [],
  following: followingProp,
  defaultFollowing,
  onFollowingChange,
  onMessage,
  self = false,
  onEdit,
  variant = "full",
  loading = false,
  locale = "en-US",
  className,
  ...rest
}: ProfileCardProps) {
  const follow = useFollow({ following: followingProp, defaultFollowing, onFollowingChange, followers: followerCount });
  const reduce = useReducedMotion();
  const compact = variant === "compact";

  // Content that replaces a skeleton fades in over it; content that was there first just is.
  const [hadSkeleton] = useState(loading);
  const arrive = hadSkeleton && "transition-opacity duration-200 ease-out starting:opacity-0";

  if (loading) return <ProfileSkeleton compact={compact} className={className} {...rest} />;

  const allStats: ProfileStat[] = [...(follow.followers !== undefined ? [{ label: "Followers", value: follow.followers }] : []), ...stats];
  const nameEl = href ? (
    <a
      href={href}
      className="rounded-[3px] underline decoration-transparent underline-offset-[3px] transition-[text-decoration-color] duration-150 outline-none hover:decoration-fg-4 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
    >
      {name}
    </a>
  ) : (
    name
  );

  const actions = self ? (
    onEdit && (
      <button
        type="button"
        onClick={onEdit}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 border border-line-2 bg-raised font-medium text-fg shadow-[var(--shadow)] select-none",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 motion-reduce:active:scale-100",
          compact ? "h-7 rounded-md px-2.5 text-[12px]" : "h-8 flex-1 rounded-lg px-3 text-[12.5px]",
        )}
      >
        <Pencil size={14} />
        Edit profile
      </button>
    )
  ) : (
    <>
      <FollowButton
        following={follow.following}
        onToggle={follow.toggle}
        name={name}
        size={compact ? "sm" : "md"}
        className={compact ? undefined : "flex-1"}
      />
      {onMessage && (
        <button
          type="button"
          onClick={onMessage}
          aria-label={compact ? `Message ${name}` : undefined}
          className={cn(
            "group relative inline-flex shrink-0 items-center justify-center gap-2 border border-line-2 bg-raised font-medium text-fg shadow-[var(--shadow)] select-none",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,scale] duration-150 ease-out hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 motion-reduce:active:scale-100",
            compact
              ? "size-7 rounded-md active:scale-[0.93] before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden"
              : "h-8 flex-1 rounded-lg px-3 text-[12.5px]",
          )}
        >
          <Message size={compact ? 14 : 16} className="transition-transform duration-200 ease-out group-hover:-translate-y-px" />
          {!compact && "Message"}
        </button>
      )}
    </>
  );

  const errorLine = (
    <div role="status" aria-live="polite" className="empty:hidden">
      <AnimatePresence initial={false}>
        {follow.error && (
          <motion.p
            key={follow.error}
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
            className="overflow-hidden text-[12px] text-danger"
          >
            <span className="block pt-2">
              {follow.error === "follow" ? `Couldn’t follow ${firstName(name)}.` : `Couldn’t unfollow ${firstName(name)}.`} Try again.
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  if (compact) {
    return (
      <div data-variant="compact" className={cn("flex min-w-0 flex-col", arrive, className)} {...rest}>
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={name} src={avatarSrc} presence={presence} px={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-[18px] font-medium text-fg">{nameEl}</p>
            <p className="truncate text-[12px] leading-4 text-fg-3">{role ?? (handle && `@${handle}`)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        </div>
        {errorLine}
      </div>
    );
  }

  return (
    <div
      data-variant="full"
      className={cn(
        "flex w-full max-w-80 min-w-0 flex-col rounded-xl border border-line bg-raised p-4 text-fg shadow-[var(--shadow)]",
        arrive,
        className,
      )}
      {...rest}
    >
      <PersonAvatar name={name} src={avatarSrc} presence={presence} px={56} />
      <div className="mt-3 min-w-0">
        <h3 className="text-[15px] leading-5 font-medium tracking-[-0.015em] text-balance break-words">{nameEl}</h3>
        {(handle || role) && (
          <p className="mt-0.5 truncate text-[12.5px] leading-[18px] text-fg-3">{[handle && `@${handle}`, role].filter(Boolean).join(" · ")}</p>
        )}
      </div>

      {(presence || statusText) && (
        <p className="mt-2.5 flex min-w-0 items-center gap-1.5 text-[12.5px] leading-[18px] text-fg-2">
          {presence && <PresenceDot presence={presence} size={8} />}
          <span className="truncate">
            {presence && <span className="text-fg">{presenceLabel[presence]}</span>}
            {presence && statusText && <span className="text-fg-4"> · </span>}
            {statusText}
          </span>
        </p>
      )}

      {bio && <p className="mt-2.5 line-clamp-3 text-[13px] leading-[1.5] text-pretty text-fg-2">{bio}</p>}

      {(location || timeZone) && (
        <ul className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-[18px] text-fg-3">
          {location && (
            <li className="flex min-w-0 items-center gap-1.5">
              <Globe size={14} className="shrink-0 text-fg-4" />
              <span className="truncate">{location}</span>
            </li>
          )}
          {timeZone && (
            <li className="flex items-center gap-1.5">
              <Clock size={14} className="shrink-0 text-fg-4" />
              <LocalTime timeZone={timeZone} locale={locale} />
            </li>
          )}
        </ul>
      )}

      {allStats.length > 0 && (
        <dl className="mt-3.5 flex gap-5 border-t border-line pt-3">
          {allStats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col-reverse">
              <dt className="truncate text-[11.5px] leading-4 text-fg-3">{s.label}</dt>
              <dd className="text-[14px] leading-5 font-medium tracking-[-0.01em] text-fg tabular">
                <NumberFlow
                  value={s.value}
                  locales={locale}
                  format={s.value >= 10000 ? { notation: "compact", maximumFractionDigits: 1 } : undefined}
                  animated={!reduce}
                  transformTiming={{ duration: 450, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                  spinTiming={{ duration: 450, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {actions && <div className={cn("flex gap-2", allStats.length > 0 ? "mt-3.5" : "mt-4")}>{actions}</div>}
      {errorLine}
    </div>
  );
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

// The person's clock, ticking on the minute. Rendered after mount so the server's time zone and
// clock never reach the markup; a same-width placeholder holds the line until then.
function LocalTime({ timeZone, locale }: { timeZone: string; locale: string }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone });
    } catch {
      return;
    }
    let timer = 0;
    const tick = () => {
      setNow(fmt.format(new Date()));
      timer = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    };
    timer = window.setTimeout(tick, 0);
    return () => window.clearTimeout(timer);
  }, [timeZone, locale]);
  return (
    <span className="grid tabular">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        00:00 PM local
      </span>
      <span className="col-start-1 row-start-1 transition-opacity duration-200 ease-out" style={{ opacity: now ? 1 : 0 }}>
        {now ? `${now} local` : ""}
      </span>
    </span>
  );
}

const presenceTone: Record<Presence, string> = {
  online: "bg-success",
  away: "bg-warning",
  busy: "bg-danger",
  offline: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--fg-3)]",
};

// Each presence has its own shape as well as color: busy carries a bar, offline is hollow.
function PresenceDot({ presence, size }: { presence: Presence; size: number }) {
  return (
    <span
      aria-hidden
      data-presence={presence}
      style={{ width: size, height: size }}
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full transition-[background-color,box-shadow] duration-200 ease-out",
        presenceTone[presence],
      )}
    >
      {presence === "busy" && <span className="h-[1.5px] w-1/2 rounded-full bg-raised" />}
    </span>
  );
}

function initials(name: string) {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .trim()
    .split(/[\s._]+/)
    .filter(Boolean);
  if (!words.length) return "";
  const first = (w: string) => Array.from(w)[0] ?? "";
  return (words.length === 1 ? first(words[0]) : first(words[0]) + first(words[words.length - 1])).toUpperCase();
}

const tones = ["bg-fg/[0.08] text-fg-2", "bg-fg/[0.12] text-fg-2", "bg-fg/[0.16] text-fg", "bg-fg/[0.2] text-fg"] as const;
function tone(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return tones[(h >>> 0) % tones.length];
}

function PersonAvatar({ name, src, presence, px }: { name: string; src?: string; presence?: Presence; px: number }) {
  const dot = px >= 48 ? 12 : 10;
  return (
    <span className="relative inline-grid shrink-0" style={{ width: px, height: px }}>
      <Avatar.Root className={cn("grid size-full place-items-center overflow-hidden rounded-full select-none", tone(name))}>
        <Avatar.Image
          src={src}
          alt=""
          width={px}
          height={px}
          className="col-start-1 row-start-1 size-full object-cover transition-opacity duration-200 ease-out data-starting-style:opacity-0"
        />
        <Avatar.Fallback aria-hidden className="col-start-1 row-start-1 font-medium" style={{ fontSize: Math.round(px * 0.36) }}>
          {initials(name)}
        </Avatar.Fallback>
      </Avatar.Root>
      {presence && (
        // The ring is the card's own surface, so the dot looks cut out of the avatar.
        <span
          className="absolute right-0 bottom-0 grid place-items-center rounded-full bg-raised p-[2px]"
          style={{ translate: px >= 48 ? "-1px -1px" : "1px 1px" }}
        >
          <PresenceDot presence={presence} size={dot - 4} />
          <span className="sr-only">{presenceLabel[presence]}</span>
        </span>
      )}
    </span>
  );
}

function ProfileSkeleton({ compact, className, ...rest }: { compact: boolean } & React.ComponentProps<"div">) {
  const fill = "bg-fg/[0.07] animate-pulse-soft motion-reduce:animate-none";
  const bar = cn(fill, "rounded-[4px]");
  if (compact)
    return (
      <div aria-busy data-variant="compact" className={cn("flex items-center gap-3", className)} {...rest}>
        <span className={cn(fill, "size-9 shrink-0 rounded-full")} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex h-[18px] items-center">
            <span className={cn(bar, "h-3 w-28 max-w-full")} />
          </span>
          <span className="flex h-4 items-center">
            <span className={cn(bar, "h-2.5 w-20 max-w-full")} />
          </span>
        </div>
        <span className={cn(fill, "h-7 w-[96px] shrink-0 rounded-md")} />
        <span className="sr-only">Loading profile</span>
      </div>
    );
  return (
    <div
      aria-busy
      data-variant="full"
      className={cn("flex w-full max-w-80 flex-col rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]", className)}
      {...rest}
    >
      <span className={cn(fill, "size-14 rounded-full")} />
      <span className="mt-3 flex h-5 items-center">
        <span className={cn(bar, "h-3.5 w-36")} />
      </span>
      <span className="mt-0.5 flex h-[18px] items-center">
        <span className={cn(bar, "h-2.5 w-44")} />
      </span>
      <span className="mt-2.5 flex h-[18px] items-center">
        <span className={cn(bar, "h-2.5 w-full")} />
      </span>
      <span className="flex h-[19.5px] items-center">
        <span className={cn(bar, "h-2.5 w-2/3")} />
      </span>
      <div className="mt-3.5 flex gap-5 border-t border-line pt-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex flex-col gap-1.5 py-0.5">
            <span className={cn(bar, "h-3.5 w-10")} />
            <span className={cn(bar, "h-2.5 w-14")} />
          </span>
        ))}
      </div>
      <div className="mt-3.5 flex gap-2">
        <span className={cn(fill, "h-8 flex-1 rounded-lg")} />
        <span className={cn(fill, "h-8 flex-1 rounded-lg")} />
      </div>
      <span className="sr-only">Loading profile</span>
    </div>
  );
}
