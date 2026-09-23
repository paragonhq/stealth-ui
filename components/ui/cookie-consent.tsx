"use client";
import { Collapsible } from "@base-ui/react/collapsible";
import { Switch } from "@base-ui/react/switch";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { ChevronDown } from "@/lib/icons";
import { ease } from "@/lib/motion";

export type CookieCategory = {
  id: string;
  label: string;
  description?: string;
  /** Needed for the site to work. Shown as always on, never toggled. */
  required?: boolean;
  /** Pre-set for Customize only. Accept and Reject ignore it. Leave off for opt-in. */
  defaultChecked?: boolean;
};

export type CookieConsentValue = Record<string, boolean>;
export type CookieDecision = "accept-all" | "reject-non-essential" | "custom";

type Stored = { consent: CookieConsentValue; decision: CookieDecision; at: string | null };

// ---------------------------------------------------------------------------
// Storage. The decision lives in localStorage and is read after hydration:
// the server renders nothing, so people who already chose never see a flash.

const EVENT = "stealth-cookie-consent-change";
const cache = new Map<string, { raw: string | null; value: Stored | null }>();

function readStored(key: string): Stored | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }
  // useSyncExternalStore needs a stable snapshot for unchanged storage.
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value: Stored | null = null;
  try {
    value = raw ? (JSON.parse(raw) as Stored) : null;
  } catch {}
  cache.set(key, { raw, value });
  return value;
}

function writeStored(key: string, value: Stored) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked storage: the choice still applies for this visit through onDecide.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(EVENT, fn);
  };
}

const hydratedStore = { subscribe: () => () => {}, client: () => true, server: () => false };

/**
 * Read the saved choice anywhere: gate analytics on `consent.analytics`, or
 * call `reopen()` from a Cookie settings link to ask again with the last
 * choices filled in.
 */
export function useCookieConsent(storageKey = "cookie-consent") {
  const stored = useSyncExternalStore(subscribe, () => readStored(storageKey), () => null);
  const reopen = useCallback(() => {
    const prev = readStored(storageKey);
    writeStored(storageKey, { consent: prev?.consent ?? {}, decision: prev?.decision ?? "custom", at: null });
  }, [storageKey]);
  return { consent: stored?.consent ?? null, decision: stored?.decision ?? null, decided: !!stored?.at, reopen };
}

// ---------------------------------------------------------------------------

export type CookieConsentProps = Omit<React.ComponentProps<"section">, "title" | "children"> & {
  categories: CookieCategory[];
  title?: React.ReactNode;
  /** The short explanation. Keep it to two lines. */
  children?: React.ReactNode;
  policyHref?: string;
  policyLabel?: string;
  /** Called once per decision with every category's state. */
  onDecide?: (consent: CookieConsentValue, decision: CookieDecision) => void;
  storageKey?: string;
  position?: "bottom-left" | "bottom-center" | "bottom-right";
  /** Place inside the nearest positioned ancestor instead of fixed to the window. */
  contained?: boolean;
  /** Open with the categories showing. */
  defaultExpanded?: boolean;
};

const place = {
  "bottom-left": "left-4",
  "bottom-center": "left-1/2 -translate-x-1/2",
  "bottom-right": "right-4",
} as const;

