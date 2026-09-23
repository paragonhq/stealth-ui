"use client";
import { useState } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";

type Node = { name: string; children?: Node[] };

const tree: Node = {
  name: "Northwind",
  children: [
    {
      name: "Engineering",
      children: [
        {
          name: "Platform",
          children: [
            {
              name: "Services",
              children: [
                {
                  name: "billing-api",
                  children: [
                    {
                      name: "docs",
                      children: [
                        { name: "Runbooks", children: [{ name: "Incident response for failed invoice webhooks.md" }, { name: "Rotating Stripe keys.md" }] },
                        { name: "architecture.md" },
                      ],
                    },
                    { name: "src", children: [] },
                  ],
                },
                { name: "auth-gateway", children: [] },
              ],
            },
          ],
        },
        { name: "Design reviews", children: [] },
      ],
    },
    { name: "Finance", children: [] },
  ],
};

const start = ["Engineering", "Platform", "Services", "billing-api", "docs", "Runbooks", "Incident response for failed invoice webhooks.md"];

function walk(path: string[]) {
  const nodes = [tree];
  for (const name of path) nodes.push(nodes[nodes.length - 1].children!.find((c) => c.name === name)!);
  return nodes;
}

// A file browser's header: drag the frame's corner to narrow it and watch the middle fold away.
export default function Demo() {
  const [path, setPath] = useState(start);
  const nodes = walk(path);
  const here = nodes[nodes.length - 1];
  const items: BreadcrumbItem[] = nodes.map((n, i) => ({
    label: n.name,
    href: `#/${nodes.slice(1, i + 1).map((x) => encodeURIComponent(x.name)).join("/")}`,
    icon: i === 0 ? <span className="grid size-3.5 place-items-center rounded-[4px] bg-fg text-[8px] font-semibold text-frame">N</span> : undefined,
  }));

  return (
    <div className="flex w-full max-w-[540px] flex-col gap-2">
      <div className="min-w-[220px] max-w-full resize-x overflow-hidden rounded-xl border border-line bg-frame" style={{ width: 540 }}>
        <div className="flex h-11 items-center border-b border-line px-1.5">
          <Breadcrumbs
            items={items}
            className="flex-1"
            onItemClick={(_, index, e) => {
              e.preventDefault();
              setPath(path.slice(0, index));
            }}
          />
        </div>
        <ul className="h-[168px] overflow-y-auto p-1" aria-label={`Contents of ${here.name}`}>
          {here.children?.length === 0 ? (
            <li className="px-2 py-2 text-[12.5px] text-fg-3">This folder is empty</li>
          ) : here.children ? (
            here.children.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => setPath([...path, c.name])}
                  className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-fg-2 outline-none transition-[background-color,color] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3 focus-visible:outline-solid"
                >
                  <span className="text-fg-4">{c.children ? <Folder /> : <Doc />}</span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.children && <span className="font-mono text-2xs text-fg-4 tabular">{c.children.length}</span>}
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-2 text-[12.5px] leading-5 text-fg-3">
              {here.name.startsWith("Incident")
                ? "Last edited by Priya Raman on 14 Sep. When invoice webhooks fail, pause the retry queue first, then check the signing secret."
                : here.name.startsWith("Rotating")
                  ? "Last edited by Jonas Weber on 2 Sep. Create the new key, deploy it to billing-api, then revoke the old one."
                  : "Last edited by Elif Demir on 28 Aug. How invoices move from draft to paid across billing-api and auth-gateway."}
            </li>
          )}
        </ul>
      </div>
      <p className="text-[12px] text-fg-4">Drag the bottom-right corner to resize.</p>
    </div>
  );
}

function Folder() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" aria-hidden>
      <path d="M2.5 4.25c0-.4.35-.75.75-.75h3l1.5 1.5h5c.4 0 .75.35.75.75v6.5c0 .4-.35.75-.75.75h-9.5a.75.75 0 0 1-.75-.75z" />
    </svg>
  );
}

function Doc() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" aria-hidden>
      <path d="M4 2.5h5l3.5 3.5v7.5H4zM9 2.5V6h3.5" />
    </svg>
  );
}
