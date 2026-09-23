"use client";
import { Popover } from "@base-ui/react/popover";
import { Select } from "@base-ui/react/select";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Loader, Mail, Search, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Member = {
  id: string;
  email: string;
  /** Missing for invites that haven't been accepted. */
  name?: string;
  avatarUrl?: string;
  role: string;
  /** Invited but not joined yet. Shown under Pending invites. */
  pending?: boolean;
  /** When the invite was sent. Shown as “Invited 2 days ago”. */
  invitedAt?: Date | string | number;
};

export type MemberRole = { value: string; label: string; description?: string };

export const defaultMemberRoles: MemberRole[] = [
  { value: "owner", label: "Owner", description: "Full access, including billing and deleting the workspace" },
  { value: "admin", label: "Admin", description: "Manage members, settings and every project" },
  { value: "member", label: "Member", description: "Create and edit projects they belong to" },
  { value: "guest", label: "Guest", description: "View and comment on projects shared with them" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

const displayName = (m: Member) => m.name ?? m.email;

// A minute clock shared by every list on the page. The server has no "now", so
// relative times render on the client only and never cause a hydration mismatch.
let clockNow = 0;
const clockListeners = new Set<() => void>();
let clockTimer: number | undefined;
function subscribeClock(cb: () => void) {
  clockListeners.add(cb);
  if (clockListeners.size === 1) {
    clockNow = Date.now();
    clockTimer = window.setInterval(() => {
      if (document.hidden) return;
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    clockListeners.delete(cb);
    if (!clockListeners.size) window.clearInterval(clockTimer);
  };
}
function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow || (clockNow = Date.now()),
    () => null,
  );
}

function ago(date: Member["invitedAt"], now: number) {
  if (date == null) return "";
  const t = new Date(date).getTime();
  const s = Math.round((t - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(t);
}

/** Wraps the matched part of a name or email so the eye lands on why the row is here. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-fg/[0.12] text-inherit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* MemberList                                                          */
/* ------------------------------------------------------------------ */

export type MemberListProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  members?: Member[];
  defaultMembers?: Member[];
  onMembersChange?: (members: Member[]) => void;
  roles?: MemberRole[];
  /** The person looking. Their row says “(you)” and can't be changed or removed here. */
  currentUserId?: string;
  /** Names the workspace in the remove confirmation. */
  workspaceName?: string;
  /** False shows roles as text and hides every action. */
  canManage?: boolean;
  /** Save a role change. The row changes at once and reverts if this rejects. */
  onRoleChange?: (member: Member, role: string) => void | Promise<unknown>;
  /** Remove a member. The confirmation stays open while it runs and shows the error if it rejects. */
  onRemove?: (member: Member) => void | Promise<unknown>;
  /** Send a pending invite again. Shows Resend on invite rows. */
  onResend?: (member: Member) => void | Promise<unknown>;
  /** Withdraw a pending invite. Shows Revoke on invite rows. */
  onRevoke?: (member: Member) => void | Promise<unknown>;
  /** Actions beside the search field, like an Invite button. */
  toolbar?: React.ReactNode;
  searchPlaceholder?: string;
  /** Portal target for role menus and confirmations. */
  portalContainer?: HTMLElement | null;
};

export function MemberList({
  members: membersProp,
  defaultMembers = [],
  onMembersChange,
  roles = defaultMemberRoles,
  currentUserId,
  workspaceName,
  canManage = true,
  onRoleChange,
  onRemove,
  onResend,
  onRevoke,
  toolbar,
  searchPlaceholder = "Search by name or email",
  portalContainer,
  className,
  ...rest
}: MemberListProps) {
  const uid = useId();
  const reduce = !!useReducedMotion();
  const [members, setMembers] = useControllableState({ value: membersProp, defaultValue: defaultMembers, onChange: onMembersChange });
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const [removing, setRemoving] = useState<ReadonlySet<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusNext = useRef<string | null>(null);
  // Saves resolve after other edits may have landed, so they read the list as it is now.
  const latest = useRef(members);
  useEffect(() => {
    latest.current = members;
  });

  // Rows that arrive after the first render (a new invite) grow in and glow once.
  // Rows that come back when a search is cleared just appear.
  const ids = members.map((m) => m.id).join("|");
  const [known, setKnown] = useState(ids);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  if (ids !== known) {
    const before = new Set(known.split("|"));
    const added = members.filter((m) => !before.has(m.id)).map((m) => m.id);
    setKnown(ids);
    if (added.length) setFresh(new Set(added));
  }
  useEffect(() => {
    if (!fresh.size) return;
    const t = window.setTimeout(() => setFresh(new Set()), 1600);
    return () => window.clearTimeout(t);
  }, [fresh]);

  const q = query.trim().toLowerCase();
  const matches = (m: Member) => !q || m.email.toLowerCase().includes(q) || !!m.name?.toLowerCase().includes(q);
  const joined = members.filter((m) => !m.pending);
  const invites = members.filter((m) => m.pending);
  const shownJoined = joined.filter(matches);
  const shownInvites = invites.filter(matches);
  const owners = joined.filter((m) => m.role === "owner").length;
  const roleLabel = (v: string) => roles.find((r) => r.value === v)?.label ?? v;

  const setError = (id: string, message: string | null) =>
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });

  const changeRole = async (m: Member, role: string) => {
    const previous = m.role;
    setError(m.id, null);
    // Optimistic: the label rolls to the new role on this frame.
    setMembers(members.map((x) => (x.id === m.id ? { ...x, role } : x)));
    setAnnouncement(`${displayName(m)} is now ${roleLabel(role)}`);
    try {
      await onRoleChange?.(m, role);
    } catch {
      setMembers(latest.current.map((x) => (x.id === m.id ? { ...x, role: previous } : x)));
      setError(m.id, `Couldn’t change the role. It’s still ${roleLabel(previous)}.`);
      setAnnouncement(`Couldn’t change ${displayName(m)}’s role`);
    }
  };

  // Where focus lands once a row is gone: the next row, else the previous, else the search.
  const neighbour = (m: Member) => {
    const list = m.pending ? shownInvites : shownJoined;
    const i = list.findIndex((x) => x.id === m.id);
    return list[i + 1]?.id ?? list[i - 1]?.id ?? null;
  };

  const drop = (m: Member) => {
    focusNext.current = neighbour(m) ?? "search";
    setRemoving((s) => new Set(s).add(m.id));
    setMembers(latest.current.filter((x) => x.id !== m.id));
  };

  const remove = async (m: Member) => {
    await onRemove?.(m);
    drop(m);
    setAnnouncement(`Removed ${displayName(m)}`);
  };

  const revoke = async (m: Member) => {
    setError(m.id, null);
    try {
      await onRevoke?.(m);
      drop(m);
      setAnnouncement(`Revoked the invite to ${m.email}`);
    } catch {
      setError(m.id, "Couldn’t revoke the invite. Try again.");
    }
  };

  const onExitComplete = () => {
    const target = focusNext.current;
    focusNext.current = null;
    if (!target) return;
    const root = rootRef.current;
    const el =
      target === "search"
        ? searchRef.current
        : root?.querySelector<HTMLElement>(`[data-member="${CSS.escape(target)}"] :is(button, [role=combobox]):not([disabled])`);
    (el ?? searchRef.current)?.focus({ preventScroll: true });
  };

  const empty = q && !shownJoined.length && !shownInvites.length;

  const renderRows = (list: Member[]) => (
    <AnimatePresence initial={false} custom={removing} onExitComplete={onExitComplete}>
      {list.map((m) => (
        <motion.li
          key={m.id}
          data-member={m.id}
          custom={removing}
          variants={{
            // Only new rows grow in; filtered rows and first paint are already there.
            hidden: fresh.has(m.id) && !reduce ? { opacity: 0, height: 0 } : { opacity: 1, height: "auto" },
            shown: { opacity: 1, height: "auto" },
            // A removed row folds shut and the list closes the gap; a filtered row just goes.
            gone: (r: ReadonlySet<string>) =>
              r.has(m.id)
                ? reduce
                  ? { opacity: 0, transition: { duration: 0.12 } }
                  : { opacity: 0, height: 0, transition: { height: { duration: 0.24, ease: ease.inOut, delay: 0.04 }, opacity: { duration: 0.12 } } }
                : { opacity: 0, transition: { duration: 0 } },
          }}
          initial="hidden"
          animate="shown"
          exit="gone"
          transition={{ height: { duration: 0.26, ease: ease.out }, opacity: { duration: 0.2, delay: 0.06 } }}
          className="overflow-hidden"
        >
          <Row
            member={m}
            you={m.id === currentUserId}
            query={q}
            fresh={fresh.has(m.id)}
            locked={!canManage || m.id === currentUserId || (m.role === "owner" && owners <= 1 && !m.pending)}
            canManage={canManage}
            roles={roles}
            roleLabel={roleLabel(m.role)}
            error={errors[m.id]}
            workspaceName={workspaceName}
            onRoleChange={(role) => void changeRole(m, role)}
            onRemove={() => remove(m)}
            onResend={onResend && canManage ? () => onResend(m) : undefined}
            onRevoke={onRevoke && canManage ? () => void revoke(m) : undefined}
            reduce={reduce}
            container={portalContainer}
          />
        </motion.li>
      ))}
    </AnimatePresence>
  );

  return (
    <div ref={rootRef} className={cn("@container flex w-full min-w-0 flex-col gap-3", className)} {...rest}>
      <div className="flex items-center gap-2">
        <label
          className={cn(
            "group/search relative flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-2 bg-raised pl-2.5 pr-1 shadow-[var(--shadow)]",
            "transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10",
          )}
        >
          <Search size={14} className="shrink-0 text-fg-3 transition-colors duration-150 group-focus-within/search:text-fg-2" />
          <span className="sr-only">Search members</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
            }}
            placeholder={searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-controls={`${uid}-lists`}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px] [&::-webkit-search-cancel-button]:appearance-none"
          />
          <AnimatePresence initial={false}>
            {query && (
              <motion.button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
                transition={reduce ? { duration: 0.1 } : spring.pop}
                className={cn(
                  "relative grid size-6 shrink-0 place-items-center rounded-md text-fg-3 outline-none transition-colors duration-150 hover:bg-hover hover:text-fg active:scale-[0.92]",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                  "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
                )}
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </label>
        {toolbar}
      </div>

      <div id={`${uid}-lists`} className="flex min-w-0 flex-col gap-4">
        {empty ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-2 px-4 py-8 text-center">
            <p className="text-[13px] text-fg-2">
              No one matches <span className="text-fg">“{query.trim()}”</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              className={cn(
                "h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none",
                "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
              )}
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            {(shownJoined.length > 0 || !q) && (
              <section aria-labelledby={`${uid}-members`} className="flex min-w-0 flex-col">
                <SectionLabel id={`${uid}-members`} count={shownJoined.length} reduce={reduce}>
                  Members
                </SectionLabel>
                {joined.length === 0 ? (
                  <p className="py-3 text-[12.5px] text-fg-3">No one has joined yet.</p>
                ) : (
                  <ul aria-labelledby={`${uid}-members`} className="-mx-2 flex flex-col">
                    {renderRows(shownJoined)}
                  </ul>
                )}
              </section>
            )}
            {shownInvites.length > 0 && (
              <section aria-labelledby={`${uid}-invites`} className="flex min-w-0 flex-col">
                <SectionLabel id={`${uid}-invites`} count={shownInvites.length} reduce={reduce}>
                  Pending invites
                </SectionLabel>
                <ul aria-labelledby={`${uid}-invites`} className="-mx-2 flex flex-col">
                  {renderRows(shownInvites)}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {q ? `${shownJoined.length + shownInvites.length} ${shownJoined.length + shownInvites.length === 1 ? "person" : "people"} found. ` : ""}
        {announcement}
      </span>
    </div>
  );
}

function SectionLabel({ id, count, reduce, children }: { id: string; count: number; reduce: boolean; children: React.ReactNode }) {
  return (
    <h3 id={id} className="flex items-center gap-1.5 border-b border-line pb-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">
      {children}
      <NumberFlow value={count} animated={!reduce} className="tabular text-fg-4" />
    </h3>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

type RowProps = {
  member: Member;
  you: boolean;
  query: string;
  fresh: boolean;
  locked: boolean;
  canManage: boolean;
  roles: MemberRole[];
  roleLabel: string;
  error?: string;
  workspaceName?: string;
  onRoleChange: (role: string) => void;
  onRemove: () => Promise<void>;
  onResend?: () => void | Promise<unknown>;
  onRevoke?: () => void;
  reduce: boolean;
  container?: HTMLElement | null;
};

function Row({ member: m, you, query, fresh, locked, canManage, roles, roleLabel, error, workspaceName, onRoleChange, onRemove, onResend, onRevoke, reduce, container }: RowProps) {
  const name = displayName(m);
  const now = useNow();
  const errorId = useId();

  return (
    <div
      data-fresh={fresh || undefined}
      className={cn(
        "group/row relative flex min-h-13 min-w-0 items-center gap-3 px-2 py-2",
        // A just-added row starts lit and cools to the page over a second.
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-lg before:bg-fg/[0.05] before:opacity-0 before:transition-opacity before:duration-1000",
        "data-fresh:before:opacity-100 data-fresh:before:duration-0",
      )}
    >
      <Avatar member={m} />

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="flex min-w-0 items-baseline gap-1 text-[13px] leading-5 text-fg">
          <span className={cn("min-w-0 font-medium [overflow-wrap:anywhere]", m.name && "truncate @max-[26rem]:whitespace-normal")}>
            <Highlight text={name} query={query} />
          </span>
          {you && <span className="shrink-0 text-fg-3">(you)</span>}
        </p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] leading-4 text-fg-3">
          {m.pending ? (
            <>
              <span className="shrink-0" suppressHydrationWarning>
                {m.invitedAt != null && now != null ? `Invited ${ago(m.invitedAt, now)}` : "Invite sent"}
              </span>
              {/* In a narrow list the actions drop to their own line instead of leaving a dot dangling. */}
              <span className="contents @max-[26rem]:flex @max-[26rem]:basis-full @max-[26rem]:items-center @max-[26rem]:gap-x-1.5">
                {onRevoke && (
                  <>
                    <Dot className="@max-[26rem]:hidden" />
                    <TextButton onClick={onRevoke} aria-label={`Revoke the invite to ${m.email}`}>
                      Revoke
                    </TextButton>
                  </>
                )}
                {/* Last on the line, so the width it reserves for its longest label never opens a gap. */}
                {onResend && (
                  <>
                    <Dot className={onRevoke ? undefined : "@max-[26rem]:hidden"} />
                    <ResendButton onResend={onResend} reduce={reduce} email={m.email} />
                  </>
                )}
              </span>
            </>
          ) : (
            m.name && (
              <span className="min-w-0 truncate">
                <Highlight text={m.email} query={query} />
              </span>
            )
          )}
        </p>
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              id={errorId}
              role="alert"
              initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.14 } }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="overflow-hidden text-[12px] leading-4 text-danger"
            >
              <span className="block pt-1">{error}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {locked ? (
          // Padded to end where a trigger's text ends, so every role sits in one column.
          <span className="pl-2 pr-6 text-[12.5px] text-fg-3">{roleLabel}</span>
        ) : (
          <RoleSelect
            name={name}
            value={m.role}
            label={roleLabel}
            roles={roles}
            onChange={onRoleChange}
            describedBy={error ? errorId : undefined}
            reduce={reduce}
            container={container}
          />
        )}
        {canManage && !m.pending && (
          // Holds its place when there's nothing to remove, so role labels stay in one column.
          <span className="grid size-7 place-items-center">
            {!locked && <RemoveButton name={name} workspaceName={workspaceName} onRemove={onRemove} container={container} />}
          </span>
        )}
        {canManage && m.pending && <span aria-hidden className="size-7" />}
      </div>
    </div>
  );
}

function Avatar({ member: m }: { member: Member }) {
  const [failed, setFailed] = useState(false);
  const showImage = m.avatarUrl && !failed;
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid size-8 shrink-0 select-none place-items-center overflow-hidden rounded-full text-[11.5px] font-medium",
        m.pending ? "border border-dashed border-line-2 text-fg-3" : "bg-hover text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]",
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.avatarUrl} alt="" width={32} height={32} onError={() => setFailed(true)} className="size-full object-cover" />
      ) : m.pending || !m.name ? (
        <Mail size={14} />
      ) : (
        initials(m.name)
      )}
    </span>
  );
}

