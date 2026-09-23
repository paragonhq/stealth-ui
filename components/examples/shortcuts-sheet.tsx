"use client";
import { useRef } from "react";
import { Kbd } from "@/components/ui/kbd";
import { ShortcutsSheet, ShortcutsSheetTrigger, type ShortcutGroup } from "@/components/ui/shortcuts-sheet";

const groups: ShortcutGroup[] = [
  {
    heading: "General",
    shortcuts: [
      { keys: "mod+k", label: "Open command menu" },
      { keys: "/", label: "Search" },
      { keys: "?", label: "Show keyboard shortcuts" },
      { keys: "[", label: "Toggle sidebar" },
      { keys: "mod+shift+l", label: "Switch theme", keywords: ["dark", "light"] },
    ],
  },
  {
    heading: "Navigation",
    shortcuts: [
      { keys: "g i", label: "Go to inbox" },
      { keys: "g m", label: "Go to my issues" },
      { keys: "g p", label: "Go to projects" },
      { keys: "j", label: "Next issue" },
      { keys: "k", label: "Previous issue" },
      { keys: "enter", label: "Open issue" },
    ],
  },
  {
    heading: "Issues",
    shortcuts: [
      { keys: "c", label: "Create issue", keywords: ["new"] },
      { keys: "i", label: "Assign to me" },
      { keys: "s", label: "Change status" },
      { keys: "p", label: "Set priority" },
      { keys: "l", label: "Add label", keywords: ["tag"] },
      { keys: "mod+shift+c", label: "Copy issue link" },
      { keys: "mod+backspace", label: "Delete issue", keywords: ["remove"] },
    ],
  },
  {
    heading: "Editor",
    shortcuts: [
      { keys: "mod+b", label: "Bold" },
      { keys: "mod+i", label: "Italic" },
      { keys: "mod+shift+k", label: "Insert link" },
      { keys: "mod+enter", label: "Send comment", keywords: ["submit", "post"] },
      { keys: "mod+z", label: "Undo" },
      { keys: "mod+shift+z", label: "Redo" },
    ],
  },
];

// The sheet opens inside this window. Press ? to open it, then press any shortcut to find it.
export default function Demo() {
  const frame = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={frame}
      tabIndex={-1}
      className="relative flex h-[460px] w-full max-w-[600px] flex-col overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)] outline-none"
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-3">
        <span className="text-[13px] font-medium tracking-[-0.01em] text-fg">Acme</span>
        <ShortcutsSheet groups={groups} container={frame} hotkeyTarget={frame}>
          <ShortcutsSheetTrigger />
        </ShortcutsSheet>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[13px] text-fg-2">Every shortcut in one place</p>
        <p className="text-[12px] text-fg-3">
          Click in the window and press <Kbd keys="?" size="sm" className="mx-0.5" />, then try <Kbd keys="mod+enter" size="sm" className="mx-0.5" />
        </p>
      </div>
    </div>
  );
}
