"use client";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { MobileMenu, MobileMenuClose } from "@/components/ui/mobile-menu";
import { Navbar, NavbarActions, NavbarBrand, NavbarLink, NavbarLinks, NavbarMobile } from "@/components/ui/navbar";

const sections = [
  { id: "product", label: "Product" },
  { id: "customers", label: "Customers" },
  { id: "pricing", label: "Pricing" },
  { id: "changelog", label: "Changelog" },
];

const btn =
  "h-8 items-center rounded-full px-3.5 text-[13px] font-medium outline-none transition-[background-color,scale] duration-150 active:scale-[0.97] active:duration-75 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3";

// A product site in a small window. Scroll it: the bar compacts and the pill follows the section you're reading.
export default function Demo() {
  const frame = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("product");
  const reduce = useReducedMotion();
  // While a click scrolls the page, the spy stands down so the pill doesn't tour every section on the way.
  const jumping = useRef(0);

  useEffect(() => {
    const el = page.current;
    if (!el) return;
    const spy = () => {
      if (jumping.current) return;
      const y = el.scrollTop + 96;
      let current = sections[0]!.id;
      for (const s of sections) if ((el.querySelector<HTMLElement>(`#nb-${s.id}`)?.offsetTop ?? Infinity) <= y) current = s.id;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) current = sections[sections.length - 1]!.id;
      setActive(current);
    };
    el.addEventListener("scroll", spy, { passive: true });
    return () => {
      el.removeEventListener("scroll", spy);
      window.clearTimeout(jumping.current);
    };
  }, []);

  const go = (id: string, e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const el = page.current;
    const target = el?.querySelector<HTMLElement>(`#nb-${id}`);
    if (!el || !target) return;
    setActive(id);
    window.clearTimeout(jumping.current);
    jumping.current = window.setTimeout(() => (jumping.current = 0), reduce ? 50 : 700);
    el.scrollTo({ top: id === "product" ? 0 : target.offsetTop - 48, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div ref={frame} className="relative h-[440px] w-full max-w-[720px] overflow-hidden rounded-xl border border-line-2 bg-frame shadow-[var(--shadow)]">
      <div ref={page} className="h-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin]">
        <Navbar target={page}>
          <NavbarBrand href="#nb-product" onClick={(e) => go("product", e)}>
            <span aria-hidden className="grid size-6 place-items-center rounded-md bg-fg text-[11px] font-semibold text-frame">N</span>
            Northwind
          </NavbarBrand>
          <NavbarLinks>
            {sections.map((s) => (
              <NavbarLink key={s.id} href={`#nb-${s.id}`} active={active === s.id} onClick={(e) => go(s.id, e)}>
                {s.label}
              </NavbarLink>
            ))}
          </NavbarLinks>
          <NavbarActions>
            <a href="#nb-pricing" onClick={(e) => go("pricing", e)} className={cn(btn, "hidden text-fg-2 hover:bg-hover hover:text-fg @min-[40rem]:inline-flex")}>
              Sign in
            </a>
            <a href="#nb-pricing" onClick={(e) => go("pricing", e)} className={cn(btn, "inline-flex bg-fg text-frame hover:bg-fg/90")}>
              Start for free
            </a>
          </NavbarActions>
          <NavbarMobile>
            <MobileMenu
              container={frame}
              current={`#nb-${active}`}
              items={sections.map((s) => ({ label: s.label, href: `#nb-${s.id}` }))}
              onNavigate={(item, e) => go(item.href!.slice(4), e)}
              footer={
                <MobileMenuClose onClick={() => go("pricing")} className={cn(btn, "flex h-11 justify-center border border-line-2 bg-raised text-[15px] text-fg")}>
                  Sign in
                </MobileMenuClose>
              }
            />
          </NavbarMobile>
        </Navbar>

        <section id="nb-product" className="flex min-h-[340px] flex-col items-start justify-center gap-4 px-6 pb-12 pt-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">Northwind 3.0</p>
          <h1 className="max-w-[16ch] text-[30px] font-medium leading-[1.08] tracking-[-0.03em] text-balance">Plan, build and ship in one place</h1>
          <p className="max-w-[44ch] text-[14px] leading-[1.55] text-fg-2">Issues, cycles and roadmaps for teams that would rather be building. Scroll this page to see the bar settle.</p>
        </section>

        <section id="nb-customers" className="border-t border-line px-6 py-12">
          <h2 className="text-[15px] font-medium tracking-[-0.015em]">Trusted by 4,000 teams</h2>
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {["Acme Freight", "Halcyon", "Brightwave", "Oakline"].map((n) => (
              <li key={n} className="grid h-14 place-items-center rounded-lg border border-line text-[13px] font-medium tracking-[-0.01em] text-fg-3">
                {n}
              </li>
            ))}
          </ul>
        </section>

        <section id="nb-pricing" className="border-t border-line px-6 py-12">
          <h2 className="text-[15px] font-medium tracking-[-0.015em]">Pricing</h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              ["Free", "$0", "Up to 3 people"],
              ["Team", "$12", "Per person, monthly"],
              ["Business", "$24", "SSO and audit log"],
            ].map(([plan, price, note]) => (
              <li key={plan} className="flex flex-col gap-1 rounded-lg border border-line bg-raised p-4">
                <span className="text-[12.5px] text-fg-2">{plan}</span>
                <span className="text-[22px] font-medium tabular tracking-[-0.02em]">{price}</span>
                <span className="text-[12px] text-fg-3">{note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="nb-changelog" className="min-h-[300px] border-t border-line px-6 py-12">
          <h2 className="text-[15px] font-medium tracking-[-0.015em]">Changelog</h2>
          <ol className="mt-5 flex flex-col gap-4">
            {[
              ["18 Sep 2026", "Cycles can now overlap across teams"],
              ["4 Sep 2026", "Insights export to CSV"],
              ["21 Aug 2026", "Faster search in large workspaces"],
            ].map(([date, text]) => (
              <li key={date} className="flex gap-4 text-[13px]">
                <span className="w-24 shrink-0 font-mono text-[11.5px] leading-5 text-fg-3">{date}</span>
                <span className="text-fg-2">{text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
