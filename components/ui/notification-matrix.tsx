"use client";
import { Checkbox } from "@base-ui/react/checkbox";
import { Tooltip } from "@base-ui/react/tooltip";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Bell, Lock, Mail } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type NotificationChannel = {
  id: string;
  label: string;
  /** A 14px glyph beside the label in the header. */
  icon?: React.ReactNode;
  /** The whole channel can't be changed right now, e.g. push is blocked in this browser. Values are kept. */
  disabled?: boolean;
  /** A short line under the channel: why it's off, or a button to turn it on. */
  hint?: React.ReactNode;
};

export type NotificationEvent = {
  id: string;
  label: string;
  description?: string;
  /** Channels this event is never sent on. Drawn as a dash, skipped by select-all. */
  unsupported?: string[];
  /** Channels that are always on for this event, like security alerts by email. */
  required?: string[];
  /** Why the required channels can't be turned off. */
  requiredReason?: string;
};

export type NotificationGroup = { id: string; label: string; events: NotificationEvent[] };

/** Event id → the channel ids it's delivered on. Required channels are always included. */
export type NotificationMatrixValue = Record<string, string[]>;

function Phone({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <rect x="4.25" y="1.75" width="7.5" height="12.5" rx="1.75" />
      <path d="M7 11.75h2" />
    </svg>
  );
}

export const defaultNotificationChannels: NotificationChannel[] = [
  { id: "email", label: "Email", icon: <Mail size={14} /> },
  { id: "push", label: "Push", icon: <Phone size={14} /> },
  { id: "in-app", label: "In-app", icon: <Bell size={14} /> },
];

/* ------------------------------------------------------------------ */
/* NotificationMatrix                                                  */
/* ------------------------------------------------------------------ */

export type NotificationMatrixProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  groups: NotificationGroup[];
  channels?: NotificationChannel[];
  value?: NotificationMatrixValue;
  defaultValue?: NotificationMatrixValue;
  onValueChange?: (value: NotificationMatrixValue) => void;
  disabled?: boolean;
  /** Heading over the event column on wide layouts. */
  eventsLabel?: string;
};

type Wave = { channel: string; on: boolean; order: Map<string, number> } | null;