const Dot = ({ className }: { className?: string }) => (
  <span aria-hidden className={cn("text-fg-4", className)}>
    ·
  </span>
);

function TextButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "relative inline-grid rounded-sm text-fg-2 outline-none transition-colors duration-150 hover:text-fg",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
        "disabled:text-fg-3",
        "before:absolute before:-inset-x-1.5 before:-inset-y-3.5 before:content-[''] pointer-fine:before:hidden",
        className,
      )}
      {...props}
    />
  );
}

/** Resend → Sending… → Sent, in one fixed-width cell. Sent holds for a while so nobody sends three. */
function ResendButton({ onResend, reduce, email }: { onResend: () => void | Promise<unknown>; reduce: boolean; email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  useEffect(() => {
    if (state !== "sent" && state !== "failed") return;
    const t = window.setTimeout(() => setState("idle"), state === "sent" ? 30_000 : 4000);
    return () => window.clearTimeout(t);
  }, [state]);

  const send = async () => {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    try {
      await onResend();
      setState("sent");
    } catch {
      setState("failed");
    }
  };

  const labels = { idle: "Resend", sending: "Sending…", sent: "Sent", failed: "Couldn’t send" };
  return (
    <>
      <TextButton
        onClick={() => void send()}
        disabled={state === "sending" || state === "sent"}
        aria-label={`${labels[state]}: invite to ${email}`}
        className={cn(state === "failed" && "text-danger hover:text-danger")}
      >
        {Object.values(labels).map((l) => (
          <span key={l} aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
            {l}
          </span>
        ))}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={state}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(2px)", transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: ease.out }}
            className="col-start-1 row-start-1 flex items-center gap-1 whitespace-nowrap text-left"
          >
            {state === "sent" && <DrawnCheck reduce={reduce} />}
            {labels[state]}
          </motion.span>
        </AnimatePresence>
      </TextButton>
    </>
  );
}

function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-success">
      <motion.path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: ease.out, delay: 0.06 }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Role select                                                         */
