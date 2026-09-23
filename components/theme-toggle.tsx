"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@/lib/icons";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"), []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="grid size-8 place-items-center rounded-lg text-fg-3 transition-colors hover:bg-hover hover:text-fg active:scale-[0.94]"
    >
      {theme === "dark" ? <Moon /> : <Sun />}
    </button>
  );
}
