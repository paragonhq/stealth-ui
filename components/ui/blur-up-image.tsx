"use client";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

export type ImageStatus = "loading" | "loaded" | "error";

const noop = () => () => {};

/**
 * The load lifecycle of one image, without the markup. Spread `imgProps` on an <img>.
 * `instant` is true when the image was already decoded the moment it mounted on the
 * client (the browser cache), so a caller can skip its reveal instead of replaying it.
 * Give the <img> the returned `key` so a retry or a new src gets a fresh element.
 */
export function useImageLoad(src: string | undefined, { onLoad, onError }: { onLoad?: () => void; onError?: () => void } = {}) {
  const [attempt, setAttempt] = useState(0);
  const key = `${src ?? ""}#${attempt}`;
  const [result, setResult] = useState<{ key: string; status: ImageStatus; instant: boolean } | null>(null);
  // During hydration the server snapshot (false) is used, so an image that finished before
  // React arrived still gets its reveal: the visitor was looking at the placeholder until now.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);

  const settledKey = useRef<string>(null);

  const current = result?.key === key ? result : null;
  const status: ImageStatus = src === undefined ? "loading" : (current?.status ?? "loading");

  const settle = useCallback(
    (img: HTMLImageElement, instant: boolean) => {
      if (settledKey.current === key) return;
      settledKey.current = key;
      // Wait for decode so the reveal never starts on a half-painted frame.
      const done = () => {
        setResult({ key, status: "loaded", instant });
        onLoad?.();
      };
      if (instant || !img.decode) done();
      else img.decode().then(done, done);
    },
    [key, onLoad],
  );

  // Catches images that finished before React attached its listeners (cache, or before hydration).
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !src || !img.complete) return;
      if (img.naturalWidth > 0) settle(img, hydrated);
      else if (img.currentSrc) setResult({ key, status: "error", instant: false });
    },
    [key, src, settle, hydrated],
  );

  return {
    status,
    instant: !!current?.instant,
    attempt,
    retry: () => setAttempt((a) => a + 1),
    key,
    imgProps: {
      ref,
      onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => settle(e.currentTarget, false),
      onError: () => {
        settledKey.current = null;
        setResult({ key, status: "error", instant: false });
        onError?.();
      },
    },
  };
}

export type BlurUpImageProps = Omit<React.ComponentProps<"div">, "children" | "onLoad" | "onError"> & {
  /** Leave undefined while the URL is still being resolved; the placeholder holds the space. */
  src?: string;
  alt: string;
  srcSet?: string;
  sizes?: string;
  /** Intrinsic size. Either this pair or `aspectRatio` reserves the box before any bytes arrive. */
  width?: number;
  height?: number;
  aspectRatio?: number | string;
  /** A tiny version of the image (a 16–32px URL or a data URI), shown blurred until the real one lands. */
  placeholder?: string;
  /** The image's dominant color, painted behind everything. Any CSS color. */
  color?: string;
  fit?: "cover" | "contain";
  /** Load eagerly at high priority. Use for the one image above the fold that matters. */
  priority?: boolean;
  /** Replaces the default failed state. */
  fallback?: React.ReactNode;
  errorLabel?: string;
  retryLabel?: string;
  onLoad?: () => void;
  onError?: () => void;
  /** Called when the person presses the retry button, before the image is requested again. */
  onRetry?: () => void;
  imgClassName?: string;
};

