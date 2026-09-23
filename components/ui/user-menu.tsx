"use client";
import { Avatar } from "@base-ui/react/avatar";
import { Menu } from "@base-ui/react/menu";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ArrowUpRight, ChevronRight, Loader, Monitor, Moon, Sun } from "@/lib/icons";
import { spring, swap } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Status and avatar
 * -----------------------------------------------------------------------------------------------*/

export type UserStatus = "online" | "away" | "busy" | "offline";

const statusLabel: Record<UserStatus, string> = {
  online: "Active",
  away: "Away",
  busy: "Do not disturb",
  offline: "Invisible",
};

/**
 * The presence dot. It morphs between states rather than swapping: busy draws a bar across
 * it, invisible hollows it out, and the color follows. The ring is the surface it sits on.
 */
export function StatusDot({ status, size = 10, className }: { status: UserStatus; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      data-status={status}
      style={{ width: size, height: size }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full ring-2 ring-(--avatar-ring,var(--frame))",
        "transition-[background-color] duration-200 ease-out-expo",
        "data-[status=online]:bg-success data-[status=away]:bg-warning data-[status=busy]:bg-danger data-[status=offline]:bg-fg-3",
        className,
      )}
    >
      <span
        className={cn(
          "col-start-1 row-start-1 h-[2px] w-[56%] rounded-full bg-(--avatar-ring,var(--frame))",
          "scale-x-0 transition-transform duration-200 ease-out-expo motion-reduce:transition-none",
          status === "busy" && "scale-x-100",
        )}
      />
      <span
        className={cn(
          "col-start-1 row-start-1 size-[44%] rounded-full bg-(--avatar-ring,var(--frame))",
          "scale-0 transition-transform duration-200 ease-out-expo motion-reduce:transition-none",
          status === "offline" && "scale-100",
        )}
      />
    </span>
  );
}

export type UserAvatarProps = {
  name: string;
  src?: string;
  size?: number;
  status?: UserStatus;
  className?: string;
};

