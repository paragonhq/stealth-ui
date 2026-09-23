"use client";
import { useState } from "react";
import { defaultNotificationChannels, NotificationMatrix, type NotificationGroup, type NotificationMatrixValue } from "@/components/ui/notification-matrix";

const groups: NotificationGroup[] = [
  {
    id: "activity",
    label: "Activity",
    events: [
      { id: "mentions", label: "Mentions", description: "Someone @mentions you in an issue, comment or doc" },
      { id: "assigned", label: "Assigned to you", description: "An issue or review request lands on your plate" },
    ],
  },
  {
    id: "deploys",
    label: "Deploys",
    events: [
      { id: "deploy-failed", label: "Production deploy failed", description: "Includes the failing step and a link to the logs" },
      { id: "deploy-ready", label: "Preview ready", unsupported: ["email"] },
    ],
  },
  {
    id: "account",
    label: "Account",
    events: [
      {
        id: "security",
        label: "Security alerts",
        description: "New sign-ins, password and 2FA changes",
        required: ["email"],
        requiredReason: "Security alerts always go to your email",
      },
      { id: "product", label: "Product updates", description: "Release notes, about twice a month", unsupported: ["push"] },
    ],
  },
];

// Notification settings for a dev platform: push starts blocked in this
// browser, security email is locked on, and each column has a select-all.
export default function Demo() {
  const [pushAllowed, setPushAllowed] = useState(false);
  const [value, setValue] = useState<NotificationMatrixValue>({
    mentions: ["email", "push", "in-app"],
    assigned: ["push", "in-app"],
    "deploy-failed": ["email", "push", "in-app"],
    "deploy-ready": ["in-app"],
    security: ["email"],
    product: ["email"],
  });

  const channels = defaultNotificationChannels.map((ch) =>
    ch.id === "push" && !pushAllowed
      ? {
          ...ch,
          disabled: true,
          hint: (
            <>
              Blocked in this browser.{" "}
              <button
                type="button"
                onClick={() => setPushAllowed(true)}
                className="relative rounded-sm text-fg underline decoration-fg-4 underline-offset-2 outline-none transition-colors duration-150 hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] pointer-fine:before:hidden"
              >
                Allow push
              </button>
            </>
          ),
        }
      : ch,
  );

  return (
    <div className="w-full max-w-[540px]">
      <NotificationMatrix groups={groups} channels={channels} value={value} onValueChange={setValue} />
    </div>
  );
}
