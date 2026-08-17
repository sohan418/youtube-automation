import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Save, Timer } from "lucide-react";
import { api } from "../../api/client";
import type { Scene, TimelineClip, TimelineData, VideoStatus } from "../../types";
import TimelineEditor from "../editor/TimelineEditor";

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

  useEffect(() => {
    if (!timeline && scenes.length > 0) {
      onTimelineChange(buildDefaultTimeline(scenes));
    }
  }, [timeline, scenes, onTimelineChange]);

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
    onTimelineChange(buildDefaultTimeline(scenes));
  };

  const durationLabel = useMemo(() => {
    const d = timeline?.duration ?? 0;
    const m = Math.floor(d / 60);
    const s = d - m * 60;
    return `${m}:${s.toFixed(1).padStart(4, "0")}`;
  }, [timeline]);

  return (
    <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
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
