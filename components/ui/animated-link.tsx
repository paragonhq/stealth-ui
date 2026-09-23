"use client";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/cn";
import { ArrowRight, ArrowUpRight } from "@/lib/icons";

type Tone = "default" | "muted" | "plain";

const isExternalHref = (href?: string) => !!href && /^(https?:)?\/\//.test(href);

/**
 * When the pointer leaves before the line has finished drawing, it rolls back
 * the way it came instead of jumping to the far end and retracting from there.
 */
function onLeave(e: React.PointerEvent<HTMLElement>) {
  const line = e.currentTarget.querySelector<HTMLElement>("[data-underline]");
  if (!line) return;
  const size = getComputedStyle(line).backgroundSize.split(",")[0]?.trim().split(" ")[0] ?? "0%";
  const drawn = size.endsWith("%") ? parseFloat(size) / 100 : parseFloat(size) / Math.max(line.offsetWidth, 1);
  e.currentTarget.toggleAttribute("data-rewind", drawn < 0.92);
}

export type AnimatedLinkProps = useRender.ComponentProps<"a"> & {
  /** default: primary text with a faint resting underline. muted: secondary text that brightens. plain: no resting underline, for footers and lists where context says “link”. */
  tone?: Tone;
  /** Opens in a new tab with an arrow. Defaults to true for absolute URLs. */
  external?: boolean;
  /** "arrow" adds a forward arrow that nudges on hover, for “View all” links. External links get the up-right arrow on their own. */
  icon?: "arrow" | "none";
  /** Dim links the person has already visited. Off by default: in apps it is usually noise. */
  markVisited?: boolean;
};

export function AnimatedLink({
  tone = "default",
  external: externalProp,
  icon = "none",
  markVisited = false,
  render,
  className,
  children,
  ...rest
}: AnimatedLinkProps) {
  const external = externalProp ?? isExternalHref(rest.href);
  const Arrow = external ? ArrowUpRight : icon === "arrow" ? ArrowRight : null;

  const own: useRender.ElementProps<"a"> & { "data-tone": Tone } = {
    "data-tone": tone,
    target: external ? "_blank" : undefined,
    rel: external ? "noopener noreferrer" : undefined,
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => e.currentTarget.removeAttribute("data-rewind"),
    onPointerLeave: onLeave,
    className: cn(
      "group/link cursor-pointer rounded-[4px] outline-none [-webkit-tap-highlight-color:transparent]",
      "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
      // In running text the ring sits 1px out so it never touches the neighboring words; standalone links get the usual 2px.
      tone === "default" ? "focus-visible:outline-offset-1" : "focus-visible:outline-offset-2",
      "transition-colors duration-150",
      // The drawn line reads these; hover and keyboard focus draw it from the left.
      "[--u:0%] [--u-at:right] hover:[--u:100%] hover:[--u-at:left] focus-visible:[--u:100%] focus-visible:[--u-at:left] data-rewind:[--u-at:left]",
      tone === "default" && "text-fg [--u-rest:var(--fg-4)] active:text-fg-2",
      tone === "muted" && "text-fg-2 [--u-rest:var(--line-2)] hover:text-fg active:text-fg-3",
      tone === "plain" && "text-fg-2 [--u-rest:transparent] hover:text-fg active:text-fg-3",
      markVisited && "visited:text-fg-3",
      className,
    ),
    children: (
      <>
        <span
          data-underline=""
          className={cn(
            // Two lines in the background: a resting hairline, and the one that draws over it.
            // Backgrounds follow the text across line breaks, so a wrapped link draws line by line.
            "bg-no-repeat pb-[0.12em]",
            "[background-image:linear-gradient(currentColor,currentColor),linear-gradient(var(--u-rest),var(--u-rest))]",
            "[background-size:var(--u)_1px,100%_1px] [background-position:var(--u-at)_100%,0_100%]",
            "transition-[background-size] duration-200 ease-out-quart group-hover/link:duration-[280ms] group-hover/link:ease-out-expo",
          )}
        >
          {children}
        </span>
        {Arrow && (
          <>
            {/* A word joiner keeps the arrow on the same line as the last word. */}
            {"\u2060"}
            <Arrow
              size={12}
              className={cn(
                "ml-0.5 inline-block align-[-0.05em] opacity-70 transition-[translate,opacity] duration-200 ease-out-quart group-hover/link:opacity-100 group-focus-visible/link:opacity-100",
                external ? "group-hover/link:translate-x-px group-hover/link:-translate-y-px" : "group-hover/link:translate-x-0.5",
              )}
            />
          </>
        )}
        {external && <span className="sr-only"> (opens in a new tab)</span>}
      </>
    ),
  };

  return useRender({ defaultTagName: "a", render, props: mergeProps<"a">(own, rest) });
}
