"use client";
import { Menu } from "@base-ui/react/menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Check, Copy, External, Folder, Pencil, Share, Trash } from "@/lib/icons";
import { ease } from "@/lib/motion";
import { LongPress, type LongPressEvent } from "@/components/ui/long-press";

type Item = { id: string; name: string; meta: string; kind: "sheet" | "doc" | "folder" };

const files: Item[] = [
  { id: "f1", name: "q3-forecast.xlsx", meta: "248 KB", kind: "sheet" },
  { id: "f2", name: "brand-guidelines.pdf", meta: "4.1 MB", kind: "doc" },
  { id: "f3", name: "Offsite photos", meta: "36 items", kind: "folder" },
];

function Glyph({ kind }: { kind: Item["kind"] }) {
  if (kind === "folder") return <Folder size={28} strokeWidth={1.2} />;
  return (
    <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2.5h5l3.5 3.5v7.5H4zM9 2.5V6h3.5" />
      {kind === "sheet" ? <path d="M6 8.5h4.5M6 10.5h4.5M8.25 8.5v3.5" /> : <path d="M6 9h4.5M6 11h3" />}
    </svg>
  );
}

type Anchor = { item: Item; el: HTMLElement; point: { x: number; y: number } | null };

// A file grid: tap selects, press and hold (or right click, or Shift F10) opens the file's menu.
export default function Demo() {
  const [selected, setSelected] = useState<string[]>(["f1"]);
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const reduce = useReducedMotion();
  const tiles = useRef<Record<string, HTMLButtonElement | null>>({});

  const openMenu = (item: Item, e: LongPressEvent) => {
    const el = tiles.current[item.id];
    if (!el) return;
    // A right click opens at the pointer; a held finger or the keyboard opens from the tile itself.
    setMenu({ item, el, point: e.pointerType === "mouse" && e.immediate ? { x: e.clientX, y: e.clientY } : null });
    setOpen(true);
  };

  const act = (say: (name: string) => string) => menu && setStatus(say(menu.item.name));

  const anchor = menu?.point
    ? { getBoundingClientRect: () => DOMRect.fromRect({ x: menu.point!.x, y: menu.point!.y, width: 0, height: 0 }) }
    : (menu?.el ?? null);

  return (
    <div className="flex w-full max-w-[380px] flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-medium tracking-[-0.015em] text-fg">Shared with you</h3>
        <span className="tabular text-[12px] text-fg-3">{selected.length ? `${selected.length} selected` : "3 items"}</span>
      </div>

      <ul className="grid grid-cols-3 gap-2.5" aria-label="Files">
        {files.map((f) => {
          const isSelected = selected.includes(f.id);
          return (
            <li key={f.id}>
              <LongPress onLongPress={(e) => openMenu(f, e)} hint="Press and hold for file actions">
                {(a11y) => (
                  <button
                    ref={(el) => {
                      tiles.current[f.id] = el;
                    }}
                    type="button"
                    aria-pressed={isSelected}
                    {...a11y}
                    onClick={() => setSelected((s) => (isSelected ? s.filter((x) => x !== f.id) : [...s, f.id]))}
                    className={cn(
                      "group/tile flex w-full flex-col gap-2 rounded-xl p-1.5 text-left outline-none",
                      "transition-[background-color] duration-150 hover:bg-hover",
                      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-fg-3",
                      menu?.item.id === f.id && open && "bg-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "relative grid aspect-square w-full place-items-center rounded-lg border bg-frame text-fg-3 transition-[border-color,color] duration-150",
                        isSelected ? "border-fg-3 text-fg-2" : "border-line-2",
                      )}
                    >
                      <Glyph kind={f.kind} />
                      <span
                        className={cn(
                          "absolute right-1.5 top-1.5 grid size-[18px] place-items-center rounded-full border transition-[background-color,border-color,scale,opacity] duration-150",
                          isSelected ? "scale-100 border-fg bg-fg text-frame opacity-100" : "scale-90 border-line-2 bg-raised opacity-0 group-hover/tile:opacity-100",
                        )}
                      >
                        {isSelected && <Check size={12} strokeWidth={2} />}
                      </span>
                    </span>
                    <span className="min-w-0 px-0.5">
                      <span className="line-clamp-2 text-[12.5px] font-medium leading-4 text-fg [overflow-wrap:anywhere]">{f.name}</span>
                      <span className="tabular block text-[11.5px] text-fg-3">{f.meta}</span>
                    </span>
                  </button>
                )}
              </LongPress>
            </li>
          );
        })}
      </ul>

      <div className="flex h-5 items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={status || "hint"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.2, ease: ease.out }}
            role="status"
            className="text-[12px] text-fg-3"
          >
            {status || (
              <>
                <span className="pointer-coarse:hidden">Hold a file for its actions, or right click it</span>
                <span className="hidden pointer-coarse:inline">Press and hold a file for its actions</span>
              </>
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Portal>
          <Menu.Positioner anchor={anchor} side="bottom" align={menu?.point ? "start" : "center"} sideOffset={menu?.point ? 4 : 8} collisionPadding={8} className="z-(--z-dropdown) outline-none">
            <Menu.Popup
              className={cn(
                "w-[216px] origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 text-fg shadow-pop outline-none",
                "transition-[opacity,scale] duration-180 ease-out-expo data-ending-style:duration-120",
                "data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-97 data-ending-style:opacity-0",
                "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
              )}
            >
              {menu && (
                <div className="flex items-center gap-2.5 border-b border-line px-2 pb-2 pt-1.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line-2 bg-frame text-fg-3 [&>svg]:size-4">
                    <Glyph kind={menu.item.kind} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium">{menu.item.name}</span>
                    <span className="tabular block text-[11.5px] text-fg-3">{menu.item.meta}</span>
                  </span>
                </div>
              )}
              <div className="pt-1">
                <MenuItem icon={<External />} onClick={() => act((n) => `Opened ${n}`)}>Open</MenuItem>
                <MenuItem icon={<Share />} onClick={() => act((n) => `Sharing ${n}`)}>Share…</MenuItem>
                <MenuItem icon={<Pencil />} onClick={() => act((n) => `Renaming ${n}`)}>Rename…</MenuItem>
                <MenuItem icon={<Copy />} onClick={() => act((n) => `Duplicated ${n}`)}>Duplicate</MenuItem>
              </div>
              <Menu.Separator className="mx-1 my-1 h-px bg-line" />
              <MenuItem icon={<Trash />} danger onClick={() => act((n) => `Moved ${n} to trash`)}>Move to trash</MenuItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

function MenuItem({ icon, danger, onClick, children }: { icon: React.ReactNode; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Menu.Item
      onClick={onClick}
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2.5 rounded-md px-2 text-[13px] outline-none",
        "data-highlighted:bg-hover",
        danger ? "text-danger data-highlighted:bg-danger-soft" : "text-fg",
        "[&>svg]:shrink-0",
        danger ? "" : "[&>svg]:text-fg-3",
      )}
    >
      {icon}
      {children}
    </Menu.Item>
  );
}
