"use client";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps, type Transition } from "motion/react";
import { createContext, use, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useControllableState } from "@/lib/use-controllable-state";
import { ease, spring } from "@/lib/motion";
import { X } from "@/lib/icons";

type Ctx = {
  id: string;
  open: boolean;
  layout: Transition;
  reduce: boolean;
  instant: boolean;
  settling: boolean;
  setSettling: (v: boolean) => void;
  container?: Dialog.Portal.Props["container"];
};
const MorphContext = createContext<Ctx | null>(null);
// Shared parts render differently in the card and in the dialog.
const WhereContext = createContext<"trigger" | "content">("trigger");

const useMorph = () => {
  const ctx = use(MorphContext);
  if (!ctx) throw new Error("MorphDialog parts must be inside <MorphDialog>");
  return ctx;
};

export type MorphDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Render the dialog inside this element instead of over the whole page: the backdrop covers
   * only the container and page scroll isn't locked. The container needs position: relative.
   */
  container?: Dialog.Portal.Props["container"];
  children: React.ReactNode;
};

export function MorphDialog({ open: openProp, defaultOpen = false, onOpenChange, container, children }: MorphDialogProps) {
  const id = useId();
  const reduce = !!useReducedMotion();
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [instant, setInstant] = useState(false);
  const [settling, setSettling] = useState(false);
  // Opening springs softly; closing folds back faster. Escape and reduced motion skip the morph.
  const layout: Transition = reduce || instant ? { duration: 0 } : open ? spring.soft : spring.snappy;

  return (
    <MorphContext value={{ id, open, layout, reduce, instant, settling, setSettling, container }}>
      <Dialog.Root
        open={open}
        modal={container ? "trap-focus" : true}
        onOpenChange={(next, details) => {
          setInstant(!next && details.reason === "escape-key");
          setOpen(next);
        }}
      >
        {children}
      </Dialog.Root>
    </MorphContext>
  );
}

export type MorphDialogTriggerProps = Omit<Dialog.Trigger.Props, "className"> & { className?: string };

/** The card. Its surface, image, title and subtitle travel into the dialog and back. */
export function MorphDialogTrigger({ className, children, ...rest }: MorphDialogTriggerProps) {
  const { id, open, layout, settling, setSettling } = useMorph();
  return (
    <WhereContext value="trigger">
      <Dialog.Trigger
        data-state={open ? "open" : "closed"}
        className={cn(
          "group/card relative flex flex-col rounded-xl p-1 text-left outline-none",
          "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
          "transition-[scale] duration-150 active:scale-[0.98] active:duration-75",
          // Above its neighbors while it flies back into place.
          (open || settling) && "z-(--z-dialog)",
          className,
        )}
        {...rest}
      >
        {open ? (
          // The slot it left stays visible, so it's clear where the dialog will fold back to.
          <span aria-hidden className="absolute inset-0 rounded-xl bg-fg/[0.03]" />
        ) : (
          <motion.span
            aria-hidden
            layoutId={`${id}-surface`}
            transition={layout}
            onLayoutAnimationStart={() => setSettling(true)}
            onLayoutAnimationComplete={() => setSettling(false)}
            style={{ borderRadius: 12 }}
            className="absolute inset-0 border border-line-2 bg-raised shadow-[var(--shadow)] transition-[border-color,background-color] duration-150 group-hover/card:border-fg-4"
          />
        )}
        <span className="relative flex flex-col">{children}</span>
      </Dialog.Trigger>
    </WhereContext>
  );
}

export type MorphDialogContentProps = Omit<Dialog.Popup.Props, "className" | "render"> & {
  className?: string;
  /** Max width in px. The dialog is never wider than its container less 32px. */
  width?: number;
  closeLabel?: string;
};

export function MorphDialogContent({ className, width = 420, closeLabel = "Close", children, ...rest }: MorphDialogContentProps) {
  const { id, open, layout, reduce, instant, container } = useMorph();
  const popupRef = useRef<HTMLDivElement>(null);
  const contained = container != null;
  const fade = { duration: reduce ? 0.12 : 0.2, ease: ease.out };
  return (
    <AnimatePresence>
      {open && (
        <Dialog.Portal keepMounted container={container}>
          <WhereContext value="content">
            <Dialog.Backdrop
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: fade }}
                  exit={{ opacity: 0, transition: { duration: instant ? 0 : 0.18, ease: ease.out } }}
                />
              }
              className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-overlay) bg-overlay")}
            />
            <Dialog.Viewport className={cn(contained ? "absolute" : "fixed", "inset-0 z-(--z-dialog) grid place-items-center p-4")}>
              <Dialog.Popup
                ref={popupRef}
                initialFocus={popupRef}
                className={cn("relative flex max-h-full w-full min-w-0 flex-col text-fg outline-none", className)}
                style={{ maxWidth: width }}
                {...rest}
              >
                <motion.div
                  aria-hidden
                  layoutId={`${id}-surface`}
                  transition={layout}
                  style={{ borderRadius: 16 }}
                  exit={{ opacity: instant ? 0 : 1, transition: { duration: 0 } }}
                  className="absolute inset-0 border border-line-2 bg-raised shadow-pop"
                />
                <div className="relative flex min-h-0 flex-col p-1.5">{children}</div>
                {/* Last in the DOM so Tab reaches the content first; first thing the eye finds, over the image. */}
                <MorphDialogFade className="absolute right-3.5 top-3.5">
                  <Dialog.Close
                    aria-label={closeLabel}
                    className={cn(
                      "relative grid size-7 place-items-center rounded-full border border-line-2 bg-raised/90 text-fg-2 shadow-[var(--shadow)] outline-none",
                      "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg active:scale-[0.92] active:duration-75",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                      "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
                    )}
                  >
                    <X size={14} />
                  </Dialog.Close>
                </MorphDialogFade>
              </Dialog.Popup>
            </Dialog.Viewport>
          </WhereContext>
        </Dialog.Portal>
      )}
    </AnimatePresence>
  );
}

