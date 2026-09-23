"use client";
import { PreviewCard } from "@base-ui/react/preview-card";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { isValidElement, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { ArrowUpRight, Refresh, X } from "@/lib/icons";

/* -------------------------------------------------------------------------------------------------
 * Data
 * -----------------------------------------------------------------------------------------------*/

export type LinkMeta = {
  url: string;
  title?: string;
  description?: string;
  /** The page's social image. Shown at 1.91:1 in the card, square in the row. */
  image?: string;
  /** Alt text for the image, when the page gives one. */
  imageAlt?: string;
  /** A URL, or your own node (an inline SVG, a brand mark). Falls back to a letter tile. */
  favicon?: string | React.ReactNode;
  siteName?: string;
  /** One short line of context, e.g. "8 min read" or "Updated 3 days ago". */
  meta?: string;
};

export type LinkPreviewLoad = (url: string) => Promise<LinkMeta>;
type Status = "loading" | "ready" | "error";
type Entry = { status: Status; data?: LinkMeta };

// One cache for every preview on the page: the inline hover and the unfurled card for the same
// URL share a request, and a preview that has loaded once never shows a skeleton again.
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Starts loading a URL's preview, unless it's already loading or loaded. Safe to call on hover. */
export function prefetchLinkPreview(url: string, load: LinkPreviewLoad) {
  const current = entries.get(url);
  if (current && current.status !== "error") return;
  entries.set(url, { status: "loading" });
  emit();
  Promise.resolve()
    .then(() => load(url))
    .then(
      (data) => entries.set(url, { status: "ready", data: { ...data, url: data.url || url } }),
      () => entries.set(url, { status: "error" }),
    )
    .then(emit);
}

/** Forgets cached previews, all of them or one URL's. */
export function clearLinkPreviews(url?: string) {
  if (url) entries.delete(url);
  else entries.clear();
  emit();
}

export type LinkPreviewState = { status: Status; data: LinkMeta | undefined; retry: () => void };

/**
 * The load state of one URL's preview. Pass `data` when you already have it (server-side
 * unfurls), or `load` to fetch it here. With neither, it's built from the URL alone.
 */
export function useLinkPreview(url: string, { data, load, enabled = true }: { data?: LinkMeta; load?: LinkPreviewLoad; enabled?: boolean } = {}): LinkPreviewState {
  const entry = useSyncExternalStore(subscribe, () => entries.get(url), () => undefined);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const needed = !data && !!load && enabled;
  useEffect(() => {
    if (needed && loadRef.current) prefetchLinkPreview(url, loadRef.current);
  }, [url, needed]);

  const retry = () => loadRef.current && prefetchLinkPreview(url, loadRef.current);
  if (data) return { status: "ready", data, retry };
  if (!load) return { status: "ready", data: { url }, retry };
  return { status: entry?.status ?? "loading", data: entry?.data, retry };
}

function parse(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = (u.pathname + u.search).replace(/\/$/, "");
    return { host, path, label: host + path };
  } catch {
    return { host: url, path: "", label: url };
  }
}

/* -------------------------------------------------------------------------------------------------
 * Small parts
 * -----------------------------------------------------------------------------------------------*/

function Favicon({ src, host, size = 16 }: { src?: LinkMeta["favicon"]; host: string; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const box = cn("grid shrink-0 place-items-center overflow-hidden", size > 20 ? "rounded-lg" : "rounded-[4px]");
  if (isValidElement(src))
    return (
      <span aria-hidden className={cn(box, "text-fg")} style={{ width: size, height: size }}>
        {src}
      </span>
    );
  if (typeof src === "string" && src && failed !== src)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- favicons come from anywhere; next/image can't assume the host
      <img src={src} alt="" width={size} height={size} onError={() => setFailed(src)} className={box} style={{ width: size, height: size }} />
    );
  // No icon, or it failed: the site's first letter on a quiet tile, the same size as the icon would be.
  return (
    <span
      aria-hidden
      className={cn(box, "border border-line-2 bg-hover font-medium uppercase leading-none text-fg-2")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.58) }}
    >
      {host.charAt(0)}
    </span>
  );
}

