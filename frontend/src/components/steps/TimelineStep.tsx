import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, RotateCcw, Save, Timer } from "lucide-react";
import { api } from "../../api/client";
import type { Scene, TimelineClip, TimelineData, VideoStatus } from "../../types";
import TimelineEditor from "../editor/TimelineEditor";
import { resolveMediaDuration } from "../editor/timeline/mediaMeta";

async function applyOriginalMediaLengths(
  clips: TimelineClip[],
  mediaUrl: (path: string | null | undefined) => string,
): Promise<TimelineClip[]> {
  const out = [...clips];
  let changed = false;
  await Promise.all(
    clips.map(async (c, i) => {
      const p = c.audio_path ?? c.video_path;
      if (!p) return;
      const kind = c.audio_path ? ("audio" as const) : ("video" as const);
      try {
        const d = await resolveMediaDuration(mediaUrl(p), kind);
        if (d == null || !(d > 0)) return;
        if (Math.abs(out[i].duration - d) > 0.05) {
          out[i] = { ...out[i], duration: Math.round(d * 100) / 100 };
          changed = true;
        }
      } catch {
        return;
      }
    }),
  );
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const byScene = new Map<number, TimelineClip[]>();
  const loose: TimelineClip[] = [];
  for (const c of out) {
    if (c.scene_id >= 0) {
      const arr = byScene.get(c.scene_id);
      if (arr) arr.push(c);
      else byScene.set(c.scene_id, [c]);
    } else {
      loose.push(c);
    }
  }
  const sceneIds = [...byScene.keys()].sort(
    (a, b) =>
      Math.min(...(byScene.get(a) ?? []).map((c) => c.start)) -
      Math.min(...(byScene.get(b) ?? []).map((c) => c.start)),
  );
  let cursor = 0;
  let moved = false;
  const placed: TimelineClip[] = [];
  for (const sid of sceneIds) {
    const arr = [...(byScene.get(sid) ?? [])].sort((a, b) => a.start - b.start);
    if (arr.length === 0) continue;
    const base = arr[0].start;
    let end = cursor;
    for (const c of arr) {
      const ns = r2(cursor + (c.start - base));
      if (Math.abs(ns - c.start) > 1e-6) moved = true;
      placed.push({ ...c, start: ns });
      end = Math.max(end, ns + c.duration);
    }
    cursor = end;
  }
  if (!changed && !moved) return clips;
  return [...placed, ...loose].sort((a, b) => a.start - b.start);
}

function buildDefaultTimeline(scenes: Scene[]): TimelineData {
  let t = 0;
  const clips: TimelineClip[] = [];
  for (const s of scenes) {
    const duration = s.duration_seconds ?? 5;
    const image = s.image_path || s.images?.[0]?.file_path || null;
    clips.push({
      id: `v-${s.id}-${t.toFixed(2)}`,
      scene_id: s.id,
      track: "video",
      start: t,
      duration,
      image_path: image,
      video_path: s.video_path,
      audio_path: s.audio_path,
      audio_in: 0,
      audio_out: null,
      volume: 1,
      motion_effect: s.motion_effect || "zoom_in",
    });
    if (s.audio_path) {
      clips.push({
        id: `n-${s.id}-${t.toFixed(2)}`,
        scene_id: s.id,
        track: "narration",
        start: t,
        duration,
        image_path: null,
        video_path: null,
        audio_path: s.audio_path,
        audio_in: 0,
        audio_out: null,
        volume: 1,
      });
    }
    t += duration;
  }
  return { version: 1, duration: t, clips };
}

interface Props {
  projectId: number;
  scenes: Scene[];
  actionLoading: string;
  videoStatus: VideoStatus | null;
  ratio: string;
  mediaUrl: (path: string | null | undefined) => string;
  timeline: TimelineData | null;
  onTimelineChange: (tl: TimelineData) => void;
}

