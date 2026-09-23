"use client";
import { useEffect, useRef, useState } from "react";
import { SessionList, type Session } from "@/components/ui/session-list";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ago = (minutes: number) => Date.now() - minutes * 60_000;

const sessions: Session[] = [
  { id: "s1", device: "laptop", browser: "Chrome", os: "macOS", location: "San Francisco, US", ip: "198.51.100.24", lastActiveAt: ago(0), current: true },
  { id: "s2", device: "phone", name: "Stealth for iOS", location: "San Francisco, US", ip: "198.51.100.61", lastActiveAt: ago(2) },
  { id: "s3", device: "desktop", browser: "Firefox", os: "Ubuntu", location: "Frankfurt, Germany", ip: "203.0.113.87", lastActiveAt: ago(5 * 60), flag: "New location" },
  { id: "s4", device: "desktop", browser: "Edge", os: "Windows 11", location: "Austin, US", ip: "192.0.2.140", lastActiveAt: ago(3 * 24 * 60) },
  { id: "s5", device: "tablet", browser: "Safari", os: "iPadOS", location: "Lisbon, Portugal", lastActiveAt: ago(19 * 24 * 60) },
];

// Account security: the list loads, then sign out one device (the iPad
// refuses the first time), or everything but this laptop at once.
export default function Demo() {
  const failed = useRef(false);
  // The list arrives from the server a moment after the page, like it would in an app.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 1100);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="w-full max-w-[540px]">
      <SessionList
        defaultSessions={sessions}
        loading={loading}
        onRevoke={async (s) => {
          await wait(650);
          if (s.id === "s5" && !failed.current) {
            failed.current = true;
            throw new Error("Timed out");
          }
        }}
        onRevokeOthers={() => wait(900)}
      />
    </div>
  );
}