type SharedProps = { className?: string; children?: React.ReactNode };

// A part that exists in both the card and the dialog under one layoutId. While the dialog
// is open, the card keeps an invisible copy so its size never changes.
function Shared({ name, radius, className, children, as = "div" }: SharedProps & { name: string; radius?: number; as?: "div" | "p" }) {
  const { id, open, layout } = useMorph();
  const where = use(WhereContext);
  // Inside the card (a button) everything is phrasing content.
  const Tag = where === "trigger" ? "span" : as;
  if (where === "trigger" && open)
    return (
      <Tag aria-hidden className={cn(className, "invisible")}>
        {children}
      </Tag>
    );
  const M = motion[Tag];
  return (
    <M layoutId={`${id}-${name}`} transition={layout} style={radius != null ? { borderRadius: radius } : undefined} className={cn("block", className)}>
      {children}
    </M>
  );
}

/** The image. Keep the same aspect ratio in the card and the dialog so it scales without stretching. */
export function MorphDialogImage({ className, children, aspect = "2 / 1" }: SharedProps & { aspect?: string }) {
  const where = use(WhereContext);
  return (
    <Shared name="image" radius={where === "trigger" ? 8 : 10} className={cn("relative w-full shrink-0 overflow-hidden bg-frame", className)}>
      <span className="block" style={{ aspectRatio: aspect }}>
        {children}
      </span>
    </Shared>
  );
}

export function MorphDialogTitle({ className, children }: SharedProps) {
  const where = use(WhereContext);
  const { id, layout } = useMorph();
  if (where === "content")
    return (
      <Dialog.Title
        render={(props) => <motion.h2 {...(props as HTMLMotionProps<"h2">)} layoutId={`${id}-title`} transition={layout} />}
        className={cn("w-fit max-w-full text-[17px] font-medium leading-6 tracking-[-0.02em] text-fg text-balance", className)}
      >
        {children}
      </Dialog.Title>
    );
  // w-fit keeps the box the size of the words, so it scales uniformly between sizes.
  return (
    <Shared name="title" className={cn("w-fit max-w-full truncate text-[13px] font-medium leading-5 tracking-[-0.01em] text-fg", className)}>
      {children}
    </Shared>
  );
}

export function MorphDialogSubtitle({ className, children }: SharedProps) {
  const where = use(WhereContext);
  return (
    <Shared name="subtitle" as="p" className={cn("w-fit max-w-full truncate leading-[18px] text-fg-3", where === "trigger" ? "text-[12px]" : "text-[12.5px]", className)}>
      {children}
    </Shared>
  );
}

/** Everything that only exists in the dialog: it fades in once the shared parts are on their way. */
export function MorphDialogFade({ className, children }: SharedProps) {
  const { reduce, instant } = useMorph();
  return (
    <motion.div
      // Held back until the surface has nearly arrived, so nothing shows outside it mid-flight.
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: reduce ? 0.12 : 0.22, delay: reduce ? 0 : 0.16, ease: ease.out } }}
      exit={{ opacity: 0, transition: { duration: instant ? 0 : 0.08 } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export type MorphDialogDescriptionProps = Omit<Dialog.Description.Props, "className"> & { className?: string };

export function MorphDialogDescription({ className, ...rest }: MorphDialogDescriptionProps) {
  return <Dialog.Description className={cn("text-[13px] leading-5 text-fg-2 text-pretty", className)} {...rest} />;
}

export type MorphDialogCloseProps = Omit<Dialog.Close.Props, "className"> & { className?: string };

/** A close control of your own, e.g. a "Cancel" button in the dialog's actions. */
export function MorphDialogClose({ className, ...rest }: MorphDialogCloseProps) {
  return <Dialog.Close className={className} {...rest} />;
}
