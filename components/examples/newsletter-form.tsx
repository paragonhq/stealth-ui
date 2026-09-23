"use client";
import { NewsletterForm } from "@/components/ui/newsletter-form";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The footer of a product blog. Addresses at @example.com are "already on the
// list", so the server error path is one keystroke away; try gmial.com too.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">The Northwind changelog</h3>
        <p className="text-[12.5px] text-fg-2 text-pretty">What shipped this month, and why. Written by the people who built it.</p>
      </div>
      <NewsletterForm
        hint="One email a month. Unsubscribe in one click."
        onSubscribe={async (email) => {
          await pause(1100);
          if (email.toLowerCase().endsWith("@example.com")) throw new Error(`${email} is already subscribed`);
        }}
      />
    </div>
  );
}
