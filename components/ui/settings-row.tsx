"use client";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, use, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronsUpDown, Loader, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Phase = "idle" | "pending" | "saving" | "saved" | "error";

const isThenable = (v: unknown): v is PromiseLike<unknown> => !!v && typeof (v as PromiseLike<unknown>).then === "function";

/**
 * The save lifecycle of one setting. Pass it a promise; it reports saving,
 * then saved (for `savedFor` ms), or error with a retry. The spinner waits
 * 150ms before it shows and stays at least 300ms once it does, so fast saves
 * only ever show the tick. A newer save always wins over an older one.
 */
export function useSaveStatus({ savedFor = 1800 }: { savedFor?: number } = {}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const seq = useRef(0);
  const shownAt = useRef(0);
  const timers = useRef<number[]>([]);
  const retryRef = useRef<(() => void) | undefined>(undefined);
  const [canRetry, setCanRetry] = useState(false);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const track = useCallback(
    (promise: PromiseLike<unknown>, retry?: () => void) => {
      const id = ++seq.current;
      clear();
      retryRef.current = retry;
      setCanRetry(!!retry);
      setPhase("pending");
      shownAt.current = 0;
      timers.current.push(
        window.setTimeout(() => {
          shownAt.current = performance.now();
          setPhase("saving");
        }, 150),
      );
      const settle = (next: "saved" | "error") => {
        if (id !== seq.current) return;
        clear();
        const wait = shownAt.current ? Math.max(0, 300 - (performance.now() - shownAt.current)) : 0;
        const finish = () => {
          if (id !== seq.current) return;
          setPhase(next);
          if (next === "saved") timers.current.push(window.setTimeout(() => id === seq.current && setPhase("idle"), savedFor));
        };
        if (wait) timers.current.push(window.setTimeout(finish, wait));
        else finish();
      };
      promise.then(
        () => settle("saved"),
        () => settle("error"),
      );
    },
    [savedFor],
  );

  const retry = useCallback(() => retryRef.current?.(), []);
  const reset = useCallback(() => {
    seq.current++;
    clear();
    setPhase("idle");
  }, []);

  const status: SaveStatus = phase === "pending" ? "saving" : phase;
  return { status, visible: phase === "pending" ? "idle" : (phase as SaveStatus), track, retry, canRetry, reset };
}

type RowCtx = {
  controlId: string;
  labelId: string;
  descriptionId: string;
  disabled: boolean;
  /** Report a save in flight. The row shows saving, saved or the error. `retry` powers "Try again". */
  track: (promise: PromiseLike<unknown>, retry?: () => void) => void;
};

const RowContext = createContext<RowCtx | null>(null);

/** The ids and save tracker of the enclosing row, for wiring your own control. */
export function useSettingsRow() {
  return use(RowContext);
}

export type SettingsGroupProps = Omit<React.ComponentProps<"section">, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** A quiet line under the card: where the setting applies, or a link to learn more. */
  footer?: React.ReactNode;
  /** Red-tinted edge for irreversible settings. */
  tone?: "default" | "danger";
  /** Heading level for the title, to fit the page's outline. */
  headingLevel?: 2 | 3 | 4;
};

/** A titled card of rows separated by hairlines. */
export function SettingsGroup({ title, description, footer, tone = "default", headingLevel = 2, className, children, ...rest }: SettingsGroupProps) {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;
  return (
    <section aria-labelledby={title ? titleId : undefined} data-tone={tone} className={cn("flex w-full min-w-0 flex-col gap-3", className)} {...rest}>
      {(title || description) && (
        <header className="flex flex-col gap-0.5 px-0.5">
          {title && (
            <Heading id={titleId} className={cn("text-[14px] font-medium leading-5 tracking-[-0.015em] text-balance", tone === "danger" ? "text-danger" : "text-fg")}>
              {title}
            </Heading>
          )}
          {description && <p className="text-[12.5px] leading-[18px] text-fg-3 text-pretty">{description}</p>}
        </header>
      )}
      <div
        className={cn(
          "flex flex-col divide-y overflow-hidden rounded-xl border bg-raised shadow-[var(--shadow)]",
          tone === "danger" ? "divide-danger/15 border-danger/30" : "divide-line border-line",
        )}
      >
        {children}
      </div>
      {footer && <p className="px-0.5 text-[12px] leading-[18px] text-fg-3 text-pretty">{footer}</p>}
    </section>
  );
}

