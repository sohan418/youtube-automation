import {
  AlignStartVertical,
  ChevronDown,
  ChevronUp,
  ChevronsRight,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Magnet,
  Maximize,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  Settings,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Volume2,
  VolumeX,
  Waves,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  RotateCcw,
  Save,
  Check,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Scene,
  TimelineClip,
  TimelineData,
  TimelineTrack,
  VideoRatio,
} from "../../types";
import { api } from "../../api/client";
import { AudioClipView, TextView, VideoClipView } from "./timeline/Clips";
import { useMediaDuration } from "./timeline/mediaMeta";
import {
  GUTTER_W,
  MIN_DUR,
  PX_MAX,
  PX_MIN,
  RULER_H,
  THEME,
  TRACK_BY_ID,
  TRACK_ROWS,
} from "./timeline/constants";
import { ContextMenu, type MenuItem } from "./timeline/ContextMenu";
import { PreviewPanel } from "./timeline/PreviewPanel";
import { Ruler } from "./timeline/Ruler";
import { fmtTime, freshId, round2 } from "./timeline/utils";
import { useTimelineEngine } from "./timeline/useEngine";

const CSS = `
.vtl-hl,.vtl-hr{position:absolute;top:0;bottom:0;width:9px;z-index:6;cursor:ew-resize;opacity:0}
.vtl-hl{left:0}.vtl-hr{right:0}
.vtl-clip:hover .vtl-hl,.vtl-sel .vtl-hl,.vtl-clip:hover .vtl-hr,.vtl-sel .vtl-hr{opacity:1}
.vtl-hl::after,.vtl-hr::after{content:'';position:absolute;top:22%;bottom:22%;width:3px;border-radius:2px;background:#fff;left:3px;box-shadow:0 0 4px rgba(0,0,0,.65)}
.vtl-hr::after{left:auto;right:3px}
.vtl-sel{box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),0 0 0 2px #ffffff,0 0 0 4px rgba(124,92,255,.8)!important}
.vtl-drag{box-shadow:0 12px 30px rgba(0,0,0,.55),0 0 0 2px #7c5cff!important}
.vtl-locked .vtl-hl,.vtl-locked .vtl-hr{display:none}
`;

const MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

interface Props {
  timeline: TimelineData;
  scenes: Scene[];
  mediaUrl: (path: string | null | undefined) => string;
  previewRatio?: VideoRatio;
  showPreview?: boolean;
  projectId?: number;
  onAddScene?: () => Promise<Scene | null>;
  onChange: (tl: TimelineData) => void;
  onSave?: () => void;
  onReset?: () => void;
  dirty?: boolean;
  saved?: boolean;
  saving?: boolean;
  onActiveSceneChange?: (idx: number) => void;
  onPlaybackStateChange?: (state: {
    time: number;
    playing: boolean;
    activeVideo: TimelineClip | null;
    activeScene: Scene | null;
    activeCaption: string | null;
  }) => void;
  voiceOverruns?: number[];
  onSelectedClipInfoChange?: (info: any) => void;
}