export function BlurUpImage({
  src,
  alt,
  srcSet,
  sizes,
  width,
  height,
  aspectRatio,
  placeholder,
  color,
  fit = "cover",
  priority = false,
  fallback,
  errorLabel = "Couldn’t load image",
  retryLabel = "Try again",
  onLoad,
  onError,
  onRetry,
  className,
  imgClassName,
  style,
  ref,
  ...rest
}: BlurUpImageProps) {
  const { status, instant, key, imgProps, retry, attempt } = useImageLoad(src, { onLoad, onError });
  const rootRef = useRef<HTMLDivElement>(null);
  const ratio = aspectRatio ?? (width && height ? `${width} / ${height}` : undefined);
  const settled = status === "loaded";

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      }}
      // Focus lands here when the retry button it held disappears, instead of dropping to the page.
      tabIndex={-1}
      data-state={status}
      data-fit={fit}
      aria-busy={status === "loading" || undefined}
      className={cn("@container relative isolate overflow-hidden bg-hover outline-none", className)}
      style={{ aspectRatio: ratio, backgroundColor: color, ...style }}
      {...rest}
    >
      {/* Nothing to show yet and nothing known about the image: a slow, low pulse, only after 400ms. */}
      {!placeholder && !color && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 bg-fg/[0.025] transition-opacity duration-300",
            status === "loading" ? "animate-pulse-soft [animation-delay:400ms] motion-reduce:animate-none" : "opacity-0",
          )}
        />
      )}

      {placeholder && (
        // Scaled past the edges so the blur has pixels to pull from and never shows a soft border.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          aria-hidden
          alt=""
          src={placeholder}
          decoding="async"
          className={cn(
            "absolute inset-0 size-full scale-110 object-cover blur-xl",
            "transition-opacity duration-300 ease-out",
            // Leaves only once the real image is fully in, so the two never show a gap between them.
            settled && !instant ? "opacity-0 delay-500" : settled ? "opacity-0 duration-0" : "opacity-100",
          )}
        />
      )}

      {src !== undefined && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={key}
          {...imgProps}
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          draggable={false}
          data-instant={instant || undefined}
          className={cn(
            "absolute inset-0 size-full",
            fit === "cover" ? "object-cover" : "object-contain",
            // The reveal: fades in while it sharpens and settles, so it reads as the placeholder coming into focus.
            "transition-[opacity,filter,scale] ease-out-quart motion-reduce:transition-opacity",
            "[transition-duration:450ms,650ms,700ms] motion-reduce:duration-200",
            settled ? "scale-100 opacity-100 blur-[0px]" : "scale-[1.03] opacity-0 blur-md motion-reduce:scale-100 motion-reduce:blur-none",
            "data-instant:transition-none",
            imgClassName,
          )}
        />
      )}

      {status === "error" &&
        (fallback ?? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[inherit] border border-line bg-raised p-3 text-center transition-opacity duration-200 ease-out starting:opacity-0">
            <BrokenImage className="text-fg-4" />
            <p className="hidden text-[12px] leading-4 text-fg-3 @[140px]:block">{errorLabel}</p>
            <button
              type="button"
              onClick={(e) => {
                if (e.currentTarget === document.activeElement) rootRef.current?.focus({ preventScroll: true });
                onRetry?.();
                retry();
              }}
              aria-label={`${retryLabel}: ${alt}`}
              className={cn(
                "group/retry relative inline-flex h-7 items-center gap-1.5 rounded-md border border-line-2 bg-raised px-2 text-[12px] font-medium text-fg shadow-[var(--shadow)]",
                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.96] active:duration-75",
                "before:absolute before:-inset-2 before:content-[''] pointer-fine:before:hidden",
              )}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                // Each attempt turns the arrow once more, so a second press visibly does something.
                style={{ rotate: `${attempt * 360}deg` }}
                className="text-fg-2 transition-[rotate] duration-500 ease-out-expo motion-reduce:transition-none"
              >
                <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75V5h-2.25" />
              </svg>
              <span className="hidden @[110px]:inline">{retryLabel}</span>
            </button>
          </div>
        ))}
    </div>
  );
}

function BrokenImage({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M13.5 9.5V4.75A1.75 1.75 0 0 0 11.75 3h-6.5M2.5 5.25v6A1.75 1.75 0 0 0 4.25 13h7" />
      <path d="m2.75 11.25 3.4-3 2.4 2M2.5 2.5l11 11" />
      <circle cx="10" cy="6.25" r="1" />
    </svg>
  );
}