export type SettingsRowProps = Omit<React.ComponentProps<"div">, "title"> & {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** A small tag after the label: Beta, Pro, Admin only. */
  badge?: React.ReactNode;
  /** Drive the indicator yourself. Leave it out and the row follows whatever its control reports through `track`. */
  status?: SaveStatus;
  /** Shown under the description when a save fails. */
  errorText?: React.ReactNode;
  /** Called by "Try again" when you control `status`. */
  onRetry?: () => void;
  disabled?: boolean;
  /** Milliseconds the Saved tick stays before fading. */
  savedFor?: number;
};

/** One setting: what it is on the left, the control on the right, and how its last save went. */
export function SettingsRow({
  label,
  description,
  badge,
  status: statusProp,
  errorText = "Couldn’t save this change.",
  onRetry,
  disabled = false,
  savedFor,
  className,
  children,
  ...rest
}: SettingsRowProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const save = useSaveStatus({ savedFor });
  const controlled = statusProp !== undefined;
  const shown: SaveStatus = controlled ? statusProp : save.visible;
  const busy = controlled ? statusProp === "saving" : save.status === "saving";
  const retry = controlled ? onRetry : save.canRetry ? save.retry : undefined;

  const ctx = useMemo<RowCtx>(
    () => ({ controlId: `${id}-control`, labelId: `${id}-label`, descriptionId: `${id}-description`, disabled, track: save.track }),
    [id, disabled, save.track],
  );

  return (
    <RowContext value={ctx}>
      <div
        data-status={shown}
        data-disabled={disabled || undefined}
        aria-busy={busy || undefined}
        className={cn("flex flex-col px-4 py-3", className)}
        {...rest}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className={cn("flex min-w-0 flex-[1_1_13rem] flex-col gap-0.5", disabled && "opacity-50")}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              {/* A real label: pointed at a switch, the whole text becomes a target. */}
              <label id={ctx.labelId} htmlFor={ctx.controlId} className="text-[13px] font-medium leading-5 tracking-[-0.005em] text-fg">
                {label}
              </label>
              {badge != null && (
                <span className="inline-flex h-[18px] items-center rounded-full border border-line-2 px-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.06em] text-fg-3">
                  {badge}
                </span>
              )}
              <StatusMark status={shown} reduce={!!reduce} />
            </div>
            {description != null && (
              <p id={ctx.descriptionId} className="text-[12.5px] leading-[18px] text-fg-3 text-pretty">
                {description}
              </p>
            )}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
        </div>
        {/* Below the whole row, so the control stays exactly where the pointer left it. */}
        <AnimatePresence initial={false}>
          {shown === "error" && (
            <motion.div
              key="error"
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.14, ease: ease.out } }}
              transition={{ duration: 0.22, ease: ease.out }}
              className="overflow-hidden"
            >
              <p role="alert" className="flex flex-wrap items-center gap-x-1.5 pt-1.5 text-[12.5px] leading-[18px] text-danger">
                <span>{errorText}</span>
                {retry && (
                  <button
                    type="button"
                    onClick={retry}
                    className={cn(
                      "relative rounded-sm font-medium underline decoration-danger/40 underline-offset-[3px] transition-[text-decoration-color,scale] duration-150 hover:decoration-danger active:scale-[0.97]",
                      "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                      "after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] pointer-fine:after:hidden",
                    )}
                  >
                    Try again
                  </button>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </RowContext>
  );
}

const statusText: Record<Exclude<SaveStatus, "idle">, string> = { saving: "Saving", saved: "Saved", error: "Not saved" };