/* ------------------------------------------------------------------ */

const popupSurface =
  "origin-(--transform-origin) rounded-xl border border-line-2 bg-raised text-fg shadow-pop outline-none transition-[opacity,scale,translate] duration-160 ease-out-expo data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100 data-instant:transition-none motion-reduce:data-starting-style:scale-100";

function RoleSelect({
  name,
  value,
  label,
  roles,
  onChange,
  describedBy,
  reduce,
  container,
}: {
  name: string;
  value: string;
  label: string;
  roles: MemberRole[];
  onChange: (role: string) => void;
  describedBy?: string;
  reduce: boolean;
  container?: HTMLElement | null;
}) {
  return (
    <Select.Root items={roles} value={value} onValueChange={(v) => v != null && v !== value && onChange(String(v))}>
      <Select.Trigger
        aria-label={`Role for ${name}: ${label}`}
        aria-describedby={describedBy}
        className={cn(
          "group/role relative flex h-7 items-center gap-1 rounded-md pl-2 pr-1.5 text-[12.5px] text-fg-2 outline-none select-none",
          "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-fg/[0.06] hover:text-fg active:scale-[0.97] active:duration-75",
          "data-popup-open:bg-fg/[0.08] data-popup-open:text-fg",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
          "before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] pointer-fine:before:hidden",
        )}
      >
        {/* Every role label shares one cell, so the trigger never changes width as the role rolls. */}
        <span className="grid overflow-hidden text-right">
          {roles.map((r) => (
            <span key={r.value} aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
              {r.label}
            </span>
          ))}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={label}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="col-start-1 row-start-1 whitespace-nowrap"
            >
              {label}
            </motion.span>
          </AnimatePresence>
        </span>
        <Select.Icon className="flex text-fg-3 transition-transform duration-200 ease-out-expo group-data-popup-open/role:rotate-180 motion-reduce:transition-none">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} alignItemWithTrigger={false} className="z-(--z-popover) outline-none">
          <Select.Popup className={cn("w-72 max-w-(--available-width) p-1", popupSurface, "data-starting-style:-translate-y-1")}>
            <Select.List>
              {roles.map((r) => (
                <Select.Item
                  key={r.value}
                  value={r.value}
                  label={r.label}
                  className="flex min-h-11 cursor-default select-none items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13px] outline-none transition-colors duration-75 data-highlighted:bg-fg/[0.06]"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Select.ItemText className="text-fg">{r.label}</Select.ItemText>
                    {r.description && <span className="text-[12px] leading-4 text-pretty text-fg-3">{r.description}</span>}
                  </span>
                  <Select.ItemIndicator className="grid h-5 w-4 shrink-0 place-items-center">
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

/* ------------------------------------------------------------------ */
/* Remove with confirm                                                 */
/* ------------------------------------------------------------------ */

function RemoveButton({
  name,
  workspaceName,
  onRemove,
  container,
}: {
  name: string;
  workspaceName?: string;
  onRemove: () => Promise<void>;
  container?: HTMLElement | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const removed = useRef(false);
  const titleId = useId();

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRemove();
      // The row folds away and the list moves focus to its neighbour, so don't hand focus back to this trigger.
      removed.current = true;
      setOpen(false);
    } catch {
      setError(`Couldn’t remove ${name}. Try again.`);
      setBusy(false);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (busy && !removed.current) return;
        if (next) setError(null);
        setOpen(next);
      }}
    >
      <Popover.Trigger
        aria-label={`Remove ${name}`}
        className={cn(
          "relative grid size-7 place-items-center rounded-md text-fg-3 outline-none",
          "transition-[background-color,color,opacity,scale] duration-150 hover:bg-danger-soft hover:text-danger active:scale-[0.92] active:duration-75",
          "data-popup-open:bg-danger-soft data-popup-open:text-danger",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
          // Quiet until the row is hovered or focused on a mouse; always there on touch.
          "pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-fine:data-popup-open:opacity-100",
          "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
        )}
      >
        <X size={14} />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
          <Popover.Popup
            initialFocus={cancelRef}
            finalFocus={() => !removed.current}
            aria-labelledby={titleId}
            className={cn("flex w-72 max-w-(--available-width) flex-col gap-3 p-3.5", popupSurface, "data-starting-style:-translate-y-1 data-[side=top]:data-starting-style:translate-y-1")}
          >
            <div className="flex flex-col gap-1">
              <Popover.Title id={titleId} className="text-[13px] font-medium leading-5 text-fg">
                Remove {name}?
              </Popover.Title>
              <Popover.Description className="text-[12.5px] leading-[18px] text-pretty text-fg-3">
                They lose access to {workspaceName ?? "this workspace"} right away. You can invite them again later.
              </Popover.Description>
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-danger-soft px-2.5 py-1.5 text-[12px] leading-4 text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Popover.Close
                ref={cancelRef}
                disabled={busy}
                className={cn(
                  "h-7 rounded-md border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg outline-none",
                  "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 disabled:opacity-50",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                )}
              >
                Cancel
              </Popover.Close>
              <button
                type="button"
                onClick={() => void confirm()}
                aria-busy={busy || undefined}
                className={cn(
                  "relative grid h-7 place-items-center rounded-md bg-danger px-2.5 text-[12.5px] font-medium text-frame outline-none",
                  "transition-[background-color,scale] duration-150 hover:bg-danger/90 active:scale-[0.97] active:duration-75 aria-busy:pointer-events-none",
                  "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-danger",
                )}
              >
                {/* The spinner overlays the label so the button keeps its width. */}
                <span className={cn("col-start-1 row-start-1 transition-opacity duration-150", busy && "opacity-0")}>Remove</span>
                {busy && (
                  <span className="col-start-1 row-start-1 grid place-items-center">
                    <Loader size={14} className="animate-spin" />
                    <span className="sr-only">Removing</span>
                  </span>
                )}
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
