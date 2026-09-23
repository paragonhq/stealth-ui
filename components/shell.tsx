import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-[1040px] border-x border-line bg-frame">
      <header className="sticky top-0 z-(--z-sticky) flex h-12 items-center gap-3 border-b border-line bg-frame/80 px-5 backdrop-blur-xl md:px-7">
        <Link href="/" className="text-[13px] font-medium tracking-[-0.01em] text-fg">Stealth UI</Link>
        <span className="font-mono text-[10.5px] text-fg-4">starter</span>
        <nav className="ml-auto flex items-center gap-1">
          <a href="https://stealth.pm/ui" className="rounded-md px-2 py-1 text-[12px] text-fg-3 transition-colors hover:text-fg">Docs</a>
          <a href="https://github.com/paragonhq/stealth-ui" className="rounded-md px-2 py-1 text-[12px] text-fg-3 transition-colors hover:text-fg">GitHub</a>
          <ThemeToggle />
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
