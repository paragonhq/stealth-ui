"use client";
import { Tooltip } from "@base-ui/react/tooltip";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------------------------------
 * Where to cut
 * -----------------------------------------------------------------------------------------------*/

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter() : null;
// Cut between graphemes, never inside an emoji or an accented letter.
const graphemes = (s: string) => (segmenter ? Array.from(segmenter.segment(s), (g) => g.segment) : Array.from(s));

/**
 * How many characters stay whole after the ellipsis in middle truncation, when you don't say.
 * Paths keep their last segment (the file), file names keep their extension plus a few
 * characters (where "v2" and "final" live), anything else keeps its last few characters
 * (enough to tell two IDs or hashes apart).
 */
export function autoTail(text: string) {
  const n = graphemes(text).length;
  const slash = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\"));
  if (slash > 0 && slash < text.length - 1) return Math.min(n, graphemes(text.slice(slash)).length);
  const ext = /\.[a-z0-9]{1,8}$/i.exec(text);
  // Short names leave at least four characters in front, so there's always a head to cut.
  if (ext && ext.index > 0) return Math.max(0, Math.min(ext[0].length + 6, n - 4));
  return Math.min(8, Math.floor(n / 3));
}

/** Splits text into the part that shrinks and the part that stays. Pure, so it renders the same on the server. */
export function splitTail(text: string, tail: number | "auto" = "auto") {
  const g = graphemes(text);
  const keep = Math.max(0, Math.min(g.length, tail === "auto" ? autoTail(text) : tail));
  return { head: g.slice(0, g.length - keep).join(""), tail: g.slice(g.length - keep).join("") };
}

/* -------------------------------------------------------------------------------------------------
 * Measuring
 * -----------------------------------------------------------------------------------------------*/

const overflows = (el: HTMLElement) => el.scrollWidth - el.clientWidth > 0 || el.scrollHeight - el.clientHeight > 1;

/** Watches an element's size, and web fonts arriving, and calls `measure` for each. */
function useMeasure(ref: React.RefObject<HTMLElement | null>, measure: () => void, deps: unknown[]) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Observing fires once straight away, which is also the first measurement.
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    let live = true;
    document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure when the caller's content changes
  }, [ref, measure, ...deps]);
}

/**
 * Whether the text inside `ref` is actually cut off right now. Re-measures on resize, when the
 * text changes and once web fonts have loaded, so it never reports on a fallback font's width.
 */
export function useIsTruncated<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);
  const [truncated, setTruncated] = useState(false);

  const measure = useCallback(() => {
    if (ref.current) setTruncated(overflows(ref.current));
  }, []);

  useMeasure(ref, measure, deps);
  return { ref, truncated };
}

/* -------------------------------------------------------------------------------------------------
 * Group
 * -----------------------------------------------------------------------------------------------*/

const GroupContext = createContext<{ delay: number } | null>(null);

export type TruncateGroupProps = {
  /** Milliseconds of hover before the first reveal in the group. */
  delay?: number;
  /** Once one reveal closes, neighbors hovered within this many milliseconds open instantly. */
  timeout?: number;
  children?: React.ReactNode;
};

/**
 * Wrap a list or table. The first row waits, then moving down the list reveals each
 * truncated row on contact, the way a file browser does.
 */