// Sits on the label line, so the news is next to the thing it's about and nothing below it moves.
function StatusMark({ status, reduce }: { status: SaveStatus; reduce: boolean }) {
  const live = status === "idle" ? "" : status === "error" ? "" : statusText[status];
  return (
    <>
      <AnimatePresence initial={false}>
        {status !== "idle" && (
          <motion.span
            key="mark"
            aria-hidden
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -4, filter: "blur(2px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.2, ease: ease.out } }}
            transition={{ duration: 0.2, ease: ease.out }}
            className={cn("inline-flex h-5 items-center gap-1 text-[12px] leading-none", status === "error" ? "text-danger" : "text-fg-3")}
          >
            <span className="relative grid size-3 place-items-center">
              <AnimatePresence initial={false}>
                <motion.span
                  key={status}
                  className="absolute inset-0 grid place-items-center"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                  transition={reduce ? { duration: 0.12 } : spring.pop}
                >
                  {status === "saving" && <Loader size={12} className="animate-spin-slow" />}
                  {status === "saved" && <DrawnCheck reduce={reduce} />}
                  {status === "error" && <X size={12} />}
                </motion.span>
              </AnimatePresence>
            </span>
            {/* Every word in one cell, so the mark is as wide as its longest word and never jitters. */}
            <span className="grid">
              {Object.values(statusText).map((t) => (
                <span key={t} className="invisible col-start-1 row-start-1">
                  {t}
                </span>
              ))}
              <AnimatePresence initial={false}>
                <motion.span
                  key={status}
                  className="col-start-1 row-start-1"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: ease.out }}
                >
                  {statusText[status as Exclude<SaveStatus, "idle">]}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
      <span role="status" aria-live="polite" className="sr-only">
        {live}
      </span>
    </>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: ease.out, delay: 0.04 }}
      />
    </svg>
  );
}

export type SettingsSwitchProps = Omit<BaseSwitch.Root.Props, "className" | "children" | "onCheckedChange" | "checked" | "defaultChecked"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  /** Return a promise and the switch flips at once, the row shows the save, and it flips back if the promise rejects. */
  onCheckedChange?: (checked: boolean) => void | PromiseLike<unknown>;
  className?: string;
};

/** A switch wired to its row: labelled by the row's text, reporting its saves to the row's indicator. */
export function SettingsSwitch({ checked: checkedProp, defaultChecked = false, onCheckedChange, disabled, className, ...rest }: SettingsSwitchProps) {
  const row = useSettingsRow();
  const reduce = useReducedMotion();
  const [checked, setChecked] = useControllableState({ value: checkedProp, defaultValue: defaultChecked });
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pressed, setPressed] = useState(false);
  const seq = useRef(0);
  const on = optimistic ?? checked;
  const off = disabled || row?.disabled;

  const attempt = (next: boolean) => {
    const result = onCheckedChange?.(next);
    if (!isThenable(result)) {
      setChecked(next);
      return;
    }
    const id = ++seq.current;
    setOptimistic(next);
    row?.track(result, () => attempt(next));
    result.then(
      () => {
        if (id !== seq.current) return;
        setChecked(next);
        setOptimistic(null);
      },
      // Failed: go back to what's actually saved. The row says why.
      () => id === seq.current && setOptimistic(null),
    );
  };

  // Pressing stretches the thumb toward the middle, the way a finger would squash it.
  const width = 16 + (pressed && !off ? 4 : 0);
  const release = () => setPressed(false);

  return (
    <BaseSwitch.Root
      id={row?.controlId}
      checked={on}
      onCheckedChange={attempt}
      disabled={off}
      aria-describedby={row ? row.descriptionId : undefined}
      onPointerDown={(e) => e.button === 0 && setPressed(true)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={(e) => e.key === " " && setPressed(true)}
      onKeyUp={release}
      onBlur={release}
      className={cn(
        "relative inline-block h-5 w-9 shrink-0 rounded-full outline-none",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "transition-[background-color] duration-200 ease-out-expo motion-reduce:transition-none",
        on ? "bg-fg hover:bg-fg/90" : "bg-fg-4 hover:bg-fg-3",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-fg-4",
        "after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']",
        className,
      )}
      {...rest}
    >
      <motion.span
        aria-hidden
        className={cn("absolute left-0 top-0.5 h-4 rounded-full transition-[background-color] duration-200 motion-reduce:transition-none", on ? "bg-frame" : "bg-raised dark:bg-fg-2")}
        initial={false}
        animate={{ x: on ? 36 - 2 - width : 2, width }}
        transition={reduce ? { duration: 0 } : spring.snappy}
      />
    </BaseSwitch.Root>
  );
}

