"use client";
import { useState } from "react";
import { ShortcutRecorder } from "@/components/ui/shortcut-recorder";

const actions = [
  { id: "palette", label: "Open command palette", defaults: "mod+k" },
  { id: "search", label: "Search in project", defaults: "mod+shift+f" },
  { id: "sidebar", label: "Toggle sidebar", defaults: "mod+b" },
  { id: "issue", label: "Create issue", defaults: null },
];

// A keyboard settings card. Toggle sidebar was customised, so it can be reset;
// press ⌘K on another row to see the conflict and take it over.
export default function Demo() {
  const [keys, setKeys] = useState<Record<string, string | null>>({
    palette: "mod+k",
    search: "mod+shift+f",
    sidebar: "mod+\\",
    issue: null,
  });

  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Keyboard shortcuts</h3>
        <p className="text-[12.5px] text-fg-3">Click a shortcut, then press the new keys.</p>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {actions.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 px-4 py-2.5 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between min-[420px]:gap-4">
            <span className="text-[13px] leading-5 text-fg min-[420px]:pt-1.5">{a.label}</span>
            <ShortcutRecorder
              label={a.label}
              value={keys[a.id]}
              resetValue={a.defaults}
              onValueChange={(v) => setKeys((k) => ({ ...k, [a.id]: v }))}
              taken={actions.filter((o) => o.id !== a.id && keys[o.id]).map((o) => ({ keys: keys[o.id]!, label: o.label }))}
              onReplace={(clash) => {
                const other = actions.find((o) => o.label === clash.label);
                if (other) setKeys((k) => ({ ...k, [other.id]: null }));
              }}
              className="min-[420px]:w-48"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
