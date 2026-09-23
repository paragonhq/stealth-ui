"use client";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { Select } from "@base-ui/react/select";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { InviteField, defaultInviteRoles, type InviteRole } from "@/components/ui/invite-field";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Globe, Lock, Mail, Trash, Users, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export type SharePerson = {
  id: string;
  email: string;
  /** Missing for people who haven't accepted an invite yet. */
  name?: string;
  avatarUrl?: string;
  role: string;
  /** Owners can't be changed or removed here. */
  owner?: boolean;
  /** Invited but not joined. */
  pending?: boolean;
};

export type ShareScope = "restricted" | "organization" | "anyone";
export type ShareAccess = { scope: ShareScope; role: string };

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const newId = () => `p-${Math.random().toString(36).slice(2, 9)}`;

/* -------------------------------------------------------------------------------------------------
 * SharePanel: everything inside the dialog, usable on its own in a popover or a settings page
 * -----------------------------------------------------------------------------------------------*/

export type SharePanelProps = Omit<React.ComponentProps<"div">, "children" | "defaultValue" | "onChange"> & {
  /** The link that general access applies to. */
  link: string;
  people?: SharePerson[];
  defaultPeople?: SharePerson[];
  onPeopleChange?: (people: SharePerson[]) => void;
  access?: ShareAccess;
  defaultAccess?: ShareAccess;
  onAccessChange?: (access: ShareAccess) => void;
  /** Roles for people and for the link. */
  roles?: InviteRole[];
  /** The id of the person looking, marked "(you)". */
  currentUserId?: string;
  /** Enables "Anyone at {organizationName}" and marks outside addresses in the invite field. */
  organizationName?: string;
  organizationDomain?: string;
  /** Send invites. New people appear as pending once it resolves. */
  onInvite?: (emails: string[], role: string) => void | Promise<unknown>;
  /** Resend a pending invite. Shows a Resend action on pending rows. */
  onResend?: (person: SharePerson) => void | Promise<unknown>;
  /** Portal target for menus and lists, e.g. inside a contained demo. */
  portalContainer?: HTMLElement | null;
  /** Actions on the right of the footer, across from Copy link. */
  footer?: React.ReactNode;
};

