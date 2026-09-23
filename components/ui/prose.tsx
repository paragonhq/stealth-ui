"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton, useCopy } from "@/components/ui/copy-button";
import { cn } from "@/lib/cn";
import { ease } from "@/lib/motion";
import { Check, Link as LinkIcon } from "@/lib/icons";

/* -------------------------------------------------------------------------------------------------
 * Type
 *
 * Every rule sits inside :where(), so it has no specificity: a class on any element inside
 * wins without a fight. Sizes are three sets of custom properties, so the rhythm (flow space,
 * heading steps, code size) scales as one system instead of being re-declared per size.
 * -----------------------------------------------------------------------------------------------*/

const ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 11 11 5M6 5h5v5'/%3E%3C/svg%3E\")";
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6.25 4.5 3.5 3.5-3.5 3.5'/%3E%3C/svg%3E\")";
const TICK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E\")";

const CSS = `
[data-prose]{--p-size:15px;--p-lh:1.65;--p-h1:28px;--p-h2:20px;--p-h3:16.5px;--p-h4:15px;--p-code:12.5px;--p-flow:1.05em;
  --sh-keyword:var(--fg);--sh-class:var(--fg);--sh-entity:var(--fg);--sh-identifier:var(--fg);--sh-property:var(--fg-2);--sh-string:var(--fg-2);--sh-jsxliterals:var(--fg-2);--sh-sign:var(--fg-3);--sh-comment:var(--fg-4);
  position:relative;font-size:var(--p-size);line-height:var(--p-lh);color:var(--fg-2);overflow-wrap:break-word}
[data-prose][data-size=sm]{--p-size:13.5px;--p-lh:1.6;--p-h1:20px;--p-h2:16px;--p-h3:14px;--p-h4:13.5px;--p-code:12px;--p-flow:.9em}
[data-prose][data-size=lg]{--p-size:17px;--p-lh:1.7;--p-h1:34px;--p-h2:24px;--p-h3:19px;--p-h4:17px;--p-code:13.5px;--p-flow:1.15em}
[data-prose][data-measure]{max-width:68ch}

:where([data-prose-body]) :where(h1,h2,h3,h4,h5,h6,p,ul,ol,dl,pre,blockquote,table,figure,hr,details,img,video){margin:var(--p-flow) 0 0}
:where([data-prose-body]) > :first-child,:where([data-prose-body]) :where(li,blockquote,dd,figure,details) > :first-child{margin-top:0}

:where([data-prose-body]) :where(h1,h2,h3,h4,h5,h6){color:var(--fg);font-weight:500;text-wrap:balance;scroll-margin-top:5rem}
:where([data-prose-body]) :where(h1){font-size:var(--p-h1);line-height:1.15;letter-spacing:-.025em;font-weight:600}
:where([data-prose-body]) :where(h2){font-size:var(--p-h2);line-height:1.3;letter-spacing:-.02em;margin-top:1.9em}
:where([data-prose-body]) :where(h3){font-size:var(--p-h3);line-height:1.4;letter-spacing:-.012em;margin-top:1.8em}
:where([data-prose-body]) :where(h4,h5,h6){font-size:var(--p-h4);line-height:1.45;letter-spacing:-.005em;margin-top:1.6em}
:where([data-prose-body]) :where(h1,h2,h3,h4,h5,h6) + *{margin-top:.55em}
:where([data-prose-body]) :where(h1) + *{margin-top:.8em}
:where([data-prose-body]) :where(p,li,dd,blockquote,figcaption){text-wrap:pretty}
:where([data-prose-body]) :where(strong,b){color:var(--fg);font-weight:500}
:where([data-prose-body]) :where(small){font-size:.86em}
:where([data-prose-body]) :where(mark){color:var(--fg);background:color-mix(in oklab,var(--fg) 12%,transparent);border-radius:3px;padding:0 .15em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
:where([data-prose-body]) :where(abbr[title]){text-decoration:underline dotted var(--fg-4);text-underline-offset:3px;cursor:help}
:where([data-prose-body]) :where(sub,sup){font-size:.75em;line-height:0}
:where([data-prose-body]) :where(sup a){font-family:var(--font-mono);text-decoration:none;padding:0 .1em}

:where([data-prose-body]) :where(a){color:var(--fg);text-decoration:underline;text-decoration-color:var(--fg-4);text-decoration-thickness:1px;text-underline-offset:3px;border-radius:3px;transition:text-decoration-color .16s ease-out}
:where([data-prose-body]) :where(a):hover{text-decoration-color:var(--fg-2)}
:where([data-prose-body]) :where(a):focus-visible{outline:1px solid var(--fg-3);outline-offset:2px}
:where([data-prose-body]) :where(a[target=_blank])::after{content:"";display:inline-block;width:.72em;height:.72em;margin-left:.12em;vertical-align:.02em;background:currentColor;opacity:.45;-webkit-mask:${ARROW} center/contain no-repeat;mask:${ARROW} center/contain no-repeat;transition:translate .2s var(--ease-out-expo),opacity .16s ease-out}
:where([data-prose-body]) :where(a[target=_blank]):hover::after{translate:1px -1px;opacity:.9}

:where([data-prose-body]) :where(ul,ol){padding-left:1.35em}
:where([data-prose-body]) :where(ul){list-style:disc}
:where([data-prose-body]) :where(ol){list-style:decimal}
:where([data-prose-body]) :where(ul ul){list-style:circle}
:where([data-prose-body]) :where(li){margin-top:.3em;padding-left:.2em}
:where([data-prose-body]) :where(li)::marker{color:var(--fg-4)}
:where([data-prose-body]) :where(ol > li)::marker{font-variant-numeric:tabular-nums;color:var(--fg-3)}
:where([data-prose-body]) :where(li > ul,li > ol){margin-top:.3em}
:where([data-prose-body]) :where(li:has(> input[type=checkbox])){list-style:none;margin-left:-1.3em;padding-left:0}
:where([data-prose-body]) :where(li > input[type=checkbox]){appearance:none;width:.9em;height:.9em;margin:0 .45em 0 0;vertical-align:-.1em;border:1px solid var(--line-2);border-radius:4px;background:var(--raised)}
:where([data-prose-body]) :where(li > input[type=checkbox]:checked){border-color:var(--fg);background:var(--fg)}
:where([data-prose-body]) :where(li > input[type=checkbox]:checked)::after{content:"";display:block;width:100%;height:100%;background:var(--frame);-webkit-mask:${TICK} center/75% no-repeat;mask:${TICK} center/75% no-repeat}
:where([data-prose-body]) :where(dt){color:var(--fg);font-weight:500;margin-top:var(--p-flow)}
:where([data-prose-body]) :where(dd){margin:.2em 0 0}

:where([data-prose-body]) :where(blockquote){padding-left:1em;border-left:2px solid var(--line-2);color:var(--fg-2)}
:where([data-prose-body]) :where(hr){border:0;border-top:1px solid var(--line);margin:2.2em 0}

:where([data-prose-body]) :where(code,kbd,samp){font-family:var(--font-mono);font-size:.86em;font-variant-ligatures:none}
:where([data-prose-body]) :where(:not(pre) > code){color:var(--fg);padding:.12em .36em;border:1px solid var(--line);border-radius:5px;background:var(--raised);overflow-wrap:anywhere;box-decoration-break:clone;-webkit-box-decoration-break:clone}
:where([data-prose-body]) :where(kbd){display:inline-block;min-width:1.6em;padding:.05em .4em;text-align:center;color:var(--fg-2);border:1px solid var(--line-2);border-bottom-width:2px;border-radius:5px;background:var(--raised);line-height:1.4}
:where([data-prose-body]) :where(pre){position:relative;overflow-x:auto;padding:.95em 1.1em;border:1px solid var(--line);border-radius:12px;background:var(--raised);color:var(--fg);font-family:var(--font-mono);font-size:var(--p-code);line-height:1.65;tab-size:2;scrollbar-width:thin;overscroll-behavior-x:contain}
:where([data-prose-body]) :where(pre):focus-visible{outline:1px solid var(--fg-3);outline-offset:2px}
:where([data-prose-body]) :where(pre code){font-size:inherit;color:inherit;background:none;border:0;padding:0;white-space:pre}
:where([data-prose-body]) :where(pre[data-language])::before{content:attr(data-language);position:absolute;top:.55em;right:.8em;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-4);transition:opacity .12s ease-out;pointer-events:none}
:where([data-prose-body]) :where(pre[data-prose-active])::before{opacity:0}

:where([data-prose-body]) :where(table){display:block;overflow-x:auto;width:max-content;max-width:100%;border:1px solid var(--line);border-radius:10px;border-spacing:0;border-collapse:separate;font-size:.9em;line-height:1.5;scrollbar-width:thin}
:where([data-prose-body]) :where(th,td){padding:.55em .9em;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
:where([data-prose-body]) :where(th){color:var(--fg);font-weight:500;background:var(--raised);white-space:nowrap}
:where([data-prose-body]) :where(tr:last-child > td){border-bottom:0}
:where([data-prose-body]) :where(th[align=right],td[align=right]){text-align:right;font-variant-numeric:tabular-nums}
:where([data-prose-body]) :where(th[align=center],td[align=center]){text-align:center}
:where([data-prose-body]) :where(td code){overflow-wrap:normal}

:where([data-prose-body]) :where(img,video){display:block;max-width:100%;height:auto;border-radius:10px;outline:1px solid var(--line);outline-offset:-1px;transition:opacity .32s var(--ease-out-expo),scale .5s var(--ease-out-expo)}
:where([data-prose-body][data-enhanced]) :where(img[data-state=loading]){opacity:0;scale:1.015}
:where([data-prose-body]) :where(img[data-state=error]){min-height:6em;background:var(--raised);color:var(--fg-3);font-size:.86em}
:where([data-prose-body]) :where(figure > img,figure > video){margin:0 auto}
:where([data-prose-body]) :where(figure){margin-top:calc(var(--p-flow) * 1.6)}
:where([data-prose-body]) :where(figure) + *{margin-top:calc(var(--p-flow) * 1.6)}
:where([data-prose-body]) :where(figcaption){margin-top:.75em;font-size:.84em;line-height:1.5;color:var(--fg-3);text-align:center;text-wrap:balance}

:where([data-prose-body]) :where(details){border:1px solid var(--line);border-radius:10px;padding:.55em .9em;interpolate-size:allow-keywords}
:where([data-prose-body]) :where(summary){display:flex;align-items:center;gap:.45em;cursor:pointer;color:var(--fg);font-weight:500;list-style:none;border-radius:4px}
:where([data-prose-body]) :where(summary)::-webkit-details-marker{display:none}
:where([data-prose-body]) :where(summary)::before{content:"";flex:none;width:.9em;height:.9em;background:var(--fg-3);-webkit-mask:${CHEVRON} center/contain no-repeat;mask:${CHEVRON} center/contain no-repeat;transition:rotate .2s var(--ease-out-expo)}
:where([data-prose-body]) :where(details[open] > summary)::before{rotate:90deg}
:where([data-prose-body]) :where(summary):focus-visible{outline:1px solid var(--fg-3);outline-offset:2px}
:where([data-prose-body]) :where(details)::details-content{block-size:0;overflow:clip;transition:block-size .24s var(--ease-in-out-quart),content-visibility .24s allow-discrete}
:where([data-prose-body]) :where(details[open])::details-content{block-size:auto}
:where([data-prose-body]) :where(details[open] > summary + *){margin-top:.6em}

@media (prefers-reduced-motion: reduce){:where([data-prose-body][data-enhanced]) :where(img[data-state=loading]){scale:1}}
`;

