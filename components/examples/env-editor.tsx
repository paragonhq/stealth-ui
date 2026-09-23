"use client";
import { CopyButton } from "@/components/ui/copy-button";
import { type EnvVar, EnvEditor } from "@/components/ui/env-editor";

// Production settings for a web app, with a duplicate LOG_LEVEL left over from
// a copy-paste. Copy the sample below and paste it into any key field.
const initial: EnvVar[] = [
  { id: "db", key: "DATABASE_URL", value: "postgres://app:q8Xv2mLr@db.internal:5432/acme" },
  { id: "redis", key: "REDIS_URL", value: "redis://cache.internal:6379/0" },
  { id: "session", key: "SESSION_SECRET", value: "c3f1b9e07d4a4e2b8f6a1d0c5e9b7a23" },
  { id: "log1", key: "LOG_LEVEL", value: "info" },
  { id: "log2", key: "LOG_LEVEL", value: "debug" },
];

const sample = `# payments
PAYMENTS_SECRET_KEY=sk_demo_51H8xExample4f2a
PAYMENTS_WEBHOOK_SECRET="whsec_9d8e7f6a5b4c"
export MAIL_FROM=billing@acme.dev
REDIS_URL=redis://cache-2.internal:6379/0`;

export default function Demo() {
  return (
    <div className="flex w-full max-w-[540px] flex-col gap-3">
      <EnvEditor defaultValue={initial} title="Production" />
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="min-w-0 text-[12px] text-fg-3">4 keys, one already set</p>
        <CopyButton value={sample} size="sm" label="Copy sample .env" copiedLabel="Now paste it" />
      </div>
    </div>
  );
}
