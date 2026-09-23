"use client";
import { useState } from "react";
import { Cascader, type CascaderOption } from "@/components/ui/cascader";

const offices: CascaderOption[] = [
  {
    value: "americas",
    label: "Americas",
    children: [
      { value: "us", label: "United States", children: [{ value: "nyc", label: "New York" }, { value: "sf", label: "San Francisco" }, { value: "austin", label: "Austin" }, { value: "seattle", label: "Seattle" }] },
      { value: "ca", label: "Canada", children: [{ value: "toronto", label: "Toronto" }, { value: "vancouver", label: "Vancouver" }, { value: "montreal", label: "Montréal" }] },
      { value: "br", label: "Brazil", children: [{ value: "sao-paulo", label: "São Paulo" }, { value: "rio", label: "Rio de Janeiro", hint: "2027", disabled: true }] },
      { value: "mx", label: "Mexico", children: [{ value: "cdmx", label: "Mexico City" }, { value: "guadalajara", label: "Guadalajara" }] },
    ],
  },
  {
    value: "europe",
    label: "Europe",
    children: [
      { value: "gb", label: "United Kingdom", children: [{ value: "london", label: "London" }, { value: "manchester", label: "Manchester" }, { value: "edinburgh", label: "Edinburgh" }] },
      { value: "de", label: "Germany", children: [{ value: "berlin", label: "Berlin" }, { value: "munich", label: "Munich" }, { value: "hamburg", label: "Hamburg" }] },
      { value: "fr", label: "France", children: [{ value: "paris", label: "Paris" }, { value: "lyon", label: "Lyon" }] },
      { value: "nl", label: "Netherlands", children: [{ value: "amsterdam", label: "Amsterdam" }, { value: "rotterdam", label: "Rotterdam" }] },
      { value: "es", label: "Spain", children: [{ value: "madrid", label: "Madrid" }, { value: "barcelona", label: "Barcelona" }] },
      { value: "se", label: "Sweden", children: [{ value: "stockholm", label: "Stockholm" }, { value: "gothenburg", label: "Gothenburg" }] },
      { value: "ba", label: "Bosnia and Herzegovina", children: [{ value: "sarajevo", label: "Sarajevo" }] },
    ],
  },
  {
    value: "apac",
    label: "Asia Pacific",
    children: [
      { value: "jp", label: "Japan", children: [{ value: "tokyo", label: "Tokyo" }, { value: "osaka", label: "Osaka" }] },
      { value: "sg", label: "Singapore", children: [{ value: "singapore", label: "Singapore" }] },
      { value: "au", label: "Australia", children: [{ value: "sydney", label: "Sydney" }, { value: "melbourne", label: "Melbourne" }] },
      { value: "in", label: "India", children: [{ value: "bengaluru", label: "Bengaluru" }, { value: "mumbai", label: "Mumbai" }] },
      { value: "kr", label: "South Korea", children: [{ value: "seoul", label: "Seoul" }] },
    ],
  },
  {
    value: "mea",
    label: "Middle East & Africa",
    children: [
      { value: "ae", label: "United Arab Emirates", children: [{ value: "dubai", label: "Dubai" }] },
      { value: "za", label: "South Africa", children: [{ value: "cape-town", label: "Cape Town" }, { value: "johannesburg", label: "Johannesburg" }] },
      { value: "ke", label: "Kenya", children: [{ value: "nairobi", label: "Nairobi" }] },
    ],
  },
];

// Data residency stops at the country, and a whole region is a valid answer.
const residency: CascaderOption[] = offices.map((r) => ({
  ...r,
  hint: String(r.children?.length ?? 0),
  children: r.children?.map(({ value, label }) => ({ value, label })),
}));

export default function Demo() {
  const [office, setOffice] = useState<string[]>(["europe", "de", "berlin"]);
  const city = office.length === 3 ? offices.flatMap((r) => r.children ?? []).flatMap((c) => c.children ?? []).find((c) => c.value === office[2]) : undefined;

  return (
    <div className="flex w-full max-w-[340px] flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cascader-office" className="text-[12.5px] font-medium text-fg">
          Office
        </label>
        <Cascader
          id="cascader-office"
          options={offices}
          levels={["Region", "Country", "City"]}
          value={office}
          onValueChange={setOffice}
          searchable
          searchPlaceholder="Search cities"
          placeholder="Choose an office"
        />
        <p className="text-[12px] text-fg-3">
          Sets Ana’s working hours and public holidays{city ? ` to ${city.label}` : ""}.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cascader-residency" className="text-[12.5px] font-medium text-fg">
          Data residency
        </label>
        <Cascader id="cascader-residency" options={residency} levels={["Region", "Country"]} selectParents placeholder="Any region" />
        <p className="text-[12px] text-fg-3">Pick a region, or go one level deeper for a single country.</p>
      </div>
    </div>
  );
}
