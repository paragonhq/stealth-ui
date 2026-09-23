"use client";
import { VideoPlayer } from "@/components/ui/video-player";

const SRC = "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/06/Sintel_trailer-1080p.ogv/Sintel_trailer-1080p.ogv.480p.vp9.webm";
const POSTER = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Sintel_trailer-1080p.ogv/960px-seek%3D34-Sintel_trailer-1080p.ogv.jpg";

const SUBTITLES = `WEBVTT

00:12.000 --> 00:15.000
What brings you to the land of the gatekeepers?

00:18.500 --> 00:20.500
I’m searching for someone.

00:36.500 --> 00:39.000
A dangerous quest for a lone hunter.

00:41.000 --> 00:43.000
I’ve been alone for as long as I can remember.
`;

const tracks = [{ src: `data:text/vtt;charset=utf-8,${encodeURIComponent(SUBTITLES)}`, srcLang: "en", label: "English", default: true }];

const chapters = [
  { start: 0, title: "Cold open" },
  { start: 11, title: "The gatekeeper" },
  { start: 24, title: "The hunt" },
  { start: 44, title: "Title card" },
];

// A trailer cut up for review: chapters on the rail, subtitles on, shortcuts on the tooltips.
export default function Demo() {
  return (
    <figure className="flex w-full max-w-[560px] flex-col gap-2.5">
      <VideoPlayer src={SRC} poster={POSTER} title="Sintel — trailer" duration={52} preload="none" tracks={tracks} chapters={chapters} defaultCaptions />
      <figcaption className="flex items-center justify-between gap-3 px-0.5 text-[12px] text-fg-3">
        <span className="truncate">Sintel · Blender Foundation · CC BY 3.0</span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          <kbd className="grid h-4 min-w-4 place-items-center rounded-[4px] border border-line-2 px-1 font-mono text-[10px] leading-none text-fg-3">K</kbd>
          <span>play</span>
          <kbd className="ml-1.5 grid h-4 min-w-4 place-items-center rounded-[4px] border border-line-2 px-1 font-mono text-[10px] leading-none text-fg-3">←</kbd>
          <kbd className="grid h-4 min-w-4 place-items-center rounded-[4px] border border-line-2 px-1 font-mono text-[10px] leading-none text-fg-3">→</kbd>
          <span>seek</span>
        </span>
      </figcaption>
    </figure>
  );
}
