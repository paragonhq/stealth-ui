"use client";
import { useState } from "react";
import { Bolt, Code, File, Folder, Globe, Lock, Message, Sliders, Sparkle, Terminal, Users } from "@/lib/icons";
import { MegaMenu, MegaMenuContent, MegaMenuFooterLink, MegaMenuItem, MegaMenuLink, MegaMenuSection, MegaMenuTopLink, MegaMenuTrigger } from "@/components/ui/mega-menu";

// A product site's header. Hover across the row: the panel resizes and the content slides the way you moved.
export default function Demo() {
  const [page, setPage] = useState<string | null>(null);
  const link = (title: string) => ({
    href: `#${title.toLowerCase().replace(/\s+/g, "-")}`,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      setPage(title);
    },
  });

  return (
    <div className="flex h-[440px] w-full max-w-[720px] flex-col overflow-hidden rounded-xl border border-line-2 bg-frame shadow-[var(--shadow)]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-3 sm:px-4">
        <a {...link("Home")} aria-label="Northwind home" className="hidden shrink-0 items-center gap-2 rounded-md text-[14px] font-medium tracking-[-0.02em] outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-fg-3 sm:flex">
          <span aria-hidden className="grid size-6 place-items-center rounded-md bg-fg text-[11px] font-semibold text-frame">N</span>
          Northwind
        </a>
        <MegaMenu aria-label="Main" className="sm:ml-2">
          <MegaMenuItem value="product">
            <MegaMenuTrigger>Product</MegaMenuTrigger>
            <MegaMenuContent>
              <div className="grid gap-0.5 sm:w-[480px] sm:grid-cols-2">
                <MegaMenuLink {...link("Issues")} icon={<Bolt />} title="Issues" description="Track work across every team" />
                <MegaMenuLink {...link("Cycles")} icon={<Sliders />} title="Cycles" description="Plan in focused two-week runs" />
                <MegaMenuLink {...link("Insights")} icon={<Sparkle />} title="Insights" description="Charts built from your own data" />
                <MegaMenuLink {...link("Integrations")} icon={<Code />} title="Integrations" description="GitHub, Slack, Figma and 40 more" />
              </div>
              <MegaMenuFooterLink {...link("Changelog")} label="New">
                Insights now export to CSV
              </MegaMenuFooterLink>
            </MegaMenuContent>
          </MegaMenuItem>

          <MegaMenuItem value="solutions">
            <MegaMenuTrigger>Solutions</MegaMenuTrigger>
            <MegaMenuContent>
              <div className="grid gap-1 sm:w-[400px] sm:grid-cols-2">
                <MegaMenuSection title="By team">
                  <MegaMenuLink {...link("Engineering")} title="Engineering" />
                  <MegaMenuLink {...link("Design")} title="Design" />
                  <MegaMenuLink {...link("Product")} title="Product" />
                </MegaMenuSection>
                <MegaMenuSection title="By stage">
                  <MegaMenuLink {...link("Startups")} title="Startups" />
                  <MegaMenuLink {...link("Enterprise")} title="Enterprise" />
                  <MegaMenuLink {...link("Public sector")} title="Public sector" />
                </MegaMenuSection>
              </div>
            </MegaMenuContent>
          </MegaMenuItem>

          <MegaMenuItem value="resources">
            <MegaMenuTrigger>Resources</MegaMenuTrigger>
            <MegaMenuContent>
              <div className="grid gap-2 sm:w-[520px] sm:grid-cols-[1fr_188px]">
                <div className="grid gap-0.5">
                  <MegaMenuLink {...link("Docs")} icon={<File />} title="Docs" description="Guides for every feature" />
                  <MegaMenuLink {...link("API reference")} icon={<Terminal />} title="API reference" description="REST and GraphQL, with examples" />
                  <MegaMenuLink {...link("Community")} icon={<Message />} title="Community" description="Ask questions, share workflows" />
                  <MegaMenuLink {...link("Security")} icon={<Lock />} title="Security" description="SOC 2 report and data handling" />
                </div>
                <a
                  {...link("Customer stories")}
                  className="group/card hidden flex-col justify-end gap-1 rounded-lg border border-line bg-frame p-3 no-underline outline-none transition-[border-color,scale] duration-150 hover:border-line-2 active:scale-[0.985] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 sm:flex"
                >
                  <span aria-hidden className="mb-auto flex -space-x-1.5">
                    {[<Users key="u" />, <Globe key="g" />, <Folder key="f" />].map((icon, i) => (
                      <span key={i} className="grid size-7 place-items-center rounded-full border border-line-2 bg-raised text-fg-3 [&_svg]:size-3.5">
                        {icon}
                      </span>
                    ))}
                  </span>
                  <span className="text-[13px] font-medium tracking-[-0.005em] text-fg">How Halcyon ships weekly</span>
                  <span className="text-[12px] leading-4 text-fg-3">A 40-person team moved from quarterly releases to every Friday.</span>
                </a>
              </div>
            </MegaMenuContent>
          </MegaMenuItem>

          <MegaMenuItem className="hidden sm:block">
            <MegaMenuTopLink {...link("Pricing")}>Pricing</MegaMenuTopLink>
          </MegaMenuItem>
        </MegaMenu>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-3 px-6 pb-8">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-3">{page ?? "Northwind 3.0"}</p>
        <h1 className="max-w-[18ch] text-[28px] font-medium leading-[1.1] tracking-[-0.03em] text-balance">{page ? `${page} at Northwind` : "Plan, build and ship in one place"}</h1>
        <p className="max-w-[46ch] text-[14px] leading-[1.55] text-fg-2">Hover Product, then slide across to Resources. Tab to a trigger and press ↓ to open it from the keyboard.</p>
      </main>
    </div>
  );
}
