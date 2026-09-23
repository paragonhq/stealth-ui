"use client";
import { useId, useState } from "react";
import { type Theme, ThemePicker, useResolvedTheme } from "@/components/ui/theme-picker";

// An appearance setting that applies to the panel it lives in, the way it would apply to the whole app.
export default function Demo() {
  const [theme, setTheme] = useState<Theme>("system");
  const resolved = useResolvedTheme(theme);
  const titleId = useId();

  return (
    <div
      data-theme={resolved ?? undefined}
      className="w-full max-w-[480px] rounded-2xl border border-line bg-frame p-5 text-fg transition-[background-color,border-color] duration-300 ease-out-quart motion-reduce:transition-none"
    >
      <div className="mb-4 flex flex-col gap-0.5">
        <h3 id={titleId} className="text-[14px] font-medium leading-5 tracking-[-0.015em] text-fg">
          Interface theme
        </h3>
        <p className="text-[12.5px] leading-[18px] text-fg-3">Pick a theme, or let it follow your device.</p>
      </div>
      <ThemePicker aria-labelledby={titleId} value={theme} onValueChange={setTheme} />
    </div>
  );
}