export default function TimelineStep({
  projectId,
  scenes,
  actionLoading,
  videoStatus,
  ratio,
  mediaUrl,
  timeline,
  onTimelineChange,
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const building = actionLoading === "video" || videoStatus?.running;

  const seedDefaults = (scenesArg: Scene[]) => {
    const base = buildDefaultTimeline(scenesArg);
    onTimelineChange(base);
    void applyOriginalMediaLengths(base.clips, mediaUrl).then((clips) => {
      if (clips === base.clips) return;
      let t = 0;
      for (const c of clips) t = Math.max(t, c.start + c.duration);
      onTimelineChange({
        ...base,
        clips,
        duration: Math.round(t * 100) / 100,
      });
    });
  };

  useEffect(() => {
    if (!timeline && scenes.length > 0) {
      seedDefaults(scenes);
    }
  }, [timeline, scenes]);

  const handleChange = (tl: TimelineData) => {
    setSaved(false);
    setDirty(true);
    onTimelineChange(tl);
  };

  const handleSave = async () => {
    if (!timeline) return;
    try {
      setSaving(true);
      await api.saveTimeline(projectId, timeline);
      setDirty(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save timeline", err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (scenes.length === 0) return;
    if (
      !window.confirm(
        "Rebuild the timeline from current scenes? Unsaved edits will be lost.",
      )
    )
      return;
    setDirty(false);
    seedDefaults(scenes);
  };

  const durationLabel = useMemo(() => {
    const d = timeline?.duration ?? 0;
    const m = Math.floor(d / 60);
    const s = d - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, "0")}`;
  }, [timeline]);

  const voiceOverruns = useMemo(() => {
    if (!timeline) return [] as number[];
    const visual = new Map<number, number>();
    const narration = new Map<number, number>();
    for (const c of timeline.clips) {
      if (c.track === "video" && c.scene_id >= 0)
        visual.set(c.scene_id, Math.max(visual.get(c.scene_id) ?? 0, c.duration));
      else if (c.track === "narration" && c.scene_id >= 0)
        narration.set(c.scene_id, Math.max(narration.get(c.scene_id) ?? 0, c.duration));
    }
    const over: number[] = [];
    narration.forEach((dur, sceneId) => {
      if (dur > (visual.get(sceneId) ?? 0) + 0.05) over.push(sceneId);
    });
    return over;
  }, [timeline]);

  return (
    <div
      className="card"
      style={{ display: "grid", gap: "0.75rem", minWidth: 0, maxWidth: "100%" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div>
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Timer size={20} color="var(--primary)" /> Timeline Editor
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Reorder clips, trim narration, and fine-tune timing before
            rendering. Total: <strong>{durationLabel}</strong>
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {voiceOverruns.length > 0 && (
            <span
              className="badge"
              title={`Scenes ${voiceOverruns.join(", ")}: narration is longer than the visuals. The renderer will fade the voice out at the scene end — shorten the script or extend those scenes.`}
              style={{
                background: "var(--warning)",
                color: "#000",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <AlertTriangle size={12} />
              Voice overruns visuals in {voiceOverruns.length} scene
              {voiceOverruns.length > 1 ? "s" : ""}
            </span>
          )}
          {dirty && (
            <span
              className="badge"
              style={{ background: "var(--warning)", color: "#000" }}
            >
              Unsaved changes
            </span>
          )}
          {saved && (
            <span
              className="badge"
              style={{
                background: "var(--success)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <Check size={12} /> Saved
            </span>
          )}
          <button
            className="btn-secondary"
            disabled={scenes.length === 0}
            onClick={handleReset}
            style={{
              fontSize: "0.8rem",
              padding: "0.35rem 0.7rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <RotateCcw size={13} /> Reset from scenes
          </button>
          <button
            className="btn-secondary"
            disabled={!timeline || saving}
            onClick={handleSave}
            style={{
              fontSize: "0.8rem",
              padding: "0.35rem 0.7rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Save size={13} /> {saving ? "Saving..." : "Save Timeline"}
          </button>
        </div>
      </div>

      {timeline && (
        <TimelineEditor
          timeline={timeline}
          scenes={scenes}
          mediaUrl={mediaUrl}
          previewRatio={{
            id: ratio,
            label: ratio,
            width: ratio === "9:16" ? 1080 : 1920,
            height: ratio === "9:16" ? 1920 : 1080,
            resolution: ratio === "9:16" ? "1080×1920" : "1920×1080",
          }}
          onChange={handleChange}
        />
      )}

      {!timeline && (
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          {scenes.length === 0
            ? "Add scenes first to build a timeline."
            : "Preparing timeline from scenes..."}
        </p>
      )}

      {/* Build controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
          paddingTop: "0.25rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        {building && videoStatus && (
          <div
            style={{
              flex: 1,
              minWidth: 200,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {videoStatus.message}
            </span>
            <strong style={{ fontSize: "0.75rem" }}>
              {videoStatus.progress}%
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}
