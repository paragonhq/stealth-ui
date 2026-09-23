"use client";
import { Home, Inbox, Pencil, Search, Settings } from "@/lib/icons";
import { HideOnScroll } from "@/components/ui/hide-on-scroll";

const threads = [
  { from: "Maya Chen", subject: "Deploy to production is green", preview: "web@4f2a1c rolled out to all regions in 6m 12s.", time: "9:41", unread: true },
  { from: "Stripe", subject: "Invoice INV-2041 paid", preview: "Northwind paid $1,280.00 for the annual plan.", time: "9:12", unread: true },
  { from: "Leo Park", subject: "Re: SSO rollout checklist", preview: "Okta and Google are done. Azure needs a tenant ID from them.", time: "8:57", unread: true },
  { from: "Priya Raman", subject: "q3-forecast.xlsx", preview: "Updated the seat numbers after the pricing change.", time: "8:30", unread: false },
  { from: "GitHub", subject: "#1182 Retry webhooks with backoff", preview: "Ana Souza approved these changes.", time: "Yesterday", unread: false },
  { from: "Tom Weiss", subject: "Office hours moved to Thursday", preview: "Same room, 3pm. Bring the onboarding numbers.", time: "Yesterday", unread: false },
  { from: "Linear", subject: "INC-88 resolved", preview: "Elevated 502s on api-eu. Postmortem due Friday.", time: "Mon", unread: false },
  { from: "Ana Souza", subject: "Two quotes for invoice translation", preview: "Both cover 9 languages; one is half the price.", time: "Mon", unread: false },
  { from: "Jordan Lee", subject: "Joined the Platform team", preview: "Say hi in #platform. Starts on-call next week.", time: "Sun", unread: false },
  { from: "Maya Chen", subject: "Storage migration dry run", preview: "Took 41 minutes on staging. No data loss.", time: "Sat", unread: false },
  { from: "Vercel", subject: "Usage alert: 80% of bandwidth", preview: "Your team has used 80 GB of 100 GB this cycle.", time: "Fri", unread: false },
  { from: "Leo Park", subject: "Audit log export design", preview: "Draft is in the doc. Comments by Wednesday.", time: "Fri", unread: false },
];

const tabs = [
  { label: "Home", icon: Home },
  { label: "Inbox", icon: Inbox },
  { label: "Search", icon: Search },
  { label: "Settings", icon: Settings },
];

const iconButton =
  "relative grid size-8 place-items-center rounded-md text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 before:absolute before:-inset-1.5 before:content-[''] pointer-fine:before:hidden";

// A phone inbox: both bars tuck away while you read down the list and come
// back the moment you head up, or when you reach the end.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-3">
      <div className="h-[440px] w-full overflow-hidden rounded-2xl border border-line bg-frame shadow-[var(--shadow)]">
        <div
          tabIndex={0}
          aria-label="Inbox"
          className="h-full overflow-y-auto overscroll-contain outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-3"
        >
          <HideOnScroll>
            <header className="flex h-12 items-center gap-2 pl-4 pr-2">
              <h3 className="text-[15px] font-medium tracking-[-0.015em] text-fg">Inbox</h3>
              <span className="tabular text-[12px] text-fg-3">3 unread</span>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" aria-label="Search mail" className={iconButton}>
                  <Search />
                </button>
                <button type="button" aria-label="New message" className={iconButton}>
                  <Pencil />
                </button>
              </div>
            </header>
          </HideOnScroll>

          <ul className="px-2 pb-2">
            {threads.map((t) => (
              <li key={t.subject}>
                <a
                  href="#inbox"
                  onClick={(e) => e.preventDefault()}
                  className="flex gap-3 rounded-lg px-2 py-2.5 outline-none transition-colors duration-150 hover:bg-hover focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
                >
                  <span aria-hidden className={`mt-[7px] size-1.5 shrink-0 rounded-full ${t.unread ? "bg-fg" : "bg-transparent"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${t.unread ? "font-medium text-fg" : "text-fg-2"}`}>{t.from}</span>
                      <span className="tabular shrink-0 text-[11.5px] text-fg-3">{t.time}</span>
                    </span>
                    <span className={`block truncate text-[12.5px] ${t.unread ? "text-fg" : "text-fg-2"}`}>{t.subject}</span>
                    <span className="block truncate text-[12px] text-fg-3">{t.preview}</span>
                  </span>
                  {t.unread && <span className="sr-only">Unread</span>}
                </a>
              </li>
            ))}
          </ul>

          <HideOnScroll edge="bottom">
            <nav aria-label="Main" className="grid grid-cols-4 px-2 pb-1.5 pt-1">
              {tabs.map(({ label, icon: Icon }) => {
                const current = label === "Inbox";
                return (
                  <a
                    key={label}
                    href="#inbox"
                    onClick={(e) => e.preventDefault()}
                    aria-current={current ? "page" : undefined}
                    className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10.5px] text-fg-3 outline-none transition-[color,scale] duration-150 hover:text-fg-2 active:scale-[0.94] aria-[current=page]:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3"
                  >
                    <Icon size={18} />
                    {label}
                  </a>
                );
              })}
            </nav>
          </HideOnScroll>
        </div>
      </div>
      <p className="text-center text-[12px] text-fg-3 text-balance">Read down and both bars step aside. Head back up, or reach the end, and they return.</p>
    </div>
  );
}
