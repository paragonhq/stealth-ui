"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ease } from "@/lib/motion";
import { ChecklistAction, OnboardingChecklist, type ChecklistTask } from "@/components/ui/onboarding-checklist";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const tasks: ChecklistTask[] = [
  { id: "project", title: "Create a project", description: "Name it and pick a region close to your users.", minutes: 1 },
  { id: "repo", title: "Connect a Git repository", description: "Every push to main deploys a preview.", minutes: 2 },
  {
    id: "team",
    title: "Invite your team",
    description: "Reviewers get comments on every preview, and on-call gets the alerts.",
    minutes: 2,
    action: <ChecklistAction onAction={() => wait(900)} pendingLabel="Sending invites…">Invite teammates</ChecklistAction>,
  },
  {
    id: "deploy",
    title: "Deploy to production",
    description: "Promote the latest preview of checkout-web. It takes about a minute.",
    minutes: 4,
    action: <ChecklistAction onAction={() => wait(1400)} pendingLabel="Deploying…">Deploy now</ChecklistAction>,
  },
  {
    id: "domain",
    title: "Add a custom domain",
    description: "Point shop.northwind.dev at this project. You can do this later.",
    minutes: 3,
    optional: true,
    action: <ChecklistAction>Add domain</ChecklistAction>,
  },
];

// A dashboard's first-run card, two tasks in. Finish the rest to see it close the loop.
export default function Demo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex w-full max-w-[400px] flex-col items-center">
      <OnboardingChecklist tasks={tasks} defaultCompleted={["project", "repo"]} title="Set up checkout-web" open={open} onOpenChange={setOpen} />
      <AnimatePresence initial={false}>
        {!open && (
          <motion.p
            key="hidden"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: ease.out, delay: 0.12 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="flex items-center gap-2 text-[12.5px] text-fg-3"
          >
            Checklist hidden.
            {/* Mounts only after hiding, so it catches the focus the close button took with it. */}
            <button
              type="button"
              autoFocus
              onClick={() => setOpen(true)}
              className="rounded-sm text-fg underline decoration-fg-4 underline-offset-[3px] outline-none transition-[text-decoration-color] hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
            >
              Show it again
            </button>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
