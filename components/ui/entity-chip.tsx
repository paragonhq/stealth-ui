"use client";
import { Avatar } from "@base-ui/react/avatar";
import { PreviewCard } from "@base-ui/react/preview-card";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { Alert, Lock, User, Users } from "@/lib/icons";

export type EntityKind = "user" | "team" | "repo" | "issue";
export type IssueStatus = "open" | "active" | "done" | "closed";

export const issueStatusLabel: Record<IssueStatus, string> = {
  open: "Open",
  active: "In progress",
  done: "Done",
  closed: "Closed",
};

export type EntityDetails = {
  /** One line under the name: a handle and role, an owner, a project. */
  subtitle?: string;
  /** A bio, a repository description, the first line of an issue. Clamped to two lines. */
  description?: string;
  /** Small facts with an optional 14px icon: a local time, a star count, an assignee. */
  meta?: { icon?: React.ReactNode; label: React.ReactNode }[];
};

type LoadStatus = "idle" | "loading" | "ready" | "error";

/**
 * The lazy-load lifecycle behind the card, on its own. `prefetch` is safe to call on every
 * hover: it runs once, and a failed load runs again on the next call. Stale answers never land.
 */
export function useEntityDetails(load: (() => Promise<EntityDetails>) | undefined, initial?: EntityDetails) {
  const [state, setState] = useState<{
    status: LoadStatus;
    details: EntityDetails | undefined;
  }>({
    status: load && !initial ? "idle" : "ready",
    details: initial,
  });
  const status = useRef<LoadStatus>(state.status);
  const loadRef = useRef(load);
  const request = useRef(0);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => () => void request.current++, []);

  const prefetch = useCallback(() => {
    const fn = loadRef.current;
    if (!fn || status.current === "loading" || status.current === "ready") return;
    status.current = "loading";
    setState((s) => ({ ...s, status: "loading" }));
    const id = ++request.current;
    Promise.resolve()
      .then(fn)
      .then(
        (details) => {
          if (id !== request.current) return;
          status.current = "ready";
          setState({ status: "ready", details });
        },
        () => {
          if (id !== request.current) return;
          status.current = "error";
          setState((s) => ({ ...s, status: "error" }));
        },
      );
  }, []);

  return { ...state, prefetch };
}

export type EntityChipProps = Omit<PreviewCard.Trigger.Props, "className" | "children" | "delay" | "closeDelay"> & {
  /** What the chip points at. Sets the leading glyph and the card's header. */
  kind?: EntityKind;
  /** The display name. Truncates in the chip, wraps in full in the card. */
  name: string;
  /** Where the chip goes. Mentions are links, so middle-click and copy link work. */
  href?: string;
  /** A short key shown before the name in mono: "ENG-482", "#1290". */
  reference?: string;
  /** Profile picture for users and teams. Falls back to initials. */
  avatarSrc?: string;
  /** Issue state, drawn as a glyph whose shape carries the meaning as well as its color. */
  status?: IssueStatus;
  /** Replaces the leading glyph. */
  icon?: React.ReactNode;
  /** What the hover card shows, when you already have it. */
  details?: EntityDetails;
  /** Fetches the card's details. Starts when the pointer or focus arrives, so the open delay hides the wait. */
  load?: () => Promise<EntityDetails>;
  /** A fully custom card body, instead of the details layout. */
  card?: React.ReactNode;
  /** `sm` sits inside a line of 13px text; `md` stands alone in rows and fields. */
  size?: "sm" | "md";
  /** A mention of the person reading. Drawn one step stronger so it's found at a glance. */
  self?: boolean;
  /** Deleted, private or otherwise out of reach: drawn muted, not a link, no card. */
  unavailable?: boolean;
  /** Milliseconds of hover or focus before the card opens. */
  delay?: number;
  closeDelay?: number;
  side?: "top" | "bottom";
  /** Where the card portals to. */
  container?: PreviewCard.Portal.Props["container"];
  className?: string;
};

