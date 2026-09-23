"use client";
import { useRef, useState } from "react";
import { SettingsGroup, SettingsRow, SettingsSelect, SettingsSwitch, useSettingsRow } from "@/components/ui/settings-row";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A notifications page: switches that save, a select, a connect button, and one save that fails the first time.
export default function Demo() {
  const failed = useRef(false);

  return (
    <div className="w-full max-w-[480px]">
      <SettingsGroup headingLevel={3} title="Notifications" description="Where we reach you about activity in Acme Web." footer="Security alerts are always on and can’t be turned off.">
        <SettingsRow label="Product updates" description="Release notes and new features, about twice a month.">
          <SettingsSwitch defaultChecked onCheckedChange={() => wait(700)} />
        </SettingsRow>
        <SettingsRow label="Activity digest" description="A summary of comments and deploys you missed.">
          <SettingsSelect
            defaultValue="weekly"
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "never", label: "Never" },
            ]}
            onValueChange={() => wait(500)}
          />
        </SettingsRow>
        <SettingsRow label="Mentions on mobile" description="Push a notification when a teammate mentions you.">
          <SettingsSwitch
            onCheckedChange={async () => {
              await wait(900);
              // The first save fails so the error and Try again can be seen.
              if (!failed.current) {
                failed.current = true;
                throw new Error("Timed out");
              }
            }}
          />
        </SettingsRow>
        <SlackRow />
      </SettingsGroup>
    </div>
  );
}

function SlackRow() {
  const [connected, setConnected] = useState(false);
  return (
    <SettingsRow
      label="Slack"
      badge="Beta"
      description={
        connected ? (
          <>
            Posting to <span className="text-fg-2">#eng-alerts</span> in the Acme workspace.
          </>
        ) : (
          "Send deploy and incident alerts to a channel."
        )
      }
    >
      <ConnectButton connected={connected} onConnectedChange={setConnected} />
    </SettingsRow>
  );
}

// Any control can report a save to its row through useSettingsRow().track.
function ConnectButton({ connected, onConnectedChange }: { connected: boolean; onConnectedChange: (next: boolean) => void }) {
  const row = useSettingsRow();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      aria-describedby={row?.descriptionId}
      aria-busy={busy || undefined}
      onClick={() => {
        if (busy) return;
        const next = !connected;
        setBusy(true);
        const save = wait(800).then(() => onConnectedChange(next));
        row?.track(save);
        save.finally(() => setBusy(false));
      }}
      className="relative inline-grid h-8 shrink-0 items-center rounded-lg border border-line-2 bg-raised px-2.5 text-[12.5px] font-medium text-fg shadow-[var(--shadow)] outline-none transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97] active:duration-75"
    >
      <span aria-hidden className="invisible col-start-1 row-start-1">
        Disconnect
      </span>
      <span className="col-start-1 row-start-1 text-center">{connected ? "Disconnect" : "Connect"}</span>
    </button>
  );
}
