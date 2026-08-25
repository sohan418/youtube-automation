import { useEffect, useState } from "react";
import { pseudoPeaks } from "./utils";

export interface PeaksData {
  peaks: Float32Array;
  duration: number;
  real: boolean;
}

const cache = new Map<string, PeaksData>();
const MAX_CACHE = 24;
let audioCtx: AudioContext | null = null;
const inflight = new Map<string, Promise<PeaksData>>();

function ctx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function computePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const ch = buffer.numberOfChannels;
  const len = buffer.length;
  const out = new Float32Array(buckets);
  const per = Math.max(1, Math.floor(len / buckets));
  const data: Float32Array[] = [];
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  let max = 0.0001;
  for (let b = 0; b < buckets; b++) {
    const start = b * per;
    const end = Math.min(len, start + per);
    let peak = 0;
    for (let i = start; i < end; i += 2) {
      let v = 0;
      for (let c = 0; c < ch; c++) v += Math.abs(data[c][i]);
      v /= ch;
      if (v > peak) peak = v;
    }
    out[b] = peak;
    if (peak > max) max = peak;
  }
  for (let b = 0; b < buckets; b++) out[b] = Math.min(1, out[b] / max);
  return out;
}

function decode(url: string): Promise<PeaksData> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(url);
  if (running) return running;
  const ac = ctx();
  if (!ac) return Promise.resolve(fallback(url));
  const task = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.arrayBuffer();
    })
    .then((buf) => ac.decodeAudioData(buf))
    .then((audio) => {
      const result: PeaksData = {
        peaks: computePeaks(audio, 1024),
        duration: audio.duration,
        real: true,
      };
      store(url, result);
      return result;
    })
    .catch(() => fallback(url))
    .finally(() => inflight.delete(url));
  inflight.set(url, task);
  return task;
}

function fallback(url: string): PeaksData {
  return { peaks: pseudoPeaks(url), duration: 0, real: false };
}

function store(url: string, data: PeaksData) {
  if (cache.has(url)) return;
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(url, data);
}

export function decodePeaks(url: string): Promise<PeaksData> {
  return decode(url);
}

export function usePeaks(
  url: string | null | undefined,
  enabled = true,
): PeaksData | null {
  const key = url ?? "";
  const [data, setData] = useState<PeaksData | null>(
    key ? cache.get(key) ?? null : null,
  );
  useEffect(() => {
    if (!key || !enabled) {
      setData(null);
      return;
    }
    const hit = cache.get(key);
    if (hit) {
      setData(hit);
      return;
    }
    let alive = true;
    decode(key).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [key, enabled]);
  return data;
}
