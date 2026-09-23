"use client";
import { CopyButton } from "@/components/ui/copy-button";

// Three places a copy button actually lives: a command, a secret, a share link.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-raised pl-3 pr-1 font-mono text-[12px] text-fg-2">
        <span className="text-fg-4">$</span>
        <span className="flex-1 truncate">npx stealth add copy-button</span>
        <CopyButton value="npx stealth add copy-button" iconOnly variant="ghost" size="sm" label="Copy command" />
      </div>

      <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-raised pl-3 pr-1">
        <span className="text-[12px] text-fg-3">API key</span>
        <span className="flex-1 truncate font-mono text-[12px] tracking-[0.02em] text-fg">sk_demo_••••••••4f2a</span>
        <CopyButton value={() => "sk_demo_51H8xStealthExample4f2a"} size="sm" />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[12px] text-fg-3">When the clipboard says no:</p>
        <CopyButton
          value={() => Promise.reject(new Error("Blocked"))}
          label="Copy link"
          copiedLabel="Link copied"
          failedLabel="Couldn’t copy"
        />
      </div>
    </div>
  );
}
