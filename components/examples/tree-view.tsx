"use client";
import { useRef, useState } from "react";
import { TreeView, type TreeNode } from "@/components/ui/tree-view";

const M = <span className="text-warning">M</span>;
const A = <span className="text-success">A</span>;

const files: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      {
        id: "src/routes",
        label: "routes",
        children: [
          { id: "src/routes/invoices.ts", label: "invoices.ts", meta: M },
          { id: "src/routes/webhooks.ts", label: "webhooks.ts", meta: M },
          { id: "src/routes/customers.ts", label: "customers.ts" },
        ],
      },
      {
        id: "src/lib",
        label: "lib",
        children: [
          { id: "src/lib/stripe.ts", label: "stripe.ts" },
          { id: "src/lib/retry-queue.ts", label: "retry-queue.ts", meta: A },
          { id: "src/lib/money.ts", label: "money.ts" },
        ],
      },
      { id: "src/server.ts", label: "server.ts" },
    ],
  },
  { id: "fixtures", label: "fixtures", hasChildren: true },
  { id: "vendor", label: "vendor", hasChildren: true },
  { id: "migrations", label: "migrations", children: [] },
  { id: "tests", label: "tests", children: [{ id: "tests/invoices.test.ts", label: "invoices.test.ts" }, { id: "tests/webhooks.test.ts", label: "webhooks.test.ts", meta: M }] },
  { id: ".env.example", label: ".env.example" },
  { id: "package.json", label: "package.json" },
  { id: "README.md", label: "README.md" },
];

// An editor's file explorer. fixtures fails to load the first time; vendor loads slowly.
export default function Demo() {
  const [selected, setSelected] = useState<string[]>(["src/routes/webhooks.ts"]);
  const [opened, setOpened] = useState<string | null>(null);
  const attempts = useRef(0);

  const loadChildren = (node: TreeNode) =>
    new Promise<TreeNode[]>((resolve, reject) => {
      if (node.id === "fixtures" && attempts.current++ === 0) return setTimeout(() => reject(new Error("timeout")), 700);
      setTimeout(
        () =>
          resolve(
            node.id === "fixtures"
              ? [
                  { id: "fixtures/invoice-paid.json", label: "invoice-paid.json", meta: "2 KB" },
                  { id: "fixtures/invoice-failed.json", label: "invoice-failed.json", meta: "3 KB" },
                ]
              : [
                  { id: "vendor/stripe-node", label: "stripe-node", children: [{ id: "vendor/stripe-node/index.js", label: "index.js", meta: "418 KB" }] },
                  { id: "vendor/decimal.js", label: "decimal.js", meta: "96 KB" },
                ],
          ),
        node.id === "vendor" ? 1400 : 600,
      );
    });

  return (
    <div className="flex w-full max-w-[340px] flex-col overflow-hidden rounded-xl border border-line bg-frame">
      <div className="flex h-9 items-center justify-between border-b border-line px-3">
        <span className="font-mono text-2xs tracking-[0.08em] text-fg-3 uppercase">Explorer</span>
        <span className="text-[12px] text-fg-4">billing-api</span>
      </div>
      <TreeView
        aria-label="Files in billing-api"
        items={files}
        defaultExpanded={["src", "src/routes"]}
        selected={selected}
        onSelectedChange={setSelected}
        loadChildren={loadChildren}
        onAction={(node) => setOpened(node.id)}
        className="h-[292px]"
      />
      <div className="flex h-9 items-center gap-2 border-t border-line px-3 text-[12px] text-fg-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{opened ? `Opened ${opened}` : (selected[0] ?? "Nothing selected")}</span>
        <span className="hidden shrink-0 text-fg-4 sm:inline">Enter to open</span>
      </div>
    </div>
  );
}