/* -------------------------------------------------------------------------------------------------
 * Enhancements: things HTML can't say on its own, applied to whatever is rendered inside,
 * including content that streams in later. Only attributes are set, never structure, so
 * React-rendered children are never fought over.
 * -----------------------------------------------------------------------------------------------*/

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";

function enhance(root: HTMLElement, autoIds: boolean) {
  if (autoIds) {
    for (const h of root.querySelectorAll<HTMLElement>("h2:not([id]),h3:not([id]),h4:not([id])")) {
      const base = slugify(h.textContent ?? "");
      let id = base;
      for (let n = 2; document.getElementById(id); n++) id = `${base}-${n}`;
      h.id = id;
    }
  }
  // A scrollable region has to be reachable by keyboard, or its overflow can't be scrolled.
  for (const pre of root.querySelectorAll<HTMLElement>("pre:not([tabindex])")) pre.tabIndex = 0;
  // display:block (for horizontal scroll) drops table semantics in some browsers; say them out loud.
  for (const table of root.querySelectorAll<HTMLElement>("table:not([role])")) {
    table.setAttribute("role", "table");
    for (const g of table.querySelectorAll("thead,tbody,tfoot")) g.setAttribute("role", "rowgroup");
    for (const tr of table.querySelectorAll("tr")) tr.setAttribute("role", "row");
    for (const th of table.querySelectorAll("th")) th.setAttribute("role", th.getAttribute("scope") === "row" ? "rowheader" : "columnheader");
    for (const td of table.querySelectorAll("td")) td.setAttribute("role", "cell");
    if (table.scrollWidth > table.clientWidth) table.tabIndex = 0;
  }
  for (const img of root.querySelectorAll<HTMLImageElement>("img:not([data-state])")) {
    if (img.complete) {
      img.dataset.state = img.naturalWidth ? "loaded" : "error";
      continue;
    }
    img.dataset.state = "loading";
    img.addEventListener("load", () => (img.dataset.state = "loaded"), { once: true });
    img.addEventListener("error", () => (img.dataset.state = "error"), { once: true });
  }
}

