import Link from "next/link";
import { Shell } from "@/components/shell";
import { categories, entries } from "@/lib/catalog";

// The gallery: every component in the library, grouped the way the docs group them.
// Delete this page when you start building; the components stay in components/ui.
export default function Home() {
  return (
    <Shell>
      <section className="border-b border-line px-5 pb-8 pt-12 md:px-7">
        <h1 className="text-[22px] font-medium leading-[1.15] tracking-[-0.03em] text-fg">Every component, ready</h1>
        <p className="mt-2.5 max-w-[60ch] text-[13px] leading-[1.6] text-fg-2">
          {entries.length} components live in <code className="font-mono text-[12px] text-fg">components/ui</code>, each with its example in{" "}
          <code className="font-mono text-[12px] text-fg">components/examples</code>. Open one to see it working, then build on top.
        </p>
      </section>
      {categories.map((c, i) => {
        const list = entries.filter((e) => e.category === c.key);
        return (
          <section key={c.key} id={c.key} className="scroll-mt-14 px-3 pb-3 pt-6 md:px-5">
            <header className="mb-2 flex items-baseline gap-2.5 px-2.5">
              <span className="font-mono text-[10.5px] tabular text-fg-4">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="text-[14px] font-medium tracking-[-0.015em] text-fg">{c.title}</h2>
              <p className="hidden truncate text-[12.5px] text-fg-3 sm:block">{c.blurb}</p>
              <span className="ml-auto font-mono text-[10.5px] tabular text-fg-4">{list.length}</span>
            </header>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((e) => (
                <li key={e.slug} className="group relative rounded-lg px-2.5 py-2 transition-colors hover:bg-hover">
                  <Link href={`/c/${e.slug}`} className="text-[13px] font-medium tracking-[-0.01em] text-fg outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-solid focus-visible:after:outline-1 focus-visible:after:outline-fg-3">
                    {e.name}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.5] text-fg-3 transition-colors group-hover:text-fg-2">{e.description}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <footer className="mt-10 border-t border-line px-5 py-5 text-[11.5px] text-fg-4 md:px-7">
        Made by Paragon · <a href="https://www.stealth.pm/ui" className="transition-colors hover:text-fg-2">stealth.pm/ui</a>
      </footer>
    </Shell>
  );
}