export default function TimelineEditor({
  timeline,
  scenes,
  mediaUrl,
  previewRatio: _previewRatio,
  showPreview = false,
  projectId,
  onAddScene,
  onChange,
  onSave,
  onReset,
  dirty,
  saved,
  saving,
  onActiveSceneChange,
  onPlaybackStateChange,
  voiceOverruns,
  onSelectedClipInfoChange,
}: Props) {
  const E = useTimelineEngine(timeline, scenes, mediaUrl, onChange);
  const [showPreviewState, setShowPreviewState] = useState(showPreview);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    clipId: string | null;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setSettingsOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [settingsOpen]);

  const t = E.time;
  const px = E.px;

  const clipAtTime = (track: TimelineTrack, time: number): TimelineClip | null => {
    let active: TimelineClip | null = null;
    for (const c of E.clips) {
      if (c.track !== track) continue;
      if (time >= c.start && time < c.start + c.duration) {
        if (!active || c.start > active.start) active = c;
      }
    }
    return active;
  };

  const activeVideo = useMemo(() => clipAtTime("video", E.time), [E.clips, E.time]);
  const activeCaption = useMemo(() => {
    const c = clipAtTime("text", E.time);
    return c?.text && c.text.trim() ? c.text.trim() : null;
  }, [E.clips, E.time]);
  const activeScene = activeVideo ? E.sceneById.get(activeVideo.scene_id) ?? null : null;

  useEffect(() => {
    if (activeScene && activeScene.id !== undefined && onActiveSceneChange) {
      const idx = scenes.findIndex((s) => s.id === activeScene.id);
      if (idx !== -1) {
        onActiveSceneChange(idx);
      }
    }
  }, [activeScene, scenes, onActiveSceneChange]);

  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  onPlaybackStateChangeRef.current = onPlaybackStateChange;
  const lastPlaybackStateRef = useRef<{
    time: number;
    playing: boolean;
    activeVideoId: string | null;
    activeSceneId: number | null;
    activeCaption: string | null;
  } | null>(null);

  useEffect(() => {
    const cb = onPlaybackStateChangeRef.current;
    if (!cb) return;

    const prev = lastPlaybackStateRef.current;
    const activeVideoId = activeVideo?.id ?? null;
    const activeSceneId = activeScene?.id ?? null;

    if (
      prev &&
      prev.playing === E.playing &&
      prev.activeVideoId === activeVideoId &&
      prev.activeSceneId === activeSceneId &&
      prev.activeCaption === activeCaption &&
      Math.abs(prev.time - E.time) < 0.04
    ) {
      return;
    }

    lastPlaybackStateRef.current = {
      time: E.time,
      playing: E.playing,
      activeVideoId,
      activeSceneId,
      activeCaption,
    };

    cb({
      time: E.time,
      playing: E.playing,
      activeVideo,
      activeScene,
      activeCaption,
    });
  }, [E.time, E.playing, activeVideo, activeScene, activeCaption]);


  const sel = E.selected;
  const selDef = sel ? TRACK_BY_ID[sel.track] : null;
  const selSrcDur = useMediaDuration(
    sel?.audio_path
      ? mediaUrl(sel.audio_path)
      : sel?.video_path
        ? mediaUrl(sel.video_path)
        : null,
    sel?.audio_path ? "audio" : "video",
  );

  const ERef = useRef(E);
  ERef.current = E;

  const onSelectedClipInfoChangeRef = useRef(onSelectedClipInfoChange);
  onSelectedClipInfoChangeRef.current = onSelectedClipInfoChange;

  useEffect(() => {
    const cb = onSelectedClipInfoChangeRef.current;
    if (!cb) return;
    if (sel && selDef) {
      cb({
        clip: sel,
        orderIndex: sel.scene_id >= 0 ? ERef.current.sceneById.get(sel.scene_id)?.order_index : undefined,
        canSplit: t > sel.start + MIN_DUR && t < sel.start + sel.duration - MIN_DUR,
        canTrimStart: t > sel.start + MIN_DUR,
        canTrimEnd: t < sel.start + sel.duration - MIN_DUR,
        canMoveUp: !!ERef.current.adjacentRow(sel.track, -1),
        canMoveDown: !!ERef.current.adjacentRow(sel.track, 1),
        sourceDuration: selSrcDur,
        onPatch: (patch: any, mergeKey?: string) => ERef.current.patchClip(sel.id, patch, mergeKey),
        onSplit: () => ERef.current.splitClipAt(sel, t),
        onTrimStart: () => ERef.current.trimSelectedEdge("start"),
        onTrimEnd: () => ERef.current.trimSelectedEdge("end"),
        onCleanSilence: sel.audio_path ? () => void ERef.current.removeSilentEdges(sel.id) : undefined,
        onDuplicate: () => ERef.current.duplicateClip(sel),
        onDelete: () => ERef.current.deleteClipOp(sel, ERef.current.rippleOn),
        onMoveRow: (dir: -1 | 1) => ERef.current.moveClipRow(sel, dir),
      });
    } else {
      cb(null);
    }
  }, [
    sel?.id,
    sel?.start,
    sel?.duration,
    sel?.volume,
    sel?.muted,
    sel?.text,
    sel?.audio_in,
    sel?.fade_in,
    sel?.fade_out,
    sel?.motion_effect,
    selDef?.id,
    selSrcDur,
    t,
  ]);

  const [dragDepth, setDragDepth] = useState(0);
  const [droppingFile, setDroppingFile] = useState<string | null>(null);

  const handleDropFiles = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragDepth(0);
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length === 0 || !projectId) return;
      const r = E.ticksRef.current?.getBoundingClientRect();
      let cursor = r ? Math.max(0, (e.clientX - r.left) / px) : 0;
      const rowEl = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-row]");
      const dropRow = rowEl?.getAttribute("data-row") as TimelineTrack | null;
      for (const file of files) {
        setDroppingFile(file.name);
        try {
          const res = await api.uploadTimelineMedia(projectId, file);
          const dur = Math.max(
            MIN_DUR,
            round2(res.duration_seconds && res.duration_seconds > 0 ? res.duration_seconds : 5),
          );
          const track: TimelineTrack =
            res.kind === "audio"
              ? dropRow === "music"
                ? "music"
              : "narration"
              : "video";
          const clip: TimelineClip = {
            id: freshId("x"),
            scene_id: -1,
            track,
            start: round2(cursor),
            duration: dur,
            image_path: res.kind === "image" ? res.file_path : null,
            video_path: res.kind === "video" ? res.file_path : null,
            audio_path: res.kind === "audio" ? res.file_path : null,
            audio_in: 0,
            audio_out: null,
            volume: track === "music" ? 0.8 : 1,
            motion_effect: "none",
          };
          E.addClip(clip);
          cursor += dur;
        } catch (err) {
          console.error("Timeline media upload failed", err);
        } finally {
          setDroppingFile(null);
        }
      }
    },
    [E, projectId, px],
  );

  const openMenuFor = useCallback((x: number, y: number, clipId: string | null) => {
    setMenu({ x, y, clipId });
  }, []);

  const menuItems: MenuItem[] = (() => {
    const clip = menu?.clipId ? E.clipMap.get(menu.clipId) ?? null : null;
    if (!clip) {
      return [
      {
        label: "Add caption here",
        icon: <Plus size={13} />,
        onSelect: () => E.addTextClip(t),
      },
      {
        label: "Close gaps (all tracks)",
        icon: <AlignStartVertical size={13} />,
        onSelect: () => E.closeGaps(),
        disabled: E.clips.length < 2,
      },
      {
        label: "Fit timeline",
        icon: <Maximize size={13} />,
        onSelect: () => E.fitTimeline(),
      },
        {
          label: E.snapOn ? "Snapping: ON" : "Snapping: OFF",
          icon: <Magnet size={13} />,
          onSelect: () => E.setSnapOn(!E.snapOn),
        },
      ];
    }
    const rs = E.rowStateOf(clip.track);
    return [
      {
        label: "Split at playhead",
        icon: <Scissors size={13} />,
        shortcut: "S",
        disabled:
          t <= clip.start + MIN_DUR || t >= clip.start + clip.duration - MIN_DUR,
        onSelect: () => E.splitClipAt(clip, t),
      },
      {
        label: "Duplicate",
        icon: <Copy size={13} />,
        shortcut: "Ctrl+D",
        onSelect: () => E.duplicateClip(clip),
      },
      {
        label: "Trim in to playhead",
        separatorBefore: true,
        disabled: t <= clip.start + MIN_DUR,
        onSelect: () => {
          E.setSelectedId(clip.id);
          requestAnimationFrame(() => E.trimSelectedEdge("start"));
        },
      },
      {
        label: "Trim out to playhead",
        disabled: t >= clip.start + clip.duration - MIN_DUR,
        onSelect: () => {
          E.setSelectedId(clip.id);
          requestAnimationFrame(() => E.trimSelectedEdge("end"));
        },
      },
      ...(clip.audio_path
        ? [
            {
              label: "Remove silent edges",
              icon: <Waves size={13} />,
              separatorBefore: true,
              onSelect: () => void E.removeSilentEdges(clip.id),
            } as MenuItem,
          ]
        : []),
      ...((clip.audio_path || clip.video_path) &&
      selSrcDur != null &&
      selSrcDur > clip.duration + 0.05 &&
      menu?.clipId === sel?.id
        ? [
            {
              label: `Extend to full source (${selSrcDur.toFixed(1)}s)`,
              icon: <ChevronsRight size={13} />,
              onSelect: () => void E.extendToSource(clip.id),
            } as MenuItem,
          ]
        : []),
      {
        label: "Move up",
        icon: <ChevronUp size={13} />,
        separatorBefore: true,
        disabled: !E.adjacentRow(clip.track, -1),
        onSelect: () => E.moveClipRow(clip, -1),
      },
      {
        label: "Move down",
        icon: <ChevronDown size={13} />,
        disabled: !E.adjacentRow(clip.track, 1),
        onSelect: () => E.moveClipRow(clip, 1),
      },
      {
        label: clip.locked ? "Unlock clip" : "Lock clip",
        icon: clip.locked ? <Unlock size={13} /> : <Lock size={13} />,
        onSelect: () => E.patchClip(clip.id, { locked: !clip.locked }),
      },
      {
        label: clip.muted ? "Unmute clip" : "Mute clip",
        icon: clip.muted ? <Volume2 size={13} /> : <VolumeX size={13} />,
        disabled: !(clip.audio_path || clip.video_path || clip.track === "video"),
        onSelect: () => E.patchClip(clip.id, { muted: !clip.muted }),
      },
      ...(clip.track === "video"
        ? ([
            {
              label: E.rowStateOf("video").muted ? "Unmute all video scenes" : "Mute all video scenes",
              icon: E.rowStateOf("video").muted ? <Volume2 size={13} /> : <VolumeX size={13} />,
              onSelect: () => E.muteAllVideoClips(!E.rowStateOf("video").muted),
            },
          ] as MenuItem[])
        : []),
      {
        label: "Delete",
        icon: <Trash2 size={13} />,
        shortcut: "Del",
        danger: true,
        separatorBefore: true,
        onSelect: () => E.deleteClipOp(clip, false),
      },
      {
        label: "Ripple delete",
        danger: true,
        onSelect: () => E.deleteClipOp(clip, true),
      },
      ...(rs.locked
        ? ([
            {
              label: "Unlock track",
              icon: <Lock size={13} />,
              separatorBefore: true,
              onSelect: () => E.toggleRowFlag(clip.track, "locked"),
            },
          ] as MenuItem[])
        : []),
    ];
  })();

  const renderClip = (c: TimelineClip, h: number) => {
    const wPx = Math.max(8, c.duration * px);
    const isSel = c.id === E.selectedId;
    const dragging = E.draggingId === c.id;
    const orderIndex =
      c.scene_id >= 0 ? E.sceneById.get(c.scene_id)?.order_index : undefined;
    let view: React.ReactNode;
    if (c.track === "video") {
      view = (
        <VideoClipView
          clip={c}
          widthPx={wPx}
          heightPx={h}
          selected={isSel}
          dragging={dragging}
          orderIndex={orderIndex}
          thumbUrl={c.image_path ? mediaUrl(c.image_path) : null}
          probeUrl={c.video_path ? mediaUrl(c.video_path) : null}
          onExtendToSource={() => void E.extendToSource(c.id)}
        />
      );
    } else if (c.track === "text") {
      view = (
        <TextView
          clip={c}
          widthPx={wPx}
          heightPx={h}
          selected={isSel}
          dragging={dragging}
          orderIndex={orderIndex}
        />
      );
    } else {
      view = (
        <AudioClipView
          clip={c}
          widthPx={wPx}
          heightPx={h}
          selected={isSel}
          dragging={dragging}
          orderIndex={orderIndex}
          audioUrl={c.audio_path ? mediaUrl(c.audio_path) : null}
          enabled
          music={c.track === "music"}
          onExtendToSource={() => void E.extendToSource(c.id)}
        />
      );
    }
    const dim =
      c.muted ||
      E.rowStateOf(c.track).muted ||
      c.locked ||
      E.rowStateOf(c.track).locked;
    return (
      <div
        key={c.id}
        style={{
          position: "absolute",
          left: c.start * px,
          top: 0,
          width: wPx,
          height: h,
          zIndex: dragging ? 40 : isSel ? 25 : 10,
          opacity: dim ? (c.locked || E.rowStateOf(c.track).locked ? 0.62 : 0.75) : 1,
          cursor: c.locked || E.rowStateOf(c.track).locked ? "default" : "grab",
        }}
        onPointerDown={(e) => E.onClipPointerDown(e, c)}
        onClick={(e) => {
          e.stopPropagation();
          E.setSelectedId(c.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          E.setSelectedId(c.id);
          openMenuFor(e.clientX, e.clientY, c.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (c.track === "text") {
            E.setSelectedId(c.id);
            requestAnimationFrame(() => E.textAreaRef.current?.focus());
          }
        }}
      >
        {view}
      </div>
    );
  };

  const btn = (
    title: string,
    node: React.ReactNode,
    onClick: () => void,
    opts?: { disabled?: boolean; active?: boolean; primary?: boolean; danger?: boolean },
  ) => (
    <button
      className={opts?.primary ? "btn-primary" : "btn-secondary"}
      title={title}
      disabled={opts?.disabled}
      onClick={() => {
        onClick();
        document.activeElement instanceof HTMLElement &&
          document.activeElement.blur();
      }}
      style={{
        padding: "5px 8px",
        display: "inline-flex",
        alignItems: "center",
        fontSize: 12,
        color: opts?.danger
          ? "#ff6b78"
          : opts?.active
            ? "#fff"
            : undefined,
        background: opts?.active ? THEME.accent : undefined,
        borderColor: opts?.active ? THEME.accent : undefined,
      }}
    >
      {node}
    </button>
  );

  const [addingScene, setAddingScene] = useState(false);

  const handleAddScene = useCallback(async () => {
    if (!onAddScene || addingScene) return;
    setAddingScene(true);
    try {
      const scene = await onAddScene();
      if (!scene) return;
      let end = 0;
      for (const c of E.clips) end = Math.max(end, c.start + c.duration);
      end = Math.max(end, timeline.duration);
      const dur = Math.max(MIN_DUR, round2(scene.duration_seconds ?? 5));
      E.addClip({
        id: freshId("x"),
        scene_id: scene.id,
        track: "video",
        start: round2(end),
        duration: dur,
        image_path: scene.image_path ?? null,
        video_path: scene.video_path ?? null,
        audio_path: null,
        audio_in: 0,
        audio_out: null,
        volume: 1,
        motion_effect: scene.motion_effect || "none",
      });
    } finally {
      setAddingScene(false);
    }
  }, [E, onAddScene, addingScene, timeline.duration]);

  return (
    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
      <style>{CSS}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          width: "100%",
        }}
      >
        {btn(
          "Play / Pause (Space)",
          E.playing ? <Pause size={14} /> : <Play size={14} />,
          E.togglePlay,
          { primary: true, disabled: E.clips.length === 0 },
        )}
        <span
          style={{
            fontFamily: MONO,
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 7,
            border: `1px solid ${THEME.separator}`,
            background: THEME.surfaceAlt,
            whiteSpace: "nowrap",
          }}
        >
          <strong style={{ color: "#fff" }}>{fmtTime(t)}</strong>
          <span style={{ color: "#6f6f7a" }}> / {fmtTime(E.totalDuration)}</span>
        </span>

        <span style={{ width: 1, height: 18, background: THEME.separator }} />

        {btn("Split at playhead (S)", <Scissors size={14} />, E.splitAtPlayhead)}
        {btn(
          "Delete (Del)",
          <Trash2 size={14} />,
          () => sel && E.deleteClipOp(sel, E.rippleOn),
          { disabled: !sel, danger: true },
        )}

        <span style={{ width: 1, height: 18, background: THEME.separator }} />

        {voiceOverruns && voiceOverruns.length > 0 && (
          <span
            className="badge"
            title={`Scenes ${voiceOverruns.join(", ")}: narration is longer than the visuals.`}
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#ff6b78",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.2rem",
              fontSize: "11px",
              padding: "3px 6px",
              borderRadius: "4px"
            }}
          >
            <AlertTriangle size={11} />
            {voiceOverruns.length} Overruns
          </span>
        )}
        {dirty && (
          <span
            style={{
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              color: "#fbbf24",
              fontSize: "11px",
              padding: "3px 6px",
              borderRadius: "4px",
              fontWeight: 600
            }}
          >
            Unsaved
          </span>
        )}
        {saved && (
          <span
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              color: "#34d399",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.15rem",
              fontSize: "11px",
              padding: "3px 6px",
              borderRadius: "4px",
              fontWeight: 600
            }}
          >
            <Check size={11} /> Saved
          </span>
        )}
        <button
          className="btn-secondary"
          onClick={() => E.closeGaps()}
          title="Remove all empty spaces between clips and snap back-to-back"
          style={{
            fontSize: "11px",
            padding: "4px 8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.2rem",
            background: "rgba(0, 229, 255, 0.12)",
            border: "1px solid rgba(0, 229, 255, 0.35)",
            color: "#00E5FF",
            fontWeight: 600,
          }}
        >
          <AlignStartVertical size={11} /> Close Gaps
        </button>
        {onReset && (
          <button
            className="btn-secondary"
            onClick={onReset}
            style={{
              fontSize: "11px",
              padding: "4px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.2rem",
            }}
          >
            <RotateCcw size={11} /> Reset
          </button>
        )}
        {onSave && (
          <button
            className="btn-primary"
            disabled={saving}
            onClick={onSave}
            style={{
              fontSize: "11px",
              padding: "4px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.2rem",
            }}
          >
            <Save size={11} /> {saving ? "Saving..." : "Save"}
          </button>
        )}

        <div style={{ flex: 1 }} />

        <div
          ref={settingsRef}
          style={{ position: "relative", display: "inline-flex" }}
        >
          {btn(
            "Timeline settings",
            <Settings size={14} />,
            () => setSettingsOpen((v) => !v),
            { active: settingsOpen },
          )}
          {settingsOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 60,
                width: 210,
                background: "#26262d",
                border: `1px solid ${THEME.separator}`,
                borderRadius: 9,
                padding: 12,
                boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
                display: "grid",
                gap: 10,
                fontSize: 11.5,
                color: "#c9c9d1",
              }}
            >
              {/* Settings Configuration */}
              <div style={{ display: "grid", gap: 6, borderBottom: `1px solid ${THEME.separator}`, paddingBottom: 8 }}>
                <strong style={{ color: "#fff", fontSize: "0.75rem", marginBottom: 2 }}>Settings</strong>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  Frame rate
                  <select
                    value={E.fps}
                    onChange={(e) => E.setFps(Number(e.target.value))}
                    style={{ width: 74, padding: "2px 6px", fontSize: 11, background: "var(--bg)", border: "1px solid var(--border)", color: "#fff", borderRadius: 4 }}
                  >
                    {[24, 25, 30, 50, 60].map((f) => (
                      <option key={f} value={f}>
                        {f} fps
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  Snapping
                  <input
                    type="checkbox"
                    checked={E.snapOn}
                    onChange={() => E.setSnapOn(!E.snapOn)}
                    style={{ width: 14, accentColor: THEME.accent }}
                  />
                </label>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  Ripple delete
                  <input
                    type="checkbox"
                    checked={E.rippleOn}
                    onChange={() => E.setRippleOn(!E.rippleOn)}
                    style={{ width: 14, accentColor: THEME.accent }}
                  />
                </label>
              </div>

              {/* Timeline Actions */}
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ color: "#fff", fontSize: "0.75rem", marginBottom: 2 }}>Actions</strong>
                <button
                  className="btn-secondary"
                  disabled={!E.canUndo}
                  onClick={() => { E.undo(); setSettingsOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 8px", justifyContent: "flex-start", textAlign: "left", width: "100%", background: "transparent", border: "none", color: E.canUndo ? "#fff" : "#6f6f7a", cursor: E.canUndo ? "pointer" : "default" }}
                >
                  <Undo2 size={12} /> Undo
                </button>
                <button
                  className="btn-secondary"
                  disabled={!E.canRedo}
                  onClick={() => { E.redo(); setSettingsOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 8px", justifyContent: "flex-start", textAlign: "left", width: "100%", background: "transparent", border: "none", color: E.canRedo ? "#fff" : "#6f6f7a", cursor: E.canRedo ? "pointer" : "default" }}
                >
                  <Redo2 size={12} /> Redo
                </button>
                <button
                  className="btn-secondary"
                  disabled={!sel}
                  onClick={() => { sel && E.duplicateClip(sel); setSettingsOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 8px", justifyContent: "flex-start", textAlign: "left", width: "100%", background: "transparent", border: "none", color: sel ? "#fff" : "#6f6f7a", cursor: sel ? "pointer" : "default" }}
                >
                  <Copy size={12} /> Duplicate Selected
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => { E.addTextClip(); setSettingsOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 8px", justifyContent: "flex-start", textAlign: "left", width: "100%", background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
                >
                  <Type size={12} /> Add Caption
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => { E.toggleMarker(); setSettingsOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 8px", justifyContent: "flex-start", textAlign: "left", width: "100%", background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
                >
                  <Plus size={12} /> Add Marker
                </button>
                {onAddScene && (
                  <button
                    className="btn-secondary"
                    disabled={addingScene}
                    onClick={() => { void handleAddScene(); setSettingsOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 8px", justifyContent: "flex-start", textAlign: "left", width: "100%", background: "transparent", border: "none", color: addingScene ? "#6f6f7a" : "#fff", cursor: addingScene ? "default" : "pointer" }}
                  >
                    <Plus size={12} /> Add Scene
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const isMuted = E.rowStateOf("video").muted;
                    E.muteAllVideoClips(!isMuted);
                    setSettingsOpen(false);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 8px", justifyContent: "flex-start", textAlign: "left", width: "100%", background: "transparent", border: "none", color: E.rowStateOf("video").muted ? "#ff8a94" : "#fff", cursor: "pointer" }}
                >
                  {E.rowStateOf("video").muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  {E.rowStateOf("video").muted ? "Unmute All Video Scene Sounds" : "Mute All Video Scene Sounds"}
                </button>
                <button
                  className="btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 8px", color: "var(--danger)", justifyContent: "flex-start", textAlign: "left", width: "100%", background: "transparent", border: "none", cursor: "pointer" }}
                  onClick={() => {
                    E.clearMarkers();
                    setSettingsOpen(false);
                  }}
                >
                  <Trash2 size={12} /> Clear all markers ({E.markers.length})
                </button>
              </div>
            </div>
          )}
        </div>

        {btn("Zoom out (-)", <ZoomOut size={14} />, () => E.zoomAt(1 / 1.3))}
        <input
          type="range"
          min={PX_MIN}
          max={PX_MAX}
          value={px}
          onChange={(e) => E.zoomAt(Number(e.target.value) / px)}
          title="Zoom (Ctrl + wheel)"
          style={{
            width: 110,
            accentColor: THEME.accent,
            cursor: "pointer",
            padding: 0,
          }}
        />
        {btn("Zoom in (+)", <ZoomIn size={14} />, () => E.zoomAt(1.3))}
        {btn("Fit timeline", <Maximize size={14} />, E.fitTimeline)}
        {btn(showPreviewState ? "Hide Timeline Preview" : "Show Timeline Preview", showPreviewState ? <EyeOff size={14} /> : <Eye size={14} />, () => setShowPreviewState((v) => !v))}
        <span
          style={{
            fontSize: 10.5,
            color: "#6f6f7a",
            width: 38,
            textAlign: "right",
            fontFamily: MONO,
          }}
        >
          {Math.round((px / 60) * 100)}%
        </span>
      </div>

     
      {showPreviewState && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            minHeight: 0,
          }}
        >
          <PreviewPanel
            ratio={_previewRatio}
            activeVideo={activeVideo}
            activeCaption={activeCaption}
            scene={activeScene}
            time={E.time}
            totalDuration={E.totalDuration}
            playing={E.playing}
            onTogglePlay={E.togglePlay}
            mediaUrl={mediaUrl}
          />
        </div>
      )}

      <div
        style={{
          width: "100%",
          minWidth: 0,
          border: `1px solid ${THEME.separator}`,
          borderRadius: 12,
          overflow: "hidden",
          background: THEME.bg,
        }}
      >
          <div
            ref={E.scrollRef}
            className="vtl-scroll"
            style={{
              maxHeight: 340,
              overflow: "auto",
              overscrollBehavior: "contain",
              position: "relative",
            }}
            onDragEnter={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDragDepth((d) => d + 1);
              }
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) e.preventDefault();
            }}
            onDragLeave={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                setDragDepth((d) => Math.max(0, d - 1));
              }
            }}
            onDrop={handleDropFiles}
          >
            {dragDepth > 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 70,
                  border: "2px dashed #7c8cff",
                  borderRadius: 10,
                  background: "rgba(20,24,44,0.72)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#cdd6ff",
                  fontSize: 12.5,
                  fontWeight: 700,
                  pointerEvents: "none",
                }}
              >
                Drop video / audio / image files here
              </div>
            )}
            {droppingFile && (
              <div
                style={{
                  position: "absolute",
                  right: 14,
                  bottom: 10,
                  zIndex: 71,
                  background: "rgba(0,0,0,0.75)",
                  border: "1px solid #3a4166",
                  borderRadius: 8,
                  padding: "5px 10px",
                  color: "#cdd6ff",
                  fontSize: 11,
                  pointerEvents: "none",
                }}
              >
                Uploading {droppingFile}...
              </div>
            )}
            <div ref={E.contentRef} style={{ position: "relative", width: GUTTER_W + E.contentW }}>
              <Ruler
                width={E.contentW}
                pxPerSec={px}
                duration={E.totalDuration}
                markers={E.markers}
                ticksRef={E.ticksRef}
                onScrubStart={E.pausePlayback}
                onScrubMove={E.handleScrub}
                onMarkerToggle={(mt) => E.toggleMarker(mt)}
              />

              {TRACK_ROWS.map((row) => {
                const h = E.rowHeight(row.id);
                const rs = E.rowStateOf(row.id);
                const def = TRACK_BY_ID[row.id];
                const rowClips = E.clips.filter((c) => c.track === row.id);
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "flex",
                      height: h,
                      borderTop: `1px solid ${THEME.separator}`,
                      background:
                        E.hoverRow === row.id
                          ? "rgba(124,92,255,0.07)"
                          : undefined,
                    }}
                  >
                    <div
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 51,
                        width: GUTTER_W,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "0 8px",
                        background: rs.muted || rs.locked ? "#202027" : THEME.surface,
                        borderRight: `1px solid ${THEME.separator}`,
                      }}
                    >
                      <button
                        title={E.collapsed[row.id] ? "Expand track" : "Collapse track"}
                        onClick={() => E.toggleCollapsed(row.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#6f6f7a",
                          padding: 2,
                          display: "inline-flex",
                          transform: E.collapsed[row.id]
                            ? "rotate(180deg)"
                            : undefined,
                        }}
                      >
                        <ChevronUp size={12} />
                      </button>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 3,
                          background: def.color,
                          boxShadow: `0 0 8px ${def.color}66`,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: "0.02em",
                          color: rs.muted ? "#6f6f7a" : "#c9c9d1",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        {def.label}
                      </span>
                      <span style={{ flex: 1 }} />
                      <button
                        title={
                          rs.muted
                            ? row.id === "video"
                              ? "Unmute all video scene sounds"
                              : "Unmute track"
                            : row.id === "video"
                              ? "Mute all video scene sounds"
                              : "Mute track"
                        }
                        onClick={() => {
                          if (row.id === "video") {
                            E.muteAllVideoClips(!rs.muted);
                          } else {
                            E.toggleRowFlag(row.id, "muted");
                          }
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: rs.muted ? "#ff8a94" : "#8e8e98",
                          padding: 2,
                          display: "inline-flex",
                          cursor: "pointer",
                        }}
                      >
                        {rs.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </button>
                      <button
                        title={rs.locked ? "Unlock track" : "Lock track"}
                        onClick={() => E.toggleRowFlag(row.id, "locked")}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: rs.locked ? "#ffd166" : "#8e8e98",
                          padding: 2,
                          display: "inline-flex",
                        }}
                      >
                        {rs.locked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                    </div>

                    <div
                      data-row={row.id}
                      style={{
                        position: "relative",
                        width: E.contentW,
                        flexShrink: 0,
                        background: THEME.lane,
                        backgroundImage:
                          "repeating-linear-gradient(90deg, transparent 0, transparent 59px, rgba(255,255,255,0.025) 59px, rgba(255,255,255,0.025) 60px)",
                      }}
                      onPointerDown={(e) => {
                        if (e.target === e.currentTarget) {
                          E.setSelectedId(null);
                          setMenu(null);
                        }
                      }}
                      onDoubleClick={(e) => {
                        if (row.id !== "text" || e.target !== e.currentTarget)
                          return;
                        const r = E.ticksRef.current?.getBoundingClientRect();
                        if (!r) return;
                        E.addTextClip((e.clientX - r.left) / px);
                      }}
                    >
                      {rowClips.map((c) => renderClip(c, h))}
                    </div>
                  </div>
                );
              })}

              {E.snapLine != null && (
                <div
                  style={{
                    position: "absolute",
                    left: GUTTER_W + E.snapLine * px - 1,
                    top: RULER_H,
                    bottom: 0,
                    width: 2,
                    background: "#ffd166",
                    boxShadow: "0 0 8px rgba(255,209,102,0.7)",
                    zIndex: 30,
                    pointerEvents: "none",
                  }}
                />
              )}

              <div
                style={{
                  position: "absolute",
                  left: GUTTER_W + t * px - 4.5,
                  top: 0,
                  bottom: 0,
                  width: 9,
                  zIndex: 31,
                  cursor: "ew-resize",
                  touchAction: "none",
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  E.handleScrub(e.clientX);
                  const move = (ev: PointerEvent) => E.handleScrub(ev.clientX);
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: RULER_H,
                    bottom: 0,
                    left: 4,
                    width: 2,
                    background: THEME.playhead,
                    boxShadow: "0 0 8px rgba(255,71,87,0.65)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 1,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: THEME.playhead,
                    color: "#fff",
                    fontFamily: MONO,
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.55)",
                    pointerEvents: "none",
                  }}
                >
                  {fmtTime(t)}
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: RULER_H - 26,
                    left: "-5px",
                    width: 18,
                    height: 24,
                    borderRadius: 9,
                    background: THEME.playhead,
                    border: "2px solid #ffffff",
                    boxShadow:
                      "0 3px 10px rgba(0,0,0,0.55), 0 0 12px rgba(255,71,87,0.45)",
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 2.5,
                      height: 10,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.9)",
                    }}
                  />
                </div>
              </div>

              {E.clips.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: GUTTER_W,
                    right: 0,
                    top: RULER_H,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      border: "1.5px dashed #3a3a44",
                      borderRadius: 14,
                      padding: "18px 30px",
                      textAlign: "center",
                      color: "#8e8e98",
                      background: "rgba(27,27,31,0.72)",
                      display: "grid",
                      gap: 8,
                      justifyItems: "center",
                    }}
                  >
                    <strong style={{ fontSize: 13, color: "#c9c9d1" }}>
                      Timeline is empty
                    </strong>
                    <span style={{ fontSize: 11.5 }}>
                      Drag &amp; drop video / audio / image files below, press
                      "+ Scene", or use "Reset from scenes".
                    </span>
                    <button
                      className="btn-secondary"
                      style={{
                        fontSize: 11.5,
                        padding: "5px 12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        pointerEvents: "auto",
                      }}
                      onClick={() => E.addTextClip()}
                    >
                      <Plus size={13} /> Add caption
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>



      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
