"use client";
import { InlineEdit } from "@/components/ui/inline-edit";

const save = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// An issue header: a title you rename in place, and settings rows that check
// themselves. Try the slug "admin" to see the server say no.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-xl border border-line bg-frame p-4">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">NW-482</span>
        <InlineEdit
          label="Issue title"
          defaultValue="Retry banner flashes on slow connections"
          maxLength={120}
          validate={(v) => (v ? undefined : "Give the issue a title")}
          onSave={() => save(700)}
          className="text-[16px] font-medium leading-6 tracking-[-0.015em]"
        />
      </div>

      <dl className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-line pt-3 text-[13px] leading-5">
        <dt className="py-[6px] text-[12.5px] text-fg-3">Project</dt>
        <dd className="min-w-0">
          <InlineEdit
            label="Project"
            defaultValue="Northwind web"
            maxLength={40}
            validate={(v) => (v ? undefined : "Enter a project name")}
            onSave={() => save(500)}
          />
        </dd>

        <dt className="py-[6px] text-[12.5px] text-fg-3">Slug</dt>
        <dd className="min-w-0">
          <InlineEdit
            label="Slug"
            defaultValue="northwind-web"
            className="font-mono text-[12.5px]"
            validate={(v) => (/^[a-z0-9-]+$/.test(v) ? undefined : "Use lowercase letters, numbers and hyphens")}
            onSave={async (v) => {
              await save(600);
              if (v === "admin") return "That slug is reserved. Try another.";
            }}
          />
        </dd>

        <dt className="py-[6px] text-[12.5px] text-fg-3">Owner</dt>
        <dd className="min-w-0">
          <InlineEdit label="Owner" placeholder="Assign someone" onSave={() => save(400)} />
        </dd>
      </dl>
    </div>
  );
}
