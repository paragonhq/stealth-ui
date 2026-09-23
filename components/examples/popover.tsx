"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { File, Link, Loader, Refresh } from "@/lib/icons";
import { Popover, PopoverContent, PopoverDescription, PopoverFooter, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

type Person = { name: string; email: string; role: string };

const initial: Person[] = [
  { name: "Maya Chen", email: "maya@northwind.co", role: "Owner" },
  { name: "Dev Patel", email: "dev@northwind.co", role: "Can edit" },
];

const nameFrom = (email: string) =>
  email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");

// A file header with the two popovers it actually needs: a click-to-open share
// form, and a sync status that opens on hover because it's glanced at, not used.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[460px] flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center gap-3 border-b border-line py-2.5 pl-3 pr-2.5">
        <span className="hidden size-8 shrink-0 place-items-center rounded-lg border border-line bg-frame text-fg-2 sm:grid">
          <File />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium tracking-[-0.005em] text-fg">q3-forecast.xlsx</p>
          <p className="truncate text-[12px] text-fg-3">Edited 4m ago by Maya</p>
        </div>
        <SyncStatus />
        <SharePopover />
      </div>
      <Sheet />
    </div>
  );
}

const rows = [
  ["North America", "$4.82M", "+12%"],
  ["Europe", "$3.17M", "+8%"],
  ["Asia Pacific", "$2.40M", "+21%"],
  ["Latin America", "$0.96M", "−3%"],
  ["Middle East", "$0.61M", "+5%"],
  ["Africa", "$0.28M", "+14%"],
  ["Total", "$12.24M", "+11%"],
];

// The file the header belongs to, so the popovers open over real content.
function Sheet() {
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="border-b border-line text-left text-2xs uppercase tracking-[0.08em] text-fg-4">
          <th className="px-4 py-2 font-normal">Region</th>
          <th className="px-4 py-2 text-right font-normal">Q3</th>
          <th className="px-4 py-2 text-right font-normal">vs Q2</th>
        </tr>
      </thead>
      <tbody className="tabular">
        {rows.map(([region, q3, delta], i) => (
          <tr key={region} className={cn("border-b border-line last:border-0", i === rows.length - 1 ? "text-fg" : "text-fg-2")}>
            <td className="px-4 py-2.5">{region}</td>
            <td className="px-4 py-2.5 text-right">{q3}</td>
            <td className={cn("px-4 py-2.5 text-right", delta.startsWith("−") ? "text-danger" : "text-fg-3")}>{delta}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SyncStatus() {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState("2m ago");
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const sync = () => {
    setSyncing(true);
    timer.current = window.setTimeout(() => {
      setSyncing(false);
      setSynced("just now");
    }, 1400);
  };

  return (
    <Popover>
      <PopoverTrigger variant="ghost" size="sm" openOnHover delay={250} closeDelay={120}>
        <span className="relative grid size-3.5 place-items-center">
          {syncing ? <Loader size={12} className="animate-spin" /> : <span className="size-1.5 rounded-full bg-success" />}
        </span>
        {syncing ? "Syncing" : "Synced"}
      </PopoverTrigger>
      <PopoverContent size="sm" side="bottom" align="center">
        <div className="flex flex-col gap-0.5">
          <PopoverTitle>{syncing ? "Syncing…" : `Synced ${synced}`}</PopoverTitle>
          <PopoverDescription>214 rows from Revenue model. Syncs every 15 minutes.</PopoverDescription>
        </div>
        <button
          type="button"
          onClick={sync}
          aria-busy={syncing || undefined}
          className={cn(
            "inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2 text-[12px] font-medium text-fg outline-none",
            "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75",
            "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 aria-busy:pointer-events-none",
          )}
        >
          <Refresh size={14} className={cn("text-fg-2", syncing && "animate-spin [animation-direction:reverse]")} />
          Sync now
        </button>
      </PopoverContent>
    </Popover>
  );
}

function SharePopover() {
  const reduce = useReducedMotion();
  const [people, setPeople] = useState(initial);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("Enter a valid email address");
    const existing = people.find((p) => p.email === value);
    if (existing) return setError(`${existing.name.split(" ")[0]} already has access`);
    setError(null);
    setBusy(true);
    timer.current = window.setTimeout(() => {
      const name = nameFrom(value);
      setPeople((p) => [...p, { name, email: value, role: "Invited" }]);
      setEmail("");
      setBusy(false);
      setAnnounce(`Invite sent to ${value}`);
      inputRef.current?.focus();
    }, 700);
  };

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) setError(null);
      }}
    >
      <PopoverTrigger>
        <Link size={16} className="text-fg-2" />
        Share
      </PopoverTrigger>
      <PopoverContent align="end" initialFocus={inputRef}>
        <PopoverHeader title="Share q3-forecast.xlsx" description="People you invite get an email with a link." />

        <form onSubmit={invite} noValidate className="flex flex-col">
          <div className="flex gap-2">
            <label htmlFor="share-email" className="sr-only">
              Email
            </label>
            <input
              ref={inputRef}
              id="share-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              enterKeyHint="send"
              placeholder="name@northwind.co"
              value={email}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "share-error" : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              className={cn(
                "h-8 min-w-0 flex-1 rounded-lg border border-line-2 bg-frame px-2.5 text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]",
                "transition-[border-color,box-shadow] duration-150 focus:border-fg-4 focus:ring-3 focus:ring-fg/10",
                "aria-invalid:border-danger/60 aria-invalid:focus:ring-danger/15",
              )}
            />
            <button
              type="submit"
              aria-busy={busy || undefined}
              className={cn(
                "relative inline-grid h-8 shrink-0 place-items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none",
                "transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75",
                "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 aria-busy:pointer-events-none",
              )}
            >
              {/* The label keeps the width; the spinner overlays it. */}
              <span className={cn("col-start-1 row-start-1 transition-opacity duration-150", busy && "opacity-0")}>Invite</span>
              {busy && <Loader size={14} className="col-start-1 row-start-1 animate-spin" />}
            </button>
          </div>
          {/* The error line opens with the grid-rows trick so the list below slides rather than jumps. */}
          <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out-expo", error ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <p id="share-error" className="overflow-hidden text-[12px] text-danger">
              <span className="block pt-1.5">{error}</span>
            </p>
          </div>
        </form>

        <ul aria-label="People with access" className="-mx-1 flex flex-col">
          <AnimatePresence initial={false}>
            {people.map((p) => (
              <motion.li
                key={p.email}
                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: reduce ? 0.15 : 0.26, ease: ease.out }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border border-line bg-frame text-[10px] font-medium text-fg-2">
                    {p.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1 leading-4">
                    <p className="truncate text-[12.5px] font-medium text-fg">{p.name}</p>
                    <p className="truncate text-[11.5px] text-fg-3">{p.email}</p>
                  </div>
                  <span className={cn("shrink-0 text-[12px]", p.role === "Invited" ? "text-fg-2" : "text-fg-3")}>{p.role}</span>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <PopoverFooter>
          <p className="min-w-0 flex-1 truncate text-[12px] text-fg-3">Anyone at Northwind with the link</p>
          <CopyButton value="https://sheets.northwind.co/f/q3-forecast" label="Copy link" copiedLabel="Copied" size="sm" variant="ghost" className="-mr-2" />
        </PopoverFooter>
        <span role="status" aria-live="polite" className="sr-only">
          {announce}
        </span>
      </PopoverContent>
    </Popover>
  );
}
