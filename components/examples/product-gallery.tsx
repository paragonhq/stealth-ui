"use client";
import { ProductGallery, type ProductImage } from "@/components/ui/product-gallery";

const crop = (rect: string, w: number) => `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?rect=${rect}&w=${w}&h=${w}&fit=crop&q=80`;
const shot = (rect: string, alt: string): ProductImage => ({ src: crop(rect, 900), thumb: crop(rect, 160), zoomSrc: crop(rect, 1800), alt });

const images = [
  shot("2050,250,3400,3400", "Studio Wireless headphones in onyx, lying flat on a yellow surface"),
  shot("2150,1500,1500,1500", "Close-up of the left ear cushion in soft protein leather"),
  shot("3200,2000,1500,1500", "Power and pairing buttons on the right ear cup"),
  shot("3000,300,1800,1800", "Perforated headband with memory-foam padding"),
];

// A product page: pick a thumbnail, swipe on a phone, or hover to inspect the stitching.
export default function Demo() {
  return (
    <div className="flex w-full max-w-[540px] flex-col gap-5 sm:flex-row sm:items-start">
      <ProductGallery images={images} className="sm:w-[300px] sm:shrink-0" />
      <div className="flex min-w-0 flex-col gap-1.5 pt-1">
        <p className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-3">Audio</p>
        <p className="text-[15px] font-medium tracking-[-0.015em] text-fg">Studio Wireless</p>
        <p className="text-[13px] text-fg-2 tabular">$349</p>
        <p className="mt-2 text-[12.5px] leading-[19px] text-fg-3 text-pretty">
          Active noise cancelling, 40 hours of battery, and ear cushions that don’t heat up on a long flight.
        </p>
        <p className="mt-2 text-[12px] text-fg-3">
          Color <span className="text-fg-2">Onyx</span>
        </p>
      </div>
    </div>
  );
}
