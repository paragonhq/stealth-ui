"use client";
import { Menu } from "@base-ui/react/menu";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton, IconButtonProvider } from "@/components/ui/icon-button";
import { ChevronLeft, ChevronRight, Download, Link, Maximize, Minus, MoreH, Plus } from "@/lib/icons";
import { ButtonGroup } from "@/components/ui/button-group";

const zooms = [25, 50, 75, 100, 150, 200, 400];
const row = "flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2 text-[13px] outline-none";
const item = `${row} text-fg-2 data-highlighted:bg-fg/[0.06] data-highlighted:text-fg`;
const danger = `${row} text-danger data-highlighted:bg-danger-soft`;

// A design file: a toolbar ending in a menu, page steppers, and a vertical zoom stack.
export default function Demo() {
  const [zoom, setZoom] = useState(3);
  const [page, setPage] = useState(2);
  const pages = 12;

  return (
    <IconButtonProvider>
      <div className="w-full max-w-[440px] overflow-hidden rounded-xl border border-line bg-raised shadow-[var(--shadow)]">
        <div className="flex items-center gap-3 border-b border-line py-2.5 pl-4 pr-2.5">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] font-medium text-fg">Onboarding flow v3</p>
            <p className="truncate text-[12px] text-fg-3">Edited by Priya Raman</p>
          </div>
          <ButtonGroup aria-label="File actions">
            <Button size="sm" leadingIcon={<Link />}>
              Share
            </Button>
            <Button size="sm" leadingIcon={<Download />}>
              Export
            </Button>
            <Menu.Root>
              <Menu.Trigger
                render={
                  <IconButton size="sm" label="More file actions" tooltip="More">
                    <MoreH />
                  </IconButton>
                }
              />
              <Menu.Portal>
                <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-(--z-dropdown)">
                  <Menu.Popup className="min-w-44 origin-(--transform-origin) rounded-xl border border-line-2 bg-raised p-1 shadow-pop outline-none transition-[opacity,scale] duration-150 ease-out-expo data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-96 data-starting-style:opacity-0">
                    <Menu.Item className={item}>Duplicate</Menu.Item>
                    <Menu.Item className={item}>Move to…</Menu.Item>
                    <Menu.Item className={item}>Version history</Menu.Item>
                    <Menu.Separator className="mx-2 my-1 h-px bg-line" />
                    <Menu.Item className={danger}>Delete file</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </ButtonGroup>
        </div>

        <div className="relative h-[228px] bg-page [background-image:radial-gradient(var(--line-2)_1px,transparent_1px)] [background-size:14px_14px]">
          <div
            className="absolute left-1/2 top-1/2 h-24 w-40 origin-center rounded-lg border border-line-2 bg-raised shadow-[var(--shadow)] transition-[scale] duration-200 ease-out-quart"
            style={{ scale: Math.min(zooms[zoom], 200) / 100, translate: "-50% -50%" }}
          >
            <div className="flex h-full flex-col gap-1.5 p-3">
              <span className="h-1.5 w-16 rounded-full bg-fg-4" />
              <span className="h-1.5 w-24 rounded-full bg-line-2" />
              <span className="mt-auto h-4 w-12 rounded bg-fg" />
            </div>
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <ButtonGroup aria-label="Pages">
              <IconButton size="sm" label="Previous page" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft />
              </IconButton>
              <IconButton size="sm" label="Next page" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight />
              </IconButton>
            </ButtonGroup>
            <span className="tabular text-[12px] text-fg-3">
              {page} / {pages}
            </span>
          </div>

          <div className="absolute bottom-3 right-3 flex items-end gap-2">
            <span className="tabular w-9 pb-1 text-right text-[12px] text-fg-3" aria-live="polite">
              {zooms[zoom]}%
            </span>
            <ButtonGroup orientation="vertical" aria-label="Zoom">
              <IconButton size="sm" label="Zoom in" shortcut="⌘ +" tooltipSide="left" disabled={zoom === zooms.length - 1} onClick={() => setZoom((z) => z + 1)}>
                <Plus />
              </IconButton>
              <IconButton size="sm" label="Zoom out" shortcut="⌘ −" tooltipSide="left" disabled={zoom === 0} onClick={() => setZoom((z) => z - 1)}>
                <Minus />
              </IconButton>
              <IconButton size="sm" label="Zoom to 100%" tooltipSide="left" onClick={() => setZoom(3)}>
                <Maximize />
              </IconButton>
            </ButtonGroup>
          </div>
        </div>
      </div>
    </IconButtonProvider>
  );
}
