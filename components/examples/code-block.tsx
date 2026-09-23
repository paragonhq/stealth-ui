"use client";
import { CodeBlock } from "@/components/ui/code-block";

const route = `import Stripe from "stripe";
import { markInvoicePaid } from "@/lib/billing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  // Reject anything Stripe didn't sign, before touching the payload.
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      await markInvoicePaid(invoice.id, { amount: invoice.amount_paid, currency: invoice.currency });
      break;
    }
    case "customer.subscription.deleted":
      // Access ends at the period end, handled by the nightly job.
      break;
  }

  return Response.json({ received: true });
}
`;

const env = `# Copy to .env.local and fill in from the dashboard
STRIPE_SECRET_KEY=sk_demo_51H8x…
STRIPE_WEBHOOK_SECRET=whsec_…
`;

// A webhook handler you'd paste into a real app, with the lines that matter marked.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[540px] flex-col gap-3">
      <CodeBlock filename="app/api/webhooks/stripe/route.ts" code={route} highlightLines={[[10, 16]]} maxLines={16} />
      <CodeBlock filename=".env.example" lang="shell" code={env} lineNumbers={false} />
    </div>
  );
}
