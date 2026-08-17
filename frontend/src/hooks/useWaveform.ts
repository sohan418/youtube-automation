import { useEffect, useState } from "react";

const cache = new Map<string, number[]>();

export function useWaveform(url: string | null | undefined, peaks = 48): number[] | null {
  const [data, setData] = useState<number[] | null>(() => (url ? cache.get(url) ?? null : null));

  useEffect(() => {
    if (!url) {
      setData(null);
      return;
    }
    if (cache.has(url)) {
      setData(cache.get(url)!);
      return;
    }
    let cancelled = false;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      setData([]);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch failed");
        const buf = await res.arrayBuffer();
        const ctx = new Ctx();
        const audio = await ctx.decodeAudioData(buf);
        const channel = audio.getChannelData(0);
        const block = Math.floor(channel.length / peaks);
        const out: number[] = [];
        for (let i = 0; i < peaks; i++) {
          const start = i * block;
          const end = Math.min(start + block, channel.length);
          let sum = 0;
          for (let j = start; j < end; j++) sum += Math.abs(channel[j]);
          const avg = end > start ? sum / (end - start) : 0;
          out.push(Math.min(1, avg * 4));
        }
        void ctx.close().catch(() => {});
        if (!cancelled) {
          cache.set(url, out);
          setData(out);
        }
      } catch {
        if (!cancelled) setData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, peaks]);

  return data;
}
