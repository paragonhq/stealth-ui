"use client";
import { TestimonialWall, type Testimonial } from "@/components/ui/testimonial-wall";

// The social-proof section of a deploy product's landing page. Rest the pointer
// on a card to read it; the corner button stops the wall for good.
const testimonials: Testimonial[] = [
  {
    name: "Maya Chen",
    role: "Staff engineer, Northwind",
    quote: "We stopped pulling branches to review UI. Every pull request has a link, and design signs off before we merge.",
  },
  {
    name: "Tomás Herrera",
    role: "CTO, Fieldnote",
    quote: "Rollbacks used to be a war room. Now it’s one click and a message in the channel saying it’s done.",
  },
  {
    name: "Priya Raman",
    role: "Design lead, Ledgerly",
    quote: "Comments pinned to the exact element changed how we review. No more screenshots with red circles.",
  },
  {
    name: "Jonas Albrecht",
    role: "Platform engineer, Kiln & Co",
    quote: (
      <>
        Cold starts went from 1.4s to <strong>under 300ms</strong> after we moved our API to the edge runtime.
      </>
    ),
  },
  {
    name: "Aisha Okafor",
    role: "Founder, Tidepool",
    quote: "Two of us ship like a team of ten. Preview deploys caught three checkout bugs in our first week.",
  },
  {
    name: "Daniel Park",
    role: "Engineering manager, Brightline Health",
    quote: "Audit logs and SSO were the reason legal said yes. The preview links were the reason the team did.",
  },
  {
    name: "Sofia Lindqvist",
    role: "Frontend engineer, Orbit",
    quote: "I open the preview on my phone during standup and leave comments before I’m back at my desk.",
  },
  {
    name: "Marcus Webb",
    role: "Head of infrastructure, Quarry",
    quote: (
      <>
        We moved 140 services over a weekend. <strong>Nothing paged anyone.</strong>
      </>
    ),
  },
  {
    name: "Elena Rossi",
    role: "Product designer, Formwork",
    quote: "Reviewing a real deploy instead of a mockup means the spacing arguments happen before launch, not after.",
  },
];

export default function Demo() {
  return (
    <div className="flex w-full max-w-[760px] flex-col gap-5">
      <div className="flex flex-col gap-1.5 px-1">
        <span className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Customers</span>
        <h2 className="text-[20px] font-medium leading-[1.2] tracking-[-0.02em] text-balance text-fg">Teams that review every change</h2>
      </div>
      <TestimonialWall items={testimonials} height={400} />
    </div>
  );
}
