"use client";
import { PreviewCard } from "@base-ui/react/preview-card";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { Clock, Globe, Refresh } from "@/lib/icons";

type Status = "idle" | "loading" | "ready" | "error";

export type HoverCardLoadState<T> = { status: Status; data: T | undefined; retry: () => void };

type Ctx = { state: HoverCardLoadState<unknown>; prefetch: () => void };
const HoverCardContext = createContext<Ctx | null>(null);
const DelayContext = createContext({ delay: 500, closeDelay: 200 });

const useCtx = () => {
  const ctx = use(HoverCardContext);
  if (!ctx) throw new Error("HoverCard parts must be inside <HoverCard>");
  return ctx;
};

/** The load state of the nearest HoverCard, for building your own content. */
export function useHoverCard<T>() {
  return useCtx().state as HoverCardLoadState<T>;
}

export type HoverCardProps<T = unknown> = Omit<PreviewCard.Root.Props, "children"> & {
  children?: React.ReactNode;
  /**
   * Fetches what the card shows. Starts the moment the pointer or focus arrives on the
   * trigger, so the open delay hides most of the latency. Called once; a failed load
   * retries on the next open.
   */
  load?: () => Promise<T>;
  /** Milliseconds of hover or focus before the card opens. */
  delay?: number;
  /** Milliseconds before it closes once the pointer has left both trigger and card. */
  closeDelay?: number;
};

export function HoverCard<T = unknown>({ load, delay = 500, closeDelay = 200, onOpenChange, children, ...rest }: HoverCardProps<T>) {
  const [state, setState] = useState<{ status: Status; data: T | undefined }>({ status: load ? "idle" : "ready", data: undefined });
  const status = useRef<Status>(load ? "idle" : "ready");
  const loadRef = useRef(load);
  const request = useRef(0);
  useEffect(() => {
    loadRef.current = load;
  });
  // Stale responses never land: each request has an id, and unmount bumps it.
  useEffect(() => () => void request.current++, []);

  const start = useCallback(() => {
    const fn = loadRef.current;
    if (!fn || status.current === "loading" || status.current === "ready") return;
    status.current = "loading";
    setState((s) => ({ ...s, status: "loading" }));
    const id = ++request.current;
    Promise.resolve()
      .then(fn)
      .then(
        (data) => {
          if (id !== request.current) return;
          status.current = "ready";
          setState({ status: "ready", data });
        },
        () => {
          if (id !== request.current) return;
          status.current = "error";
          setState((s) => ({ ...s, status: "error" }));
        },
      );
  }, []);

  const ctx: Ctx = { state: { ...state, retry: start }, prefetch: start };

  return (
    <HoverCardContext value={ctx}>
      <PreviewCard.Root
        onOpenChange={(open, details) => {
          if (open) start();
          onOpenChange?.(open, details);
        }}
        {...rest}
      >
        <DelayContext value={{ delay, closeDelay }}>{children}</DelayContext>
      </PreviewCard.Root>
    </HoverCardContext>
  );
}

export type HoverCardTriggerProps = Omit<PreviewCard.Trigger.Props, "className" | "delay" | "closeDelay"> & {
  className?: string;
  /** "link" underlines, "mention" is a soft chip, "bare" leaves styling to you. */
  variant?: "link" | "mention" | "bare";
};

export function HoverCardTrigger({ variant = "link", className, style, onPointerEnter, onFocus, ...rest }: HoverCardTriggerProps) {
  const { prefetch } = useCtx();
  const { delay, closeDelay } = use(DelayContext);
  return (
    <PreviewCard.Trigger
      delay={delay}
      closeDelay={closeDelay}
      data-variant={variant}
      onPointerEnter={(e) => {
        prefetch();
        onPointerEnter?.(e);
      }}
      onFocus={(e) => {
        prefetch();
        onFocus?.(e);
      }}
      style={{ "--hc-delay": `${delay}ms`, ...(typeof style === "object" ? style : null) } as React.CSSProperties}
      className={cn(
        "rounded-[3px] outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        // Two background lines: a faint resting underline, and a brighter one that draws
        // across over exactly the open delay, so the wait reads as "coming" rather than "broken".
        // Backgrounds follow wrapped lines, which a pseudo-element can't.
        variant !== "bare" && "cursor-pointer bg-no-repeat [background-position:0_100%,0_100%]",
        variant !== "bare" &&
          "transition-[background-size,color] duration-150 ease-out-quart hover:duration-(--hc-delay) hover:ease-linear data-popup-open:duration-150 motion-reduce:duration-0",
        variant === "link" &&
          "pb-px text-fg [background-image:linear-gradient(var(--fg-2),var(--fg-2)),linear-gradient(var(--fg-4),var(--fg-4))] [background-size:0%_1px,100%_1px] hover:[background-size:100%_1px,100%_1px] focus-visible:[background-size:100%_1px,100%_1px] data-popup-open:[background-size:100%_1px,100%_1px]",
        variant === "mention" &&
          "px-[3px] py-px font-medium text-fg [box-decoration-break:clone] [background-image:linear-gradient(color-mix(in_oklab,var(--fg)_8%,transparent),color-mix(in_oklab,var(--fg)_8%,transparent)),linear-gradient(color-mix(in_oklab,var(--fg)_6%,transparent),color-mix(in_oklab,var(--fg)_6%,transparent))] [background-size:0%_100%,100%_100%] hover:[background-size:100%_100%,100%_100%] data-popup-open:[background-size:100%_100%,100%_100%]",
        className,
      )}
      {...rest}
    />
  );
}