export function SharePanel({
  link,
  people: peopleProp,
  defaultPeople = [],
  onPeopleChange,
  access: accessProp,
  defaultAccess = { scope: "restricted", role: "viewer" },
  onAccessChange,
  roles = defaultInviteRoles,
  currentUserId,
  organizationName,
  organizationDomain,
  onInvite,
  onResend,
  portalContainer,
  footer,
  className,
  ...rest
}: SharePanelProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const [people, setPeople] = useControllableState({ value: peopleProp, defaultValue: defaultPeople, onChange: onPeopleChange });
  const [access, setAccess] = useControllableState({ value: accessProp, defaultValue: defaultAccess, onChange: onAccessChange });
  const [fresh, setFresh] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  // New rows glow briefly, then settle, so you can see who you just added.
  useEffect(() => {
    if (!fresh.length) return;
    const t = window.setTimeout(() => setFresh([]), 1600);
    return () => window.clearTimeout(t);
  }, [fresh]);

  const invite = async (emails: string[], role: string) => {
    await onInvite?.(emails, role);
    const have = new Set(people.map((p) => p.email.toLowerCase()));
    const added: SharePerson[] = emails.filter((e) => !have.has(e.toLowerCase())).map((email) => ({ id: newId(), email, role, pending: true }));
    // People already here keep their row; their role is updated to the one just chosen.
    const next = people.map((p) => (emails.some((e) => e.toLowerCase() === p.email.toLowerCase()) && !p.owner ? { ...p, role } : p));
    // New people go in right under the owners, where the eye already is.
    const owners = next.filter((p) => p.owner);
    setPeople([...owners, ...added, ...next.filter((p) => !p.owner)]);
    setFresh(added.map((p) => p.id));
    setAnnouncement(`${emails.length === 1 ? emails[0] : `${emails.length} people`} can now ${roleLabel(role).toLowerCase().replace(/^can /, "")}`);
  };

  const roleLabel = (value: string) => roles.find((r) => r.value === value)?.label ?? value;

  const changeRole = (id: string, role: string) => {
    setPeople(people.map((p) => (p.id === id ? { ...p, role } : p)));
    const who = people.find((p) => p.id === id);
    if (who) setAnnouncement(`${who.name ?? who.email}: ${roleLabel(role)}`);
  };

  const removePerson = (id: string) => {
    const who = people.find((p) => p.id === id);
    setPeople(people.filter((p) => p.id !== id));
    if (who) setAnnouncement(`Removed ${who.name ?? who.email}`);
  };

  const scopes: { value: ShareScope; label: string; note: (role: string) => string }[] = [
    { value: "restricted", label: "Restricted", note: () => "Only people with access can open the link" },
    ...(organizationName
      ? [{ value: "organization" as const, label: `Anyone at ${organizationName}`, note: (r: string) => `Anyone at ${organizationName} with the link ${verb(r)}` }]
      : []),
    { value: "anyone", label: "Anyone with the link", note: (r: string) => `Anyone on the internet with the link ${verb(r)}` },
  ];
  const verb = (r: string) => (r === "editor" ? "can edit" : r === "commenter" ? "can comment" : "can view");
  const scope = scopes.find((s) => s.value === access.scope) ?? scopes[0];

  return (
    <div className={cn("flex min-w-0 flex-col", className)} {...rest}>
      <InviteField label="" roles={roles} organizationDomain={organizationDomain} onInvite={invite} portalContainer={portalContainer} placeholder="Add by email" />

      <section aria-labelledby={`${uid}-people`} className="mt-5 flex min-w-0 flex-col">
        <h3 id={`${uid}-people`} className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
          People with access
          <NumberFlow value={people.length} animated={!reduce} className="pr-2 font-normal text-fg-3 tabular" />
        </h3>
        <ul className="-mx-2 flex max-h-[min(15rem,40vh)] flex-col overflow-y-auto overscroll-contain px-2 [scrollbar-width:thin] [mask-image:linear-gradient(to_bottom,transparent,black_6px,black_calc(100%-10px),transparent)]">
          <AnimatePresence initial={false}>
            {people.map((p) => (
              <motion.li
                key={p.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { height: { duration: 0.2, ease: ease.inOut }, opacity: { duration: 0.1 } } }}
                transition={reduce ? { duration: 0.12 } : { height: { duration: 0.24, ease: ease.inOut }, opacity: { duration: 0.2, delay: 0.05 } }}
                className="-mx-2 overflow-hidden px-2"
              >
                <PersonRow
                  person={p}
                  you={p.id === currentUserId}
                  fresh={fresh.includes(p.id)}
                  roles={roles}
                  roleLabel={roleLabel(p.role)}
                  onRoleChange={(role) => changeRole(p.id, role)}
                  onRemove={() => removePerson(p.id)}
                  onResend={onResend ? () => onResend(p) : undefined}
                  reduce={reduce}
                  container={portalContainer}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      <section aria-labelledby={`${uid}-general`} className="@container mt-4 flex min-w-0 flex-col">
        <h3 id={`${uid}-general`} className="mb-2 text-[12.5px] font-medium text-fg-2">
          General access
        </h3>
        {/* Wide: the role sits beside the scope. Narrow: it drops under the note, so neither truncates. */}
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 [grid-template-areas:'icon_scope_role''icon_note_note'] @max-[26rem]:[grid-template-areas:'icon_scope_scope''icon_note_note''icon_role_role']">
          <span
            aria-hidden
            className={cn(
              "relative grid size-9 shrink-0 self-center [grid-area:icon] @max-[26rem]:self-start place-items-center overflow-hidden rounded-full transition-colors duration-300",
              access.scope === "restricted" ? "bg-fg/[0.06] text-fg-2" : "bg-success-soft text-success",
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={access.scope}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: 20 }}
                transition={reduce ? { duration: 0.12 } : spring.pop}
                className="grid place-items-center"
              >
                {access.scope === "restricted" ? <Lock /> : access.scope === "organization" ? <Users /> : <Globe />}
              </motion.span>
            </AnimatePresence>
          </span>

          <div className="-ml-1.5 flex min-w-0 items-center gap-1 [grid-area:scope]">
            <InlineSelect
              label="Who can open the link"
              value={access.scope}
              items={scopes.map((s) => ({ value: s.value, label: s.label }))}
              onValueChange={(v) => {
                setAccess({ ...access, scope: v as ShareScope });
                setAnnouncement(scopes.find((s) => s.value === v)?.label ?? "");
              }}
              strong
              container={portalContainer}
            />
          </div>
          <div className="min-w-0 [grid-area:note]">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p
                key={`${access.scope}-${access.role}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                transition={{ duration: 0.18, ease: ease.out }}
                className="text-[12px] leading-4 text-pretty text-fg-3"
              >
                {scope.note(access.role)}
              </motion.p>
            </AnimatePresence>
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {access.scope !== "restricted" && (
              <motion.div
                key="link-role"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 8, filter: "blur(2px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 8, filter: "blur(2px)", transition: { duration: 0.12 } }}
                transition={{ duration: 0.22, ease: ease.out }}
                className="justify-self-end [grid-area:role] @max-[26rem]:-ml-1.5 @max-[26rem]:mt-1 @max-[26rem]:justify-self-start"
              >
                <InlineSelect
                  label="What people with the link can do"
                  value={access.role}
                  items={roles.map((r) => ({ value: r.value, label: r.label, description: r.description }))}
                  onValueChange={(v) => setAccess({ ...access, role: v })}
                  align="end"
                  container={portalContainer}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between gap-2">
        <CopyButton value={link} label="Copy link" copiedLabel="Link copied" failedLabel="Couldn’t copy" />
        {footer}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * One person with access
 * -----------------------------------------------------------------------------------------------*/

function PersonRow({
  person: p,
  you,
  fresh,
  roles,
  roleLabel,
  onRoleChange,
  onRemove,
  onResend,
  reduce,
  container,
}: {
  person: SharePerson;
  you: boolean;
  fresh: boolean;
  roles: InviteRole[];
  roleLabel: string;
  onRoleChange: (role: string) => void;
  onRemove: () => void;
  onResend?: () => void | Promise<unknown>;
  reduce: boolean;
  container?: HTMLElement | null;
}) {
  const [resent, setResent] = useState<"idle" | "sending" | "done">("idle");
  const display = p.name ?? p.email;

  const resend = async () => {
    if (!onResend || resent !== "idle") return;
    setResent("sending");
    try {
      await onResend();
      setResent("done");
    } catch {
      setResent("idle");
    }
  };

  return (
    <div
      data-fresh={fresh || undefined}
      className={cn(
        "relative flex min-h-12 min-w-0 items-center gap-3 rounded-lg py-1.5",
        // A just-added row starts lit and cools to the page over a second.
        "before:pointer-events-none before:absolute before:-inset-x-2 before:inset-y-0.5 before:rounded-lg before:bg-fg/[0.06] before:opacity-0 before:transition-opacity before:duration-1000",
        "data-fresh:before:opacity-100 data-fresh:before:duration-0",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative grid size-8 shrink-0 select-none place-items-center overflow-hidden rounded-full text-[11.5px] font-medium",
          p.pending ? "border border-dashed border-line-2 text-fg-3" : "bg-hover text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]",
        )}
      >
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt="" className="size-full object-cover" />
        ) : p.pending || !p.name ? (
          <Mail size={14} />
        ) : (
          initials(p.name)
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex min-w-0 items-baseline gap-1 text-[13px] leading-5 text-fg">
          <span className={cn("min-w-0 font-medium", p.name ? "truncate" : "[overflow-wrap:anywhere]")}>{display}</span>
          {you && <span className="shrink-0 text-fg-3">(you)</span>}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-fg-3">
          {p.pending ? (
            <>
              <span className="shrink-0">Invite sent</span>
              {onResend && (
                <>
                  <span aria-hidden className="text-fg-4">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={() => void resend()}
                    disabled={resent !== "idle"}
                    className={cn(
                      "relative rounded-sm text-fg-2 underline decoration-fg-4 underline-offset-2 outline-none transition-colors duration-150 hover:text-fg hover:decoration-fg-3",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                      "disabled:no-underline disabled:text-fg-3",
                      "before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] pointer-fine:before:hidden",
                    )}
                  >
                    {resent === "done" ? "Sent again" : resent === "sending" ? "Sending…" : "Resend"}
                  </button>
                </>
              )}
            </>
          ) : (
            p.name && <span className="min-w-0 truncate">{p.email}</span>
          )}
        </p>
      </div>

      {p.owner ? (
        <span className="shrink-0 pr-2 text-[12.5px] text-fg-3">Owner</span>
      ) : (
        <Menu.Root>
          <Menu.Trigger
            aria-label={`Access for ${display}: ${roleLabel}`}
            className={cn(
              "group/role relative flex h-7 shrink-0 items-center gap-1 rounded-md pl-2 pr-1.5 text-[12.5px] text-fg-2 outline-none select-none",
              "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-fg/[0.06] hover:text-fg active:scale-[0.97] active:duration-75",
              "data-popup-open:bg-fg/[0.08] data-popup-open:text-fg",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
              "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
            )}
          >
            <span className="grid overflow-hidden">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={roleLabel}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  className="col-start-1 row-start-1 whitespace-nowrap"
                >
                  {roleLabel}
                </motion.span>
              </AnimatePresence>
            </span>
            <ChevronDown size={14} className="text-fg-3 transition-transform duration-200 ease-out-expo group-data-popup-open/role:rotate-180 motion-reduce:transition-none" />
          </Menu.Trigger>
          <Menu.Portal container={container}>
            <Menu.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8} className="z-(--z-popover)">
              <Menu.Popup className={popup}>
                <Menu.RadioGroup value={p.role} onValueChange={(v) => onRoleChange(String(v))}>
                  {roles.map((r) => (
                    <Menu.RadioItem key={r.value} value={r.value} closeOnClick className={item}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-fg">{r.label}</span>
                        {r.description && <span className="truncate text-[12px] leading-4 text-fg-3">{r.description}</span>}
                      </span>
                      <Menu.RadioItemIndicator className="grid size-4 shrink-0 place-items-center">
                        <Check size={14} />
                      </Menu.RadioItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
                <Menu.Separator className="mx-2 my-1 h-px bg-line" />
                <Menu.Item onClick={onRemove} className={cn(item, "min-h-8 text-danger data-highlighted:bg-danger-soft")}>
                  <Trash size={16} className="shrink-0" />
                  <span className="flex-1">{p.pending ? "Cancel invite" : "Remove access"}</span>
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}
    </div>
  );
}

const popup = cn(
  "w-60 max-w-(--available-width) origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
  "transition-[opacity,scale,translate] duration-160 ease-out-expo",
  "data-starting-style:-translate-y-1 data-starting-style:scale-96 data-starting-style:opacity-0",
  "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
  "data-instant:transition-none motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
);

const item = cn(
  "flex min-h-11 cursor-default select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] outline-none",
  "transition-colors duration-75 data-highlighted:bg-fg/[0.06]",
);

/** A borderless select that reads as text until hovered: used for the link scope and role. */
function InlineSelect({
  label,
  value,
  items,
  onValueChange,
  strong,
  align = "start",
  container,
}: {
  label: string;
  value: string;
  items: { value: string; label: string; description?: string }[];
  onValueChange: (v: string) => void;
  strong?: boolean;
  align?: "start" | "end";
  container?: HTMLElement | null;
}) {
  return (
    <Select.Root items={items} value={value} onValueChange={(v) => v != null && onValueChange(String(v))}>
      <Select.Trigger
        aria-label={label}
        className={cn(
          "group/sel relative flex h-7 min-w-0 items-center gap-1 rounded-md px-1.5 text-[13px] outline-none select-none",
          "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-fg/[0.06] active:scale-[0.98] active:duration-75",
          "data-popup-open:bg-fg/[0.08]",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
          "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
          strong ? "font-medium text-fg" : "text-fg-2 hover:text-fg",
        )}
      >
        <Select.Value className="min-w-0 truncate" />
        <Select.Icon className="flex shrink-0 text-fg-3 transition-transform duration-200 ease-out-expo group-data-popup-open/sel:rotate-180 motion-reduce:transition-none">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner side="bottom" align={align} sideOffset={6} collisionPadding={8} alignItemWithTrigger={false} className="z-(--z-popover) outline-none">
          <Select.Popup className={popup}>
            <Select.List>
              {items.map((i) => (
                <Select.Item key={i.value} value={i.value} className={cn(item, !i.description && "min-h-9")}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Select.ItemText className="truncate text-fg">{i.label}</Select.ItemText>
                    {i.description && <span className="truncate text-[12px] leading-4 text-fg-3">{i.description}</span>}
                  </span>
                  <Select.ItemIndicator className="grid size-4 shrink-0 place-items-center">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ShareDialog
 * -----------------------------------------------------------------------------------------------*/

export type ShareDialogProps = Omit<Dialog.Root.Props, "children"> &
  Omit<SharePanelProps, "className" | "portalContainer"> & {
    /** The button that opens it. Rendered as the dialog trigger. */
    trigger?: React.ReactElement<Record<string, unknown>>;
    /** Name the thing: “Share q3-forecast.xlsx”. */
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Render inside this element instead of document.body; the backdrop then covers only it. */
    container?: HTMLElement | null;
    /** Where focus goes on open. Defaults to the invite field. */
    initialFocus?: Dialog.Popup.Props["initialFocus"];
    className?: string;
  };

export function ShareDialog({
  open,
  defaultOpen,
  onOpenChange,
  modal,
  disablePointerDismissal,
  trigger,
  title,
  description,
  container,
  initialFocus,
  className,
  ...panel
}: ShareDialogProps) {
  const contained = container != null;
  return (
    <Dialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal} disablePointerDismissal={disablePointerDismissal}>
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal container={container}>
        <Dialog.Backdrop
          className={cn(
            contained ? "absolute" : "fixed",
            "inset-0 z-(--z-overlay) bg-overlay transition-opacity duration-200 ease-out-quart data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150",
          )}
        />
        <Dialog.Viewport
          className={cn(
            contained ? "absolute" : "fixed",
            "inset-0 z-(--z-dialog) flex items-center justify-center p-4 max-sm:items-end max-sm:p-2 max-sm:pb-[max(8px,env(safe-area-inset-bottom))]",
          )}
        >
          <Dialog.Popup
            initialFocus={initialFocus}
            className={cn(
              "relative flex max-h-full w-full max-w-[520px] min-w-0 flex-col overflow-y-auto overscroll-contain rounded-2xl border border-line-2 bg-raised p-5 text-fg shadow-pop outline-none",
              "origin-center transition-[opacity,scale,translate] duration-[260ms] ease-out-expo",
              "data-starting-style:translate-y-1.5 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-[160ms] data-ending-style:ease-out-quart",
              "max-sm:data-starting-style:translate-y-4 max-sm:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
              className,
            )}
          >
            <div className="mb-4 flex min-w-0 flex-col gap-1 pr-8">
              <Dialog.Title className="min-w-0 text-[15px] font-medium leading-[1.3] tracking-[-0.015em] text-balance text-fg">{title}</Dialog.Title>
              {description && <Dialog.Description className="text-[12.5px] leading-[1.5] text-fg-3">{description}</Dialog.Description>}
            </div>

            <SharePanel
              {...panel}
              portalContainer={container}
              footer={
                <Dialog.Close
                  className={cn(
                    "inline-flex h-8 items-center justify-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame shadow-[var(--shadow)] outline-none",
                    "transition-[background-color,scale] duration-150 ease-out-quart hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                  )}
                >
                  Done
                </Dialog.Close>
              }
            />
            <Dialog.Close
              aria-label="Close"
              className={cn(
                "absolute right-3 top-3 grid size-7 place-items-center rounded-md text-fg-3 outline-none",
                "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-fg/[0.06] hover:text-fg active:scale-[0.92] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              <X />
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
