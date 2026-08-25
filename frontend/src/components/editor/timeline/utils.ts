import type { TimelineClip } from "../../../types";
import { SNAP_PX } from "./constants";

export interface SilenceBounds {
  lead: number;
  tail: number;
}

export function silenceBounds(
  peaks: Float32Array | null,
  srcDuration: number,
  threshold = 0.02,
): SilenceBounds | null {
  if (!peaks || peaks.length === 0 || !(srcDuration > 0)) return null;
  const n = peaks.length;
  let a = 0;
  while (a < n && (peaks[a] ?? 0) < threshold) a++;
  if (a >= n) return null;
  let b = n - 1;
  while (b > a && (peaks[b] ?? 0) < threshold) b--;
  const per = srcDuration / n;
  return {
    lead: Math.max(0, a * per),
    tail: Math.max(0, (n - 1 - b) * per),
  };
}

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const round2 = (v: number) => Math.round(v * 100) / 100;

export function fmtTime(t: number, centis = true): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  if (centis) {
    return `${String(m).padStart(2, "0")}:${r.toFixed(2).padStart(5, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${Math.floor(r)
    .toString()
    .padStart(2, "0")}`;
}

const STEP_CANDIDATES = [
  0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 3600,
];

export function majorStepFor(pxPerSec: number): number {
  for (const s of STEP_CANDIDATES) {
    if (s * pxPerSec >= 78) return s;
  }
  return STEP_CANDIDATES[STEP_CANDIDATES.length - 1];
}

export function rulerLabel(sec: number, step: number): string {
  if (step < 1) return `${sec.toFixed(2).replace(/\.?0+$/, "")}s`;
  const m = Math.floor(sec / 60);
  const r = Math.round(sec - m * 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pseudoPeaks(seed: string, count = 1024): Float32Array {
  let h = hashSeed(seed) || 1;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r1 = ((h >>> 0) % 1000) / 1000;
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r2 = ((h >>> 0) % 1000) / 1000;
    out[i] = 0.15 + (r1 * 0.6 + r2 * 0.4) * 0.85;
  }
  return out;
}

export interface SnapContext {
  clips: TimelineClip[];
  excludeId?: string | null;
  playhead: number;
  markers?: number[];
}

export function snapTargets(ctx: SnapContext): number[] {
  const pts = new Set<number>([0, ctx.playhead]);
  for (const c of ctx.clips) {
    if (c.id === ctx.excludeId) continue;
    pts.add(round2(c.start));
    pts.add(round2(c.start + c.duration));
  }
  for (const m of ctx.markers ?? []) pts.add(round2(m));
  return [...pts];
}

export function applySnap(
  value: number,
  targets: number[],
  pxPerSec: number,
  enabled: boolean,
): { time: number; snapped: boolean } {
  if (!enabled || targets.length === 0) return { time: value, snapped: false };
  const thresh = SNAP_PX / pxPerSec;
  let best = value;
  let bestD = thresh;
  for (const t of targets) {
    const d = Math.abs(t - value);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return { time: best, snapped: best !== value };
}

export function clipLabel(clip: TimelineClip, orderIndex?: number): string {
  switch (clip.track) {
    case "video":
      return clip.scene_id >= 0 && orderIndex != null
        ? `Scene ${orderIndex}`
        : clip.video_path
          ? fileBase(clip.video_path)
          : "Video";
    case "narration":
      return clip.scene_id >= 0 && orderIndex != null
        ? `Voice ${orderIndex}`
        : clip.audio_path
          ? fileBase(clip.audio_path)
          : "Voiceover";
    case "music":
      return clip.audio_path ? fileBase(clip.audio_path) : "Music";
    case "text":
      return clip.text?.trim() || "Caption";
  }
}

export function fileBase(p: string): string {
  const base = p.split(/[\\/]/).pop() ?? p;
  return base.length > 22 ? `${base.slice(0, 20)}…` : base;
}

export function fadeGain(clip: TimelineClip, localT: number): number {
  let g = 1;
  const fi = clip.fade_in ?? 0;
  const fo = clip.fade_out ?? 0;
  if (fi > 0 && localT < fi) g *= Math.max(0, localT / fi);
  if (fo > 0 && localT > clip.duration - fo) {
    g *= Math.max(0, (clip.duration - localT) / fo);
  }
  return clamp(g, 0, 1);
}

let idCounter = 0;
export function freshId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}`;
}
