"use client";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowDown } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";

// useLayoutEffect warns on the server; the effect only matters in the browser.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* -------------------------------------------------------------------------------------------------
 * useStickToBottom
 * -----------------------------------------------------------------------------------------------*/

export type StickToBottom = {
  /** Put on the scrolling element. */
  viewportRef: React.RefCallback<HTMLElement>;
  /** Put on the element inside it that grows. */
  contentRef: React.RefCallback<HTMLElement>;
  /** True while the view follows new content. False once the reader scrolls up. */
  stuck: boolean;
  /** Items added since the reader left the bottom. */
  unseen: number;
  /** More than half a screen away from the bottom. */
  far: boolean;
  /** Scroll to the newest content and follow it again. */
  scrollToBottom: (options?: { instant?: boolean }) => void;
};

/**
 * Follows the bottom of a growing list while the reader is there, lets go the moment they scroll
 * up, and counts what arrives while they are away. Streaming content that grows in place is
 * followed too, because it watches the content's size rather than the item count.
 */
export function useStickToBottom({ itemCount = 0 }: { itemCount?: number } = {}): StickToBottom {
  const reduce = !!useReducedMotion();
  // The nodes live in refs (they are mutated: scrollTop); state only re-runs effects when they attach.
  const vp = useRef<HTMLElement | null>(null);
  const ct = useRef<HTMLElement | null>(null);
  const [viewportNode, setViewportNode] = useState<HTMLElement | null>(null);
  const [contentNode, setContentNode] = useState<HTMLElement | null>(null);
  const viewportRef = useCallback((n: HTMLElement | null) => {
    vp.current = n;
    setViewportNode(n);
  }, []);
  const contentRef = useCallback((n: HTMLElement | null) => {
    ct.current = n;
    setContentNode(n);
  }, []);
  const [stuck, setStuck] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [far, setFar] = useState(false);
  const stuckRef = useRef(true);
  const lastTop = useRef(0);

  // Count what arrives while the reader is scrolled away. Adjusted during render, from the
  // previous count, so the badge updates in the same frame as the list.
  const [prevCount, setPrevCount] = useState(itemCount);
  if (itemCount !== prevCount) {
    setPrevCount(itemCount);
    if (!stuck && itemCount > prevCount) setUnseen((n) => n + itemCount - prevCount);
  }

  const pin = useCallback((value: boolean) => {
    stuckRef.current = value;
    setStuck(value);
    if (value) setUnseen(0);
  }, []);

  // Start at the newest message.
  useIsoLayoutEffect(() => {
    const viewport = vp.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
    lastTop.current = viewport.scrollTop;
  }, [viewportNode]);

  // Growth while stuck (new messages, streaming text, images loading) keeps the bottom in view.
  // ResizeObserver runs after layout and before paint, so the jump is never seen.
  useEffect(() => {
    const viewport = vp.current;
    const content = ct.current;
    if (!viewport || !content) return;
    const ro = new ResizeObserver(() => {
      if (stuckRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
        lastTop.current = viewport.scrollTop;
      }
      const dist = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setFar(dist > viewport.clientHeight / 2);
    });
    ro.observe(content);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [viewportNode, contentNode]);

  useEffect(() => {
    const viewport = vp.current;
    if (!viewport) return;
    const onScroll = () => {
      const top = viewport.scrollTop;
      const dist = viewport.scrollHeight - top - viewport.clientHeight;
      // Only a move up lets go. Content growing never does, and neither does the browser
      // clamping scrollTop when content shrinks, because that leaves us at the bottom.
      if (top < lastTop.current - 1 && dist > 4) {
        if (stuckRef.current) pin(false);
      } else if (dist <= 4 && !stuckRef.current) pin(true);
      lastTop.current = top;
      setFar(dist > viewport.clientHeight / 2);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [viewportNode, pin]);

  const scrollToBottom = useCallback(
    ({ instant = false }: { instant?: boolean } = {}) => {
      const viewport = vp.current;
      if (!viewport) return;
      pin(true);
      const target = viewport.scrollHeight - viewport.clientHeight;
      const dist = target - viewport.scrollTop;
      if (instant || reduce) {
        viewport.scrollTop = target;
        return;
      }
      // A long way up, skip most of it: land a screen and a half away, then glide the rest.
      if (dist > viewport.clientHeight * 2) viewport.scrollTop = target - viewport.clientHeight * 1.5;
      lastTop.current = viewport.scrollTop;
      viewport.scrollTo({ top: target, behavior: "smooth" });
    },
    [pin, reduce],
  );

  return { viewportRef, contentRef, stuck, unseen, far, scrollToBottom };
}

/* -------------------------------------------------------------------------------------------------
 * ChatScroll
 * -----------------------------------------------------------------------------------------------*/

type Ctx = StickToBottom & { viewport: React.RefObject<HTMLElement | null> };
const ChatScrollContext = createContext<Ctx | null>(null);

/** The stick-to-bottom state from inside a ChatScroll: send buttons call scrollToBottom. */
export function useChatScroll() {
  const ctx = useContext(ChatScrollContext);
  if (!ctx) throw new Error("useChatScroll must be used inside <ChatScroll>");
  return ctx;
}

export type ChatScrollProps = React.ComponentProps<"div"> & {
  /** How many messages there are. Growth while scrolled up becomes the unseen count. */
  itemCount?: number;
};

/** Frames a chat: holds the scrolling viewport, the jump button, and anything else that needs the scroll state. */
export function ChatScroll({ itemCount, className, children, ...rest }: ChatScrollProps) {
  const stick = useStickToBottom({ itemCount });
  const viewport = useRef<HTMLElement | null>(null);
  const attach = stick.viewportRef;
  // Stable, so the scroller is attached once rather than on every render.
  const viewportRef = useCallback(
    (node: HTMLElement | null) => {
      viewport.current = node;
      attach(node);
    },
    [attach],
  );
  const { contentRef, stuck, unseen, far, scrollToBottom } = stick;
  const value = useMemo<Ctx>(
    () => ({ viewportRef, contentRef, stuck, unseen, far, scrollToBottom, viewport }),
    [viewportRef, contentRef, stuck, unseen, far, scrollToBottom],
  );
  return (
    <ChatScrollContext.Provider value={value}>
      <div className={cn("relative flex min-h-0 flex-col", className)} {...rest}>
        {children}
      </div>
    </ChatScrollContext.Provider>
  );
}

export type ChatScrollViewportProps = React.ComponentProps<"div"> & {
  /** Props for the growing element inside the scroller, e.g. role="log". */
  contentProps?: React.ComponentProps<"div">;
};

/** The scrolling region. Keyboard focusable, so arrow keys, Page Down and End scroll it. */
export function ChatScrollViewport({ className, children, contentProps, "aria-label": label = "Messages", ...rest }: ChatScrollViewportProps) {
  const { viewportRef, contentRef } = useChatScroll();
  return (
    <div
      ref={viewportRef}
      tabIndex={0}
      aria-label={label}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      <div ref={contentRef} {...contentProps}>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * JumpToLatest
 * -----------------------------------------------------------------------------------------------*/

export type JumpToLatestProps = Omit<React.ComponentProps<"button">, "children"> & {
  /** Words after the count. Receives the count, for plurals and other languages. */
  label?: (count: number) => string;
  /** Name when nothing new has arrived. */
  emptyLabel?: string;
  /** Centered over the viewport, or tucked in the bottom-right corner. */
  align?: "center" | "end";
};

const defaultLabel = (n: number) => (n === 1 ? "new message" : "new messages");

/**
 * Floats up when the reader has scrolled away. Quiet and round with nothing new; once messages
 * arrive it widens into a filled pill whose count rolls, and the arrow ticks down with each one.
 */
export function JumpToLatest({ label = defaultLabel, emptyLabel = "Jump to latest", align = "center", className, onClick, ...rest }: JumpToLatestProps) {
  const { stuck, unseen, far, scrollToBottom, viewport } = useChatScroll();
  const reduce = !!useReducedMotion();
  const show = !stuck && (far || unseen > 0);
  const loud = unseen > 0;
  const words = label(unseen);
  const name = loud ? `${emptyLabel}, ${unseen} ${words}` : emptyLabel;

  return (
    <div className={cn("pointer-events-none absolute inset-x-0 bottom-3 z-(--z-sticky) flex px-3", align === "center" ? "justify-center" : "justify-end")}>
      <AnimatePresence>
        {show && (
          <motion.button
            key="jump"
            type="button"
            layout={reduce ? false : true}
            aria-label={name}
            data-state={loud ? "new" : "idle"}
            onClick={(e) => {
              onClick?.(e);
              if (e.defaultPrevented) return;
              const hadFocus = document.activeElement === e.currentTarget;
              scrollToBottom();
              // The button is about to leave; keep keyboard users in the conversation.
              if (hadFocus) viewport.current?.focus({ preventScroll: true });
            }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 6, scale: 0.94, transition: { duration: 0.14, ease: ease.in } }}
            transition={reduce ? { duration: 0.15 } : { ...spring.snappy, layout: spring.snappy }}
            style={{ borderRadius: 999 }}
            className={cn(
              "group/jump pointer-events-auto relative flex h-8 min-w-8 items-center justify-center gap-1.5 overflow-hidden border text-[12.5px] font-medium shadow-pop",
              "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              "transition-[background-color,border-color,color] duration-200 active:scale-[0.96]",
              // A touch target of 44px around the 32px drawing.
              "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
              loud ? "border-transparent bg-fg pl-2.5 pr-3 text-frame hover:bg-fg/90" : "border-line-2 bg-raised text-fg-2 hover:bg-hover hover:text-fg",
              className,
            )}
            {...(rest as React.ComponentProps<typeof motion.button>)}
          >
            {/* The arrow ticks down each time another message lands. */}
            <motion.span layout={reduce ? false : "position"} className="grid size-4 shrink-0 place-items-center">
              <motion.span
                key={unseen}
                className="grid place-items-center transition-transform duration-200 group-hover/jump:translate-y-px"
                initial={reduce || unseen === 0 ? false : { y: -5, opacity: 0.3 }}
                animate={{ y: 0, opacity: 1 }}
                transition={spring.pop}
              >
                <ArrowDown size={16} />
              </motion.span>
            </motion.span>
            <AnimatePresence initial={false} mode="popLayout">
              {loud && (
                <motion.span
                  key="count"
                  layout={reduce ? false : "position"}
                  className="flex items-center gap-1 whitespace-nowrap tabular"
                  initial={{ opacity: 0, filter: reduce ? "blur(0px)" : "blur(2px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  aria-hidden
                >
                  <NumberFlow value={unseen} animated={!reduce} className="leading-none" />
                  <span>{words}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