const widths = { sm: "w-64", md: "w-72", lg: "w-80" } as const;

export type HoverCardContentProps<T = unknown> = Omit<PreviewCard.Popup.Props, "className" | "children"> & {
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  size?: keyof typeof widths;
  container?: PreviewCard.Portal.Props["container"];
  /** Content, or a function of the load state for custom layouts. */
  children?: React.ReactNode | ((state: HoverCardLoadState<T>) => React.ReactNode);
};

export function HoverCardContent<T = unknown>({
  side = "bottom",
  align = "start",
  sideOffset = 8,
  size = "md",
  container,
  className,
  children,
  ...rest
}: HoverCardContentProps<T>) {
  const { state } = useCtx();
  return (
    <PreviewCard.Portal container={container}>
      <PreviewCard.Positioner side={side} align={align} sideOffset={sideOffset} collisionPadding={8} className="z-(--z-popover)">
        <PreviewCard.Popup
          className={cn(
            "max-w-[var(--available-width)] rounded-xl border border-line-2 bg-raised p-3.5 text-[13px] text-fg shadow-pop outline-none",
            widths[size],
            "origin-[var(--transform-origin)] transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
            "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
            "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
            "data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1",
            "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
            "data-instant:transition-none",
            "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
            className,
          )}
          {...rest}
        >
          {typeof children === "function" ? children(state as HoverCardLoadState<T>) : children}
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  );
}

// Skeleton and content share one grid cell and are built to the same geometry, so the
// swap is a 200ms crossfade with nothing moving. When the data was already there at
// open (the usual case, thanks to prefetch), there is no fade at all.
function Swap({ loaded, skeleton, children }: { loaded: boolean; skeleton: React.ReactNode; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid" aria-busy={!loaded || undefined}>
      <AnimatePresence initial={false}>
        <motion.div
          key={loaded ? "content" : "skeleton"}
          className="col-start-1 row-start-1 min-w-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
        >
          {loaded ? children : skeleton}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const Bone = ({ className }: { className?: string }) => <span aria-hidden className={cn("block animate-pulse-soft rounded-[4px] bg-fg/[0.07] motion-reduce:animate-none", className)} />;

function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 py-0.5">
      <p className="text-[12.5px] text-fg-2">Couldn’t load {what}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg outline-none",
          "transition-[background-color,scale] duration-150 hover:bg-hover active:scale-[0.97] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        )}
      >
        <Refresh size={14} className="text-fg-3" />
        Try again
      </button>
    </div>
  );
}

function Avatar({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-frame text-[13px] font-medium text-fg-2" style={{ width: size, height: size }}>
      <span aria-hidden>{initials}</span>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element -- a copied component can't assume next/image
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
        />
      )}
    </span>
  );
}

export type HoverCardPerson = {
  name: string;
  handle?: string;
  avatar?: string;
  /** Role and team, e.g. "Staff engineer · Platform". */
  role?: string;
  bio?: string;
  /** IANA zone. Shown as their local time, which is what people actually want before messaging. */
  timeZone?: string;
  /** A short status, e.g. "In a meeting until 3:30 PM". */
  status?: string;
  /** Whether the status means they're free: a filled dot when true, hollow when false. */
  available?: boolean;
};

export type HoverCardProfileProps = React.ComponentProps<"div"> & {
  /** Pass the person directly, or leave it out to use what the HoverCard's load returned. */
  person?: HoverCardPerson;
};

/** A person: avatar, name, role, two lines of bio, their local time and status. */
export function HoverCardProfile({ person, className, ...rest }: HoverCardProfileProps) {
  const { state } = useCtx();
  const data = person ?? (state.data as HoverCardPerson | undefined);
  if (!person && state.status === "error") return <Failed what="this profile" onRetry={state.retry} />;
  return (
    <div className={cn("min-w-0", className)} {...rest}>
      <Swap loaded={!!data} skeleton={<ProfileSkeleton />}>
        {data && <ProfileBody person={data} />}
      </Swap>
    </div>
  );
}

function localTime(timeZone: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone }).format(new Date());
  } catch {
    return null;
  }
}