export function CookieConsent({
  categories,
  title = "Cookies",
  children,
  policyHref,
  policyLabel = "Cookie policy",
  onDecide,
  storageKey = "cookie-consent",
  position = "bottom-left",
  contained = false,
  defaultExpanded = false,
  className,
  ...rest
}: CookieConsentProps) {
  const reduce = useReducedMotion();
  const { consent: saved, decided } = useCookieConsent(storageKey);
  const hydrated = useSyncExternalStore(hydratedStore.subscribe, hydratedStore.client, hydratedStore.server);
  const optional = categories.filter((c) => !c.required);
  const initial = useCallback(
    () => Object.fromEntries(categories.map((c) => [c.id, c.required ? true : (saved?.[c.id] ?? c.defaultChecked ?? false)])),
    [categories, saved],
  );

  const [choices, setChoices] = useState<CookieConsentValue>(initial);
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Set while the switches flip to show what the button meant, just before the card leaves.
  const [settling, setSettling] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const ref = useRef<HTMLElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const shown = hydrated && !decided;

  // When it asks again, start from what was saved last time.
  const [lastShown, setLastShown] = useState(shown);
  if (shown !== lastShown) {
    setLastShown(shown);
    if (shown) {
      setChoices(initial());
      setSettling(false);
    }
  }

  const decide = (decision: CookieDecision) => {
    if (settling) return;
    const consent: CookieConsentValue =
      decision === "custom"
        ? { ...choices }
        : Object.fromEntries(categories.map((c) => [c.id, c.required || decision === "accept-all"]));
    const finish = () => {
      if (ref.current?.contains(document.activeElement) && returnTo.current?.isConnected) returnTo.current.focus({ preventScroll: true });
      writeStored(storageKey, { consent, decision, at: new Date().toISOString() });
      onDecide?.(consent, decision);
    };
    // With the categories open and something to flip, flip first so the choice is visible.
    const changes = optional.some((c) => choices[c.id] !== consent[c.id]);
    if (expanded && changes && !reduce) {
      setChoices(consent);
      setSettling(true);
      timer.current = window.setTimeout(finish, 320 + optional.length * 45);
    } else finish();
  };

  const card = (
    <motion.section
      ref={ref}
      role="region"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onFocus={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) returnTo.current = e.relatedTarget as HTMLElement | null;
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.36, ease: ease.out, delay: 0.15 } }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: 12, transition: { duration: 0.2, ease: ease.in } }}
      className={cn(
        "@container z-(--z-toast) w-[min(380px,calc(100%-32px))] origin-bottom overflow-y-auto overscroll-contain rounded-xl border border-line-2 bg-raised p-4 shadow-pop",
        // Short windows scroll inside the card instead of pushing it off the top.
        contained ? "absolute bottom-4 max-h-[calc(100%-32px)]" : "fixed bottom-[max(16px,env(safe-area-inset-bottom))] max-h-[calc(100dvh-32px)] max-sm:inset-x-4 max-sm:w-auto max-sm:translate-x-0",
        place[position],
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.section>)}
    >
      <h2 id={titleId} className="text-[14px] font-medium tracking-[-0.015em] text-fg">
        {title}
      </h2>
      <p id={bodyId} className="mt-1 text-[12.5px] leading-[18px] text-fg-2 text-pretty">
        {children ?? "We use essential cookies to run the site. With your OK, we’d also like to measure how it’s used so we can improve it."}
        {policyHref && (
          <>
            {" "}
            <a href={policyHref} className="text-fg underline decoration-fg-4 underline-offset-[3px] outline-none transition-[text-decoration-color] duration-150 hover:decoration-fg-2 focus-visible:rounded-sm focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3">
              {policyLabel}
            </a>
          </>
        )}
      </p>

      <Collapsible.Root open={expanded} onOpenChange={setExpanded}>
        <Collapsible.Panel
          className={cn(
            "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-280 ease-in-out-quart motion-reduce:transition-none",
            "data-starting-style:h-0 data-ending-style:h-0",
          )}
        >
          <ul className="mt-3 flex flex-col divide-y divide-line rounded-lg border border-line" aria-label="Cookie categories">
            {categories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                checked={c.required ? true : !!choices[c.id]}
                delay={settling ? optional.findIndex((o) => o.id === c.id) * 45 : 0}
                disabled={settling}
                onChange={(on) => setChoices((prev) => ({ ...prev, [c.id]: on }))}
              />
            ))}
          </ul>
          <ConsentButton primary className="mt-2 w-full" onClick={() => decide("custom")}>
            Save my choices
          </ConsentButton>
        </Collapsible.Panel>

        {/* Equal weight, side by side; stacked when the card is too narrow to show both labels whole. */}
        <div className="mt-3 grid grid-cols-2 gap-2 @max-[340px]:grid-cols-1">
          <ConsentButton onClick={() => decide("reject-non-essential")}>Reject non-essential</ConsentButton>
          <ConsentButton onClick={() => decide("accept-all")}>Accept all</ConsentButton>
        </div>

        {/* One persistent toggle, so focus stays put; both labels share a cell so it never changes width. */}
        <Collapsible.Trigger className="group/cust mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-lg text-[12.5px] text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.98]">
          <span className="grid">
            <span aria-hidden={expanded} className={cn("col-start-1 row-start-1 text-center transition-opacity duration-150", expanded && "opacity-0")}>
              Customize
            </span>
            <span aria-hidden={!expanded} className={cn("col-start-1 row-start-1 text-center transition-opacity duration-150", !expanded && "opacity-0")}>
              Hide categories
            </span>
          </span>
          <ChevronDown size={14} className="text-fg-3 transition-transform duration-280 ease-in-out-quart group-data-panel-open/cust:rotate-180 motion-reduce:transition-none" />
        </Collapsible.Trigger>
      </Collapsible.Root>
    </motion.section>
  );

  return <AnimatePresence>{shown && card}</AnimatePresence>;
}

function CategoryRow({
  category,
  checked,
  delay,
  disabled,
  onChange,
}: {
  category: CookieCategory;
  checked: boolean;
  delay: number;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        {category.required ? (
          <span className="text-[13px] leading-[18px] text-fg">{category.label}</span>
        ) : (
          <label htmlFor={id} className="cursor-pointer text-[13px] leading-[18px] text-fg">
            {category.label}
          </label>
        )}
        {category.description && (
          <p id={`${id}-d`} className="mt-0.5 text-[12px] leading-4 text-fg-3 text-pretty">
            {category.description}
          </p>
        )}
      </div>
      {category.required ? (
        <span className="mt-px shrink-0 text-[11.5px] leading-4 text-fg-3">
          Always on
        </span>
      ) : (
        <Switch.Root
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-describedby={category.description ? `${id}-d` : undefined}
          className={cn(
            "relative mt-px inline-flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 outline-none",
            "transition-[background-color] duration-200 ease-out-expo motion-reduce:transition-none",
            "bg-fg-4 hover:bg-fg-3 data-checked:bg-fg data-checked:hover:bg-fg/90",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']",
            "data-disabled:cursor-default",
          )}
          style={{ transitionDelay: `${delay}ms` }}
        >
          <Switch.Thumb
            className={cn(
              "size-3.5 rounded-full bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.25)] dark:bg-fg-2",
              "transition-[translate,background-color] duration-260 ease-out-expo motion-reduce:transition-none",
              "data-checked:translate-x-3.5 data-checked:bg-frame",
            )}
            style={{ transitionDelay: `${delay}ms` }}
          />
        </Switch.Root>
      )}
    </li>
  );
}

function ConsentButton({ primary, className, children, ...rest }: React.ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 min-w-0 items-center justify-center rounded-lg px-3 text-[12.5px] font-medium outline-none",
        "transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        primary ? "bg-fg text-frame hover:bg-fg/90" : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover",
        className,
      )}
      {...rest}
    >
      <span className="truncate">{children}</span>
    </button>
  );
}
