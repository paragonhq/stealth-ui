"use client";
import { CookieConsent, useCookieConsent } from "@/components/ui/cookie-consent";

const KEY = "stealth-demo-cookie-consent";

const categories = [
  { id: "essential", label: "Essential", description: "Sign-in, security and remembering this choice.", required: true },
  { id: "analytics", label: "Analytics", description: "Anonymous usage, so we know what to fix first." },
  { id: "marketing", label: "Marketing", description: "Measures our ads on other sites." },
];

// A docs site on first visit. Decide, then reopen it from the footer.
export default function Demo() {
  const { consent, decided, reopen } = useCookieConsent(KEY);

  return (
    <div className="relative flex h-[500px] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-line bg-frame">
      <div className="relative flex flex-1 flex-col gap-3 p-6">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-4">Guides</span>
        <p className="text-[20px] font-medium leading-tight tracking-[-0.02em] text-fg">Deploy on push</p>
        <p className="max-w-[46ch] text-[13px] leading-5 text-fg-3">
          Connect a repository and every push to main builds and ships. Preview deploys open for each pull request.
        </p>
        <div className="mt-2 flex flex-col gap-2" aria-hidden>
          {[92, 84, 66].map((w) => (
            <span key={w} className="h-2 rounded-full bg-hover" style={{ width: `${w}%` }} />
          ))}
        </div>
        <CookieConsent contained storageKey={KEY} categories={categories} policyHref="#cookies" />
      </div>

      <footer className="flex h-11 shrink-0 items-center justify-between border-t border-line px-4 text-[12px] text-fg-3">
        <span className="tabular">
          {decided && consent ? `Analytics ${consent.analytics ? "on" : "off"} · Marketing ${consent.marketing ? "on" : "off"}` : "No choice saved yet"}
        </span>
        <button
          type="button"
          onClick={reopen}
          disabled={!decided}
          className="h-7 rounded-md px-2 text-fg-2 outline-none transition-[background-color,color,opacity] duration-150 hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Cookie settings
        </button>
      </footer>
    </div>
  );
}
