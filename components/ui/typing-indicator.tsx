"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type TypingPerson = { id: string; name: string; src?: string };

/* -------------------------------------------------------------------------------------------------
 * Words
 * -----------------------------------------------------------------------------------------------*/

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * The sentence, as parts so names can be set apart from the verb. Names are first names: in a
 * thread everyone already knows who Ana is, and the line has to fit beside a composer.
 *   1 → "Ana is typing"   2 → "Ana and Ben are typing"   3 → "Ana, Ben and Chen are typing"
 *   4+ → "Ana, Ben and 3 others are typing"
 */
export function typingParts(people: TypingPerson[]): { names: string[]; rest: number; text: string } {
  const all = people.map((p) => firstName(p.name));
  const names = all.length <= 3 ? all : all.slice(0, 2);
  const rest = all.length - names.length;
  const joined =
    rest > 0
      ? `${names.join(", ")} and ${rest} others`
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return { names, rest, text: all.length ? `${joined} ${all.length === 1 ? "is" : "are"} typing` : "" };
}

/* -------------------------------------------------------------------------------------------------
 * Dots
 * -----------------------------------------------------------------------------------------------*/

// Continuous motion stops when nobody can see it: off screen, or the tab hidden.
function useVisible<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return [ref, visible] as const;
}

export type TypingDotsProps = React.ComponentProps<"span"> & {
  /** Dot diameter in px. */
  dot?: number;
};

/** Three dots in a wave, 150ms apart. Pauses off screen. Decorative: pair it with words. */
export function TypingDots({ dot = 4, className, style, ...rest }: TypingDotsProps) {
  const [ref, visible] = useVisible<HTMLSpanElement>();
  return (
    <span
      ref={ref}
      aria-hidden
      data-paused={visible ? undefined : ""}
      className={cn("inline-flex items-center data-paused:[&>span]:[animation-play-state:paused]", className)}
      style={{ gap: Math.max(2, Math.round(dot * 0.75)), ...style }}
      {...rest}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block animate-dot-wave rounded-full bg-current motion-reduce:animate-none motion-reduce:opacity-60"
          style={{ width: dot, height: dot, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Faces (bubble variant)
 * -----------------------------------------------------------------------------------------------*/

const tones = ["bg-fg/[0.07] text-fg-2", "bg-fg/[0.1] text-fg-2", "bg-fg/[0.13] text-fg", "bg-fg/[0.17] text-fg", "bg-fg/[0.22] text-fg"];
function tone(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return tones[(h >>> 0) % tones.length];
}

function Face({ person, size, cut }: { person: TypingPerson; size: number; cut?: string }) {
  const [broken, setBroken] = useState(false);
  const letter = (Array.from(person.name.trim())[0] ?? "").toUpperCase();
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full font-medium leading-none", tone(person.id))}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), maskImage: cut, WebkitMaskImage: cut }}
    >
      {letter}
      {person.src && !broken && (
        // eslint-disable-next-line @next/next/no-img-element -- a 20px face from any host, no optimizer in the way
        <img src={person.src} alt="" width={size} height={size} onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * TypingIndicator
 * -----------------------------------------------------------------------------------------------*/

export type TypingIndicatorProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Everyone typing right now, the viewer excluded. Empty collapses the row to nothing. */
  people: TypingPerson[];
  /** A line of text under a composer, or a message-shaped bubble at the end of a thread. */
  variant?: "inline" | "bubble";
  /** Announce who started typing to screen readers. Off for busy channels. */
  announce?: boolean;
};

/**
 * Says who is typing, with three dots in a wave. It opens and closes its own height so the thread
 * above never jumps, and the sentence slides to its new wording as people start and stop.
 */
export function TypingIndicator({ people, variant = "inline", announce = true, className, ...rest }: TypingIndicatorProps) {
  const reduce = useReducedMotion();
  const { names, rest: others, text } = typingParts(people);
  const active = people.length > 0;

  const height = reduce
    ? { duration: 0 }
    : { height: { duration: 0.24, ease: ease.inOut }, opacity: { duration: 0.2, ease: ease.out }, y: { duration: 0.24, ease: ease.out } };

  return (
    <div data-variant={variant} data-state={active ? "active" : "idle"} className={cn("relative", className)} {...rest}>
      {/* The live region stays in the DOM when empty, so the first "is typing" is read out. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announce ? text : ""}
      </span>
      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            key="row"
            aria-hidden
            className="overflow-hidden"
            // Named variants so the bubble inside can inherit them and grow with the row.
            variants={{
              hidden: { height: 0, opacity: 0, y: reduce ? 0 : 4 },
              shown: { height: "auto", opacity: 1, y: 0, transition: height },
              gone: { height: 0, opacity: 0, y: 0, transition: reduce ? { duration: 0 } : { height: { duration: 0.18, ease: ease.inOut }, opacity: { duration: 0.12 } } },
            }}
            initial="hidden"
            animate="shown"
            exit="gone"
          >
            {variant === "bubble" ? <Bubble people={people} reduce={!!reduce} /> : <Line names={names} others={others} text={text} reduce={!!reduce} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Line({ names, others, text, reduce }: { names: string[]; others: number; text: string; reduce: boolean }) {
  const verb = names.length + others === 1 ? "is" : "are";
  return (
    <div className="flex h-6 min-w-0 items-center gap-2 text-[12px] text-fg-3">
      <TypingDots dot={4} className="w-5 shrink-0 justify-center text-fg-3" />
      {/* Each wording is its own layer, so a change rolls the line instead of rewriting it in place. */}
      <span className="relative grid min-w-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={text}
            className="col-start-1 row-start-1 truncate"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
            transition={{ duration: reduce ? 0.12 : 0.22, ease: ease.out }}
          >
            {names.map((n, i) => (
              <span key={i}>
                {i > 0 && (i === names.length - 1 && others === 0 ? " and " : ", ")}
                <span className="font-medium text-fg-2">{n}</span>
              </span>
            ))}
            {others > 0 && (
              <>
                {" and "}
                <span className="font-medium text-fg-2 tabular">{others} others</span>
              </>
            )}{" "}
            {verb} typing
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}

function Bubble({ people, reduce }: { people: TypingPerson[]; reduce: boolean }) {
  const faces = people.slice(0, 2);
  const size = 22;
  const overlap = 7;
  const cut = `radial-gradient(circle at ${overlap - size / 2}px 50%, transparent ${size / 2 + 1.5}px, var(--fg) ${size / 2 + 2}px)`;
  return (
    <div className="flex items-end gap-2 pt-1.5 pb-0.5">
      <span className="flex shrink-0">
        <AnimatePresence initial={false} mode="popLayout">
          {faces.map((p, i) => (
            <motion.span
              key={p.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
              transition={spring.pop}
              className="relative flex"
              style={{ zIndex: 2 - i, marginLeft: i ? -overlap : 0 }}
            >
              <Face person={p} size={size} cut={i ? cut : undefined} />
            </motion.span>
          ))}
        </AnimatePresence>
      </span>
      {/* The bubble grows out of its tail corner, the way the message it stands in for will. */}
      <motion.span
        variants={{
          hidden: reduce ? {} : { scale: 0.8 },
          shown: { scale: 1, transition: reduce ? { duration: 0 } : { ...spring.snappy, delay: 0.04 } },
          gone: {},
        }}
        className="flex h-8 origin-bottom-left items-center rounded-2xl rounded-bl-md border border-line bg-hover px-3 text-fg-3"
      >
        <TypingDots dot={5} />
      </motion.span>
    </div>
  );
}