// The image slot: reserved at its final size before anything loads. The picture settles in
// from a 4% zoom as it decodes; if there isn't one, or it fails, the site's mark stands in.
function Media({ src, alt, favicon, host, className }: { src?: string; alt?: string; favicon?: LinkMeta["favicon"]; host: string; className?: string }) {
  const [state, setState] = useState<{ src?: string; status: "loading" | "loaded" | "failed" }>({ src, status: "loading" });
  const status = state.src === src ? state.status : "loading";
  const set = (s: "loaded" | "failed") => setState({ src, status: s });
  const fallback = !src || status === "failed";
  return (
    <div className={cn("relative overflow-hidden bg-frame", className)}>
      <div
        aria-hidden
        className={cn("absolute inset-0 grid place-items-center transition-opacity duration-200", fallback ? "opacity-100" : "opacity-0")}
      >
        <span className="grid size-10 place-items-center rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
          <Favicon src={favicon} host={host} size={20} />
        </span>
      </div>
      {src && status !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element -- remote OG images; next/image can't assume the host
        <img
          key={src}
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          ref={(el) => {
            // Already decoded (cached) before hydration: skip the fade.
            if (el?.complete && el.naturalWidth && status === "loading") set("loaded");
          }}
          onLoad={() => set("loaded")}
          onError={() => set("failed")}
          className={cn(
            "absolute inset-0 size-full object-cover transition-[opacity,scale] duration-[420ms] ease-out-expo",
            status === "loaded" ? "scale-100 opacity-100" : "scale-[1.04] opacity-0",
            "motion-reduce:scale-100",
          )}
        />
      )}
    </div>
  );
}

const Bone = ({ className }: { className?: string }) => (
  <span aria-hidden className={cn("block animate-pulse-soft rounded-[4px] bg-fg/[0.07] motion-reduce:animate-none", className)} />
);

/* -------------------------------------------------------------------------------------------------
 * Body: the content of a preview, shared by the card and the hover popup
 * -----------------------------------------------------------------------------------------------*/

type Layout = "card" | "row";

