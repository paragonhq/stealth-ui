"use client";
import { useState } from "react";
import { Field, FieldControl, FieldDescription, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { SaveBar } from "@/components/ui/save-bar";

type Values = { name: string; digest: boolean; mentions: boolean };
const initial: Values = { name: "Northwind Labs", digest: true, mentions: false };
const tabs = ["General", "Members", "Billing"];

// Workspace settings. Change anything and the bar arrives; try another tab
// with unsaved changes and it asks you to decide first.
export default function Demo() {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [tab, setTab] = useState("General");
  const [nudges, setNudges] = useState(0);
  const changes = (Object.keys(values) as (keyof Values)[]).filter((k) => values[k] !== saved[k]).length;
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((p) => ({ ...p, [k]: v }));

  return (
    <div className="relative flex h-[420px] w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <div role="tablist" aria-label="Settings" className="flex gap-1 border-b border-line px-3 pt-3">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => (changes > 0 && t !== tab ? setNudges((n) => n + 1) : setTab(t))}
            className={cn(
              "relative -mb-px h-9 rounded-t-md px-2.5 text-[12.5px] font-medium outline-none transition-colors duration-150",
              "focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
              tab === t ? "text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-px after:bg-fg after:content-['']" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "General" ? (
        <div className="flex flex-col gap-5 p-5 pb-24">
          <Field>
            <FieldLabel>Workspace name</FieldLabel>
            <FieldControl value={values.name} onValueChange={(v) => set("name", v)} autoComplete="organization" />
            <FieldDescription>Clear it and save to see a failed save.</FieldDescription>
          </Field>
          <div className="flex flex-col divide-y divide-line rounded-lg border border-line">
            <Toggle label="Weekly digest" hint="A summary of activity every Monday" checked={values.digest} onChange={(v) => set("digest", v)} />
            <Toggle label="Mentions by email" hint="When someone @mentions you" checked={values.mentions} onChange={(v) => set("mentions", v)} />
          </div>
        </div>
      ) : (
        <p className="p-5 text-[12.5px] text-fg-3">{tab} settings would load here.</p>
      )}

      <SaveBar
        position="absolute"
        dirty={changes > 0}
        changes={changes}
        nudgeKey={nudges}
        onDiscard={() => setValues(saved)}
        onSave={() =>
          new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              if (!values.name.trim()) return reject(new Error("Name required"));
              setSaved(values);
              resolve();
            }, 900),
          )
        }
      />
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] text-fg">{label}</span>
        <span className="truncate text-[12px] text-fg-3">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-8 shrink-0 rounded-full outline-none transition-colors duration-200",
          "focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid",
          checked ? "bg-fg" : "bg-fg/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full shadow-[var(--shadow)] transition-[translate,background-color] duration-200 ease-out-expo",
            checked ? "translate-x-3 bg-frame" : "bg-raised",
          )}
        />
      </button>
    </label>
  );
}
