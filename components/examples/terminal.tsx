"use client";
import { Terminal, type TerminalLine } from "@/components/ui/terminal";

const session: TerminalLine[] = [
  { kind: "command", cwd: "storefront", text: "pnpm install" },
  { kind: "task", text: "Resolving dependencies", done: "Resolved 412 packages", duration: 900 },
  { kind: "task", text: "Downloading packages", done: "Added 412 packages in 3.4s", duration: 1500 },
  { kind: "blank" },
  { kind: "command", cwd: "storefront", text: "pnpm build" },
  { kind: "output", text: "> storefront@0.4.0 build", tone: "muted" },
  { kind: "output", text: "> next build", tone: "muted" },
  { kind: "task", text: "Compiling", done: "Compiled in 6.2s", duration: 1800 },
  { kind: "output", text: "Route (app)          Size     First load" },
  { kind: "output", text: "○ /                  5.1 kB   102 kB" },
  { kind: "output", text: "○ /products          3.8 kB   98.4 kB" },
  { kind: "output", text: "ƒ /api/checkout      0 B      0 B" },
  { kind: "output", text: "✓ Generated 18 static pages", tone: "success" },
  { kind: "blank" },
  { kind: "command", cwd: "storefront", text: "acme deploy --prod" },
  { kind: "task", text: "Uploading build", done: "Uploaded 2.1 MB", duration: 1300 },
  { kind: "output", text: "Production  https://storefront.acme.app", tone: "info" },
];

// A deploy you can watch, skip, or replay. It waits until it's on screen to start typing.
export default function Demo() {
  return (
    <div className="w-full max-w-[540px]">
      <Terminal title="zsh — ~/storefront" lines={session} className="h-[400px]" />
    </div>
  );
}
