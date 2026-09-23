"use client";
import { Select } from "@base-ui/react/select";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Globe, Loader, Warning, X } from "@/lib/icons";
import { ease, spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* -------------------------------------------------------------------------------------------------
 * Parsing
 * -----------------------------------------------------------------------------------------------*/

const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;

export const isValidEmail = (value: string) => EMAIL.test(value);

/** Lowercases the domain and trims wrapping quotes and brackets: "<Mara@Northwind.COM>" → "Mara@northwind.com". */
function normalize(token: string) {
  const t = token.trim().replace(/^["'<(]+|["'>),.]+$/g, "");
  const at = t.lastIndexOf("@");
  return at > 0 ? t.slice(0, at + 1) + t.slice(at + 1).toLowerCase() : t;
}

/**
 * Pulls addresses out of whatever was typed or pasted: comma, semicolon, space or newline
 * separated lists, and contact lists like `Mara Okafor <mara@northwind.com>, jonah@…`,
 * where the names are dropped and only the addresses kept.
 */
export function parseEmails(text: string): string[] {
  const bracketed = [...text.matchAll(/<([^<>\s]+@[^<>\s]+)>/g)].map((m) => m[1]);
  const rest = text.replace(/[^,;\n]*<[^<>\s]+@[^<>\s]+>/g, " ");
  const loose = rest
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  // With a contact list, stray words are names, not failed addresses.
  const tokens = bracketed.length ? [...bracketed, ...loose.filter((t) => t.includes("@"))] : loose;
  return [...new Set(tokens.map(normalize).filter(Boolean))];
}

type Tone = "valid" | "invalid" | "external";
const toneOf = (email: string, domain?: string): Tone =>
  !isValidEmail(email) ? "invalid" : domain && !email.toLowerCase().endsWith(`@${domain.toLowerCase()}`) ? "external" : "valid";

/* -------------------------------------------------------------------------------------------------
 * InviteField
 * -----------------------------------------------------------------------------------------------*/

export type InviteRole = { value: string; label: string; description?: string };

export const defaultInviteRoles: InviteRole[] = [
  { value: "viewer", label: "Can view", description: "Read and download" },
  { value: "commenter", label: "Can comment", description: "Read and leave comments" },
  { value: "editor", label: "Can edit", description: "Make changes and share" },
];

type Phase = "idle" | "sending" | "sent";

export type InviteFieldProps = Omit<React.ComponentProps<"div">, "onChange" | "defaultValue" | "children"> & {
  /** Addresses as chips, controlled. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (emails: string[]) => void;
  /** Roles to choose from. Pass an empty array to hide the role picker. */
  roles?: InviteRole[];
  role?: string;
  defaultRole?: string;
  onRoleChange?: (role: string) => void;
  /** Send the invites. A promise keeps the button busy; a rejection keeps the chips and shows why. Omit to hide the button. */
  onInvite?: (emails: string[], role: string) => void | Promise<unknown>;
  /** Addresses outside this domain are marked as external, without blocking them. */
  organizationDomain?: string;
  /** Most addresses in one invite. */
  max?: number;
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
  /** Portal target for the role list. Defaults to document.body. */
  portalContainer?: HTMLElement | null;
};

export function InviteField({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  roles = defaultInviteRoles,
  role: roleProp,
  defaultRole,
  onRoleChange,
  onInvite,
  organizationDomain,
  max,
  label = "Invite people",
  placeholder = "Emails, separated by commas",
  submitLabel = "Invite",
  disabled = false,
  portalContainer,
  className,
  ...rest
}: InviteFieldProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const inputId = `${uid}-input`;
  const hintId = `${uid}-hint`;
  const [emails, setEmails] = useControllableState({ value: valueProp, defaultValue, onChange: onValueChange });
  const [role, setRole] = useControllableState({ value: roleProp, defaultValue: defaultRole ?? roles[0]?.value ?? "", onChange: onRoleChange });
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ email: string; n: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sentTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(sentTimer.current), []);

  const tones = emails.map((e) => toneOf(e, organizationDomain));
  const invalid = emails.filter((_, i) => tones[i] === "invalid");
  const external = emails.filter((_, i) => tones[i] === "external");
  const valid = emails.length - invalid.length;
  const busy = phase === "sending";
  const full = max != null && emails.length >= max;

  /** Adds addresses, skipping ones already there (which flash instead). Returns what was added. */
  const add = (incoming: string[]) => {
    if (!incoming.length) return [];
    const have = new Set(emails.map((e) => e.toLowerCase()));
    const fresh: string[] = [];
    let dupe: string | null = null;
    for (const e of incoming) {
      const key = e.toLowerCase();
      if (have.has(key)) {
        dupe = emails.find((x) => x.toLowerCase() === key) ?? null;
        continue;
      }
      if (max != null && emails.length + fresh.length >= max) break;
      have.add(key);
      fresh.push(e);
    }
    if (fresh.length) setEmails([...emails, ...fresh]);
    if (dupe) setFlash((f) => ({ email: dupe!, n: (f?.n ?? 0) + 1 }));
    setError(null);
    const bad = fresh.filter((e) => !isValidEmail(e)).length;
    setAnnouncement(
      [
        fresh.length ? `Added ${fresh.length} ${fresh.length === 1 ? "address" : "addresses"}` : "",
        bad ? `${bad} not valid` : "",
        dupe && !fresh.length ? `${dupe} is already added` : "",
        max != null && emails.length + fresh.length >= max && incoming.length > fresh.length + (dupe ? 1 : 0) ? `Limit of ${max} reached` : "",
      ]
        .filter(Boolean)
        .join(". "),
    );
    return fresh;
  };

  const commitDraft = () => {
    const parsed = parseEmails(draft);
    if (!parsed.length) return false;
    add(parsed);
    setDraft("");
    return true;
  };

  const remove = (email: string, focusAfter: "prev" | "input" = "input") => {
    const i = emails.indexOf(email);
    const next = emails.filter((e) => e !== email);
    setEmails(next);
    setError(null);
    setAnnouncement(`Removed ${email}`);
    const target = focusAfter === "prev" ? (emails[i - 1] ?? emails[i + 1]) : undefined;
    if (target) chipFor(target)?.focus();
    else inputRef.current?.focus();
  };

  // Clicking a chip that needs fixing puts it back in the field to edit.
  const edit = (email: string) => {
    const leftover = draft.trim();
    setEmails(emails.filter((e) => e !== email));
    setDraft(leftover ? `${leftover}, ${email}` : email);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  };

  // Chips are found by address, not position: one that is still animating out stays in the DOM for a moment.
  const chipFor = (email: string | undefined) => (email ? (listRef.current?.querySelector<HTMLButtonElement>(`[data-chip][data-email="${CSS.escape(email)}"]`) ?? null) : null);
  const chipAt = (i: number) => chipFor(emails[i]);

  const send = async () => {
    if (busy || !onInvite) return;
    // Whatever is still being typed goes along with the chips.
    const pending = [...emails];
    for (const e of parseEmails(draft)) if (!pending.some((p) => p.toLowerCase() === e.toLowerCase())) pending.push(e);
    if (pending.length !== emails.length) {
      setEmails(pending);
      setDraft("");
    }
    if (pending.some((e) => !isValidEmail(e))) {
      const n = pending.filter((e) => !isValidEmail(e)).length;
      setError(`Fix or remove ${n === 1 ? "the invalid address" : `${n} invalid addresses`} to send.`);
      requestAnimationFrame(() => {
        const first = listRef.current?.querySelector<HTMLButtonElement>("button[data-chip][data-tone=invalid]");
        first?.focus();
      });
      return;
    }
    if (!pending.length) return;
    setPhase("sending");
    setError(null);
    try {
      await onInvite(pending, role);
      setEmails([]);
      setPhase("sent");
      setAnnouncement(`Invited ${pending.length} ${pending.length === 1 ? "person" : "people"}`);
      sentTimer.current = window.setTimeout(() => setPhase("idle"), 1600);
    } catch {
      setPhase("idle");
      setError("Couldn’t send the invites. Try again.");
    }
  };

  const hint =
    error ??
    (invalid.length
      ? `${invalid.length === 1 ? "1 address isn’t" : `${invalid.length} addresses aren’t`} valid. Click to edit.`
      : external.length && organizationDomain
        ? `${external.length === 1 ? "1 person is" : `${external.length} people are`} outside ${organizationDomain}.`
        : full
          ? `You can invite up to ${max} people at a time.`
          : null);
  const hintTone = error || invalid.length ? "danger" : external.length ? "warning" : "muted";

  return (
    <div className={cn("@container flex w-full min-w-0 flex-col gap-1.5", className)} data-disabled={disabled || undefined} {...rest}>
      {label && (
        <label htmlFor={inputId} className="w-fit text-[12.5px] font-medium text-fg">
          {label}
        </label>
      )}

      <div className="flex min-w-0 items-start gap-2 @max-[22rem]:flex-col @max-[22rem]:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div
            onMouseDown={(e) => {
              // Presses on the field's empty space land in the input.
              if (e.target === e.currentTarget || e.target === listRef.current) {
                e.preventDefault();
                inputRef.current?.focus();
              }
            }}
            className={cn(
              "flex min-h-9 min-w-0 cursor-text items-start rounded-lg border bg-raised shadow-[var(--shadow)]",
              "transition-[border-color,box-shadow] duration-150 ease-out focus-within:ring-3 focus-within:ring-fg/8",
              error ? "border-danger/60" : "border-line-2 hover:border-fg-4 focus-within:border-fg-4",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <ul ref={listRef} aria-label="Addresses" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 p-1 pl-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {emails.map((email, i) => (
                  <Chip
                    key={email}
                    email={email}
                    tone={tones[i]}
                    busy={busy}
                    reduce={reduce}
                    flash={flash?.email === email ? flash.n : 0}
                    onRemove={() => remove(email)}
                    onEdit={() => edit(email)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        chipAt(i - 1)?.focus();
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        (chipAt(i + 1) ?? inputRef.current)?.focus();
                      } else if (e.key === "Backspace" || e.key === "Delete") {
                        e.preventDefault();
                        remove(email, e.key === "Backspace" ? "prev" : "input");
                      } else if (e.key === "Enter" || e.key === "F2") {
                        e.preventDefault();
                        edit(email);
                      } else if (e.key === "Escape") {
                        inputRef.current?.focus();
                      }
                    }}
                  />
                ))}
              </AnimatePresence>
              <li className="flex min-w-[9rem] flex-1">
                <input
                  ref={inputRef}
                  id={inputId}
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint={onInvite ? "send" : "done"}
                  value={draft}
                  disabled={disabled || busy}
                  placeholder={emails.length ? "" : placeholder}
                  aria-label={label ? undefined : "Email addresses"}
                aria-describedby={hint ? hintId : undefined}
                  aria-invalid={invalid.length > 0 || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    // A separator typed at the end turns what's before it into a chip.
                    if (/[,;\s]$/.test(v) && v.trim()) {
                      add(parseEmails(v));
                      setDraft("");
                    } else setDraft(v);
                    setError(null);
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    const found = parseEmails(text);
                    if (found.length > 1 || /[,;\n<]/.test(text)) {
                      e.preventDefault();
                      add(parseEmails(`${draft} ${text}`));
                      setDraft("");
                    }
                  }}
                  onBlur={() => {
                    if (draft.trim()) commitDraft();
                  }}
                  onKeyDown={(e) => {
                    const el = e.currentTarget;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!commitDraft() && (e.metaKey || e.ctrlKey || !draft)) void send();
                    } else if (e.key === "Tab" && !e.shiftKey && draft.trim()) {
                      commitDraft();
                    } else if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0 && emails.length) {
                      e.preventDefault();
                      chipAt(emails.length - 1)?.focus();
                    } else if (e.key === "ArrowLeft" && el.selectionStart === 0 && el.selectionEnd === 0 && emails.length) {
                      e.preventDefault();
                      chipAt(emails.length - 1)?.focus();
                    }
                  }}
                  className="h-7 w-full min-w-0 bg-transparent px-1 text-base text-fg outline-none placeholder:text-fg-4 disabled:cursor-not-allowed sm:text-[13px]"
                />
              </li>
            </ul>

            {roles.length > 0 && <RolePicker roles={roles} value={role} onValueChange={setRole} disabled={disabled || busy} container={portalContainer} />}
          </div>
          <AnimatePresence initial={false} mode="popLayout">
            {hint && (
              <motion.p
                key={hint}
                id={hintId}
                role={error ? "alert" : undefined}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                transition={{ duration: 0.16, ease: ease.out }}
                className={cn("flex items-center gap-1.5 text-[12px]", hintTone === "danger" ? "text-danger" : hintTone === "warning" ? "text-warning" : "text-fg-3")}
              >
                {hintTone === "warning" && <Globe size={13} className="shrink-0" />}
                {hint}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {onInvite && (
          <InviteButton
            phase={phase}
            count={valid + parseEmails(draft).filter((e) => isValidEmail(e) && !emails.some((x) => x.toLowerCase() === e.toLowerCase())).length}
            label={submitLabel}
            disabled={disabled || (emails.length === 0 && !draft.trim())}
            onPress={() => void send()}
            reduce={reduce}
          />
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Parts
 * -----------------------------------------------------------------------------------------------*/

function Chip({
  email,
  tone,
  busy,
  reduce,
  flash,
  onRemove,
  onEdit,
  onKeyDown,
  ref,
}: {
  email: string;
  tone: Tone;
  busy: boolean;
  reduce: boolean;
  flash: number;
  onRemove: () => void;
  onEdit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  ref?: React.Ref<HTMLLIElement>;
}) {
  const [scope, animateChip] = useAnimate<HTMLSpanElement>();
  // Adding an address that's already here nudges the one that exists instead of adding a twin.
  useEffect(() => {
    if (!flash || reduce || !scope.current) return;
    animateChip(scope.current, { scale: [1, 1.08, 1] }, { duration: 0.32, ease: ease.out });
  }, [flash, reduce, animateChip, scope]);

  const label = tone === "invalid" ? `${email}, not a valid email` : tone === "external" ? `${email}, outside your organization` : email;

  return (
    <motion.li
      ref={ref}
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, filter: "blur(2px)" }}
      animate={{ opacity: busy ? 0.55 : 1, scale: 1, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.85, filter: "blur(2px)", transition: { duration: 0.12 } }}
      transition={reduce ? { duration: 0.12 } : { ...spring.pop, opacity: { duration: 0.14 } }}
      className="flex min-w-0 max-w-full"
    >
      <span
        ref={scope}
        data-tone={tone}
        className={cn(
          "group/chip flex h-7 min-w-0 max-w-full items-center rounded-md border text-[12.5px] transition-colors duration-150",
          tone === "invalid" && "border-danger/30 bg-danger-soft text-danger",
          tone === "external" && "border-warning/30 bg-warning-soft text-fg",
          tone === "valid" && "border-line-2 bg-fg/[0.04] text-fg",
          "has-[button[data-chip]:focus-visible]:outline-solid has-[button[data-chip]:focus-visible]:outline-1 has-[button[data-chip]:focus-visible]:outline-offset-1 has-[button[data-chip]:focus-visible]:outline-fg-3",
        )}
      >
        <button
          type="button"
          data-chip
          data-email={email}
          data-tone={tone}
          tabIndex={-1}
          aria-label={label}
          aria-keyshortcuts="Backspace Delete Enter"
          title={tone === "invalid" ? "Not a valid email. Click to edit." : tone === "external" ? "Outside your organization" : undefined}
          onClick={tone === "invalid" ? onEdit : undefined}
          onDoubleClick={tone !== "invalid" ? onEdit : undefined}
          onKeyDown={onKeyDown}
          className={cn("flex h-full min-w-0 items-center gap-1.5 pl-2 pr-0.5 outline-none", tone === "invalid" ? "cursor-text" : "cursor-default")}
        >
          {tone === "invalid" && <Warning size={13} className="shrink-0" />}
          {tone === "external" && <Globe size={13} className="shrink-0 text-warning" />}
          <span className="min-w-0 truncate">{email}</span>
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Remove ${email}`}
          onClick={onRemove}
          disabled={busy}
          className={cn(
            "relative mr-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] opacity-60 outline-none",
            "transition-[background-color,opacity,scale] duration-150 hover:bg-fg/10 hover:opacity-100 active:scale-90",
            "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
          )}
        >
          <X size={12} />
        </button>
      </span>
    </motion.li>
  );
}

function RolePicker({
  roles,
  value,
  onValueChange,
  disabled,
  container,
}: {
  roles: InviteRole[];
  value: string;
  onValueChange: (v: string) => void;
  disabled: boolean;
  container?: HTMLElement | null;
}) {
  const items = roles.map((r) => ({ value: r.value, label: r.label }));
  return (
    <Select.Root items={items} value={value} onValueChange={(v) => v != null && onValueChange(String(v))} disabled={disabled}>
      <Select.Trigger
        aria-label="Role"
        className={cn(
          "group/role relative m-1 ml-0 flex h-7 shrink-0 items-center gap-1 rounded-md pl-2 pr-1.5 text-[12.5px] text-fg-2 outline-none select-none",
          "transition-[background-color,color,scale] duration-150 ease-out-quart hover:bg-fg/[0.06] hover:text-fg active:scale-[0.97] active:duration-75",
          "data-popup-open:bg-fg/[0.08] data-popup-open:text-fg data-disabled:opacity-50",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-fg-3",
        )}
      >
        <Select.Value className="whitespace-nowrap" />
        <Select.Icon className="flex text-fg-3 transition-transform duration-200 ease-out-expo group-data-popup-open/role:rotate-180 motion-reduce:transition-none">
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8} alignItemWithTrigger={false} className="z-(--z-popover) outline-none">
          <Select.Popup
            className={cn(
              "w-60 max-w-(--available-width) origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
              "transition-[opacity,scale,translate] duration-160 ease-out-expo",
              "data-starting-style:-translate-y-1 data-starting-style:scale-96 data-starting-style:opacity-0",
              "data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100",
              "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100",
            )}
          >
            <Select.List>
              {roles.map((r) => (
                <Select.Item
                  key={r.value}
                  value={r.value}
                  className="flex min-h-11 cursor-default select-none items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] outline-none transition-colors duration-75 data-highlighted:bg-fg/[0.06]"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Select.ItemText className="truncate text-fg">{r.label}</Select.ItemText>
                    {r.description && <span className="truncate text-[12px] leading-4 text-fg-3">{r.description}</span>}
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

function InviteButton({ phase, count, label, disabled, onPress, reduce }: { phase: Phase; count: number; label: string; disabled: boolean; onPress: () => void; reduce: boolean }) {
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" };
  const leave = reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" };
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled && phase === "idle"}
      aria-busy={phase === "sending" || undefined}
      className={cn(
        "relative inline-flex h-9 shrink-0 select-none items-center justify-center rounded-lg bg-fg px-3 text-[13px] font-medium text-frame shadow-[var(--shadow)] outline-none",
        "transition-[background-color,opacity,scale] duration-150 ease-out-quart hover:bg-fg/90 active:scale-[0.97] active:duration-75",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "disabled:opacity-35 disabled:hover:bg-fg aria-busy:cursor-progress",
      )}
    >
      {/* All states share one cell, so the button holds its width while it works. */}
      <span className="grid place-items-center">
        <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-1.5">
          {label}
          <span className="min-w-[2ch] tabular">00</span>
        </span>
        <span aria-hidden className="invisible col-start-1 row-start-1 flex items-center gap-1.5">
          <Check size={14} />
          Sent
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={phase}
            className="col-start-1 row-start-1 flex items-center gap-1.5"
            initial={enter}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={leave}
            transition={reduce ? { duration: 0.12 } : phase === "sent" ? spring.pop : { duration: 0.2, ease: ease.out }}
          >
            {phase === "idle" ? (
              <>
                {label}
                {count > 0 && <NumberFlow value={count} animated={!reduce} className="tabular opacity-60" />}
              </>
            ) : phase === "sending" ? (
              <>
                <Loader size={14} className="animate-spin" />
                <span className="sr-only">Sending invites</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <motion.path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.3, ease: ease.out, delay: 0.05 }}
                  />
                </svg>
                Sent
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}
