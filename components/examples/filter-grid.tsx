"use client";
import type { ComponentType } from "react";
import { Code, CreditCard, Image as ImageIcon, Share, Users, type IconProps } from "@/lib/icons";
import { FilterGrid, FilterGridHighlight } from "@/components/ui/filter-grid";

type Template = { id: string; name: string; description: string; category: string; teams: string };

const templates: Template[] = [
  { id: "sprint", name: "Sprint planning", description: "Two-week cycles with capacity, carry-over and a burndown.", category: "engineering", teams: "2.4k" },
  { id: "postmortem", name: "Incident postmortem", description: "Timeline, impact, root cause and follow-ups with owners.", category: "engineering", teams: "1.8k" },
  { id: "changelog", name: "API changelog", description: "Versioned entries with breaking-change flags and migration notes.", category: "engineering", teams: "960" },
  { id: "critique", name: "Design critique", description: "Collect feedback on frames, group it by theme, track decisions.", category: "design", teams: "1.1k" },
  { id: "brand", name: "Brand asset library", description: "Logos, colors and type specimens with usage rules.", category: "design", teams: "740" },
  { id: "budget", name: "Quarterly budget", description: "Plan against actuals by department, with variance per month.", category: "finance", teams: "1.3k" },
  { id: "invoices", name: "Invoice tracker", description: "Due dates, payment status and reminders for overdue accounts.", category: "finance", teams: "2.1k" },
  { id: "vendors", name: "Vendor onboarding", description: "Security review, contracts and approvals in one checklist.", category: "operations", teams: "620" },
  { id: "hiring", name: "Hiring pipeline", description: "Candidates by stage, interview loops and scorecards.", category: "operations", teams: "3.0k" },
  { id: "launch", name: "Launch checklist", description: "Every step from final QA to the announcement, with owners.", category: "marketing", teams: "1.6k" },
  { id: "calendar", name: "Content calendar", description: "Posts, newsletters and campaigns laid out by week.", category: "marketing", teams: "2.7k" },
];

const categories = [
  { value: "engineering", label: "Engineering" },
  { value: "design", label: "Design" },
  { value: "finance", label: "Finance" },
  { value: "operations", label: "Operations" },
  { value: "marketing", label: "Marketing" },
  { value: "legal", label: "Legal" },
];

const glyph: Record<string, ComponentType<IconProps>> = { engineering: Code, design: ImageIcon, finance: CreditCard, operations: Users, marketing: Share };

export default function Demo() {
  return (
    <FilterGrid
      items={templates}
      categories={categories}
      getKey={(t) => t.id}
      getCategory={(t) => t.category}
      getText={(t) => `${t.name} ${t.description}`}
      itemLabel={{ one: "template", other: "templates" }}
      searchPlaceholder="Search templates"
      minItemWidth={164}
      className="h-[440px] w-full max-w-[560px]"
      renderItem={(t, { query }) => {
        const Icon = glyph[t.category] ?? Code;
        return (
          <button
            type="button"
            className="group/card flex w-full flex-col gap-2.5 rounded-xl border border-line bg-raised p-3 text-left shadow-[var(--shadow)] outline-none transition-[border-color,background-color,scale] duration-150 hover:border-line-2 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.985]"
          >
            <span className="flex items-center justify-between">
              <span className="grid size-7 place-items-center rounded-lg border border-line-2 bg-frame text-fg-2 transition-colors duration-150 group-hover/card:text-fg">
                <Icon size={14} />
              </span>
              <span className="text-[11px] text-fg-4 tabular">{t.teams} teams</span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="truncate text-[13px] font-medium tracking-[-0.01em] text-fg">
                <FilterGridHighlight text={t.name} query={query} />
              </span>
              <span className="line-clamp-2 text-[12px] leading-[1.45] text-fg-3">
                <FilterGridHighlight text={t.description} query={query} />
              </span>
            </span>
          </button>
        );
      }}
    />
  );
}
