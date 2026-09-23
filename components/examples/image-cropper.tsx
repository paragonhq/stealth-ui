"use client";
import { useEffect, useRef, useState } from "react";
import { cropImage, ImageCropper, type CropArea, type CropRotation } from "@/components/ui/image-cropper";

const PHOTO = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&q=80&auto=format";

const kb = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

// Setting a project cover: crop, then export to a real JPEG and see what you'd upload.
export default function Demo() {
  const [area, setArea] = useState<{ area: CropArea; rotation: CropRotation } | null>(null);
  const [result, setResult] = useState<{ url: string; w: number; h: number; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const last = useRef<string | null>(null);
  useEffect(() => () => void (last.current && URL.revokeObjectURL(last.current)), []);

  const apply = async () => {
    if (!area) return;
    setBusy(true);
    setError(false);
    try {
      const blob = await cropImage(PHOTO, area.area, { rotation: area.rotation, maxWidth: 1600 });
      if (last.current) URL.revokeObjectURL(last.current);
      const url = URL.createObjectURL(blob);
      last.current = url;
      const scale = Math.min(1, 1600 / area.area.width);
      setResult({ url, w: Math.round(area.area.width * scale), h: Math.round(area.area.height * scale), size: blob.size });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-3">
      <ImageCropper
        src={PHOTO}
        alt="Valley at sunrise with mist between the cliffs"
        defaultAspect="16:9"
        height={280}
        onCropComplete={(a, r) => setArea({ area: a, rotation: r })}
      />
      <div className="flex items-center gap-3 border-t border-line pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-hover ring-1 ring-line">
            {result && (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob preview
              <img src={result.url} alt="Cropped cover preview" className="size-full object-cover" />
            )}
          </span>
          <p className="min-w-0 truncate text-[12px] text-fg-3" aria-live="polite">
            {error ? (
              <span className="text-danger">Couldn’t export the crop. Try again.</span>
            ) : result ? (
              <>
                <span className="tabular font-mono text-fg-2">
                  {result.w} × {result.h}
                </span>{" "}
                · JPEG · {kb(result.size)}
              </>
            ) : (
              "No cover yet"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={!area || busy}
          aria-busy={busy || undefined}
          className="relative grid h-8 shrink-0 place-items-center rounded-lg bg-fg px-3 text-[12.5px] font-medium text-frame outline-none transition-[background-color,scale,opacity] duration-150 hover:bg-fg/90 active:scale-[0.97] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3 disabled:opacity-50"
        >
          <span className={busy ? "invisible" : undefined}>Set as cover</span>
          {busy && (
            <svg aria-hidden viewBox="0 0 16 16" className="absolute size-4 animate-spin">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
              <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
