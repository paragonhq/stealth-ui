"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { ease, spring } from "@/lib/motion";

export type TagTone = "neutral" | "success" | "warning" | "danger" | "info";

const dotTone: Record<TagTone, string> = {
  neutral: "bg-fg-3",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

const GroupContext = createContext(false);

/* -------------------------------------------------------------------------------------------------
 * Focus helpers
 * -----------------------------------------------------------------------------------------------*/

// The one control per tag that arrows move between: the tag itself when it's clickable,
// otherwise its remove button.
const targets = (group: Element) =>
  Array.from(group.querySelectorAll<HTMLElement>("[data-tag]:not([data-removing]) [data-tag-target]")).filter((el) => !el.closest("[data-tag]")?.hasAttribute("data-removing"));

/** After a tag goes, focus the next one, else the previous, else the group itself. */
function refocusAfter(tag: HTMLElement) {
  const group = tag.closest<HTMLElement>("[data-tag-group]");
  if (!group) return;
  const all = Array.from(group.querySelectorAll<HTMLElement>("[data-tag]"));
  const at = all.indexOf(tag);
  tag.setAttribute("data-removing", "");
  const pick = (el: HTMLElement | undefined) => el?.querySelector<HTMLElement>("[data-tag-target]");
  const rest = all.filter((el) => el !== tag && !el.hasAttribute("data-removing"));
  const next = pick(rest.find((el) => all.indexOf(el) > at)) ?? pick([...rest].reverse().find((el) => all.indexOf(el) < at));
  (next ?? group).focus();
}

/* -------------------------------------------------------------------------------------------------
 * Tag
 * -----------------------------------------------------------------------------------------------*/

export type TagProps = Omit<React.ComponentProps<"span">, "onClick"> & {
  /** Color of the leading dot. Semantic tones are for meaning only. */
  tone?: TagTone;
  dot?: boolean;
  /** A person or team, drawn as a small avatar flush with the left edge. */
  avatar?: { name: string; src?: string };
  /** A leading icon at 14px (12px in sm). */
  icon?: React.ReactNode;
  size?: "sm" | "md";
  /** Shows the remove button, and Backspace or Delete removes the tag. */
  onRemove?: () => void;
  /** Accessible name for the remove button. Defaults to "Remove <label>". */
  removeLabel?: string;
  /** Makes the tag itself a button: open the label, filter by it, edit the value. */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Makes the tag itself a link. */
  href?: string;
  disabled?: boolean;
  /** Longest the label grows before it truncates, in px. The full text is in its tooltip. */
  maxWidth?: number;
};

/**
 * A chip for a label, a person or a filter value. Removable ones leave by shrinking and fading,
 * and inside a TagGroup the rest slide over to close the gap and focus lands on a neighbor.
 */
export function Tag({
  tone = "neutral",
  dot = false,
  avatar,
  icon,
  size = "md",
  onRemove,
  removeLabel,
  onClick,
  href,
  disabled = false,
  maxWidth = 200,
  className,
  children,
  ref,
  ...rest
}: TagProps) {
  const reduce = useReducedMotion();
  const inGroup = useContext(GroupContext);
  const root = useRef<HTMLSpanElement>(null);
  const text = typeof children === "string" || typeof children === "number" ? String(children) : avatar?.name;
  const interactive = !disabled && (!!onClick || !!href);
  const removable = !!onRemove && !disabled;
  const sm = size === "sm";

  const remove = () => {
    if (!onRemove || !root.current) return;
    // Only move focus if it was inside this tag; a pointer removal elsewhere leaves focus alone.
    if (root.current.contains(document.activeElement)) refocusAfter(root.current);
    else root.current.setAttribute("data-removing", "");
    onRemove();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (removable && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      remove();
    }
  };

  const lead = avatar ? (
    <Avatar name={avatar.name} src={avatar.src} size={sm ? 16 : 20} alt="" className="-ml-px" />
  ) : icon ? (
    <span aria-hidden className={cn("grid shrink-0 place-items-center text-fg-3 [&_svg]:size-full", sm ? "size-3" : "size-3.5")}>
      {icon}
    </span>
  ) : dot ? (
    <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full transition-[background-color] duration-200", dotTone[tone])} />
  ) : null;

  // Space before the content: tight when an avatar sits flush in the pill's curve.
  const padStart = avatar ? (sm ? "pl-0.5" : "pl-[3px]") : sm ? "pl-2" : "pl-2.5";
  const padEnd = sm ? "pr-2" : "pr-2.5";

  const label = (
    <span className="truncate" style={{ maxWidth }} title={text}>
      {children ?? avatar?.name}
    </span>
  );

  const bodyClass = cn("inline-flex h-full min-w-0 items-center gap-1.5 rounded-full outline-none", padStart, removable ? "pr-1" : padEnd);

  const body = interactive ? (
    href ? (
      <a data-tag-target href={href} onKeyDown={onKeyDown} className={cn(bodyClass, "cursor-pointer")}>
        {lead}
        {label}
      </a>
    ) : (
      <button data-tag-target type="button" onClick={onClick} onKeyDown={onKeyDown} className={bodyClass}>
        {lead}
        {label}
      </button>
    )
  ) : (
    <span className={bodyClass}>
      {lead}
      {label}
    </span>
  );

  return (
    <motion.span
      ref={(node: HTMLSpanElement | null) => {
        root.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      data-tag=""
      data-size={size}
      data-interactive={interactive || undefined}
      data-disabled={disabled || undefined}
      role={inGroup ? "listitem" : undefined}
      layout={inGroup && !reduce ? "position" : undefined}
      // Tags only animate in when they join a group; a tag rendered on its own is simply there.
      initial={!inGroup ? false : reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, filter: "blur(2px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.85, filter: "blur(2px)", transition: { duration: 0.14, ease: ease.out } }}
      transition={reduce ? { duration: 0.12 } : { ...spring.pop, layout: spring.snappy }}
      className={cn(
        "relative inline-flex max-w-full shrink-0 select-none items-center rounded-full border border-line-2 bg-raised align-middle text-fg-2",
        sm ? "h-6 text-[12px]" : "h-7 text-[12.5px]",
        removable && "pr-1",
        "transition-[background-color,border-color,color,scale] duration-150",
        // A clickable tag lights up as one piece and takes its focus ring around the whole pill.
        // Only the tag's own body lights it up; hovering the remove button lights just the button.
        interactive &&
          "pointer-fine:has-[[data-tag-target]:hover]:border-fg-4 pointer-fine:has-[[data-tag-target]:hover]:bg-hover pointer-fine:has-[[data-tag-target]:hover]:text-fg has-[[data-tag-target]:active]:scale-[0.97] has-[[data-tag-target]:active]:duration-75",
        interactive && "has-[[data-tag-target]:focus-visible]:outline-solid has-[[data-tag-target]:focus-visible]:outline-1 has-[[data-tag-target]:focus-visible]:outline-offset-2 has-[[data-tag-target]:focus-visible]:outline-fg-3",
        disabled && "opacity-50",
        className,
      )}
      {...(rest as React.ComponentProps<typeof motion.span>)}
    >
      {body}
      {removable && (
        <button
          type="button"
          data-remove=""
          // In a tag that isn't itself a button, the remove button is what arrows land on.
          data-tag-target={interactive ? undefined : ""}
          aria-label={removeLabel ?? `Remove ${text ?? "tag"}`}
          aria-keyshortcuts="Backspace Delete"
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "relative grid shrink-0 place-items-center rounded-full text-fg-3 outline-none",
            sm ? "size-4" : "size-5",
            "transition-[background-color,color,scale] duration-150 hover:bg-fg/[0.08] hover:text-fg active:scale-90 active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
            // Draws at 16–20px; on touch the target grows to 44px.
            "before:absolute before:-inset-3 before:content-[''] pointer-fine:before:hidden",
          )}
        >
          <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={sm ? "size-2.5" : "size-3"}>
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </motion.span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * TagGroup
 * -----------------------------------------------------------------------------------------------*/

export type TagGroupProps = React.ComponentProps<"div"> & {
  /** Names the list for screen readers: "Labels", "Assignees", "Filters". */
  label: string;
  /** Shown in place of the tags when there are none. */
  empty?: React.ReactNode;
};

/**
 * Lays tags out in wrapping rows. Arrow keys, Home and End move between them; removing one
 * slides the rest over and hands focus to its neighbor. Give each Tag a stable key.
 */
export function TagGroup({ label, empty, className, children, onKeyDown, ...rest }: TagGroupProps) {
  const hasTags = Array.isArray(children) ? children.some(Boolean) : !!children;
  return (
    <GroupContext.Provider value>
      <div
        data-tag-group=""
        role="list"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
          if (e.defaultPrevented || !keys.includes(e.key)) return;
          const list = targets(e.currentTarget);
          if (!list.length) return;
          const at = list.indexOf(document.activeElement as HTMLElement);
          const back = e.key === "ArrowLeft" || e.key === "ArrowUp";
          const next = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : at < 0 ? 0 : Math.min(list.length - 1, Math.max(0, at + (back ? -1 : 1)));
          e.preventDefault();
          list[next]?.focus();
        }}
        className={cn("relative flex flex-wrap items-center gap-1.5 outline-none", className)}
        {...rest}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {children}
        </AnimatePresence>
        {!hasTags && empty}
      </div>
    </GroupContext.Provider>
  );
}