export function TruncateGroup({ delay = 400, timeout = 400, children }: TruncateGroupProps) {
  return (
    <GroupContext value={{ delay }}>
      <Tooltip.Provider delay={delay} timeout={timeout}>
        {children}
      </Tooltip.Provider>
    </GroupContext>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Truncate
 * -----------------------------------------------------------------------------------------------*/

// The nearest thing a keyboard user can land on, so tabbing onto a row reveals its name.
const HOST = "a[href],button,input,select,textarea,summary,[tabindex],[role=row],[role=option],[role=menuitem],[role=treeitem],[role=gridcell]";

// Surface padding and border, in px. The reveal is offset by exactly this so its text lands on the original.
const PAD_X = 6;
const PAD_Y = 2;
const BORDER = 1;

type FontMatch = Pick<
  React.CSSProperties,
  "fontFamily" | "fontSize" | "fontWeight" | "letterSpacing" | "lineHeight" | "color" | "fontFeatureSettings" | "fontVariantNumeric"
>;

function readFont(el: HTMLElement): FontMatch {
  const s = getComputedStyle(el);
  return {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    letterSpacing: s.letterSpacing,
    lineHeight: s.lineHeight,
    color: s.color,
    fontFeatureSettings: s.fontFeatureSettings,
    fontVariantNumeric: s.fontVariantNumeric,
  };
}

export type TruncateProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** The full text. Always what screen readers read and what copying gives you. */
  children: string;
  /** Cut at the end, or in the middle so the end (an extension, a file, the last digits of an ID) survives. */
  position?: "end" | "middle";
  /**
   * Middle only: characters kept whole after the ellipsis. "auto" keeps a path's last
   * segment, a file's extension plus a few characters, or an ID's last few characters.
   */
  tail?: number | "auto";
  /** End only: clamp to this many lines instead of one. */
  lines?: number;
  /**
   * How the full text appears when it's cut off. "inline" unfolds it in place, over the
   * original, in the same font; "tooltip" shows it above; "none" never shows it.
   */
  reveal?: "inline" | "tooltip" | "none";
  /** Milliseconds of hover before revealing. Inside a TruncateGroup, the group's delay. */
  delay?: number;
  /** Where to portal the reveal. Defaults to document.body. */
  container?: Tooltip.Portal.Props["container"];
  /** Called when the text starts or stops being cut off. */
  onTruncatedChange?: (truncated: boolean) => void;
};

/**
 * One line (or a few) of text that cuts itself off cleanly, at the end or in the middle,
 * and offers the full text only when something was actually cut.
 */
export function Truncate({
  children: text,
  position = "end",
  tail = "auto",
  lines = 1,
  reveal = "inline",
  delay,
  container,
  onTruncatedChange,
  className,
  ...rest
}: TruncateProps) {
  const group = use(GroupContext);
  const ref = useRef<HTMLSpanElement>(null);
  const headRef = useRef<HTMLSpanElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const dotsRef = useRef<HTMLSpanElement>(null);
  // `cut` is the head's width in px when it's been cut, null when everything fits.
  const [fit, setFit] = useState<{ truncated: boolean; cut: number | null }>({ truncated: false, cut: null });
  const [open, setOpen] = useState(false);
  const [font, setFont] = useState<FontMatch>();
  const middle = position === "middle";
  const multiline = !middle && lines > 1;
  const { head, tail: end } = middle ? splitTail(text, tail) : { head: text, tail: "" };
  const truncated = fit.truncated;

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const commit = (next: { truncated: boolean; cut: number | null }) =>
      setFit((prev) => (prev.truncated === next.truncated && prev.cut === next.cut ? prev : next));
    if (!middle) return commit({ truncated: overflows(el), cut: null });

    // Middle: find the longest run of the head that fits beside the ellipsis and the tail,
    // measured on the rendered glyphs (a Range, no DOM writes), and clip the head to exactly
    // that width. CSS ellipsis would stop at a glyph and leave a gap before the tail.
    const node = headRef.current?.firstChild;
    const tailWidth = tailRef.current?.getBoundingClientRect().width ?? 0;
    const available = el.clientWidth;
    if (!(node instanceof Text)) return commit({ truncated: tailWidth - available > 0.5, cut: null });
    const range = document.createRange();
    const widthTo = (i: number) => {
      range.setStart(node, 0);
      range.setEnd(node, i);
      return range.getBoundingClientRect().width;
    };
    if (widthTo(node.length) + tailWidth <= available + 0.5) return commit({ truncated: false, cut: null });

    const room = available - tailWidth - (dotsRef.current?.getBoundingClientRect().width ?? 0);
    const stops = [0];
    for (const g of graphemes(node.data)) stops.push(stops[stops.length - 1] + g.length);
    let lo = 0;
    let hi = stops.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (widthTo(stops[mid]) <= room) lo = mid;
      else hi = mid - 1;
    }
    // Never leave a space hanging before the ellipsis.
    let at = stops[lo];
    while (at > 0 && /\s/.test(node.data[at - 1])) at--;
    commit({ truncated: true, cut: at > 0 ? widthTo(at) : 0 });
  }, [middle]);

  useMeasure(ref, measure, [text, tail, lines]);

  const onChange = useRef(onTruncatedChange);
  useEffect(() => {
    onChange.current = onTruncatedChange;
  });
  useEffect(() => {
    onChange.current?.(truncated);
  }, [truncated]);


  const show = useCallback(() => {
    if (ref.current) setFont(readFont(ref.current));
    setOpen(true);
  }, [ref]);

  // Keyboard: reveal when focus lands on the row, link or option this text lives in.
  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>(HOST);
    if (!host || reveal === "none") return;
    const onIn = (e: FocusEvent) => {
      if (e.target !== host || !host.matches(":focus-visible")) return;
      // A row can hold several (a name and its path): the first one that's cut is the one to unfold.
      if (host.querySelector("[data-slot=truncate][data-truncated]") === ref.current) show();
    };
    const onOut = (e: FocusEvent) => {
      if (e.target === host) setOpen(false);
    };
    host.addEventListener("focusin", onIn);
    host.addEventListener("focusout", onOut);
    return () => {
      host.removeEventListener("focusin", onIn);
      host.removeEventListener("focusout", onOut);
    };
  }, [ref, reveal, show]);

  const inline = reveal === "inline";

  return (
    <Tooltip.Root
      open={open && truncated}
      onOpenChange={(next) => (next ? show() : setOpen(false))}
      disabled={!truncated || reveal === "none"}
      disableHoverablePopup
    >
      <Tooltip.Trigger
        delay={delay ?? group?.delay ?? 400}
        closeOnClick={false}
        render={
          <span
            ref={ref}
            data-slot="truncate"
            data-position={position}
            data-truncated={truncated || undefined}
            className={cn(
              "min-w-0 max-w-full align-top",
              // Middle fills the width it's given, so the measurement reads the space, not its own content.
              middle ? "block w-full truncate" : multiline ? "inline-block [overflow-wrap:anywhere]" : "inline-block truncate",
              className,
            )}
            style={multiline ? { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" } : undefined}
            {...rest}
          />
        }
      >
        {middle ? (
          <>
            {/* The head and tail hold the whole text between them, inline so selecting and copying gives the real name. */}
            <span aria-hidden>
              {head && (
                <span ref={headRef} className={cn(fit.cut !== null && "inline-block overflow-hidden align-top")} style={fit.cut !== null ? { width: fit.cut } : undefined}>
                  {head}
                </span>
              )}
              <span ref={dotsRef} className={cn("select-none", fit.cut === null && "invisible absolute")}>
                …
              </span>
              {end && (
                <span ref={tailRef}>
                  {end}
                </span>
              )}
            </span>
            <span className="sr-only select-none">{text}</span>
          </>
        ) : (
          text
        )}
      </Tooltip.Trigger>

      <Tooltip.Portal container={container}>
        <Tooltip.Positioner
          side={inline ? "bottom" : "top"}
          align={inline ? "start" : "center"}
          // Inline sits exactly over the original: up by the text's height plus the surface's padding and border.
          sideOffset={inline ? ({ anchor }) => -anchor.height - PAD_Y - BORDER : 8}
          alignOffset={inline ? -PAD_X - BORDER : 0}
          collisionAvoidance={inline ? { side: "none", align: "shift", fallbackAxisSide: "none" } : undefined}
          collisionPadding={8}
          className="z-(--z-tooltip)"
        >
          <Tooltip.Popup
            aria-hidden
            style={inline ? font : undefined}
            className={cn(
              "rounded-md border border-line-2 bg-raised shadow-pop outline-none [overflow-wrap:anywhere]",
              "data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none",
              inline
                ? cn(
                    "pointer-events-none px-[6px] py-[2px]",
                    multiline
                      ? "w-[calc(var(--anchor-width)+14px)] max-w-(--available-width)"
                      : "w-max max-w-[min(32rem,var(--available-width))]",
                    // Unfolds from the original's own box: the clip starts where the text was cut and opens to full size.
                    "transition-[opacity,clip-path] [transition-duration:120ms,240ms] ease-out-expo",
                    "data-starting-style:opacity-0",
                    multiline
                      ? "data-starting-style:[clip-path:inset(0_0_calc(100%-var(--anchor-height)-3px)_0_round_6px)]"
                      : "data-starting-style:[clip-path:inset(0_calc(100%-var(--anchor-width)-7px)_0_0_round_6px)]",
                    "[clip-path:inset(0_0_0_0_round_6px)]",
                  )
                : cn(
                    "max-w-[min(20rem,var(--available-width))] px-2 py-1 text-[12px] leading-4 text-fg",
                    "origin-(--transform-origin) transition-[opacity,scale,translate] duration-150 ease-out-expo",
                    "data-starting-style:scale-96 data-starting-style:translate-y-0.5 data-starting-style:opacity-0",
                    "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0",
                  ),
            )}
          >
            {text}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
