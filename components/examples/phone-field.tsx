"use client";
import { useState } from "react";
import { PhoneField, type PhoneFieldDetails } from "@/components/ui/phone-field";

// Two-factor setup: a number we'll text a code to.
export default function Demo() {
  const [value, setValue] = useState("");
  const [details, setDetails] = useState<PhoneFieldDetails | null>(null);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const complete = !!details?.complete;
  const showError = touched && !!value && !complete;
  const max = details ? [...details.country.pattern].filter((c) => c === "#").length : 10;
  const min = details?.country.min ?? max;
  const need = min === max ? `${max} digits` : `${min}–${max} digits`;

  return (
    <form
      className="flex w-full max-w-[340px] flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (complete) setSent(true);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone-2fa" className="text-[12.5px] font-medium text-fg">
          Phone number
        </label>
        <PhoneField
          id="phone-2fa"
          name="phone"
          value={value}
          onValueChange={(v, d) => {
            setValue(v);
            setDetails(d);
            setSent(false);
          }}
          onBlur={() => setTouched(true)}
          preferredCountries={["US", "GB", "CA", "DE"]}
          invalid={showError}
          aria-describedby="phone-2fa-hint"
        />
        <p id="phone-2fa-hint" className={showError ? "text-[12px] text-danger" : "text-[12px] text-fg-3"}>
          {showError
            ? `Enter the full number, ${need} for ${details?.country.name}`
            : sent
              ? `Code sent to ${value}. It expires in 10 minutes.`
              : "We’ll text a 6-digit code to this number."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            // Sends a real paste event into the field, the way a clipboard would.
            const input = document.getElementById("phone-2fa") as HTMLInputElement | null;
            if (!input) return;
            input.focus();
            const data = new DataTransfer();
            data.setData("text", "+44 20 7946 0958");
            input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
            setTouched(false);
          }}
          className="truncate text-left text-[12px] text-fg-3 underline decoration-fg-4 underline-offset-[3px] outline-none transition-colors hover:text-fg-2 hover:decoration-fg-3 focus-visible:text-fg"
        >
          Paste +44 20 7946 0958
        </button>
        <button
          type="submit"
          disabled={!complete}
          className="h-8 shrink-0 rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,opacity,scale] duration-150 hover:bg-fg/90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          Send code
        </button>
      </div>
    </form>
  );
}
