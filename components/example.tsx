"use client";
import { useState } from "react";
import { examples } from "./examples";
import { Refresh } from "@/lib/icons";

// A framed stage for one example. Replay remounts it to watch the entrance again.
export function Example({ slug }: { slug: string }) {
  const Demo = examples[slug];
  const [run, setRun] = useState(0);
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-page">
      <button
        type="button"
        onClick={() => setRun((r) => r + 1)}
        aria-label="Replay the example"
        className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-hover hover:text-fg active:scale-[0.92]"
      >
        <Refresh size={14} />
      </button>
      <div key={run} className="relative flex min-h-[420px] items-center justify-center px-5 py-14 md:px-10">
        {Demo ? <Demo /> : null}
      </div>
    </div>
  );
}
