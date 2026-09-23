"use client";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Dial } from "@/components/ui/dial";

// Pan reads the way a mixer prints it: L 12, C, R 30.
const panDisplay = (v: number) => (v === 0 ? "C" : { value: Math.abs(v), prefix: v < 0 ? "L " : "R " });

// A vocal channel strip: bipolar gain and pan, a unipolar mix, and a bypass that disables the lot.
export default function Demo() {
  const [bypassed, setBypassed] = useState(false);
  const [cutoff, setCutoff] = useState(4.2);

  return (
    <div className="w-full max-w-[360px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 pl-4 pr-2.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">Lead vocal</p>
          <p className="text-[11.5px] text-fg-3">Bus 2 · Compressor</p>
        </div>
        <button
          type="button"
          aria-pressed={bypassed}
          onClick={() => setBypassed((b) => !b)}
          className={cn(
            "h-7 shrink-0 rounded-md border px-2 text-[12px] font-medium",
            "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] active:duration-75",
            bypassed ? "border-fg bg-fg text-frame" : "border-line-2 text-fg-2 hover:border-fg-4 hover:text-fg",
          )}
        >
          Bypass
        </button>
      </div>

      <div className="grid grid-cols-4 place-items-center gap-y-4 px-3 pb-4 pt-5">
        <Dial label="Gain" min={-24} max={24} step={0.5} defaultValue={3.5} origin={0} unit=" dB" format={{ minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" }} disabled={bypassed} />
        <Dial label="Pan" min={-50} max={50} defaultValue={-12} origin={0} formatDisplay={panDisplay} disabled={bypassed} />
        <Dial label="Mix" defaultValue={72} unit="%" disabled={bypassed} />
        <Dial
          label="Tone"
          dragMode="circular"
          min={0.2}
          max={20}
          step={0.1}
          value={cutoff}
          onValueChange={setCutoff}
          format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
          unit=" kHz"
          disabled={bypassed}
        />
      </div>

      <p className="border-t border-line px-4 py-2.5 text-[11.5px] leading-[1.45] text-fg-3">
        Drag up or down, or turn Tone around. Hold Shift for fine moves; double-click resets.
      </p>
    </div>
  );
}
