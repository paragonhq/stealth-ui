"use client";
import { InstallCommand } from "@/components/ui/install-command";

// A getting-started page: three commands that all follow one package manager choice.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-4">
      <Step n="01" title="Create the app">
        <InstallCommand action="create" args="acme-app@latest storefront" />
      </Step>
      <Step n="02" title="Add the SDK">
        <InstallCommand args="@acme/mail" />
      </Step>
      <Step n="03" title="Add the CLI and types">
        <InstallCommand action="dev" args="@acme/cli typescript @types/node" />
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-fg-2">
        <span className="mr-2 font-mono text-2xs text-fg-4">{n}</span>
        {title}
      </p>
      {children}
    </div>
  );
}
