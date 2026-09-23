"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { SignaturePad, type Signature } from "@/components/ui/signature-pad";

// Signing an agreement: the button wakes up once there's a signature, and the result is the exported image.
export default function Demo() {
  const reduce = useReducedMotion();
  const [signature, setSignature] = useState<Signature | null>(null);
  const [signed, setSigned] = useState<{ png: string; svg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const list = urls.current;
    return () => list.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const adopt = async () => {
    if (!signature) {
      setMissing(true);
      return;
    }
    setBusy(true);
    const png = URL.createObjectURL(await signature.toPNG());
    const svg = URL.createObjectURL(new Blob([signature.toSVG()], { type: "image/svg+xml" }));
    urls.current.push(png, svg);
    setSigned({ png, svg });
    setBusy(false);
  };

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-xl border border-line-2 bg-raised p-5 shadow-[var(--shadow)]">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Master services agreement</h3>
        <p className="text-[12.5px] text-fg-3">Northwind Labs and Harbor &amp; Pine · 14 pages</p>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {signed ? (
          <motion.div
            key="signed"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.26, ease: ease.out }}
            className="flex flex-col gap-3"
          >
            {/* Exports are dark ink on transparent, for white documents, so they're shown on paper. */}
            <div className="grid h-[120px] place-items-center rounded-lg border border-line bg-raised px-4 dark:bg-fg">
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL of the exported signature */}
              <img src={signed.png} alt="Your signature" className="max-h-[88px] max-w-full object-contain" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12.5px] text-fg-2">Signed by Dana Whitfield</p>
              <div className="flex items-center gap-1">
                <a
                  href={signed.svg}
                  download="signature.svg"
                  className="inline-flex h-7 items-center rounded-md px-2 text-[12px] font-medium text-fg-2 underline decoration-fg-4 underline-offset-[3px] outline-none transition-[color,text-decoration-color] duration-150 hover:text-fg hover:decoration-fg-2 focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
                >
                  Download SVG
                </a>
                <button
                  type="button"
                  onClick={() => setSigned(null)}
                  className="inline-flex h-7 items-center rounded-md px-2 text-[12px] font-medium text-fg-2 outline-none transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3"
                >
                  Sign again
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="pad"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.26, ease: ease.out }}
            className="flex flex-col gap-4"
          >
            <SignaturePad
              defaultName="Dana Whitfield"
              error={missing && !signature ? "Sign or type your name to accept the agreement." : undefined}
              onSignatureChange={(s) => {
                setSignature(s);
                if (s) setMissing(false);
              }}
            />
            <button
              type="button"
              aria-busy={busy || undefined}
              onClick={adopt}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-lg bg-fg px-3 text-[13px] font-medium text-frame",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "transition-[background-color,opacity,scale] duration-150 ease-out hover:bg-fg/90 active:scale-[0.98]",
                !signature && "opacity-60",
              )}
            >
              Accept and sign
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
