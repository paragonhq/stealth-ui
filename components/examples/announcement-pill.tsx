"use client";
import { AnnouncementPill } from "@/components/ui/announcement-pill";

// The top of a product page, where the pill actually lives, and the two quieter
// forms it takes in a changelog and a footer of links.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[480px] flex-col items-center gap-10">
      <section className="flex flex-col items-center gap-5 text-center">
        <AnnouncementPill href="#agent-mode" badge="New">
          Agent mode is here
        </AnnouncementPill>
        <div className="flex flex-col items-center gap-2.5">
          <h2 className="max-w-[16ch] text-[28px] font-medium leading-[1.08] tracking-[-0.03em] text-balance text-fg sm:text-[32px]">
            Review every change before it ships
          </h2>
          <p className="max-w-[40ch] text-[13.5px] leading-[1.55] text-pretty text-fg-2">
            Preview deploys for each pull request, with comments pinned to the pixel your teammate meant.
          </p>
        </div>
      </section>

      <div className="flex w-full flex-col items-center gap-3 border-t border-line pt-6">
        <AnnouncementPill href="#changelog-2-4" badge="v2.4" badgeVariant="soft" size="sm">
          Cold starts are 40% faster on the edge runtime
        </AnnouncementPill>
        <AnnouncementPill href="https://blog.example.com/agent-mode" size="sm">
          Read the launch post
        </AnnouncementPill>
      </div>
    </div>
  );
}
