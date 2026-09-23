"use client";
import { atZonedTime, BookingSlots } from "@/components/ui/booking-slots";

// An intro call on a teammate's booking page. Weekdays only, some slots already taken,
// and every Wednesday fully booked so "next available" has something to do.
const HOST_ZONE = "Europe/London";

const isDateAvailable = (day: Date) => day.getDay() !== 0 && day.getDay() !== 6;

async function getSlots(day: Date) {
  await new Promise((r) => setTimeout(r, 420));
  if (day.getDay() === 3) return [];
  const seed = day.getDate() * 3 + day.getMonth();
  return Array.from({ length: 16 }, (_, i) => ({
    start: atZonedTime(day, 9 * 60 + i * 30, HOST_ZONE),
    // A believable scatter of meetings already on the calendar.
    available: (seed + i * 5) % 7 > 1,
  }));
}

export default function Demo() {
  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <div className="flex items-center gap-2.5 px-1">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fg/[0.08] text-[12px] font-medium text-fg-2">MC</span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-5 tracking-[-0.01em]">Intro call with Maya Chen</p>
          <p className="truncate text-[12px] leading-4 text-fg-3">Product design · Google Meet</p>
        </div>
      </div>
      <BookingSlots
        getSlots={getSlots}
        isDateAvailable={isDateAvailable}
        timeZone={HOST_ZONE}
        duration={30}
        onConfirm={() => new Promise((r) => setTimeout(r, 900))}
      />
    </div>
  );
}