/* -------------------------------------------------------------------------------------------------
 * Floating controls
 * -----------------------------------------------------------------------------------------------*/

type AnchorTarget = { id: string; label: string; x: number; y: number };
type CodeTarget = { el: HTMLElement; top: number; right: number };

const HEADINGS = "h2[id],h3[id],h4[id]";

// Where a heading's text actually ends (its last line), relative to the container: the link sits there.
function anchorFor(h: HTMLElement, box: DOMRect): AnchorTarget {
  const range = document.createRange();
  range.selectNodeContents(h);
  const rects = range.getClientRects();
  const last = rects[rects.length - 1] ?? h.getBoundingClientRect();
  return { id: h.id, label: h.textContent?.trim() ?? "", x: last.right - box.left + 6, y: last.top + last.height / 2 - box.top };
}

function codeFor(pre: HTMLElement, box: DOMRect): CodeTarget {
  const r = pre.getBoundingClientRect();
  return { el: pre, top: r.top - box.top + 6, right: box.right - r.right + 6 };
}

/* -------------------------------------------------------------------------------------------------
 * Prose
 * -----------------------------------------------------------------------------------------------*/

export type ProseProps = Omit<React.ComponentProps<"div">, "dangerouslySetInnerHTML"> & {
  /** "sm" for comments and descriptions in product UI, "md" for docs, "lg" for long reads. */
  size?: "sm" | "md" | "lg";
  /** Rendered HTML (from markdown or a CMS). Sanitize it first. Or pass children instead. */
  html?: string;
  /** Cap the line length at about 68 characters. */
  measure?: boolean;
  /** A copy-link button beside h2–h4 on hover. */
  anchors?: boolean;
  /** A copy button on code blocks, and ⌘C / Ctrl+C on a focused block copies all of it. */
  copyCode?: boolean;
  /** Give h2–h4 without an id one from their text, so they can be linked to. */
  autoIds?: boolean;
};