export type SettingsSelectOption = { value: string; label: React.ReactNode; disabled?: boolean };

export type SettingsSelectProps = {
  options: SettingsSelectOption[];
  value?: string;
  defaultValue?: string;
  /** Return a promise to show the save on the row; the choice reverts if it rejects. */
  onValueChange?: (value: string) => void | PromiseLike<unknown>;
  disabled?: boolean;
  name?: string;
  className?: string;
  /** Portal target for the list. Defaults to document.body. */
  container?: BaseSelect.Portal.Props["container"];
};

/** A compact select for the right side of a row, labelled by the row. */
export function SettingsSelect({ options, value: valueProp, defaultValue, onValueChange, disabled, name, className, container }: SettingsSelectProps) {
  const row = useSettingsRow();
  const [value, setValue] = useControllableState<string | undefined>({ value: valueProp, defaultValue: defaultValue ?? options[0]?.value });
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const seq = useRef(0);
  const current = optimistic ?? value ?? null;
  const items = useMemo(() => options.map((o) => ({ value: o.value, label: o.label })), [options]);

  const attempt = (next: string) => {
    const result = onValueChange?.(next);
    if (!isThenable(result)) {
      setValue(next);
      return;
    }
    const id = ++seq.current;
    setOptimistic(next);
    row?.track(result, () => attempt(next));
    result.then(
      () => {
        if (id !== seq.current) return;
        setValue(next);
        setOptimistic(null);
      },
      () => id === seq.current && setOptimistic(null),
    );
  };

  return (
    <BaseSelect.Root items={items} value={current} onValueChange={(v) => v != null && attempt(v as string)} disabled={disabled || row?.disabled} name={name}>
      <BaseSelect.Trigger
        aria-labelledby={row?.labelId}
        aria-describedby={row?.descriptionId}
        className={cn(
          "group/trigger relative inline-flex h-8 min-w-36 max-w-full items-center justify-between gap-2 rounded-lg border border-line-2 bg-raised pr-2 pl-2.5 text-left text-[13px] text-fg shadow-[var(--shadow)] select-none",
          "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,scale] duration-150 ease-out active:scale-[0.98] active:duration-75",
          "hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5 pointer-coarse:after:content-['']",
          className,
        )}
      >
        <BaseSelect.Value className="min-w-0 truncate" />
        <ChevronsUpDown size={14} className="shrink-0 text-fg-3 transition-colors duration-150 group-hover/trigger:text-fg-2" />
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={container}>
        <BaseSelect.Positioner alignItemWithTrigger={false} side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-(--z-popover) outline-none">
          <BaseSelect.Popup
            className={cn(
              "min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
              "transition-[opacity,scale] duration-150 ease-out-expo data-ending-style:duration-100",
              "data-starting-style:scale-[0.96] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <BaseSelect.List className="max-h-[min(var(--available-height),16rem)] overflow-y-auto overscroll-contain outline-none">
              {options.map((o) => (
                <BaseSelect.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className="flex h-8 cursor-default items-center gap-2 rounded-lg pr-2 pl-2 text-[13px] outline-none select-none data-highlighted:bg-line data-disabled:text-fg-4 pointer-coarse:h-10"
                >
                  <BaseSelect.ItemText className="min-w-0 flex-1 truncate">{o.label}</BaseSelect.ItemText>
                  <span className="grid size-4 shrink-0 place-items-center">
                    <BaseSelect.ItemIndicator>
                      <Check size={14} />
                    </BaseSelect.ItemIndicator>
                  </span>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
