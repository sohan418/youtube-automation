import { useEffect, useState } from "react";
import { decodePeaks } from "./peaks";

const videoCache = new Map<string, number>();
const audioCache = new Map<string, number>();
const inflightVideo = new Map<string, Promise<number | null>>();

function probeVideoDuration(url: string): Promise<number | null> {
  const running = inflightVideo.get(url);
  if (running) return running;
  const task = new Promise<number | null>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () =>
      resolve(isFinite(v.duration) && v.duration > 0 ? v.duration : null);
    v.onerror = () => resolve(null);
    v.src = url;
  }).finally(() => inflightVideo.delete(url));
  inflightVideo.set(url, task);
  return task;
}

export function getCachedMediaDuration(
  url: string,
  kind: "audio" | "video",
): number | null {
  return (kind === "video" ? videoCache : audioCache).get(url) ?? null;
}

export async function resolveMediaDuration(
  url: string,
  kind: "audio" | "video",
): Promise<number | null> {
  const hit = getCachedMediaDuration(url, kind);
  if (hit != null) return hit;
  if (kind === "audio") {
    try {
      const d = await decodePeaks(url);
      if (!d.real || !(d.duration > 0)) return null;
      audioCache.set(url, d.duration);
      return d.duration;
    } catch {
      return null;
    }
  }
  const d = await probeVideoDuration(url);
  if (d != null) videoCache.set(url, d);
  return d;
}

export function useMediaDuration(
  url: string | null | undefined,
  kind: "audio" | "video",
): number | null {
  const [dur, setDur] = useState<number | null>(() =>
    url
      ? (kind === "video" ? videoCache.get(url) : audioCache.get(url)) ?? null
      : null,
  );
  useEffect(() => {
    if (!url) {
      setDur(null);
      return;
    }
    const cache = kind === "video" ? videoCache : audioCache;
    const hit = cache.get(url);
    if (hit != null) {
      setDur(hit);
      return;
    }
    let alive = true;
    if (kind === "audio") {
      decodePeaks(url).then((d) => {
        if (!alive || !d.real || !(d.duration > 0)) return;
        cache.set(url, d.duration);
        setDur(d.duration);
      });
    } else {
      probeVideoDuration(url).then((d) => {
        if (!alive || d == null) return;
        cache.set(url, d);
        setDur(d);
      });
    }
    return () => {
      alive = false;
    };
  }, [url, kind]);
  return dur;
}
