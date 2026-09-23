"use client";
import { useState } from "react";
import { CommentThread, type CommentAuthor, type Thread } from "@/components/ui/comment-thread";

const mara: CommentAuthor = { id: "u_mara", name: "Mara Okafor" };
const jonah: CommentAuthor = { id: "u_jonah", name: "Jonah Park" };
const priya: CommentAuthor = { id: "u_priya", name: "Priya Raman" };
const leo: CommentAuthor = { id: "u_leo", name: "Leo Brandt" };

const min = 60_000;

function seed(now: number): [Thread, Thread] {
  return [
    {
      root: {
        id: "c1",
        author: mara,
        body: "Can we move the monthly/annual toggle above the plan cards? On a phone it sits below three screens of copy, so most people never see the annual price.",
        createdAt: now - 3 * 60 * min,
      },
      replies: [
        { id: "c2", author: jonah, body: "Agreed. Annual converts 2.4× better when it’s visible on load.", createdAt: now - 2 * 60 * min },
        { id: "c3", author: leo, body: "I’ll pin it under the heading and keep it sticky on scroll.", createdAt: now - 95 * min },
        { id: "c4", author: priya, body: "Pushed to the pricing-v3 branch. Preview is up.", createdAt: now - 12 * min, editedAt: now - 10 * min },
      ],
    },
    {
      root: { id: "c5", author: jonah, body: "The Enterprise card says “Contact us” but the button says “Talk to sales”. Pick one.", createdAt: now - 26 * 60 * min },
      replies: [{ id: "c6", author: mara, body: "Going with Talk to sales everywhere.", createdAt: now - 25 * 60 * min }],
      resolved: true,
      resolvedBy: mara,
      resolvedAt: now - 24 * 60 * min,
    },
  ];
}

// A design review on a pricing page: one live thread, one already resolved.
export default function Demo() {
  const [[first, second]] = useState(() => seed(Date.now()));

  return (
    <div className="w-full max-w-[460px] rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
      <div className="flex h-11 items-center justify-between border-b border-line px-4">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">Comments</p>
        <p className="font-mono text-[11px] text-fg-3">pricing / v3</p>
      </div>
      <div className="flex flex-col divide-y divide-line">
        <CommentThread
          defaultThread={first}
          currentUser={priya}
          onReply={() => new Promise((r) => setTimeout(r, 700))}
          className="px-4 py-3.5"
        />
        <CommentThread defaultThread={second} currentUser={priya} className="px-4 py-3.5" />
      </div>
    </div>
  );
}
