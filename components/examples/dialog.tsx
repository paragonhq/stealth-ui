"use client";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const btn = (variant: "primary" | "secondary") =>
  cn(
    "relative inline-flex h-8 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-[12.5px] font-medium tracking-[-0.005em]",
    "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
    "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart active:scale-[0.97] active:duration-75",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    variant === "primary"
      ? "bg-fg text-frame shadow-[var(--shadow)] hover:bg-fg/90"
      : "border border-line-2 bg-raised text-fg shadow-[var(--shadow)] hover:border-fg-4 hover:bg-hover data-popup-open:border-fg-4 data-popup-open:bg-hover",
  );

const files: [string, number, number][] = [
  ["app/(marketing)/page.tsx", 42, 18],
  ["app/(marketing)/pricing/page.tsx", 31, 4],
  ["components/pricing-table.tsx", 58, 12],
  ["components/plan-toggle.tsx", 24, 0],
  ["lib/billing/plans.ts", 17, 9],
  ["lib/billing/format-price.ts", 11, 2],
  ["app/api/checkout/route.ts", 8, 3],
  ["app/globals.css", 6, 1],
  ["public/og/pricing.png", 0, 0],
  ["tests/pricing.spec.ts", 12, 0],
  ["tests/plan-toggle.spec.ts", 5, 0],
  ["package.json", 1, 1],
  ["next.config.ts", 2, 2],
  ["README.md", 4, 1],
  ["middleware.ts", 3, 3],
  ["lib/analytics/events.ts", 6, 2],
  ["components/footer.tsx", 2, 1],
  ["app/sitemap.ts", 2, 2],
  ["components/nav/top-bar.tsx", 9, 6],
  ["components/nav/mobile-menu.tsx", 14, 3],
  ["lib/billing/currency.ts", 21, 0],
  ["app/(marketing)/layout.tsx", 3, 1],
  ["tests/checkout.spec.ts", 18, 4],
  ["vercel.json", 1, 0],
];
const added = files.reduce((n, f) => n + f[1], 0);
const removed = files.reduce((n, f) => n + f[2], 0);

export default function Demo() {
  const [name, setName] = useState("stealth-web");

  return (
    <div className="w-full max-w-[380px] rounded-xl border border-line bg-raised p-4 shadow-[var(--shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium tracking-[-0.005em] text-fg">{name}</p>
          <p className="mt-0.5 text-[12px] text-fg-3">Production · main · 3 commits waiting</p>
        </div>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
          <span className="size-1.5 rounded-full bg-current" />
          Ready
        </span>
      </div>
      <div className="mt-4 flex gap-2">
        <RenameDialog name={name} onRename={setName} />
        <ReviewDialog />
      </div>
    </div>
  );
}

function RenameDialog({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const id = useId();
  const dirty = draft !== name;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return setError("Enter a name");
    if (!/^[a-z0-9-]+$/.test(value)) return setError("Use lowercase letters, numbers and dashes");
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    onRename(value);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (next) {
          setDraft(name);
          setError("");
        }
        setOpen(next);
      }}
      // Once there is something to lose, a stray click outside doesn't throw it away.
      dismissible={!dirty}
    >
      <DialogTrigger className={btn("secondary")}>Rename</DialogTrigger>
      <DialogContent size="sm">
        <form onSubmit={submit} noValidate className="contents">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>The new name shows up in its URL and in every deploy log.</DialogDescription>
          </DialogHeader>
          <DialogBody className="pb-1 pt-3">
            <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-fg">
              Project name
            </label>
            <input
              id={id}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError("");
              }}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className={cn(
                "h-9 w-full rounded-lg border border-line-2 bg-raised px-3 font-mono text-base text-fg shadow-[var(--shadow)] outline-none sm:text-[13px]",
                "transition-[border-color,box-shadow] duration-150 ease-out-quart hover:border-fg-4 focus:border-fg-3 focus:ring-3 focus:ring-fg/8",
                "aria-invalid:border-danger/70 aria-invalid:focus:border-danger aria-invalid:focus:ring-danger/15",
              )}
            />
            <p id={`${id}-error`} className={cn("mt-1.5 min-h-[18px] text-[12px]", error ? "text-danger" : "text-fg-4")}>
              {error || "Lowercase letters, numbers and dashes"}
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose disabled={saving}>Cancel</DialogClose>
            <button type="submit" aria-busy={saving || undefined} className={btn("primary")}>
              <span className={cn("transition-opacity duration-150", saving && "opacity-0")}>Save changes</span>
              {saving && <Spinner className="absolute" />}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog() {
  return (
    <Dialog>
      <DialogTrigger className={btn("secondary")}>Review changes</DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Review {files.length} changes</DialogTitle>
          <DialogDescription>main → production · 3 commits by Maya Chen</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="-mx-2 flex flex-col">
            {files.map(([path, plus, minus]) => (
              <li key={path} className="flex h-9 items-center gap-3 rounded-md px-2 hover:bg-hover">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2">{path}</span>
                <span className="tabular shrink-0 font-mono text-[11.5px]">
                  {plus + minus === 0 ? (
                    <span className="text-fg-4">binary</span>
                  ) : (
                    <>
                      <span className="text-success">+{plus}</span> <span className="text-danger">−{minus}</span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter className="justify-between max-sm:flex max-sm:flex-wrap">
          <p className="tabular font-mono text-[11.5px] text-fg-3 max-sm:hidden">
            {files.length} files · <span className="text-success">+{added}</span> <span className="text-danger">−{removed}</span>
          </p>
          <div className="flex gap-2 max-sm:grid max-sm:w-full max-sm:auto-cols-fr max-sm:grid-flow-col max-sm:*:h-10">
            <DialogClose>Cancel</DialogClose>
            <DialogClose variant="primary">Deploy to production</DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={cn("animate-[spin_0.7s_linear_infinite]", className)}>
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M8 2.25A5.75 5.75 0 0 1 13.75 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
