"use client";
import { useState } from "react";
import { Listbox, ListboxGroup, ListboxItem } from "@/components/ui/listbox";

const zones = [
  { region: "Americas", items: [["America/Los_Angeles", "Los Angeles", "UTC−7"], ["America/Denver", "Denver", "UTC−6"], ["America/Chicago", "Chicago", "UTC−5"], ["America/New_York", "New York", "UTC−4"], ["America/Sao_Paulo", "São Paulo", "UTC−3"]] },
  { region: "Europe", items: [["Europe/London", "London", "UTC+1"], ["Europe/Paris", "Paris", "UTC+2"], ["Europe/Berlin", "Berlin", "UTC+2"], ["Europe/Helsinki", "Helsinki", "UTC+3"]] },
  { region: "Asia-Pacific", items: [["Asia/Kolkata", "Mumbai", "UTC+5:30"], ["Asia/Singapore", "Singapore", "UTC+8"], ["Asia/Tokyo", "Tokyo", "UTC+9"], ["Australia/Sydney", "Sydney", "UTC+10"]] },
];

const columns = [
  { group: "Details", items: [["title", "Title"], ["status", "Status"], ["assignee", "Assignee"], ["priority", "Priority"], ["labels", "Labels"]] },
  { group: "Dates", items: [["created", "Created"], ["updated", "Updated"], ["due", "Due date"]] },
  { group: "Tracking", items: [["estimate", "Estimate"], ["cycle", "Cycle"]] },
];
const total = columns.reduce((n, g) => n + g.items.length, 0);

// Two inline lists from an app's settings: a single time zone, and which columns a table shows.
export default function Demo() {
  const [zone, setZone] = useState<string | null>("Europe/London");
  const [shown, setShown] = useState(["title", "status", "assignee", "updated"]);

  return (
    <div className="grid w-full max-w-[540px] grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p id="tz-label" className="text-[12.5px] font-medium text-fg-2">
          Time zone
        </p>
        <Listbox aria-labelledby="tz-label" value={zone} onValueChange={setZone} className="h-52 sm:h-64">
          {zones.map((g) => (
            <ListboxGroup key={g.region} label={g.region}>
              {g.items.map(([value, name, offset]) => (
                <ListboxItem key={value} value={value} hint={offset}>
                  {name}
                </ListboxItem>
              ))}
            </ListboxGroup>
          ))}
        </Listbox>
        <p className="truncate font-mono text-2xs text-fg-4">{zone ?? "No zone"}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <p id="cols-label" className="text-[12.5px] font-medium text-fg-2">
          Visible columns
        </p>
        <Listbox multiple aria-labelledby="cols-label" value={shown} onValueChange={setShown} className="h-52 sm:h-64">
          {columns.map((g) => (
            <ListboxGroup key={g.group} label={g.group}>
              {g.items.map(([value, name]) => (
                <ListboxItem key={value} value={value} disabled={value === "title"}>
                  {name}
                </ListboxItem>
              ))}
            </ListboxGroup>
          ))}
        </Listbox>
        <p className="font-mono text-2xs text-fg-4 tabular">
          {shown.length} of {total} shown · Title is always on
        </p>
      </div>
    </div>
  );
}