function Body({
  url,
  state,
  layout,
  openInNewTab,
  action,
}: {
  url: string;
  state: LinkPreviewState;
  layout: Layout;
  openInNewTab: boolean;
  /** Sits at the end of the site line in place of the arrow (the row's remove button). */
  action?: React.ReactNode;
}) {
  const { status, data, retry } = state;
  const { host, label } = parse(data?.url ?? url);
  const loading = status === "loading" && !data;
  const failed = status === "error" && !data;
  const title = data?.title || label;
  const site = data?.siteName || host;
  const reduce = useReducedMotion();

  const link = (
    <a
      href={data?.url ?? url}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      // The whole card is the target; its focus ring is drawn by the card (has-focus-visible).
      className="outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-['']"
    >
      {title}
    </a>
  );

  const siteRow = (
    <p className="flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-fg-3">
      <Favicon src={data?.favicon} host={host} size={14} />
      <span className="truncate">{site}</span>
      {data?.meta && !failed && (
        <>
          <span aria-hidden className="text-fg-4">
            ·
          </span>
          <span className="shrink-0">{data.meta}</span>
        </>
      )}
      {action ?? (
        <ArrowUpRight
          size={14}
          className="-my-px ml-auto shrink-0 text-fg-4 transition-[translate,color] duration-200 ease-out-expo group-hover/lp:-translate-y-px group-hover/lp:translate-x-px group-hover/lp:text-fg-2"
        />
      )}
    </p>
  );

  const failure = (
    <div role="alert" className="relative z-10 flex items-center justify-between gap-3">
      <p className="text-[12.5px] leading-[18px] text-fg-3">Couldn’t load the preview</p>
      <button
        type="button"
        onClick={retry}
        className={cn(
          "-my-1 -mr-1.5 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none",
          "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        )}
      >
        <Refresh size={14} className="text-fg-3" />
        Try again
      </button>
    </div>
  );

  const text = (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={loading ? "skeleton" : "content"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.2, ease: ease.out }}
        className="flex min-w-0 flex-col gap-1.5"
      >
        {loading ? (
          // Held back 150ms, so a fast unfurl goes straight to content without a flash of gray.
          <div aria-hidden className="flex flex-col gap-1.5 transition-opacity delay-150 duration-200 starting:opacity-0">
            <span className="flex h-4 items-center gap-1.5">
              <Bone className="size-3.5" />
              <Bone className="h-2.5 w-24" />
              {action}
            </span>
            <span className="flex h-5 items-center">
              <Bone className="h-3 w-4/5" />
            </span>
            {/* Card titles usually run to two lines; rows usually to one. */}
            {layout === "card" && (
              <span className="-mt-1.5 flex h-5 items-center">
                <Bone className="h-3 w-1/2" />
              </span>
            )}
            <span className="flex flex-col gap-[7px] py-[4px]">
              <Bone className="h-2.5 w-full" />
              <Bone className="h-2.5 w-2/3" />
            </span>
          </div>
        ) : (
          <>
            {siteRow}
            <p className={cn("font-medium tracking-[-0.01em] text-fg text-pretty", layout === "card" ? "line-clamp-2 text-[14px] leading-5" : "line-clamp-2 text-[13.5px] leading-5")}>
              {link}
            </p>
            {failed ? failure : data?.description && <p className="line-clamp-2 text-[12.5px] leading-[18px] text-fg-2 text-pretty">{data.description}</p>}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );

  // A card with nothing to show up top folds its image slot away (the height glides, see Grow).
  // An image that was promised but failed keeps the slot, with the site's mark standing in.
  const showMedia = layout === "row" || loading || !!data?.image;
  const media = !showMedia ? null : loading ? (
    <div aria-hidden className={cn("shrink-0 overflow-hidden bg-frame", layout === "card" ? "aspect-[1.91/1] border-b border-line" : "size-[72px] rounded-lg border border-line")}>
      <Bone className="size-full rounded-none opacity-60" />
    </div>
  ) : (
    <Media
      src={data?.image}
      alt={data?.imageAlt}
      favicon={data?.favicon}
      host={host}
      className={layout === "card" ? "aspect-[1.91/1] border-b border-line" : "size-[72px] shrink-0 rounded-lg border border-line"}
    />
  );

  return layout === "card" ? (
    <Grow>
      {media}
      <div className="px-3.5 pb-3.5 pt-3">{text}</div>
    </Grow>
  ) : (
    <div className="flex items-start gap-3 p-3">
      <Grow className="min-w-0 flex-1">{text}</Grow>
      {media}
    </div>
  );
}

// Height follows the content on a short in-out curve, so skeleton → content → error
// never jumps the thread around it. The first measurement lands without animating.
function Grow({ className, children }: { className?: string; children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    let first = true;
    const ro = new ResizeObserver(([e]) => {
      const h = e.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight;
      if (first || reduce) height.set(h);
      else animate(height, h, { duration: 0.24, ease: ease.inOut });
      first = false;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height, reduce]);
  return (
    // clip, not hidden: a hidden box can still be scrolled sideways by focus, which would nudge the text.
    <motion.div style={{ height }} className={cn("overflow-clip", className)}>
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * The card
 * -----------------------------------------------------------------------------------------------*/

export type LinkPreviewProps = Omit<React.ComponentProps<"div">, "children"> & {
  url: string;
  /** The preview, when you already have it. */
  data?: LinkMeta;
  /** Fetches the preview. Shared and cached per URL across the page. */
  load?: LinkPreviewLoad;
  /** "card" stacks the image over the text; "row" puts a square thumbnail beside it, for chat and lists. */
  layout?: Layout;
  openInNewTab?: boolean;
  /** Shows a remove button. The card collapses its space first, then this is called. */
  onRemove?: () => void;
  removeLabel?: string;
};

/** An unfurled link: image, site, title and description, with its loading, missing and failed states. */
export function LinkPreview({
  url,
  data,
  load,
  layout = "card",
  openInNewTab = true,
  onRemove,
  removeLabel = "Remove preview",
  className,
  ...rest
}: LinkPreviewProps) {
  const state = useLinkPreview(url, { data, load });
  const [leaving, setLeaving] = useState(false);
  const reduce = useReducedMotion();

  const remove = onRemove && (
    <button
      type="button"
      aria-label={removeLabel}
      onClick={() => setLeaving(true)}
      className={cn(
        "relative z-10 grid shrink-0 place-items-center rounded-md text-fg-3 outline-none",
        layout === "card" ? "size-6 border border-line-2 bg-raised/90 shadow-pop" : "-my-1 ml-auto size-6",
        "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
        "transition-[opacity,background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.9] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        // Quiet until you're on the card (always there on touch).
        "pointer-fine:opacity-0 pointer-fine:group-hover/lp:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:group-has-[a:focus-visible]/lp:opacity-100",
      )}
    >
      <X size={12} />
    </button>
  );

  return (
    <motion.div
      animate={leaving ? (reduce ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.98 }) : undefined}
      transition={{ duration: 0.22, ease: ease.inOut }}
      onAnimationComplete={() => leaving && onRemove?.()}
      className={cn("w-full origin-top", leaving && "pointer-events-none overflow-hidden")}
    >
      <div
        data-slot="link-preview"
        data-layout={layout}
        data-status={state.status}
        aria-busy={state.status === "loading" || undefined}
        className={cn(
          "group/lp relative w-full overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]",
          "transition-[border-color,scale] duration-150 ease-out hover:border-line-2 has-[a:active]:scale-[0.99] has-[a:active]:duration-75",
          "has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-1 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-fg-3",
          className,
        )}
        {...rest}
      >
        <Body url={url} state={state} layout={layout} openInNewTab={openInNewTab} action={layout === "row" ? remove : undefined} />
        {layout === "card" && remove && <span className="absolute right-2 top-2 z-10">{remove}</span>}
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Inline link with a hover preview
 * -----------------------------------------------------------------------------------------------*/

export type LinkPreviewLinkProps = Omit<PreviewCard.Trigger.Props, "className" | "delay" | "closeDelay" | "href"> & {
  href: string;
  className?: string;
  data?: LinkMeta;
  load?: LinkPreviewLoad;
  /** Milliseconds of hover or focus before the preview opens. The request starts at once. */
  delay?: number;
  closeDelay?: number;
  side?: "top" | "bottom";
  openInNewTab?: boolean;
  /** Where to portal the preview. Defaults to document.body. */
  container?: PreviewCard.Portal.Props["container"];
};

/** A link in running text that shows where it goes before you follow it. */
export function LinkPreviewLink({
  href,
  data,
  load,
  delay = 500,
  closeDelay = 200,
  side = "bottom",
  openInNewTab = true,
  container,
  className,
  children,
  onPointerEnter,
  onFocus,
  ...rest
}: LinkPreviewLinkProps) {
  // Only subscribe to the request once someone shows interest; hovering starts it immediately.
  const [armed, setArmed] = useState(false);
  const state = useLinkPreview(href, { data, load, enabled: armed });
  const arm = () => {
    setArmed(true);
    if (load && !data) prefetchLinkPreview(href, load);
  };

  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        href={href}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
        delay={delay}
        closeDelay={closeDelay}
        onPointerEnter={(e) => {
          arm();
          onPointerEnter?.(e);
        }}
        onFocus={(e) => {
          arm();
          onFocus?.(e);
        }}
        className={cn(
          "group/link rounded-[3px] font-medium text-fg underline decoration-fg-4 decoration-1 underline-offset-[3px] outline-none",
          "transition-[text-decoration-color] duration-150 ease-out hover:decoration-fg-2 data-popup-open:decoration-fg-2",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          className,
        )}
        {...rest}
      >
        {children}
        {openInNewTab && (
          <ArrowUpRight
            size={12}
            className="ml-px inline-block align-[-1px] text-fg-4 transition-[translate,color] duration-200 ease-out-expo group-hover/link:-translate-y-px group-hover/link:translate-x-px group-hover/link:text-fg-2"
          />
        )}
        {openInNewTab && <span className="sr-only"> (opens in a new tab)</span>}
      </PreviewCard.Trigger>
      <PreviewCard.Portal container={container}>
        <PreviewCard.Positioner side={side} align="start" sideOffset={8} collisionPadding={8} className="z-(--z-popover)">
          <PreviewCard.Popup
            className={cn(
              "group/lp relative w-[300px] max-w-[var(--available-width)] overflow-hidden rounded-xl border border-line-2 bg-raised text-left shadow-pop outline-none",
              "origin-[var(--transform-origin)] transition-[opacity,scale,translate,filter] duration-200 ease-out-expo",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-starting-style:blur-[2px]",
              "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-150 data-ending-style:ease-out-quart",
              "data-instant:transition-none",
              "motion-reduce:data-starting-style:translate-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:blur-none motion-reduce:data-ending-style:scale-100",
            )}
          >
            <Body url={href} state={state} layout="card" openInNewTab={openInNewTab} />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
