"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { CommentComposer, type ComposerUser } from "@/components/ui/comment-composer";

const team: ComposerUser[] = [
  { id: "u_mara", name: "Mara Okafor", detail: "Design" },
  { id: "u_jonah", name: "Jonah Park", detail: "Engineering" },
  { id: "u_leo", name: "Leo Brandt", detail: "Engineering" },
  { id: "u_ines", name: "Inès Moreau", detail: "Finance" },
  { id: "u_sam", name: "Sam Whitaker", detail: "Support" },
];

type Posted = { id: number; name: string; body: string };

const initials = (n: string) =>
  n
    .split(" ")
    .map((w) => w[0])
    .join("");

// Commenting on an invoice before it goes out: posted comments land in the list above the field.
export default function Demo() {
  const reduce = useReducedMotion();
  const [posted, setPosted] = useState<Posted[]>([
    { id: 1, name: "Inès Moreau", body: "Net 30 on this one, not Net 15. Their contract changed in August." },
  ]);

  return (
    <div className="w-full max-w-[460px] rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <div className="flex h-11 items-center justify-between border-b border-line px-4">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-fg">INV-2041 · Northwind Labs</p>
        <p className="font-mono text-[11px] text-fg-3 tabular">$18,400</p>
      </div>

      <ul className="flex flex-col gap-3 px-4 pt-3.5">
        <AnimatePresence initial={false}>
          {posted.map((p) => (
            <motion.li
              key={p.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2.5"
            >
              <span aria-hidden className="grid size-6 place-items-center rounded-full bg-hover text-[10px] font-medium text-fg-2 shadow-[inset_0_0_0_1px_var(--line-2)]">
                {initials(p.name)}
              </span>
              <div className="min-w-0">
                <p className="flex h-6 items-center gap-1.5 text-[13px] font-medium text-fg">
                  {p.name}
                  <span className="text-[12px] font-normal text-fg-3">{p.id === 1 ? "1h ago" : "just now"}</span>
                </p>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-5 text-fg">{p.body}</p>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="p-4 pt-3.5">
        <CommentComposer
          author={{ name: "Priya Raman" }}
          users={team}
          draftKey="demo-inv-2041"
          maxLength={500}
          placeholder="Add a comment…"
          onSubmit={({ body }) =>
            new Promise<void>((resolve) =>
              setTimeout(() => {
                setPosted((list) => [...list, { id: list.length + 1, name: "Priya Raman", body }]);
                resolve();
              }, 650),
            )
          }
        />
      </div>
    </div>
  );
}
