"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { ArrowDown, ArrowUp, Monitor, Moon, Pause, Play, Sun, Volume, VolumeOff } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { IconSwap } from "@/components/ui/icon-swap";

const themes = { system: <Monitor />, light: <Sun />, dark: <Moon /> };
const themeNames = { system: "System", light: "Light", dark: "Dark" } as const;
const themeHints = { system: "Follows your device", light: "Always light", dark: "Always dark" } as const;
type Theme = keyof typeof themes;
const cycle: Theme[] = ["system", "light", "dark"];

const files = [
  { name: "q3-forecast.xlsx", when: "2h ago", t: 3 },
  { name: "brand-guidelines.pdf", when: "Yesterday", t: 2 },
  { name: "onboarding-v2.fig", when: "3 days ago", t: 1 },
];

const iconButton =
  "relative grid size-8 shrink-0 place-items-center rounded-lg text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden";

// Three places an icon changes in place: a player's transport, a theme cycle, a sort toggle.
export default function Demo() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [newest, setNewest] = useState(true);
  const reduce = useReducedMotion();
  const sorted = [...files].sort((a, b) => (newest ? b.t - a.t : a.t - b.t));

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-line-2 bg-raised p-2 pr-1.5 shadow-[var(--shadow)]">
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-fg text-frame outline-none transition-[background-color,scale] duration-150 hover:bg-fg/90 active:scale-[0.92] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          <IconSwap value={playing ? "pause" : "play"} icons={{ play: <Play />, pause: <Pause /> }} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium tracking-[-0.005em] text-fg">q3-roadmap-review.m4a</p>
          <p className="truncate text-[12px] text-fg-3">
            Priya Raman · <span className="tabular">12:48</span>
          </p>
        </div>
        <button type="button" aria-label="Mute" aria-pressed={muted} onClick={() => setMuted((m) => !m)} className={iconButton}>
          <IconSwap value={muted ? "off" : "on"} icons={{ on: <Volume />, off: <VolumeOff /> }} />
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-line-2 bg-raised py-2 pl-3.5 pr-2 shadow-[var(--shadow)]">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium tracking-[-0.005em] text-fg">Appearance</p>
          <p className="truncate text-[12px] text-fg-3">{themeHints[theme]}</p>
        </div>
        <button
          type="button"
          aria-label={`Theme: ${themeNames[theme]}`}
          onClick={() => setTheme((t) => cycle[(cycle.indexOf(t) + 1) % cycle.length])}
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          <IconSwap value={theme} icons={themes} variant="rotate" />
          {/* Every name in one cell, so the button keeps the width of the longest. */}
          <span className="grid text-left">
            {cycle.map((t) => (
              <span key={t} aria-hidden className="invisible col-start-1 row-start-1">{themeNames[t]}</span>
            ))}
            <span className="col-start-1 row-start-1">{themeNames[theme]}</span>
          </span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-line-2 bg-raised shadow-[var(--shadow)]">
        <div className="flex h-9 items-center justify-between border-b border-line pl-3.5 pr-1.5">
          <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Files</span>
          <button
            type="button"
            onClick={() => setNewest((n) => !n)}
            aria-label={`Sorted by last updated, ${newest ? "newest" : "oldest"} first. Reverse order`}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
          >
            Last updated
            <IconSwap value={newest ? "down" : "up"} icons={{ up: <ArrowUp size={14} />, down: <ArrowDown size={14} /> }} variant="slide" size={14} />
          </button>
        </div>
        <ul aria-label="Files">
          {sorted.map((f) => (
            <motion.li
              key={f.name}
              layout={reduce ? false : "position"}
              transition={spring.soft}
              className="flex h-9 items-center justify-between gap-3 border-b border-line px-3.5 last:border-b-0"
            >
              <span className="min-w-0 truncate text-[13px] text-fg">{f.name}</span>
              <span className="shrink-0 text-[12px] text-fg-3">{f.when}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