export function NotificationMatrix({
  groups,
  channels = defaultNotificationChannels,
  value: valueProp,
  defaultValue = {},
  onValueChange,
  disabled = false,
  eventsLabel = "Notify me about",
  className,
  style,
  onKeyDown,
  ...rest
}: NotificationMatrixProps) {
  const uid = useId();
  const [value, setValue] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [wave, setWave] = useState<Wave>(null);
  const [previewCol, setPreviewCol] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // A column toggle ripples down the column once, then later single toggles are instant again.
  useEffect(() => {
    if (!wave) return;
    const t = window.setTimeout(() => setWave(null), 500);
    return () => window.clearTimeout(t);
  }, [wave]);

  const events = groups.flatMap((g) => g.events);
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const supports = (ev: NotificationEvent, ch: string) => !ev.unsupported?.includes(ch);
  const isRequired = (ev: NotificationEvent, ch: string) => !!ev.required?.includes(ch);
  // A cell select-all speaks for: supported and not locked. A blocked channel still reports its state.
  const choosable = (ev: NotificationEvent, ch: string) => supports(ev, ch) && !isRequired(ev, ch);
  const isOn = (ev: NotificationEvent, ch: string) => isRequired(ev, ch) || !!value[ev.id]?.includes(ch);

  const withChannel = (ev: NotificationEvent, ch: string, on: boolean, from: NotificationMatrixValue) => {
    const set = new Set(from[ev.id] ?? []);
    ev.required?.forEach((r) => set.add(r));
    if (on) set.add(ch);
    else set.delete(ch);
    // Keep channel order stable so the value diffs cleanly.
    return channels.map((c) => c.id).filter((id) => set.has(id));
  };

  const toggleCell = (ev: NotificationEvent, ch: string, on: boolean) => {
    setWave(null);
    setValue({ ...value, [ev.id]: withChannel(ev, ch, on, value) });
  };

  const column = (ch: string) => {
    const cells = events.filter((ev) => choosable(ev, ch));
    const on = cells.filter((ev) => isOn(ev, ch)).length;
    return { cells, on, total: cells.length, state: on === 0 ? "off" : on === cells.length ? "on" : "mixed" } as const;
  };

  const toggleColumn = (ch: string) => {
    const { cells, state } = column(ch);
    const on = state !== "on";
    const next = { ...value };
    const order = new Map<string, number>();
    let i = 0;
    for (const ev of cells) {
      if (isOn(ev, ch) !== on) order.set(ev.id, i++);
      next[ev.id] = withChannel(ev, ch, on, next);
    }
    setWave({ channel: ch, on, order });
    setValue(next);
    const label = channelById.get(ch)?.label ?? ch;
    setAnnouncement(`${label} ${on ? "on" : "off"} for ${cells.length} ${cells.length === 1 ? "event" : "events"}`);
  };

  // Arrow keys move between checkboxes like a grid: up and down within a channel, left and right within an event.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const dirs: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = dirs[e.key];
    const from = (e.target as HTMLElement).closest<HTMLElement>("[data-matrix-cell]");
    if (!d || !from) return;
    const cells = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-matrix-cell]:not([data-disabled])")).filter((el) => el.offsetParent !== null);
    const r = Number(from.dataset.row);
    const c = Number(from.dataset.col);
    const candidates = cells
      .map((el) => ({ el, r: Number(el.dataset.row), c: Number(el.dataset.col) }))
      .filter((p) => (d[0] ? p.c === c && Math.sign(p.r - r) === d[0] : p.r === r && Math.sign(p.c - c) === d[1]))
      .sort((a, b) => Math.abs(a.r - r) + Math.abs(a.c - c) - (Math.abs(b.r - r) + Math.abs(b.c - c)));
    if (candidates[0]) {
      e.preventDefault();
      candidates[0].el.focus();
    }
  };

  const cols = `minmax(0,1fr) repeat(${channels.length}, 4.75rem)`;
  let row = 0;

  // One DOM for both layouts: below 30rem of container width (the @max-[30rem] classes)
  // each event stacks over a row of channel chips and the header becomes chips too.
  return (
    <Tooltip.Provider delay={400}>
      <div
        role="group"
        aria-labelledby={`${uid}-label`}
        data-disabled={disabled || undefined}
        className={cn("@container w-full min-w-0", className)}
        style={{ ...style, ["--matrix-cols" as string]: cols }}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <span id={`${uid}-label`} className="sr-only">
          Notification preferences
        </span>
        {/* overflow-clip rounds the corners without becoming a scroll container, so the header can still stick. */}
        <div className="overflow-clip rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
          {/* Header: one select-all per channel, stacked over its column. */}
          <div
            className={cn(
              "sticky top-(--matrix-sticky-top,0px) z-(--z-sticky) grid border-b border-line bg-raised pr-2 [grid-template-columns:var(--matrix-cols)]",
              "@max-[30rem]:flex @max-[30rem]:flex-col @max-[30rem]:gap-2 @max-[30rem]:px-4 @max-[30rem]:py-3",
            )}
          >
            <div className={cn("flex items-end px-4 pb-2.5 pt-3", "@max-[30rem]:p-0")}>
              <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
                <span className={"@max-[30rem]:hidden"}>{eventsLabel}</span>
                <span className={"hidden @max-[30rem]:inline"}>All events</span>
              </span>
            </div>
            <div className={cn("contents", "@max-[30rem]:flex @max-[30rem]:flex-wrap @max-[30rem]:gap-1.5")}>
              {channels.map((ch, c) => {
                const col = column(ch.id);
                const off = disabled || ch.disabled || col.total === 0;
                return (
                  <label
                    key={ch.id}
                    data-preview={previewCol === ch.id || undefined}
                    onPointerEnter={(e) => e.pointerType === "mouse" && !off && setPreviewCol(ch.id)}
                    onPointerLeave={() => setPreviewCol(null)}
                    className={cn(
                      "group/cell relative flex select-none flex-col items-center justify-end gap-2 px-1 pb-2.5 pt-3",
                      "transition-colors duration-150 data-preview:bg-fg/[0.03]",
                      "@max-[30rem]:h-8 @max-[30rem]:flex-row-reverse @max-[30rem]:justify-end @max-[30rem]:gap-2 @max-[30rem]:rounded-full @max-[30rem]:border @max-[30rem]:border-line-2 @max-[30rem]:px-2.5 @max-[30rem]:py-0",
                      "@max-[30rem]:before:absolute @max-[30rem]:before:-inset-y-1.5 @max-[30rem]:before:inset-x-0 @max-[30rem]:before:content-['']",
                      off ? "opacity-50" : "cursor-pointer",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium leading-4 text-fg-2">
                      {ch.icon && <span className={cn("flex text-fg-3", "@max-[30rem]:hidden")}>{ch.icon}</span>}
                      {ch.label}
                    </span>
                    <Box
                      checked={col.state === "on"}
                      indeterminate={col.state === "mixed"}
                      disabled={off}
                      row={-1}
                      col={c}
                      aria-label={`${ch.label} for all events`}
                      onCheckedChange={() => toggleColumn(ch.id)}
                      onFocus={() => setPreviewCol(ch.id)}
                      onBlur={() => setPreviewCol(null)}
                    />
                  </label>
                );
              })}
            </div>
            {channels.some((ch) => ch.hint) && (
              <div className={cn("col-span-full -mt-1 flex flex-col gap-0.5 px-4 pb-2.5 text-right", "@max-[30rem]:m-0 @max-[30rem]:p-0 @max-[30rem]:text-left")}>
                {channels
                  .filter((ch) => ch.hint)
                  .map((ch) => (
                    <p key={ch.id} className="text-[12px] leading-4 text-fg-3">
                      <span className="text-fg-2">{ch.label}</span> · {ch.hint}
                    </p>
                  ))}
              </div>
            )}
          </div>

          {groups.map((group) => (
            <div key={group.id} role="group" aria-labelledby={`${uid}-${group.id}`} className="border-b border-line last:border-b-0">
              {/* Empty cells under each channel keep the column preview continuous through the group label. */}
              <div className={cn("grid pr-2 [grid-template-columns:var(--matrix-cols)]", "@max-[30rem]:block")}>
                <h3 id={`${uid}-${group.id}`} className="px-4 pb-1 pt-3 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
                  {group.label}
                </h3>
                {channels.map((ch) => (
                  <span key={ch.id} aria-hidden data-preview={previewCol === ch.id || undefined} className={cn("transition-colors duration-150 data-preview:bg-fg/[0.03]", "@max-[30rem]:hidden")} />
                ))}
              </div>
              <div>
                {group.events.map((ev) => {
                  const r = row++;
                  const reasonId = `${uid}-${ev.id}-reason`;
                  return (
                    <div
                      key={ev.id}
                      role="group"
                      aria-labelledby={`${uid}-${ev.id}`}
                      aria-describedby={ev.description ? `${uid}-${ev.id}-desc` : undefined}
                      className={cn(
                        "grid border-t border-line/60 pr-2 first:border-t-0 [grid-template-columns:var(--matrix-cols)]",
                        "@max-[30rem]:flex @max-[30rem]:flex-col @max-[30rem]:gap-2.5 @max-[30rem]:px-4 @max-[30rem]:py-3",
                      )}
                    >
                      <div className={cn("flex min-w-0 flex-col justify-center gap-0.5 py-2 pl-4 pr-3", "@max-[30rem]:p-0")}>
                        <span id={`${uid}-${ev.id}`} className="text-[13px] font-medium leading-5 text-fg">
                          {ev.label}
                        </span>
                        {ev.description && (
                          <span id={`${uid}-${ev.id}-desc`} className="line-clamp-2 text-[12px] leading-4 text-pretty text-fg-3">
                            {ev.description}
                          </span>
                        )}
                        {ev.required?.length ? (
                          <span id={reasonId} className="sr-only">
                            {ev.requiredReason ?? `${ev.required.map((id) => channelById.get(id)?.label ?? id).join(", ")} always on`}
                          </span>
                        ) : null}
                      </div>
                      <div className={cn("contents", "@max-[30rem]:flex @max-[30rem]:flex-wrap @max-[30rem]:gap-1.5")}>
                        {channels.map((ch, c) => {
                          if (!supports(ev, ch.id))
                            return (
                              <span
                                key={ch.id}
                                data-preview={previewCol === ch.id || undefined}
                                className={cn("grid place-items-center text-fg-4 transition-colors duration-150 data-preview:bg-fg/[0.03]", "@max-[30rem]:hidden")}
                              >
                                <span aria-hidden className="h-px w-2.5 bg-current" />
                                <span className="sr-only">{ch.label} not available</span>
                              </span>
                            );
                          const required = isRequired(ev, ch.id);
                          const on = isOn(ev, ch.id);
                          const off = disabled || !!ch.disabled || required;
                          const w = wave?.channel === ch.id ? wave.order.get(ev.id) : undefined;
                          const cell = (
                            <label
                              key={ch.id}
                              data-preview={previewCol === ch.id || undefined}
                              data-on={on || undefined}
                              className={cn(
                                "group/cell relative flex select-none items-center justify-center",
                                "transition-[background-color,border-color] duration-150 data-preview:bg-fg/[0.03]",
                                "@max-[30rem]:h-8 @max-[30rem]:flex-row @max-[30rem]:justify-start @max-[30rem]:gap-2 @max-[30rem]:rounded-full @max-[30rem]:border @max-[30rem]:border-line-2 @max-[30rem]:px-2.5",
                                "@max-[30rem]:data-on:border-fg-4 @max-[30rem]:data-on:bg-fg/[0.05]",
                                "@max-[30rem]:before:absolute @max-[30rem]:before:-inset-y-1.5 @max-[30rem]:before:inset-x-0 @max-[30rem]:before:content-['']",
                                !off && "cursor-pointer @max-[30rem]:active:scale-[0.97] @max-[30rem]:transition-[background-color,border-color,scale]",
                                off && !required && "opacity-50",
                              )}
                            >
                              <Box
                                checked={on}
                                disabled={off}
                                locked={required}
                                row={r}
                                col={c}
                                delay={w === undefined ? 0 : Math.min(w, 8) * 0.022}
                                aria-describedby={required ? reasonId : undefined}
                                onCheckedChange={(next) => toggleCell(ev, ch.id, next)}
                              />
                              <span className={cn("sr-only text-[12.5px] leading-4 text-fg-2", "@max-[30rem]:not-sr-only", "@max-[30rem]:group-data-on/cell:text-fg")}>
                                {ch.label}
                              </span>
                              {required && (
                                // Beside the box on wide layouts, after the label on chips.
                                <span aria-hidden className={cn("absolute left-[calc(50%+13px)] flex text-fg-4", "@max-[30rem]:static @max-[30rem]:text-fg-3")}>
                                  <Lock size={12} />
                                </span>
                              )}
                            </label>
                          );
                          if (!required) return cell;
                          return (
                            <Tooltip.Root key={ch.id}>
                              <Tooltip.Trigger render={cell} />
                              <Tooltip.Portal>
                                <Tooltip.Positioner side="top" sideOffset={2} className="z-(--z-tooltip)">
                                  <Tooltip.Popup
                                    className={cn(
                                      "flex w-max max-w-64 origin-(--transform-origin) items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2 py-1 text-[12px] leading-4 text-fg-2 shadow-pop",
                                      "transition-[opacity,scale] duration-150 ease-out-expo data-starting-style:scale-96 data-starting-style:opacity-0",
                                      "data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none motion-reduce:data-starting-style:scale-100",
                                    )}
                                  >
                                    <Lock size={12} className="shrink-0 text-fg-3" />
                                    {ev.requiredReason ?? "Always on for this event"}
                                  </Tooltip.Popup>
                                </Tooltip.Positioner>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </div>
    </Tooltip.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* The box                                                             */
/* ------------------------------------------------------------------ */

const CHECK = "M3.75 8.25 6.75 11.25 12.25 4.75";
const DASH = "M4.5 8h7";

type BoxProps = Omit<Checkbox.Root.Props, "className" | "children"> & {
  locked?: boolean;
  /** Seconds to wait before drawing: set per row by a column toggle so the change ripples down. */
  delay?: number;
  row: number;
  col: number;
};

function Box({ checked, indeterminate, locked, delay = 0, row, col, disabled, ...rest }: BoxProps) {
  const reduce = useReducedMotion();
  const on = !!checked && !indeterminate;
  const d = reduce ? 0 : delay;
  return (
    <Checkbox.Root
      checked={checked}
      indeterminate={indeterminate}
      disabled={disabled}
      data-matrix-cell=""
      data-row={row}
      data-col={col}
      style={{ transitionDelay: d ? `${d}s` : undefined }}
      className={(state) =>
        cn(
          "relative inline-grid size-4 shrink-0 place-items-center rounded-[4.5px] border outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[background-color,border-color,color,scale] duration-150 ease-out-expo motion-reduce:transition-none",
          !state.disabled && "motion-safe:active:scale-[0.86] motion-safe:group-active/cell:scale-[0.86] active:duration-100 group-active/cell:duration-100",
          locked
            ? "border-transparent bg-fg-4 text-frame"
            : state.checked || state.indeterminate
              ? "border-fg bg-fg text-frame"
              : cn("border-fg-4 bg-raised", !state.disabled && "group-hover/cell:border-fg-3"),
        )
      }
      {...rest}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden focusable="false" className="size-full">
        <motion.path
          d={CHECK}
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
          transition={
            reduce
              ? { duration: 0.12 }
              : on
                ? { pathLength: { duration: 0.24, ease: ease.out, delay: d + 0.03 }, opacity: { duration: 0.04, delay: d + 0.03 } }
                : { pathLength: { duration: 0.1, ease: ease.in, delay: d }, opacity: { duration: 0.08, delay: d + 0.04 } }
          }
        />
        <motion.path
          d={DASH}
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          initial={false}
          animate={{ scaleX: indeterminate ? 1 : 0.2, opacity: indeterminate ? 1 : 0 }}
          transition={reduce ? { duration: 0.12, scaleX: { duration: 0 } } : { duration: 0.18, ease: ease.out }}
        />
      </svg>
    </Checkbox.Root>
  );
}
