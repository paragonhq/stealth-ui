"use client";
import { useState } from "react";
import { AsyncCombobox, Highlight } from "@/components/ui/async-combobox";

type Repo = { id: string; name: string; description: string; language: string; stars: number };

const repos: Repo[] = [
  ["acme/web", "Marketing site and docs", "TypeScript", 1240],
  ["acme/dashboard", "The customer dashboard", "TypeScript", 3180],
  ["acme/api", "Public REST and webhooks API", "Go", 2410],
  ["acme/api-gateway", "Edge routing, auth and rate limits", "Rust", 860],
  ["acme/billing", "Invoices, metering and payouts", "Go", 540],
  ["acme/billing-worker", "Queue consumers for usage events", "Go", 120],
  ["acme/mobile", "iOS and Android app", "Swift", 1920],
  ["acme/design-system", "Tokens, components and icons", "TypeScript", 4310],
  ["acme/infra", "Terraform for every environment", "HCL", 310],
  ["acme/search", "Indexing and relevance tuning", "Python", 690],
  ["acme/data-pipeline", "Nightly warehouse loads", "Python", 275],
  ["acme/cli", "The acme command-line tool", "Rust", 1570],
  ["acme/docs", "Guides and API reference", "MDX", 830],
  ["acme/status-page", "Uptime and incident history", "TypeScript", 95],
  ["acme/email-templates", "Transactional email in MJML", "HTML", 64],
  ["acme/sdk-js", "JavaScript and TypeScript SDK", "TypeScript", 2250],
  ["acme/sdk-python", "Python SDK", "Python", 980],
].map(([name, description, language, stars]) => ({ id: name as string, name: name as string, description: description as string, language: language as string, stars: stars as number }));

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

// Connecting a repository to a project, searched on a server that takes its time.
export default function Demo() {
  const [failNext, setFailNext] = useState(false);

  // A pretend API: 350–900ms of latency, aborts when asked, fails when told to.
  const search = (query: string, { signal }: { signal: AbortSignal }) =>
    new Promise<Repo[]>((resolve, reject) => {
      const latency = 350 + ((query.length * 173) % 550);
      const t = window.setTimeout(() => {
        if (failNext) {
          setFailNext(false);
          return reject(new Error("Network error"));
        }
        const q = query.toLowerCase();
        resolve(repos.filter((r) => r.name.includes(q) || r.description.toLowerCase().includes(q) || r.language.toLowerCase() === q));
      }, latency);
      signal.addEventListener("abort", () => {
        window.clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-4 rounded-xl border border-line bg-frame p-4 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-0.5">
        <p className="text-[14px] font-medium tracking-[-0.015em] text-fg">Connect a repository</p>
        <p className="text-[12.5px] text-fg-3">Deploys run on every push to the default branch.</p>
      </div>
      <AsyncCombobox<Repo>
        label="Repository"
        placeholder="Search acme repositories"
        noun="repositories"
        search={search}
        getKey={(r) => r.id}
        getLabel={(r) => r.name}
        suggestions={repos.slice(0, 3)}
        suggestionsLabel="Recently deployed"
        renderItem={(r, query) => (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate font-mono text-[12.5px]">
                <Highlight text={r.name} query={query} />
              </span>
              <span className="shrink-0 font-mono text-2xs text-fg-4 tabular">★ {fmt(r.stars)}</span>
            </span>
            <span className="truncate text-[12px] text-fg-3">
              {r.language} · {r.description}
            </span>
          </span>
        )}
      />
      <label className="flex w-fit cursor-pointer items-center gap-2 text-[12px] text-fg-3 select-none">
        <input
          type="checkbox"
          checked={failNext}
          onChange={(e) => setFailNext(e.target.checked)}
          className="size-3.5 cursor-pointer appearance-none rounded-[4px] border border-line-2 bg-raised transition-colors checked:border-fg checked:bg-fg focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 focus-visible:outline-solid"
        />
        Fail the next request
      </label>
    </div>
  );
}
