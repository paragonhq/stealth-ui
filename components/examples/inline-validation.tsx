"use client";
import { InlineValidation } from "@/components/ui/inline-validation";

const taken = new Set(["maya", "admin", "design", "northwind", "support", "team"]);
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

// Claiming a workspace handle: checked as you type once you pause,
// plus a domain that is only verified when you leave the field.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-frame p-5 shadow-[var(--shadow)]">
        <InlineValidation
          label="Handle"
          name="handle"
          required
          start="stealth.pm/"
          placeholder="your-team"
          description="Letters, numbers and dashes. This becomes your public URL."
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          checkingMessage="Checking availability…"
          validMessage={(v) => (
            <>
              <span className="font-medium">stealth.pm/{v}</span> is available
            </>
          )}
          validate={async (v, { signal }) => {
            if (!/^[a-z0-9-]+$/i.test(v)) return "Use only letters, numbers and dashes";
            if (v.length < 3) return "Use at least 3 characters";
            await wait(350 + Math.random() * 500, signal);
            if (taken.has(v.toLowerCase())) return `${v} is taken. Try ${v}-hq or ${v}-studio`;
            return null;
          }}
        />

        <InlineValidation
          label="Custom domain"
          name="domain"
          optional
          trigger="blur"
          placeholder="docs.company.com"
          defaultValue="docs.northwind"
          description="Checked when you leave the field."
          inputClassName="font-mono sm:text-[12.5px]"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          checkingMessage="Looking up DNS records…"
          validMessage="CNAME found. SSL will be ready in a few minutes."
          errorMessage="Couldn’t reach the DNS resolver."
          validate={async (v, { signal }) => {
            await wait(700, signal);
            if (v.endsWith(".local")) throw new Error("Resolver timed out");
            if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+\.[a-z]{2,}$/i.test(v)) return "Enter a full domain, like docs.northwind.com";
            if (!v.includes("northwind")) return `No CNAME record for ${v}. Point it to cname.stealth.pm`;
            return null;
          }}
        />
      </div>
      <p className="text-center text-[12px] text-fg-3">
        Try a taken handle like <span className="font-mono text-fg-2">maya</span>, or a domain ending in{" "}
        <span className="font-mono text-fg-2">.local</span> to see a failed check.
      </p>
    </div>
  );
}
