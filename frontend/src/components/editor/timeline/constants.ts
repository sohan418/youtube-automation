import type { TimelineTrack } from "../../../types";

export const GUTTER_W = 168;
export const RULER_H = 34;
export const MIN_DUR = 0.2;
export const SNAP_PX = 8;
export const PX_MIN = 6;
export const PX_MAX = 480;
export const PX_DEFAULT = 60;
export const RIGHT_PAD = 180;

export const THEME = {
  bg: "#1b1b1f",
  surface: "#222228",
  surfaceAlt: "#26262d",
  separator: "#303038",
  text: "#e5e5ea",
  muted: "#8e8e98",
  accent: "#7c5cff",
  playhead: "#ff4757",
  lane: "#1e1e24",
};

export interface TrackDef {
  id: TimelineTrack;
  label: string;
  color: string;
  softColor: string;
  height: number;
  collapsedHeight: number;
  kind: "text" | "video" | "audio";
}

export const TRACK_ROWS: TrackDef[] = [
  { id: "text", label: "Captions", color: "#9db2ff", softColor: "rgba(125,140,255,0.16)", height: 36, collapsedHeight: 24, kind: "text" },
  { id: "video", label: "Video", color: "#5aa2ff", softColor: "rgba(59,130,246,0.14)", height: 64, collapsedHeight: 30, kind: "video" },
  { id: "narration", label: "Voiceover", color: "#3fd68f", softColor: "rgba(34,197,94,0.13)", height: 48, collapsedHeight: 26, kind: "audio" },
  { id: "music", label: "Music", color: "#2dd4bf", softColor: "rgba(20,184,166,0.13)", height: 46, collapsedHeight: 26, kind: "audio" },
];

export const TRACK_BY_ID: Record<TimelineTrack, TrackDef> = Object.fromEntries(
  TRACK_ROWS.map((r) => [r.id, r]),
) as Record<TimelineTrack, TrackDef>;

export function compatibleTracks(track: TimelineTrack): TimelineTrack[] {
  const def = TRACK_BY_ID[track];
  if (!def) return [track];
  return TRACK_ROWS.filter((r) => r.kind === def.kind).map((r) => r.id);
}