export function EntityChip({
  kind = "user",
  name,
  href,
  reference,
  avatarSrc,
  status,
  icon,
  details,
  load,
  card,
  size = "sm",
  self = false,
  unavailable = false,
  delay = 500,
  closeDelay = 200,
  side = "bottom",
  container,
  className,
  onPointerEnter,
  onFocus,
  ...rest
}: EntityChipProps) {
  const lifecycle = useEntityDetails(load, details);
  const hasCard = !unavailable && !!(card || details || load);

  const glyph = icon ?? (
    <Glyph
      kind={unavailable ? (kind === "user" ? "gone" : "locked") : kind}
      name={name}
      src={unavailable ? undefined : avatarSrc}
      status={status}
      px={size === "sm" ? 16 : 18}
    />
  );
  const body = (
    <>
      <span className="grid shrink-0 place-items-center">{glyph}</span>
      {reference && <span className="shrink-0 font-mono text-[0.9em] font-normal tracking-normal text-fg-3">{reference}</span>}
      <span className="min-w-0 truncate">{name}</span>
    </>
  );

  const chip = cn(
    "relative inline-flex max-w-[min(16rem,100%)] items-center rounded-md font-medium tracking-[-0.005em] align-middle whitespace-nowrap",
    size === "sm" ? "-my-px h-5 gap-1 pr-1.5 pl-0.5 text-[12.5px] leading-5" : "h-6 gap-1.5 pr-2 pl-1 text-[12.5px]",
    // Icons that aren't round avatars sit in a square box; give them the same inset as the text.
    kind !== "user" && kind !== "team" && (size === "sm" ? "pl-1" : "pl-1.5"),
    className,
  );

  if (unavailable) {
    return (
      <span
        data-kind={kind}
        data-size={size}
        data-unavailable=""
        className={cn(chip, "border border-dashed border-line-2 font-normal text-fg-3", size === "sm" ? "pl-1" : "pl-1.5")}
      >
        {body}
      </span>
    );
  }

  const trigger = cn(
    chip,
    "cursor-pointer select-none text-fg outline-none no-underline",
    // Inline chips sit between words, so their ring hugs closer than a button's.
    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
    size === "sm" ? "focus-visible:outline-offset-1" : "focus-visible:outline-offset-2",
    "transition-[background-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] active:duration-75 motion-reduce:active:scale-100",
    self
      ? "bg-fg/[0.13] shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-fg/[0.17] data-popup-open:bg-fg/[0.17]"
      : "bg-fg/[0.06] hover:bg-fg/[0.1] data-popup-open:bg-fg/[0.1]",
    // Standalone chips are small; on touch the hit area grows without changing the drawing.
    size === "md" && "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
  );

  return (
    <PreviewCard.Root
      // Without anything to preview the chip is a plain link; the root stays so `render` still works.
      open={hasCard ? undefined : false}
      onOpenChange={(open) => {
        if (open) lifecycle.prefetch();
      }}
    >
      <PreviewCard.Trigger
        href={href}
        delay={delay}
        closeDelay={closeDelay}
        data-kind={kind}
        data-size={size}
        data-self={self ? "" : undefined}
        onPointerEnter={(e) => {
          lifecycle.prefetch();
          onPointerEnter?.(e);
        }}
        onFocus={(e) => {
          lifecycle.prefetch();
          onFocus?.(e);
        }}
        className={trigger}
        {...rest}
      >
        {body}
      </PreviewCard.Trigger>
      {hasCard && (
        <PreviewCard.Portal container={container}>
          <PreviewCard.Positioner side={side} align="start" sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
            <PreviewCard.Popup
              className={cn(
                "w-72 max-w-[var(--available-width)] rounded-xl border border-line-2 bg-raised text-[13px] text-fg shadow-pop outline-none",
                "origin-[var(--transform-origin)] transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
                "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
                "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
                "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
                "data-instant:transition-none",
                "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
              )}
            >
              {card ?? (
                <Card
                  kind={kind}
                  name={name}
                  reference={reference}
                  avatarSrc={avatarSrc}
                  status={status}
                  icon={icon}
                  state={lifecycle.status}
                  details={lifecycle.details}
                />
              )}
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      )}
    </PreviewCard.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The card
 * -----------------------------------------------------------------------------------------------*/

function Card({
  kind,
  name,
  reference,
  avatarSrc,
  status,
  icon,
  state,
  details,
}: {
  kind: EntityKind;
  name: string;
  reference?: string;
  avatarSrc?: string;
  status?: IssueStatus;
  icon?: React.ReactNode;
  state: LoadStatus;
  details?: EntityDetails;
}) {
  const reduce = useReducedMotion();
  const skeleton = useLoadingGate(state === "loading" || state === "idle");
  // The header is known from the chip, so it's there on the first frame. Only the body waits.
  const phase = skeleton ? "skeleton" : state === "ready" && details ? "ready" : state === "error" ? "error" : "none";
  const round = kind === "user" || kind === "team";
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0.1 } },
    transition: { duration: reduce ? 0.12 : 0.2, ease: ease.out },
  };
  const subtitle = phase === "ready" ? details?.subtitle : undefined;
  const hasBody = phase === "skeleton" || phase === "error" || (phase === "ready" && !!(details?.description || details?.meta?.length));

  return (
    <AutoHeight>
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fg/[0.06] text-fg-2">{icon}</span>
          ) : round ? (
            <Glyph kind={kind} name={name} src={avatarSrc} px={36} />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fg/[0.06] text-fg-2">
              <Glyph kind={kind} name={name} status={status} px={20} />
            </span>
          )}
          <div className="flex min-h-9 min-w-0 flex-1 flex-col justify-center">
            {(reference || (kind === "issue" && status)) && (
              <div className="mb-0.5 flex items-center gap-1.5 text-[11.5px] leading-4 text-fg-3">
                {reference && <span className="font-mono">{reference}</span>}
                {reference && kind === "issue" && status && (
                  <span aria-hidden className="text-fg-4">
                    ·
                  </span>
                )}
                {kind === "issue" && status && <span>{issueStatusLabel[status]}</span>}
              </div>
            )}
            <p className="text-[14px] leading-[1.3] font-medium tracking-[-0.015em] text-pretty break-words">{name}</p>
            <AnimatePresence initial={false} mode="popLayout">
              {phase === "skeleton" ? (
                <motion.span key="bar" {...fade} aria-hidden className="mt-0.5 flex h-4 items-center">
                  <span className="h-2.5 w-28 animate-pulse-soft rounded-[4px] bg-fg/[0.07] motion-reduce:animate-none" />
                </motion.span>
              ) : subtitle ? (
                <motion.p key="subtitle" {...fade} className="mt-0.5 truncate text-[12px] leading-4 text-fg-3">
                  {subtitle}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          {hasBody && (
            <motion.div key={phase} {...fade} className="pt-3">
              {phase === "skeleton" && <Skeleton />}
              {phase === "error" && (
                <p className="flex items-center gap-1.5 text-[12px] text-fg-3">
                  <Alert size={14} className="shrink-0" />
                  Couldn’t load details. Hover again to retry.
                </p>
              )}
              {phase === "ready" && details && <Details details={details} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AutoHeight>
  );
}

function Details({ details }: { details: EntityDetails }) {
  const { description, meta } = details;
  return (
    <div className="flex flex-col gap-2">
      {description && <p className="line-clamp-2 text-[12.5px] leading-[18px] text-fg-2">{description}</p>}
      {meta && meta.length > 0 && (
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[12px] leading-[18px] text-fg-3">
          {meta.map((m, i) => (
            <li key={i} className="flex min-w-0 items-center gap-1.5 tabular">
              {m.icon && <span className="grid shrink-0 place-items-center text-fg-4 [&>svg]:size-3.5">{m.icon}</span>}
              <span className="truncate">{m.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Built on Details' own line boxes (two 18px description lines, a divider, an 18px meta row),
// so the swap to real content is a crossfade with nothing moving.
function Skeleton() {
  const line = "flex h-[18px] items-center";
  const bar = "h-2.5 rounded-[4px] bg-fg/[0.07] animate-pulse-soft motion-reduce:animate-none";
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <div>
        <span className={line}>
          <span className={cn(bar, "w-full")} />
        </span>
        <span className={line}>
          <span className={cn(bar, "w-3/5")} />
        </span>
      </div>
      <div className="flex gap-3 border-t border-line pt-2">
        <span className={line}>
          <span className={cn(bar, "w-16")} />
        </span>
        <span className={line}>
          <span className={cn(bar, "w-20")} />
        </span>
      </div>
    </div>
  );
}

/**
 * Loading that doesn't flash: the skeleton waits 150ms before it shows (most loads are done by
 * then), and once shown it stays at least 300ms so it never blinks.
 */
function useLoadingGate(loading: boolean) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (loading && !shown) {
      const t = window.setTimeout(() => {
        since.current = performance.now();
        setShown(true);
      }, 150);
      return () => window.clearTimeout(t);
    }
    if (!loading && shown) {
      const left = Math.max(0, 300 - (performance.now() - since.current));
      const t = window.setTimeout(() => setShown(false), left);
      return () => window.clearTimeout(t);
    }
  }, [loading, shown]);
  return shown;
}

/** Animates its own height to fit its content, so the card grows when details arrive instead of jumping. */
function AutoHeight({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { duration: 0.24, ease: ease.inOut }}
      className="overflow-hidden"
    >
      <div ref={inner} className="relative">
        {children}
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Glyphs
 * -----------------------------------------------------------------------------------------------*/

function initials(name: string) {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split("@")[0]
    .trim()
    .split(/[\s._]+/)
    .filter(Boolean);
  if (!words.length) return "";
  const first = (w: string) => Array.from(w)[0] ?? "";
  return (words.length === 1 ? first(words[0]) : first(words[0]) + first(words[words.length - 1])).toUpperCase();
}

// Neutral fills stepped by a stable hash of the name, so the same person is the same tone everywhere.
const tones = ["bg-fg/[0.08] text-fg-2", "bg-fg/[0.12] text-fg-2", "bg-fg/[0.16] text-fg", "bg-fg/[0.2] text-fg"] as const;
function tone(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return tones[(h >>> 0) % tones.length];
}

function Glyph({
  kind,
  name,
  src,
  status,
  px,
}: {
  kind: EntityKind | "locked" | "gone";
  name: string;
  src?: string;
  status?: IssueStatus;
  px: number;
}) {
  if (kind === "user" || kind === "team") {
    return (
      <Avatar.Root
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden select-none",
          kind === "team" ? "rounded-[28%]" : "rounded-full",
          tone(name),
        )}
        style={{ width: px, height: px }}
      >
        <Avatar.Image
          src={src}
          alt=""
          width={px}
          height={px}
          className="col-start-1 row-start-1 size-full object-cover transition-opacity duration-200 ease-out data-starting-style:opacity-0"
        />
        <Avatar.Fallback
          aria-hidden
          className="col-start-1 row-start-1 font-medium tracking-normal"
          style={{
            fontSize: Math.max(7, Math.round(px * (px < 20 ? 0.5 : 0.38))),
            lineHeight: 1,
          }}
        >
          {kind === "team" && px < 20 ? <Users size={px - 4} /> : px < 20 ? initials(name).slice(0, 1) : initials(name)}
        </Avatar.Fallback>
      </Avatar.Root>
    );
  }
  const size = px <= 18 ? 14 : 16;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "shrink-0",
  };
  if (kind === "locked") return <Lock size={size} className="shrink-0" />;
  if (kind === "gone") return <User size={size} className="shrink-0" />;
  if (kind === "repo")
    return (
      <svg {...common} className="shrink-0 text-fg-2">
        <path d="M4 12.25V3.9c0-.63.52-1.15 1.15-1.15h6.85v8.25H5.25A1.25 1.25 0 0 0 4 12.25zm0 0c0 .69.56 1.25 1.25 1.25H12" />
        <path d="M6.75 2.75v4l1.1-.8 1.1.8v-4" />
      </svg>
    );
  // Issue states differ by shape, not only color: hollow, half, checked, crossed.
  const s = status ?? "open";
  return (
    <svg
      {...common}
      data-status={s}
      className={cn(
        "shrink-0",
        s === "open" && "text-fg-2",
        s === "active" && "text-warning",
        s === "done" && "text-success",
        s === "closed" && "text-fg-3",
      )}
    >
      {s === "done" ? (
        <>
          <circle cx="8" cy="8" r="5.75" fill="currentColor" stroke="none" />
          <path d="m5.6 8.2 1.6 1.6 3.2-3.5" stroke="var(--raised)" strokeWidth={1.5} />
        </>
      ) : (
        <circle cx="8" cy="8" r="5.25" />
      )}
      {s === "active" && <path d="M8 4.75a3.25 3.25 0 0 1 0 6.5z" fill="currentColor" stroke="none" />}
      {s === "closed" && <path d="m6.25 6.25 3.5 3.5M9.75 6.25l-3.5 3.5" />}
    </svg>
  );
}
