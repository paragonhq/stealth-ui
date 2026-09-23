"use client";
import { useEffect, useRef, useState } from "react";
import { type PathItem, PathSegment, PathSwitcher } from "@/components/ui/path-switcher";

const Tile = ({ letter, round }: { letter: string; round?: boolean }) => (
  <span className={`grid size-4 place-items-center bg-fg text-[9px] font-semibold leading-none text-frame ${round ? "rounded-full" : "rounded-[4px]"}`}>{letter}</span>
);
const ProjectMark = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
    <path d="m6 10.25 2-4.5 2 4.5" />
  </svg>
);

const teams: PathItem[] = [
  { id: "riley", name: "Riley Santos", meta: "Hobby", icon: <Tile letter="R" round /> },
  { id: "northwind", name: "Northwind", meta: "Pro", icon: <Tile letter="N" /> },
  { id: "acme", name: "Acme Studio", meta: "Pro", icon: <Tile letter="A" /> },
  { id: "halcyon", name: "Halcyon Labs", meta: "Enterprise", icon: <Tile letter="H" /> },
];

// Mutable so a team created in the demo gets an (empty) project list.
const byTeam: Record<string, string[]> = {
  riley: ["dotfiles", "portfolio"],
  northwind: ["checkout-api", "web", "billing-worker", "docs", "search-indexer"],
  acme: ["studio-site", "brand-kit"],
  halcyon: ["telemetry-pipeline-eu-west-production", "console"],
};
const deploys = ["2m", "1h", "3h", "1d", "4d"];
const projectsOf = (team: string): PathItem[] =>
  byTeam[team].map((p, i) => ({ id: p, name: p, meta: deploys[i % deploys.length], icon: <ProjectMark /> }));

// A dashboard header. Changing the team loads its projects (the project name turns into a
// skeleton for a moment), and every name eases its width so the path never jumps.
export default function Demo() {
  const [team, setTeam] = useState("northwind");
  const [projects, setProjects] = useState(() => projectsOf("northwind"));
  const [project, setProject] = useState<string | null>("checkout-api");
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const switchTeam = (id: string) => {
    setTeam(id);
    setLoading(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const next = projectsOf(id);
      setProjects(next);
      setProject(next[0]?.id ?? null);
      setLoading(false);
    }, 650);
  };

  const [teamList, setTeamList] = useState(teams);
  const createTeam = (typed: string) => {
    const name = typed || `New team ${teamList.length + 1}`;
    const id = `team-${teamList.length + 1}`;
    byTeam[id] = [];
    setTeamList((all) => [...all, { id, name, meta: "Hobby", icon: <Tile letter={name[0].toUpperCase()} /> }]);
    switchTeam(id);
  };
  const createProject = (typed: string) => {
    const name = typed.trim().toLowerCase().replace(/\s+/g, "-") || `project-${projects.length + 1}`;
    setProjects((all) => [...all, { id: name, name, meta: "New", icon: <ProjectMark /> }]);
    setProject(name);
  };

  const when = projects.find((p) => p.id === project)?.meta;
  const lastDeploy = loading ? "…" : !when || when === "New" ? "No deploys yet" : `${when} ago`;

  return (
    <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-frame shadow-[var(--shadow)]">
      <header className="flex h-12 items-center gap-1 border-b border-line pl-3 pr-3">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-label="Home" role="img" className="mr-1 shrink-0 text-fg">
          <path d="M2 13 8 3l6 10z" />
        </svg>
        <PathSwitcher className="flex-1">
          <PathSegment label="Team" items={teamList} value={team} onValueChange={switchTeam} onCreate={createTeam} />
          <PathSegment label="Project" items={projects} value={project} onValueChange={setProject} loading={loading} onCreate={createProject} maxWidth={160} />
        </PathSwitcher>
      </header>
      <div className="grid grid-cols-3 gap-px bg-line max-sm:grid-cols-1">
        {[
          ["Production", "Ready"],
          ["Preview", "3 open"],
          ["Last deploy", lastDeploy],
        ].map(([k, v]) => (
          <div key={k} className="bg-frame px-4 py-3">
            <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-4">{k}</p>
            <p className="mt-1 text-[13px] text-fg-2 tabular">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 p-4">
        {[76, 58, 66].map((w) => (
          <div key={w} className="h-2 rounded-full bg-hover" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}
