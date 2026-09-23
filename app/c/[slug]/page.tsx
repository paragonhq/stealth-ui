import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { Example } from "@/components/example";
import { entries } from "@/lib/catalog";

export const dynamicParams = false;
export const generateStaticParams = () => entries.map((e) => ({ slug: e.slug }));

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = entries.find((x) => x.slug === slug);
  if (!e) notFound();
  return (
    <Shell>
      <section className="px-5 pb-6 pt-10 md:px-7">
        <Link href={`/#${e.category}`} className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-4 transition-colors hover:text-fg-2">← All components</Link>
        <h1 className="mt-4 text-[22px] font-medium leading-[1.15] tracking-[-0.03em] text-fg">{e.name}</h1>
        <p className="mt-2 max-w-[60ch] text-[13px] leading-[1.6] text-fg-2">{e.description}.</p>
        <p className="mt-3 font-mono text-[11px] text-fg-4">
          components/ui/{e.slug}.tsx · <a href={`https://stealth.pm/ui/${e.slug}`} className="underline decoration-line-2 underline-offset-2 transition-colors hover:text-fg-2">docs</a>
        </p>
      </section>
      <div className="px-5 pb-12 md:px-7">
        <Example slug={e.slug} />
      </div>
    </Shell>
  );
}