/** A round avatar with an initials fallback that matches its size, and an optional presence dot. */
export function UserAvatar({ name, src, size = 32, status, className }: UserAvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span className={cn("relative inline-block shrink-0 align-middle", className)} style={{ width: size, height: size }}>
      <Avatar.Root className="flex size-full select-none items-center justify-center overflow-hidden rounded-full bg-hover text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
        {src && <Avatar.Image src={src} alt="" width={size} height={size} className="size-full object-cover" />}
        <Avatar.Fallback delay={src ? 400 : 0} className="font-medium leading-none tracking-[0.01em]" style={{ fontSize: Math.round(size * 0.36) }}>
          {initials}
        </Avatar.Fallback>
      </Avatar.Root>
      {status && <StatusDot status={status} size={Math.max(8, Math.round(size * 0.3))} className="absolute -bottom-px -right-px" />}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * UserMenu
 * -----------------------------------------------------------------------------------------------*/

export type Theme = "light" | "dark" | "system";

export type UserMenuProps = {
  user: { name: string; email: string; image?: string };
  /** Presence on the avatar. Pass onStatusChange too and a status submenu appears in the menu. */
  status?: UserStatus;
  onStatusChange?: (status: UserStatus) => void;
  /** Adds the theme control. Pair with onThemeChange. */
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  /** Adds Sign out as the last item. Return a promise to keep the menu open with a spinner until it settles. */
  onSignOut?: () => void | Promise<unknown>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  /** Avatar size on the trigger. */
  size?: number;
  /** Portal container. Defaults to document.body. */
  container?: HTMLElement | React.RefObject<HTMLElement | null> | null;
  className?: string;
  /** Your items (profile, settings, shortcuts), between the header and the theme control. */
  children?: React.ReactNode;
};

/**
 * The avatar in the corner that opens everything about the account: who you are,
 * your status, the theme, and signing out.
 */
export function UserMenu({
  user,
  status,
  onStatusChange,
  theme,
  onThemeChange,
  onSignOut,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = "bottom",
  align = "end",
  size = 32,
  container,
  className,
  children,
}: UserMenuProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    if (!onSignOut || signingOut) return;
    setFailed(false);
    const result = onSignOut();
    if (!(result instanceof Promise)) return setOpen(false);
    setSigningOut(true);
    try {
      await result;
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFailed(false);
      }}
    >
      <Menu.Trigger
        aria-label={`Account: ${user.name}${status ? `, ${statusLabel[status]}` : ""}`}
        className={cn(
          "group/avatar relative inline-flex shrink-0 rounded-full outline-none",
          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
          // The avatar draws at 32px; the hit area grows to 44px on touch without moving anything.
          "before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden",
          "transition-[scale,box-shadow] duration-150 ease-out active:scale-[0.94] active:duration-75",
          "shadow-[0_0_0_0_var(--line-2)] hover:shadow-[0_0_0_3px_var(--line-2)] data-popup-open:shadow-[0_0_0_3px_var(--fg-4)]",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-fg-3",
          className,
        )}
      >
        <UserAvatar name={user.name} src={user.image} size={size} status={status} />
      </Menu.Trigger>

      <Menu.Portal container={container}>
        <Menu.Positioner side={side} align={align} sideOffset={8} collisionPadding={8} className="z-(--z-popover) outline-none">
          <Popup>
            <div className="flex items-center gap-2.5 px-2 pb-2.5 pt-2">
              <UserAvatar name={user.name} src={user.image} size={36} status={status} className="[--avatar-ring:var(--raised)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-[18px] tracking-[-0.01em] text-fg">{user.name}</p>
                <p className="truncate text-[12px] leading-[16px] text-fg-3">{user.email}</p>
              </div>
            </div>

            {status && onStatusChange && (
              <>
                <UserMenuSeparator />
                <StatusSubmenu status={status} onStatusChange={onStatusChange} />
              </>
            )}

            {children && (
              <>
                <UserMenuSeparator />
                {children}
              </>
            )}

            {theme && onThemeChange && (
              <>
                <UserMenuSeparator />
                <ThemeControl theme={theme} onThemeChange={onThemeChange} />
              </>
            )}

            {onSignOut && (
              <>
                <UserMenuSeparator />
                <Menu.Item
                  closeOnClick={false}
                  onClick={signOut}
                  aria-busy={signingOut || undefined}
                  data-row=""
                  className={cn(itemClass, failed && "text-danger")}
                >
                  <span className="grid size-4 place-items-center text-fg-3">
                    <AnimatePresence initial={false} mode="popLayout">
                      {signingOut ? (
                        <motion.span key="busy" {...swap} transition={spring.pop} className="grid">
                          <Loader size={14} className="animate-spin" />
                        </motion.span>
                      ) : (
                        <motion.span key="icon" {...swap} transition={spring.pop} className="grid">
                          <SignOutIcon />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className="min-w-0 flex-1 truncate">{signingOut ? "Signing out…" : failed ? "Couldn’t sign out. Try again" : "Sign out"}</span>
                </Menu.Item>
                <span role="status" aria-live="polite" className="sr-only">
                  {signingOut ? "Signing out" : failed ? "Couldn’t sign out. Try again." : ""}
                </span>
              </>
            )}
          </Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Items
 * -----------------------------------------------------------------------------------------------*/

const itemClass = cn(
  "group/item relative flex h-8 cursor-default select-none items-center gap-2.5 rounded-lg px-2 text-[13px] text-fg-2 outline-none",
  "transition-colors duration-100 data-highlighted:text-fg pointer-coarse:h-10",
  "data-disabled:pointer-events-none data-disabled:text-fg-4",
);

export type UserMenuItemProps = Omit<Menu.Item.Props, "className"> & {
  icon?: React.ReactNode;
  /** Shown on the right, e.g. "⌘," — display only; bind the key yourself. */
  shortcut?: string;
  /** Renders a link. */
  href?: string;
  /** Opens in a new tab and shows an arrow. */
  external?: boolean;
  className?: string;
};

export function UserMenuItem({ icon, shortcut, href, external, className, children, ...rest }: UserMenuItemProps) {
  const inner = (
    <>
      {icon && <span className="grid size-4 shrink-0 place-items-center text-fg-3 transition-colors group-data-highlighted/item:text-fg-2 [&_svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {external && <ArrowUpRight size={13} className="shrink-0 text-fg-4 transition-transform duration-150 group-data-highlighted/item:-translate-y-px group-data-highlighted/item:translate-x-px" />}
      {shortcut && <kbd className="shrink-0 font-mono text-2xs tracking-[0.04em] text-fg-4 pointer-coarse:hidden">{shortcut}</kbd>}
    </>
  );
  if (href)
    return (
      <Menu.LinkItem
        href={href}
        closeOnClick
        data-row=""
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        label={typeof children === "string" ? children : undefined}
        className={cn(itemClass, "cursor-pointer", className)}
      >
        {inner}
      </Menu.LinkItem>
    );
  return (
    <Menu.Item data-row="" className={cn(itemClass, className)} {...rest}>
      {inner}
    </Menu.Item>
  );
}

export function UserMenuSeparator({ className }: { className?: string }) {
  return <Menu.Separator className={cn("-mx-1 my-1 h-px bg-line", className)} />;
}

/* -------------------------------------------------------------------------------------------------
 * Status submenu
 * -----------------------------------------------------------------------------------------------*/

function StatusSubmenu({ status, onStatusChange }: { status: UserStatus; onStatusChange: (s: UserStatus) => void }) {
  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger data-row="" className={cn(itemClass, "data-popup-open:text-fg")}>
        <span className="grid size-4 place-items-center [--avatar-ring:var(--raised)]">
          <StatusDot status={status} size={9} />
        </span>
        <span className="min-w-0 flex-1 truncate">{statusLabel[status]}</span>
        <ChevronRight size={14} className="shrink-0 text-fg-4" />
      </Menu.SubmenuTrigger>
      <Menu.Portal>
        <Menu.Positioner
          sideOffset={4}
          alignOffset={-5}
          collisionPadding={8}
          collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
          className="z-(--z-popover) outline-none"
        >
          <Popup className="min-w-44">
            <Menu.RadioGroup value={status} onValueChange={(v: UserStatus) => onStatusChange(v)}>
              {(Object.keys(statusLabel) as UserStatus[]).map((s) => (
                <Menu.RadioItem key={s} value={s} closeOnClick data-row="" className={itemClass}>
                  <span className="grid size-4 place-items-center [--avatar-ring:var(--raised)]">
                    <StatusDot status={s} size={9} />
                  </span>
                  <span className="flex-1">{statusLabel[s]}</span>
                  <Menu.RadioItemIndicator className="text-fg">
                    <CheckGlyph />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Theme: a segmented control that lives inside the menu
 * -----------------------------------------------------------------------------------------------*/

const themes: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

// Three radio items laid out as segments. They stay menu items, so arrows walk through them
// like any other row and a screen reader hears "Dark theme, radio, checked". The menu stays
// open on a pick so the thumb can be seen sliding and the page seen changing behind it.
function ThemeControl({ theme, onThemeChange }: { theme: Theme; onThemeChange: (t: Theme) => void }) {
  const reduce = !!useReducedMotion();
  const id = useId();
  return (
    <Menu.RadioGroup value={theme} onValueChange={(v: Theme) => onThemeChange(v)} className="flex h-9 items-center justify-between gap-3 pl-2 pr-1">
      <Menu.GroupLabel className="text-[13px] text-fg-2">Theme</Menu.GroupLabel>
      <LayoutGroup id={id}>
        <div className="relative flex rounded-full border border-line-2 bg-frame p-0.5">
          {themes.map(({ value, label, Icon }) => (
            <Menu.RadioItem
              key={value}
              value={value}
              label={`${label} theme`}
              aria-label={`${label} theme`}
              className={cn(
                "group/seg relative grid h-6 w-7 cursor-default place-items-center rounded-full text-fg-3 outline-none",
                "transition-colors duration-150 data-checked:text-fg data-highlighted:text-fg",
                "data-highlighted:[&>[data-ring]]:opacity-100",
              )}
            >
              {theme === value && (
                <motion.span
                  layoutId="thumb"
                  aria-hidden
                  transition={reduce ? { duration: 0 } : spring.snappy}
                  className="absolute inset-0 rounded-full bg-raised shadow-[var(--shadow),inset_0_0_0_1px_var(--line-2)]"
                />
              )}
              <span data-ring aria-hidden className="absolute inset-0 rounded-full bg-fg/[0.06] opacity-0 shadow-[inset_0_0_0_1px_var(--fg-3)] transition-opacity duration-100" />
              <Icon size={14} className="relative transition-transform duration-150 ease-out group-active/seg:scale-90" />
            </Menu.RadioItem>
          ))}
        </div>
      </LayoutGroup>
    </Menu.RadioGroup>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Popup surface with one gliding highlight
 * -----------------------------------------------------------------------------------------------*/

function Popup({ className, children }: { className?: string; children: React.ReactNode }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const hl = useRef<HTMLDivElement>(null);
  const { y, height, opacity } = useGlide(node, hl);
  return (
    <Menu.Popup
      ref={setNode}
      className={cn(
        "relative isolate w-64 max-w-(--available-width) max-h-(--available-height) overflow-y-auto overscroll-contain rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none [scrollbar-width:none]",
        "origin-(--transform-origin) transition-[opacity,scale,translate] duration-180 ease-out-expo",
        "data-starting-style:scale-96 data-starting-style:opacity-0",
        "data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1",
        "data-[side=inline-end]:data-starting-style:-translate-x-1 data-[side=right]:data-starting-style:-translate-x-1",
        "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120",
        "data-instant:duration-0 motion-reduce:scale-100 motion-reduce:translate-none",
        className,
      )}
    >
      <motion.div ref={hl} aria-hidden style={{ y, height, opacity }} className="pointer-events-none absolute inset-x-1 top-0 -z-10 rounded-lg bg-fg/[0.06] data-pressed:bg-fg/[0.1]" />
      {children}
    </Menu.Popup>
  );
}

// Follows whichever row Base UI marks highlighted: springs after the pointer, jumps for
// the keyboard, fades in place when it first appears. The theme segments carry their own
// focus ring, so the row highlight ignores them.
function useGlide(popup: HTMLDivElement | null, hlRef: React.RefObject<HTMLDivElement | null>) {
  const reduce = useReducedMotion();
  const y = useMotionValue(0);
  const height = useMotionValue(0);
  const opacity = useMotionValue(0);

  useEffect(() => {
    const hl = hlRef.current;
    if (!popup || !hl) return;
    let keyboard = false;
    let shown = false;
    const sync = () => {
      const row =
        popup.querySelector<HTMLElement>("[data-row][data-highlighted]") ?? popup.querySelector<HTMLElement>("[data-row][data-popup-open]");
      if (!row) {
        if (shown) animate(opacity, 0, { duration: 0.12 });
        shown = false;
        delete hl.dataset.pressed;
        return;
      }
      let top = 0;
      for (let n: HTMLElement | null = row; n && n !== popup; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(row.offsetHeight);
      } else {
        animate(y, top, spring.follow);
        animate(height, row.offsetHeight, spring.follow);
      }
      animate(opacity, row.hasAttribute("data-highlighted") ? 1 : 0.6, { duration: shown ? 0.08 : 0.1 });
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onMove = () => (keyboard = false);
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-row]:not([data-disabled])")) hl.dataset.pressed = "";
    };
    const onUp = () => delete hl.dataset.pressed;
    const observer = new MutationObserver(sync);
    observer.observe(popup, { subtree: true, attributes: true, attributeFilter: ["data-highlighted", "data-popup-open"] });
    popup.addEventListener("keydown", onKey, true);
    popup.addEventListener("pointermove", onMove, true);
    popup.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    sync();
    return () => {
      observer.disconnect();
      popup.removeEventListener("keydown", onKey, true);
      popup.removeEventListener("pointermove", onMove, true);
      popup.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [popup, hlRef, reduce, y, height, opacity]);

  return { y, height, opacity };
}

function CheckGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.5 3.25H4.25a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1H9.5M7 8h6.5M11 5.5 13.5 8 11 10.5" />
    </svg>
  );
}
