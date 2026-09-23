"use client";
import { useCallback, useRef, useState } from "react";
import { Link } from "@/lib/icons";
import { SelectionToolbar, SelectionToolbarButton, SelectionToolbarField, SelectionToolbarSeparator, useSelectionToolbar } from "@/components/ui/selection-toolbar";

type Marks = { bold: boolean; italic: boolean; strike: boolean; link: boolean };
const none: Marks = { bold: false, italic: false, strike: false, link: false };

// The browser's own editing commands keep this demo small; the toolbar itself doesn't care
// what editor sits underneath.
const exec = (cmd: string, value?: string) => document.execCommand(cmd, false, value);
const readMarks = (): Marks => ({
  bold: document.queryCommandState("bold"),
  italic: document.queryCommandState("italic"),
  strike: document.queryCommandState("strikeThrough"),
  link: !!window.getSelection()?.anchorNode?.parentElement?.closest("a"),
});

// A weekly update being edited. Select any words: the toolbar rises over the first line,
// follows the selection as it grows, and turns into a link field without losing it.
export default function Demo() {
  const editor = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<Marks>(none);
  const [mode, setMode] = useState<"format" | "link">("format");

  const onSelectionChange = useCallback((text: string | null) => {
    if (text === null) setMode("format");
    else setMarks(readMarks());
  }, []);

  const run = (cmd: string) => {
    exec(cmd);
    setMarks(readMarks());
  };

  return (
    <div className="w-full max-w-[460px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Weekly update · Sep 22</p>
        <p className="shrink-0 text-[12px] text-fg-3">Saved</p>
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label="Weekly update"
        spellCheck={false}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            setMode("link");
          }
          if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "x") {
            e.preventDefault();
            run("strikeThrough");
          }
        }}
        className="flex flex-col gap-3 px-4 py-4 text-base leading-[1.65] text-fg-2 outline-none sm:text-[13.5px] [&_a]:text-fg [&_a]:underline [&_a]:decoration-fg-4 [&_a]:underline-offset-[3px] [&_b]:font-medium [&_b]:text-fg [&_strike]:decoration-fg-3"
      >
        <p>
          Checkout conversion rose 4.2% after the new address form shipped on Tuesday. Mobile still trails desktop by 11 points, mostly on
          the payment step.
        </p>
        <p>Next week we test saved cards with 10% of returning customers, then decide on the rollout with Maya on Friday.</p>
      </div>
      <p className="border-t border-line px-4 py-2 text-[12px] text-fg-3">
        Select text to format it. <kbd className="font-sans text-fg-2">Alt F10</kbd> reaches the toolbar from the keyboard.
      </p>

      <SelectionToolbar target={editor} label="Formatting" onSelectionChange={onSelectionChange}>
        {mode === "format" ? (
          <>
            <SelectionToolbarButton label="Bold" shortcut={["mod", "B"]} pressed={marks.bold} onClick={() => run("bold")} icon={<Glyph d="M5 3.25h3.6a2.4 2.4 0 0 1 0 4.8H5zm0 4.8h4.1a2.6 2.6 0 0 1 0 5.2H5z" />} />
            <SelectionToolbarButton label="Italic" shortcut={["mod", "I"]} pressed={marks.italic} onClick={() => run("italic")} icon={<Glyph d="M9.75 3.25H6.5m3 9.5H6.25M9.25 3.25 6.75 12.75" />} />
            <SelectionToolbarButton
              label="Strikethrough"
              shortcut={["mod", "shift", "X"]}
              pressed={marks.strike}
              onClick={() => run("strikeThrough")}
              icon={<Glyph d="M2.75 8h10.5M10.9 4.6c-.4-.9-1.5-1.5-2.9-1.5-1.7 0-2.9.9-2.9 2.1 0 .9.5 1.5 1.6 2M5 11.2c.4 1 1.6 1.7 3.1 1.7 1.8 0 3-.9 3-2.2 0-.5-.2-1-.6-1.4" />}
            />
            <SelectionToolbarSeparator />
            <SelectionToolbarButton
              label={marks.link ? "Remove link" : "Link"}
              shortcut={["mod", "K"]}
              pressed={marks.link}
              onClick={() => (marks.link ? run("unlink") : setMode("link"))}
              icon={<Link />}
              showLabel
            />
            <SelectionToolbarSeparator />
            <SelectionToolbarButton label="Clear formatting" onClick={() => run("removeFormat")} icon={<Glyph d="M4 3.25h8M8 3.25l-2 9.5M2.75 12.75h5.5M10.5 9.5l3 3m0-3-3 3" />} />
          </>
        ) : (
          <LinkField
            onDone={(url) => {
              if (url) exec("createLink", /^[a-z]+:/i.test(url) ? url : `https://${url}`);
              setMarks(readMarks());
              setMode("format");
            }}
          />
        )}
      </SelectionToolbar>
    </div>
  );
}

function LinkField({ onDone }: { onDone: (url: string | null) => void }) {
  const { text } = useSelectionToolbar();
  return (
    <SelectionToolbarField
      aria-label={`Link for “${text.slice(0, 40)}”`}
      placeholder="Paste or type a link"
      type="url"
      inputMode="url"
      autoComplete="off"
      enterKeyHint="done"
      submitLabel="Add link"
      onSubmit={(url) => onDone(url)}
      onCancel={() => onDone(null)}
    />
  );
}

function Glyph({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
