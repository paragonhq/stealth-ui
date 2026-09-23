"use client";
import { CodeTabs } from "@/components/ui/code-tabs";

const managers = ["npm", "pnpm", "yarn", "bun"];
const install = { npm: "npm install", pnpm: "pnpm add", yarn: "yarn add", bun: "bun add" } as Record<string, string>;
const run = { npm: "npm run", pnpm: "pnpm", yarn: "yarn", bun: "bun run" } as Record<string, string>;
const tabs = (line: (pm: string) => string) => managers.map((pm) => ({ value: pm, label: pm, code: line(pm), lang: "shell" }));

const client = [
  {
    value: "ts",
    label: "TypeScript",
    filename: "send.ts",
    code: `import { Mail } from "@acme/mail";

const mail = new Mail(process.env.ACME_API_KEY);

await mail.emails.send({
  from: "Billing <billing@acme.dev>",
  to: "maya@northwind.io",
  subject: "Your invoice for September",
});`,
  },
  {
    value: "py",
    label: "Python",
    filename: "send.py",
    code: `import os
from acme import mail

mail.api_key = os.environ["ACME_API_KEY"]

mail.Emails.send({
    "from": "Billing <billing@acme.dev>",
    "to": "maya@northwind.io",
    "subject": "Your invoice for September",
})`,
  },
  {
    value: "go",
    label: "Go",
    filename: "main.go",
    code: `client := mail.NewClient(os.Getenv("ACME_API_KEY"))

_, err := client.Emails.Send(&mail.SendRequest{
    From:    "Billing <billing@acme.dev>",
    To:      []string{"maya@northwind.io"},
    Subject: "Your invoice for September",
})`,
  },
];

// Two install steps that remember the package manager together, and a snippet in three languages.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-[12.5px] text-fg-2">
          <span className="mr-2 font-mono text-2xs text-fg-4">01</span>Install the SDK
        </p>
        <CodeTabs syncKey="package-manager" label="Package manager" items={tabs((pm) => `${install[pm]} @acme/mail`)} />
        <p className="mt-2 text-[12.5px] text-fg-2">
          <span className="mr-2 font-mono text-2xs text-fg-4">02</span>Start the dev server
        </p>
        <CodeTabs syncKey="package-manager" label="Package manager" items={tabs((pm) => `${run[pm]} dev`)} />
      </div>
      <CodeTabs syncKey="language" label="Language" items={client} lineNumbers />
    </div>
  );
}
