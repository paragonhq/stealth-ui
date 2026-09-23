"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Plus, Trash } from "@/lib/icons";
import { AnimateHeight } from "@/components/ui/animate-height";

type Variable = { key: string; value: string; secret: boolean };

const initial: Variable[] = [
  { key: "DATABASE_URL", value: "postgres://…", secret: true },
  { key: "STRIPE_SECRET_KEY", value: "sk_demo_…", secret: true },
  { key: "NEXT_PUBLIC_APP_URL", value: "https://app.acme.dev", secret: false },
];

const control =
  "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";
const field =
  "h-8 min-w-0 rounded-md border border-line-2 bg-frame px-2 font-mono text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-4 focus:border-fg-4 focus:ring-2 focus:ring-fg/10 aria-invalid:border-danger/60 sm:text-[12px]";

// An environment editor: rows come and go, a draft row opens, a validation line
// appears while you type. The card follows every change without a jump.
export default function Demo() {
  const [vars, setVars] = useState(initial);
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null);
  // A fresh object each time, so asking for the same target twice still moves focus.
  const [focusTarget, setFocusTarget] = useState<{ selector: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep keyboard users in place after a row they were on disappears.
  useEffect(() => {
    if (focusTarget) listRef.current?.querySelector<HTMLElement>(focusTarget.selector)?.focus();
  }, [focusTarget]);

  const key = draft?.key ?? "";
  const error = !draft
    ? null
    : /[^A-Z0-9_]/.test(key)
      ? "Use letters, digits and underscores only"
      : vars.some((v) => v.key === key)
        ? `${key} already exists`
        : null;
  const canSave = !!draft && !!key && !!draft.value && !error;

  const remove = (i: number) => {
    const next = vars.filter((_, j) => j !== i);
    setVars(next);
    setFocusTarget({ selector: next.length ? `[data-row="${Math.min(i, next.length - 1)}"] button` : "[data-add]" });
  };
  const save = () => {
    if (!draft || !canSave) return;
    setVars([...vars, { key: draft.key, value: draft.value, secret: true }]);
    setDraft(null);
    setFocusTarget({ selector: "[data-add]" });
  };
  const cancel = () => {
    setDraft(null);
    setFocusTarget({ selector: "[data-add]" });
  };

  return (
    // Reserve room below so the stage never re-centres while the card grows.
    <div className="flex min-h-[380px] w-full max-w-[440px] flex-col justify-start">
      <div ref={listRef} className="rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <p className="text-[13px] font-medium tracking-[-0.005em] text-fg">Environment variables</p>
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Production</span>
        </div>

        <AnimateHeight>
          {vars.length === 0 && !draft ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[13px] text-fg-2">No variables yet</p>
              <p className="mt-0.5 text-[12px] text-fg-3">They’re encrypted and injected at build time.</p>
            </div>
          ) : (
            <ul aria-label="Variables" className="py-1">
              {vars.map((v, i) => (
                <li
                  key={v.key}
                  data-row={i}
                  className="group flex h-10 items-center gap-3 pl-4 pr-1.5 transition-opacity duration-200 starting:opacity-0 hover:bg-hover"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg">{v.key}</span>
                  <span className="max-w-[40%] shrink-0 truncate font-mono text-[12px] text-fg-3">
                    {v.secret ? "••••••••" : v.value}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${v.key}`}
                    onClick={() => remove(i)}
                    className={`relative grid size-7 shrink-0 place-items-center rounded-md text-fg-3 transition-[background-color,color,scale] duration-150 hover:bg-danger-soft hover:text-danger active:scale-[0.92] active:duration-75 before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden ${control}`}
                  >
                    <Trash size={14} />
                  </button>
                </li>
              ))}
              {draft && (
                <li className="px-4 pb-2 pt-1.5 transition-opacity duration-200 starting:opacity-0">
                  <form
                    className="flex flex-col gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      save();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") cancel();
                    }}
                  >
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        aria-label="Key"
                        placeholder="KEY_NAME"
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        value={draft.key}
                        aria-invalid={!!error || undefined}
                        aria-describedby={error ? "env-error" : undefined}
                        onChange={(e) => setDraft({ ...draft, key: e.target.value.toUpperCase() })}
                        className={`${field} w-0 flex-[1.2]`}
                      />
                      <input
                        aria-label="Value"
                        placeholder="Value"
                        autoComplete="off"
                        spellCheck={false}
                        enterKeyHint="done"
                        value={draft.value}
                        onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                        className={`${field} w-0 flex-1`}
                      />
                    </div>
                    {error && (
                      <p id="env-error" className="flex items-center gap-1.5 text-[12px] text-danger transition-opacity duration-150 starting:opacity-0">
                        <Alert size={14} className="shrink-0" />
                        {error}
                      </p>
                    )}
                    <button type="submit" hidden />
                  </form>
                </li>
              )}
            </ul>
          )}
        </AnimateHeight>

        <div className="flex h-12 items-center justify-between gap-2 border-t border-line px-2.5">
          <span className="pl-1.5 text-[12px] text-fg-3 tabular">
            {vars.length === 0 ? "" : vars.length === 1 ? "1 variable" : `${vars.length} variables`}
          </span>
          {draft ? (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={cancel}
                className={`h-8 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-2 transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75 ${control}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className={`h-8 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50 ${control}`}
              >
                Save variable
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-add
              onClick={() => {
                setDraft({ key: "", value: "" });
              }}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 ${control}`}
            >
              <Plus size={14} />
              Add variable
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
