import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Scene, TimelineClip, TimelineData, VideoStatus } from "../../types";
import TimelineEditor from "../editor/TimelineEditor";
import { resolveMediaDuration } from "../editor/timeline/mediaMeta";
import "./TimelineStep.css";

async function applyOriginalMediaLengths(
  clips: TimelineClip[],
  mediaUrl: (path: string | null | undefined) => string,
): Promise<TimelineClip[]> {
  const out = [...clips];
  let changed = false;
  await Promise.all(
    clips.map(async (c, i) => {
      let p: string | null | undefined = null;
      let kind: "audio" | "video" = "audio";
      if (c.track === "narration" || c.track === "music") {
        p = c.audio_path;
        kind = "audio";
      } else if (c.video_path) {
        p = c.video_path;
        kind = "video";
      } else {
        return;
      }
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
    const arr = [...(byScene.get(sid) ?? [])];
    if (arr.length === 0) continue;

    const narClip = arr.find((c) => c.track === "narration");
    const vidClips = arr.filter((c) => c.track === "video");

    const sceneDuration =
      narClip?.duration && narClip.duration > 0
        ? narClip.duration
        : vidClips.length > 0
          ? vidClips.reduce((sum, c) => sum + c.duration, 0)
          : 5;

    let vCursor = cursor;
    const numVids = vidClips.length;
    if (numVids > 0) {
      const baseSubDur = sceneDuration / numVids;
      vidClips.forEach((c, idx) => {
        const isLast = idx === numVids - 1;
        const subDur = isLast
          ? r2(cursor + sceneDuration - vCursor)
          : r2(baseSubDur);
        const ns = r2(vCursor);
        if (
          Math.abs(ns - c.start) > 1e-6 ||
          Math.abs(subDur - c.duration) > 1e-6
        )
          moved = true;
        placed.push({ ...c, start: ns, duration: Math.max(0.2, subDur) });
        vCursor += subDur;
      });
    }

    for (const c of arr) {
      if (c.track === "video") continue;
      const ns = r2(cursor);
      if (Math.abs(ns - c.start) > 1e-6) moved = true;
      placed.push({ ...c, start: ns });
    }

    cursor = r2(cursor + sceneDuration);
  }
  if (!changed && !moved) return clips;
  return [...placed, ...loose].sort((a, b) => a.start - b.start);
}

function buildSceneVideoClips(s: Scene, startT: number): TimelineClip[] {
  const totalDuration = s.duration_seconds ?? 5;
  const mediaItems: { image_path: string | null; video_path: string | null }[] = [];

  const images = [...(s.images || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const videos = [...(s.videos || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  for (const img of images) {
    if (img.file_path) {
      mediaItems.push({ image_path: img.file_path, video_path: null });
    }
  }
  for (const vid of videos) {
    if (vid.file_path) {
      const isImg = /\.(png|jpg|jpeg|webp)$/i.test(vid.file_path);
      mediaItems.push({
        image_path: isImg ? vid.file_path : null,
        video_path: isImg ? null : vid.file_path,
      });
    }
  }

  if (mediaItems.length === 0) {
    mediaItems.push({
      image_path: s.image_path || null,
      video_path: s.video_path || null,
    });
  }

  const subDuration = Math.max(0.2, totalDuration / mediaItems.length);
  let curT = startT;
  const clips: TimelineClip[] = [];

  mediaItems.forEach((m, idx) => {
    const isLast = idx === mediaItems.length - 1;
    const dur = isLast
      ? Math.max(0.2, Math.round((startT + totalDuration - curT) * 100) / 100)
      : Math.max(0.2, Math.round(subDuration * 100) / 100);

    clips.push({
      id: `v-${s.id}-${curT.toFixed(2)}-${idx}`,
      scene_id: s.id,
      track: "video",
      start: Math.round(curT * 100) / 100,
      duration: dur,
      image_path: m.image_path,
      video_path: m.video_path,
      audio_path: null,
      audio_in: 0,
      audio_out: null,
      volume: 1,
      motion_effect: s.motion_effect || "none",
    });

    curT += dur;
  });

  return clips;
}

function buildDefaultTimeline(scenes: Scene[]): TimelineData {
  let t = 0;
  const clips: TimelineClip[] = [];
  for (const s of scenes) {
    const duration = s.duration_seconds ?? 5;
    const vClips = buildSceneVideoClips(s, t);
    clips.push(...vClips);
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
  onAddScene?: () => Promise<Scene | null>;
  onActiveSceneChange?: (idx: number) => void;
  onPlaybackStateChange?: (state: any) => void;
  onSelectedClipInfoChange?: (info: any) => void;
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
  onAddScene,
  onActiveSceneChange,
  onPlaybackStateChange,
  onSelectedClipInfoChange,
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const seededRef = useRef(false);

  const building = actionLoading === "video" || videoStatus?.running;

  const seedDefaults = (scenesArg: Scene[]) => {
    const base = buildDefaultTimeline(scenesArg);
    base.music = timeline?.music ?? null;
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
    if (!timeline && scenes.length > 0 && !seededRef.current) {
      seededRef.current = true;
      seedDefaults(scenes);
      return;
    }
    if (timeline) seededRef.current = true;
    if (!timeline || scenes.length === 0) return;

    const sceneByIdMap = new Map(scenes.map((s) => [s.id, s]));
    const existingSceneIds = new Set(scenes.map((s) => s.id));
    const sceneClipMap = new Set(
      timeline.clips.filter((c) => c.scene_id >= 0).map((c) => c.scene_id),
    );

    const missingScenes = scenes.filter((s) => !sceneClipMap.has(s.id));
    const hasOrphanedClips = timeline.clips.some(
      (c) => c.scene_id >= 0 && !existingSceneIds.has(c.scene_id),
    );

    // Check if any scene's media item count has changed compared to video clips on timeline
    const videoClipsByScene = new Map<number, TimelineClip[]>();
    for (const c of timeline.clips) {
      if (c.track === "video" && c.scene_id >= 0) {
        const list = videoClipsByScene.get(c.scene_id) || [];
        list.push(c);
        videoClipsByScene.set(c.scene_id, list);
      }
    }

    let mediaStructureChanged = false;
    for (const s of scenes) {
      const existingClips = videoClipsByScene.get(s.id) || [];
      const imageCount = (s.images || []).length;
      const videoCount = (s.videos || []).length;
      const expectedCount = Math.max(1, imageCount + videoCount);
      if (existingClips.length > 0 && existingClips.length !== expectedCount) {
        mediaStructureChanged = true;
        break;
      }
    }

    if (mediaStructureChanged) {
      const base = buildDefaultTimeline(scenes);
      base.music = timeline.music;
      onTimelineChange(base);
      return;
    }

    let mediaChanged = false;
    let updatedClips = timeline.clips
      .filter((c) => c.scene_id < 0 || existingSceneIds.has(c.scene_id))
      .map((c) => {
        if (c.scene_id >= 0) {
          const s = sceneByIdMap.get(c.scene_id);
          if (s) {
            const expectedVideo = s.video_path || null;
            const expectedAudio = s.audio_path || null;
            let changed = false;
            const patch: Partial<TimelineClip> = {};
            if (c.track === "video") {
              if (!c.image_path && c.video_path !== expectedVideo) {
                patch.video_path = expectedVideo;
                changed = true;
              }
            } else if (c.track === "narration") {
              if (c.audio_path !== expectedAudio) {
                patch.audio_path = expectedAudio;
                changed = true;
              }
            }
            if (changed) {
              mediaChanged = true;
              return { ...c, ...patch };
            }
          }
        }
        return c;
      });

    if (missingScenes.length === 0 && !hasOrphanedClips && !mediaChanged) return;

    if (missingScenes.length > 0) {
      let t = updatedClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
      for (const s of missingScenes) {
        const duration = s.duration_seconds ?? 5;
        const vClips = buildSceneVideoClips(s, t);
        updatedClips.push(...vClips);
        if (s.audio_path) {
          updatedClips.push({
            id: `n-${s.id}-${t.toFixed(2)}`,
            scene_id: s.id,
            track: "narration",
            start: Math.round(t * 100) / 100,
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
    }

    const maxT = updatedClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0);
    onTimelineChange({
      ...timeline,
      duration: Math.round(maxT * 100) / 100,
      clips: updatedClips,
    });
  }, [scenes, timeline, onTimelineChange]);

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
    <div className="timeline-wrapper">
      {timeline && (
        <TimelineEditor
          timeline={timeline}
          scenes={scenes}
          mediaUrl={mediaUrl}
          projectId={projectId}
          previewRatio={{
            id: ratio,
            label: ratio,
            width: ratio === "9:16" ? 1080 : 1920,
            height: ratio === "9:16" ? 1920 : 1080,
            resolution: ratio === "9:16" ? "1080×1920" : "1920×1080",
          }}
          onChange={handleChange}
          onAddScene={onAddScene}
          onSave={handleSave}
          onReset={handleReset}
          dirty={dirty}
          saved={saved}
          saving={saving}
          onActiveSceneChange={onActiveSceneChange}
          onPlaybackStateChange={onPlaybackStateChange}
          voiceOverruns={voiceOverruns}
          onSelectedClipInfoChange={onSelectedClipInfoChange}
        />
      )}

      {!timeline && (
        <p className="timeline-hint">
          {scenes.length === 0
            ? "Add scenes first to build a timeline."
            : "Preparing timeline from scenes..."}
        </p>
      )}

      {/* Build controls */}
      {building && videoStatus && (
        <div className="timeline-build-controls">
          <div className="timeline-building-status">
            <span className="timeline-building-message">
              {videoStatus.message}
            </span>
            <strong className="timeline-building-progress">
              {videoStatus.progress}%
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
