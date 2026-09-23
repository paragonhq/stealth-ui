"use client";
import { useState } from "react";
import { ArrowUp, Paperclip } from "@/lib/icons";
import { ModelPicker, type Model } from "@/components/ui/model-picker";

const models: Model[] = [
  {
    value: "atlas-2-mini",
    name: "Atlas 2 Mini",
    group: "Everyday",
    description: "Quick answers, rewrites and summaries",
    capabilities: ["tools"],
    speed: 3,
    cost: 1,
  },
  {
    value: "atlas-2",
    name: "Atlas 2",
    group: "Everyday",
    description: "Balanced for most work, reads images and files",
    capabilities: ["vision", "tools", "long-context"],
    speed: 2,
    cost: 2,
  },
  {
    value: "atlas-2-pro",
    name: "Atlas 2 Pro",
    group: "Deep work",
    tag: "New",
    description: "Thinks before answering; best for code and analysis",
    capabilities: ["reasoning", "vision", "tools", "code"],
    speed: 1,
    cost: 3,
  },
  {
    value: "atlas-research",
    name: "Atlas Research",
    group: "Deep work",
    description: "Browses and cites dozens of sources",
    capabilities: ["web", "reasoning"],
    speed: 1,
    cost: 3,
    disabled: true,
    disabledReason: "Available on the Team plan",
  },
];

// The picker where it usually lives: the bottom row of a composer, opening upward.
export default function Demo() {
  const [model, setModel] = useState("atlas-2");
  const [text, setText] = useState("");

  return (
    <div className="flex h-[460px] w-full max-w-[520px] flex-col justify-end">
      <div className="rounded-2xl border border-line-2 bg-raised shadow-[var(--shadow)] transition-[border-color,box-shadow] duration-150 has-[textarea:focus]:border-fg-4 has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-fg/10">
        <label htmlFor="demo-composer" className="sr-only">
          Message
        </label>
        <textarea
          id="demo-composer"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about the Q3 forecast…"
          className="block w-full resize-none bg-transparent px-3.5 pt-3 text-base leading-6 text-fg outline-none placeholder:text-fg-4 sm:text-[13.5px]"
        />
        <div className="flex items-center gap-1 p-2 pt-1">
          <button
            type="button"
            aria-label="Attach a file"
            className="grid size-7 place-items-center rounded-md text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3"
          >
            <Paperclip />
          </button>
          <ModelPicker models={models} value={model} onValueChange={setModel} side="top" shortcut="/" />
          <button
            type="button"
            aria-label="Send message"
            disabled={!text.trim()}
            className="ms-auto grid size-7 place-items-center rounded-full bg-fg text-frame outline-none transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.92] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:opacity-30"
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