/** Typography for rendered rich text: rhythm, headings, lists, code, quotes, tables and figures, in tokens. */
export function Prose({
  size = "md",
  html,
  measure = true,
  anchors = true,
  copyCode = true,
  autoIds = true,
  className,
  children,
  onPointerOver,
  onPointerLeave,
  onFocus,
  onKeyDown,
  ...rest
}: ProseProps) {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<AnchorTarget | null>(null);
  const [code, setCode] = useState<CodeTarget | null>(null);
  const reduce = useReducedMotion();
  const hideTimer = useRef<number>(undefined);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    enhance(el, autoIds);
    el.dataset.enhanced = "";
    let frame = 0;
    // Content that arrives later (streamed replies, lazy sections) gets the same treatment.
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => enhance(el, autoIds));
    });
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer.current);
    };
  }, [html, autoIds]);

  // The code button marks its block, so the block's language label can step aside for it.
  useEffect(() => {
    if (!code) return;
    code.el.setAttribute("data-prose-active", "");
    return () => code.el.removeAttribute("data-prose-active");
  }, [code]);

  const show = useCallback(
    (target: EventTarget | null) => {
      const box = root.current?.getBoundingClientRect();
      if (!box || !(target instanceof Element) || !body.current?.contains(target)) return;
      window.clearTimeout(hideTimer.current);
      const h = anchors ? target.closest<HTMLElement>(HEADINGS) : null;
      const pre = copyCode ? target.closest<HTMLElement>("pre") : null;
      setAnchor((a) => (h ? (a?.id === h.id ? a : anchorFor(h, box)) : null));
      setCode((c) => (pre ? (c?.el === pre ? c : codeFor(pre, box)) : null));
    },
    [anchors, copyCode],
  );

  // Leaving a heading or block hides its control after a beat, so the pointer can travel onto it.
  const hideSoon = () => {
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setAnchor(null);
      setCode(null);
    }, 160);
  };
  const hold = () => window.clearTimeout(hideTimer.current);

  const bodyProps = html !== undefined ? { dangerouslySetInnerHTML: { __html: html } } : { children };
  const pop = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.95, transition: { duration: 0.1 } } };

  return (
    <>
      <style href="stealth-ui-prose" precedence="default">
        {CSS}
      </style>
      <div
        ref={root}
        data-prose=""
        data-size={size}
        data-measure={measure || undefined}
        className={className}
        onPointerOver={(e) => {
          onPointerOver?.(e);
          if ((e.target as Element).closest?.("[data-prose-control]")) return hold();
          const inside = (e.target as Element).closest?.(`${HEADINGS},pre`);
          if (inside) show(e.target);
          else hideSoon();
        }}
        onPointerLeave={(e) => {
          onPointerLeave?.(e);
          hideSoon();
        }}
        onFocus={(e) => {
          onFocus?.(e);
          // A focused code block shows its copy button, so keyboard users see what ⌘C will do.
          if (e.target instanceof HTMLElement && e.target.matches("pre")) show(e.target);
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          const pre = e.target instanceof HTMLElement && e.target.matches("pre") ? e.target : null;
          if (!pre || !copyCode || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "c") return;
          // With nothing selected, copy the whole block, the way the button would.
          if (window.getSelection()?.toString()) return;
          e.preventDefault();
          show(pre);
          requestAnimationFrame(() => copyRef.current?.click());
        }}
        {...rest}
      >
        <div ref={body} data-prose-body="" {...bodyProps} />

        <AnimatePresence>
          {anchor && (
            <motion.span
              key="anchor"
              data-prose-control=""
              {...pop}
              transition={{ duration: 0.14, ease: ease.out }}
              onPointerLeave={hideSoon}
              className="absolute z-10 -translate-y-1/2"
              style={{ left: anchor.x, top: anchor.y }}
            >
              <SectionLink id={anchor.id} label={anchor.label} />
            </motion.span>
          )}
          {code && (
            <motion.span
              key={`code`}
              data-prose-control=""
              {...pop}
              transition={{ duration: 0.14, ease: ease.out }}
              onPointerLeave={hideSoon}
              className="absolute z-10 origin-top-right"
              style={{ top: code.top, right: code.right }}
            >
              <CopyButton
                ref={copyRef}
                iconOnly
                size="sm"
                label="Copy code"
                copiedLabel="Code copied"
                failedLabel="Couldn’t copy"
                // Mouse users have the button; keyboard users copy the focused block with ⌘C.
                tabIndex={-1}
                aria-keyshortcuts="Meta+C Control+C"
                value={() => (code.el.querySelector("code") ?? code.el).textContent?.replace(/\n$/, "") ?? ""}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// Copies a link to the section. The page doesn't move: sharing is what people want from it.
function SectionLink({ id, label }: { id: string; label: string }) {
  const { state, copy } = useCopy({ timeout: 1400 });
  const reduce = useReducedMotion();
  const done = state === "copied";
  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Copy link to “${label}”`}
        onClick={() => copy(() => `${location.origin}${location.pathname}${location.search}#${id}`)}
        className={cn(
          "relative grid size-6 place-items-center rounded-md text-fg-4 outline-none",
          "before:absolute before:-inset-2.5 before:content-[''] pointer-fine:before:hidden",
          "transition-[background-color,color,scale] duration-150 hover:bg-hover hover:text-fg-2 active:scale-[0.9] active:duration-75",
          done && "text-fg-2",
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={done ? "done" : "link"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(2px)" }}
            transition={{ duration: 0.16, ease: ease.out }}
            className="grid place-items-center"
          >
            {done ? <Check size={14} /> : <LinkIcon size={14} />}
          </motion.span>
        </AnimatePresence>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {done ? "Link copied" : state === "failed" ? "Couldn’t copy the link" : ""}
      </span>
    </>
  );
}