function ProfileBody({ person }: { person: HoverCardPerson }) {
  // Only ever rendered inside an open card, on the client, so reading the clock here is hydration-safe.
  const [time] = useState(() => (person.timeZone ? localTime(person.timeZone) : null));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={person.name} src={person.avatar} />
        <div className="min-w-0 flex-1 leading-[18px]">
          <p className="truncate text-[14px] font-medium tracking-[-0.015em] text-fg">{person.name}</p>
          <p className="truncate text-[12.5px] text-fg-3">{[person.handle && `@${person.handle}`, person.role].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {/* Always two lines tall, so a short bio and the skeleton occupy the same box. */}
      <p className="line-clamp-2 min-h-9 text-[12.5px] leading-[18px] text-fg-2 text-pretty">{person.bio}</p>
      {(time || person.status) && (
        <div className="flex min-w-0 flex-col gap-1 border-t border-line pt-2.5 text-[12px] text-fg-3">
          {time && (
            <p className="flex items-center gap-1.5">
              <Clock size={14} className="shrink-0 text-fg-4" />
              <span>
                <span className="tabular">{time}</span> local time
              </span>
            </p>
          )}
          {person.status && (
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="grid size-3.5 shrink-0 place-items-center" aria-hidden>
                <span className={cn("size-1.5 rounded-full", person.available ? "bg-success" : "border border-fg-3")} />
              </span>
              <span className="truncate">{person.status}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Bone className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2 py-0.5">
          <Bone className="h-3 w-28" />
          <Bone className="h-2.5 w-40" />
        </div>
      </div>
      <div className="flex min-h-9 flex-col justify-center gap-2">
        <Bone className="h-2.5 w-full" />
        <Bone className="h-2.5 w-3/4" />
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line pb-1 pt-3.5">
        <Bone className="h-2.5 w-28" />
        <Bone className="h-2.5 w-44" />
      </div>
    </div>
  );
}

export type HoverCardLinkPreview = {
  url: string;
  title: string;
  description?: string;
  /** Shown at 16:9 above the text; the box is reserved before the image loads. */
  image?: string;
  siteName?: string;
  /** Freshness, e.g. "Updated 3 days ago". */
  meta?: string;
};

export type HoverCardLinkProps = React.ComponentProps<"div"> & {
  /** Pass the preview directly, or leave it out to use what the HoverCard's load returned. */
  preview?: HoverCardLinkPreview;
  /** Reserve the 16:9 image box in the skeleton, for previews that will have one. */
  withImage?: boolean;
};

/** A link: optional image, the site, a two-line title and a two-line description. */
export function HoverCardLink({ preview, withImage = false, className, ...rest }: HoverCardLinkProps) {
  const { state } = useCtx();
  const data = preview ?? (state.data as HoverCardLinkPreview | undefined);
  if (!preview && state.status === "error") return <Failed what="this preview" onRetry={state.retry} />;
  return (
    <div className={cn("min-w-0", className)} {...rest}>
      <Swap loaded={!!data} skeleton={<LinkSkeleton withImage={withImage} />}>
        {data && <LinkBody preview={data} />}
      </Swap>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function LinkBody({ preview }: { preview: HoverCardLinkPreview }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = hostOf(preview.url);
  return (
    <div className="flex flex-col gap-2.5">
      {preview.image && (
        <div className="relative -mx-1.5 -mt-1.5 aspect-video overflow-hidden rounded-lg border border-line bg-fg/[0.05]">
          {!failed && (
            // eslint-disable-next-line @next/next/no-img-element -- a copied component can't assume next/image
            <img
              src={preview.image}
              alt=""
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={cn("size-full object-cover transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
            />
          )}
        </div>
      )}
      <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
        <Globe size={14} className="shrink-0 text-fg-4" />
        <span className="truncate">{preview.siteName ? `${preview.siteName} · ${host}` : host}</span>
      </p>
      <div className="flex flex-col gap-1">
        <p className="line-clamp-2 text-[13.5px] font-medium leading-[19px] tracking-[-0.01em] text-fg text-balance">{preview.title}</p>
        {preview.description && <p className="line-clamp-2 min-h-9 text-[12.5px] leading-[18px] text-fg-2">{preview.description}</p>}
      </div>
      {preview.meta && <p className="text-[11.5px] text-fg-4">{preview.meta}</p>}
    </div>
  );
}

function LinkSkeleton({ withImage }: { withImage: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      {withImage && <Bone className="-mx-1.5 -mt-1.5 aspect-video rounded-lg" />}
      <div className="flex h-[18px] items-center gap-1.5">
        <Bone className="size-3.5 rounded-full" />
        <Bone className="h-2.5 w-32" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex h-[19px] items-center">
          <Bone className="h-3 w-4/5" />
        </div>
        <div className="flex min-h-9 flex-col justify-center gap-2">
          <Bone className="h-2.5 w-full" />
          <Bone className="h-2.5 w-2/3" />
        </div>
      </div>
      <div className="flex h-[17px] items-center">
        <Bone className="h-2 w-24" />
      </div>
    </div>
  );
}
