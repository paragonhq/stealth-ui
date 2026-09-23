"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { highlight } from "sugar-high";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { Prose, type ProseProps } from "@/components/ui/prose";

const verify = `import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(body: string, header: string, secret: string) {
  const [timestamp, signature] = header.split(",");
  const expected = createHmac("sha256", secret).update(\`\${timestamp}.\${body}\`).digest("hex");
  // Constant time, so the comparison can't leak how much of it matched.
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}`;

const retries = [
  ["1", "Immediately", "0 s"],
  ["2", "30 s", "30 s"],
  ["3", "5 min", "5.5 min"],
  ["4", "30 min", "36 min"],
  ["5", "2 h", "2.6 h"],
  ["6", "12 h", "14.6 h"],
];

const sizes: { value: NonNullable<ProseProps["size"]>; label: string }[] = [
  { value: "sm", label: "Compact" },
  { value: "md", label: "Docs" },
  { value: "lg", label: "Reading" },
];

// A docs page in a scrolling panel: hover a heading for its link, hover or focus the code
// to copy it, and switch the size to see the whole rhythm scale together.
export default function Demo() {
  const [size, setSize] = useState<NonNullable<ProseProps["size"]>>("md");
  const reduce = useReducedMotion();

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <div role="radiogroup" aria-label="Text size" className="relative flex self-start rounded-lg border border-line bg-raised p-0.5">
        {sizes.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={size === s.value}
            onClick={() => setSize(s.value)}
            onKeyDown={(e) => {
              const i = sizes.findIndex((x) => x.value === size);
              const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
              if (next === null) return;
              e.preventDefault();
              const target = sizes[(next + sizes.length) % sizes.length];
              setSize(target.value);
              (e.currentTarget.parentElement?.children[sizes.indexOf(target)] as HTMLElement | undefined)?.focus();
            }}
            tabIndex={size === s.value ? 0 : -1}
            className={cn(
              "relative h-7 rounded-md px-2.5 text-[12px] font-medium outline-none transition-[color,scale] duration-150 active:scale-[0.97] active:duration-75",
              "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
              size === s.value ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {size === s.value && (
              <motion.span
                layoutId="prose-demo-size"
                transition={reduce ? { duration: 0 } : spring.snappy}
                className="absolute inset-0 rounded-md bg-hover shadow-[var(--shadow)]"
              />
            )}
            <span className="relative">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="max-h-[440px] overflow-y-auto overscroll-contain rounded-xl border border-line bg-frame px-5 py-6 sm:px-8 sm:py-7">
        <Prose size={size}>
          <h1>Verifying webhook signatures</h1>
          <p>
            Every webhook carries a signature, so you can check it came from Northwind and wasn’t changed on the way. Verify it before you trust
            anything in the body.
          </p>

          <h2>How signing works</h2>
          <p>
            We compute an HMAC-SHA256 of the <strong>raw request body</strong> with your endpoint’s secret and send it in the{" "}
            <code>Northwind-Signature</code> header, next to a timestamp. The{" "}
            <a href="https://docs.northwind.co/security" target="_blank" rel="noopener" onClick={(e) => e.preventDefault()}>
              security overview
            </a>{" "}
            covers how secrets are stored.
          </p>
          <ol>
            <li>Read the raw body before any JSON parsing.</li>
            <li>
              Build the signed payload as <code>{"{timestamp}.{body}"}</code>.
            </li>
            <li>Compare it to the header in constant time.</li>
          </ol>
          <pre data-language="ts">
            <code dangerouslySetInnerHTML={{ __html: highlight(verify) }} />
          </pre>
          <blockquote>
            <p>
              Rotating a secret? The old one keeps working for 24 hours, so a deploy never drops events. Press <kbd>⌘</kbd> <kbd>K</kbd> and search
              for “webhooks” to find it.
            </p>
          </blockquote>

          <h3>Retry schedule</h3>
          <p>Failed deliveries retry with exponential backoff for up to three days, then the endpoint is paused and you get an email.</p>
          <table>
            <thead>
              <tr>
                <th>Attempt</th>
                <th align="right">Delay</th>
                <th align="right">Elapsed</th>
              </tr>
            </thead>
            <tbody>
              {retries.map(([n, delay, total]) => (
                <tr key={n}>
                  <td>{n}</td>
                  <td align="right">{delay}</td>
                  <td align="right">{total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered rich text, as a CMS would send it */}
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1100&q=70"
              alt="An analytics dashboard with delivery charts on a laptop screen"
              width={1100}
              height={733}
              loading="lazy"
            />
            <figcaption>Each retry shows up in the delivery log within a few seconds, with the response your server sent.</figcaption>
          </figure>

          <h3>Before you go live</h3>
          <ul>
            <li>
              <input type="checkbox" checked readOnly disabled /> Keep the secret out of source control
            </li>
            <li>
              <input type="checkbox" checked readOnly disabled /> Reject timestamps older than five minutes
            </li>
            <li>
              <input type="checkbox" readOnly disabled /> Respond with a 2xx within 10 seconds, then do the work
            </li>
          </ul>
          <details>
            <summary>Why compare in constant time?</summary>
            <p>
              A normal comparison stops at the first different character, so how long it takes reveals how much of a forged signature was right.
              Constant time takes the same time either way.
            </p>
          </details>
        </Prose>
      </div>
    </div>
  );
}
