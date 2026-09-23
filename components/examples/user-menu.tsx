"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Bell, Command, Settings, Sparkle, User } from "@/lib/icons";
import { type Theme, type UserStatus, UserMenu, UserMenuItem } from "@/components/ui/user-menu";

// An app header. The theme control really re-themes the card (and the menu, which is
// portaled inside it), status morphs the dot on the avatar, and signing out takes a beat.
export default function Demo() {
  const card = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>("system");
  const [status, setStatus] = useState<UserStatus>("online");
  const [signedIn, setSignedIn] = useState(true);

  return (
    <div
      ref={card}
      data-theme={theme === "system" ? undefined : theme}
      className="relative h-[420px] w-full max-w-[520px] overflow-hidden rounded-xl border border-line bg-frame text-fg shadow-[var(--shadow)] transition-[background-color] duration-300"
    >
      <header className="flex h-12 items-center justify-between border-b border-line pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="font-medium text-fg">Northwind</span>
          <span className="text-fg-4">/</span>
          <span className="truncate text-fg-2">Q3 forecast</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Notifications"
            className="grid size-8 place-items-center rounded-lg text-fg-3 outline-none transition-[background-color,color,scale] hover:bg-hover hover:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 active:scale-[0.94]"
          >
            <Bell size={16} />
          </button>
          {signedIn ? (
            <UserMenu
              user={{ name: "Riley Santos", email: "riley@northwind.dev" }}
              status={status}
              onStatusChange={setStatus}
              theme={theme}
              onThemeChange={setTheme}
              onSignOut={() => new Promise<void>((r) => setTimeout(() => (setSignedIn(false), r()), 900))}
              container={card}
            >
              <UserMenuItem icon={<User />} shortcut="⇧⌘P">Profile</UserMenuItem>
              <UserMenuItem icon={<Settings />} shortcut="⌘,">Settings</UserMenuItem>
              <UserMenuItem icon={<Command />} shortcut="?">Keyboard shortcuts</UserMenuItem>
              <UserMenuItem icon={<Sparkle />} href="https://example.com/changelog" external>Changelog</UserMenuItem>
            </UserMenu>
          ) : (
            <button
              type="button"
              onClick={() => setSignedIn(true)}
              className="h-8 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale] hover:bg-fg/90 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 active:scale-[0.97]"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
      <div className={cn("flex flex-col gap-3 p-5 transition-opacity duration-300", !signedIn && "opacity-40")}>
        <p className="text-[15px] font-medium tracking-[-0.015em]">Q3 forecast</p>
        <p className="max-w-[40ch] text-[12.5px] text-fg-3">Edited by Maya Chen 12 minutes ago</p>
        {[80, 64, 72].map((w) => (
          <div key={w} className="h-2 rounded-full bg-hover" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}
