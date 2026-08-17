import { useEffect, useMemo, useRef, useState } from "react";
import {
  Film,
  Image as ImageIcon,
  Maximize,
  Mic,
  Pause,
  Play,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type {
  Scene,
  TimelineClip,
  TimelineData,
  VideoRatio,
} from "../../types";
import { useWaveform } from "../../hooks/useWaveform";

const SNAP = 0.1;
const MIN_PX_PER_SEC = 20;
const MAX_PX_PER_SEC = 300;

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
}

function clampStartFor(
  sibs: TimelineClip[],
  origStart: number,
  origDuration: number,
  ns: number,
): number {
  let min = 0;
  for (const c of sibs)
    if (c.start < origStart) min = Math.max(min, c.start + c.duration);
  let max = Number.MAX_SAFE_INTEGER;
  for (const c of sibs)
    if (c.start >= origStart) {
      max = c.start;
      break;
    }
  return Math.min(Math.max(ns, min), Math.max(max - origDuration, min));
}

function clampDurationFor(
  sibs: TimelineClip[],
  origStart: number,
  nd: number,
): number {
  let maxEnd = 300;
  for (const c of sibs)
    if (c.start >= origStart) {
      maxEnd = c.start - origStart;
      break;
    }
  return Math.min(Math.max(nd, 0.5), Math.max(maxEnd, 0.5));
}

interface Props {
  timeline: TimelineData;
  scenes: Scene[];
  mediaUrl: (path: string | null | undefined) => string;
  previewRatio?: VideoRatio;
  onChange: (tl: TimelineData) => void;
}

type DragMode = "move" | "trim-left" | "trim-right";

export default function TimelineEditor({
  timeline,
  scenes,
  mediaUrl,
  previewRatio,
  onChange,
}: Props) {
  const [pxPerSec, setPxPerSec] = useState(90);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const lastAudioClipRef = useRef<string | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    id: string;
    startX: number;
    origStart: number;
    origDuration: number;
    origAudioIn: number;
    sibs: TimelineClip[];
  } | null>(null);

  const sceneById = useMemo(
    () => new Map(scenes.map((s) => [s.id, s])),
    [scenes],
  );

  const videoClips = useMemo(
    () =>
      timeline.clips
        .filter((c) => c.track === "video")
        .sort((a, b) => a.start - b.start),
    [timeline.clips],
  );
  const narrationClips = useMemo(
    () =>
      timeline.clips
        .filter((c) => c.track === "narration")
        .sort((a, b) => a.start - b.start),
    [timeline.clips],
  );

  const totalDuration = useMemo(
    () =>
      Math.max(
        timeline.duration,
        timeline.clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0),
      ),
    [timeline],
  );
  const totalPx = totalDuration * pxPerSec;

  const withClips = (clips: TimelineClip[]): TimelineData => {
    const end = clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    return { ...timeline, clips, duration: Math.max(timeline.duration, end) };
  };

  const patchClip = (id: string, patch: Partial<TimelineClip>) => {
    const src = timeline.clips.find((c) => c.id === id);
    if (!src) return;
    const twinTrack: TimelineClip["track"] =
      src.track === "video" ? "narration" : "video";
    const twinPatch: Partial<TimelineClip> = {};
    if (patch.start !== undefined && patch.duration !== undefined) {
      twinPatch.start = patch.start;
      twinPatch.duration = patch.duration;
    } else if (patch.start !== undefined) {
      twinPatch.start = patch.start;
    } else if (patch.duration !== undefined) {
      twinPatch.duration = patch.duration;
    }
    onChange(
      withClips(
        timeline.clips.map((c) => {
          if (c.id === id) return { ...c, ...patch };
          if (c.track === twinTrack && c.scene_id === src.scene_id)
            return { ...c, ...twinPatch };
          return c;
        }),
      ),
    );
  };

  const deleteClip = (id: string) => {
    const src = timeline.clips.find((c) => c.id === id);
    if (!src) return;
    onChange(
      withClips(
        timeline.clips.filter(
          (c) =>
            c.id !== id &&
            !(c.scene_id === src.scene_id && c.track !== src.track),
        ),
      ),
    );
    setSelectedId((prev) => (prev === id ? null : prev));
  };

  // ---- Drag & drop ----
  const onDragStart = (e: React.PointerEvent, id: string, mode: DragMode) => {
    const clip = timeline.clips.find((c) => c.id === id);
    if (!clip) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      id,
      startX: e.clientX,
      origStart: clip.start,
      origDuration: clip.duration,
      origAudioIn: clip.audio_in ?? 0,
      sibs: timeline.clips
        .filter((c) => c.track === clip.track && c.id !== id)
        .sort((a, b) => a.start - b.start),
    };
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = (e.clientX - d.startX) / pxPerSec;
    if (d.mode === "move") {
      const ns = clampStartFor(
        d.sibs,
        d.origStart,
        d.origDuration,
        snap(d.origStart + delta),
      );
      patchClip(d.id, { start: ns });
    } else if (d.mode === "trim-left") {
      const ns = clampStartFor(
        d.sibs,
        d.origStart,
        d.origDuration,
        snap(d.origStart + delta),
      );
      const nd = d.origDuration + (d.origStart - ns);
      const audioIn = d.origAudioIn + (ns - d.origStart);
      patchClip(d.id, {
        start: ns,
        duration: nd,
        audio_in: Math.max(0, audioIn),
      });
    } else {
      const nd = clampDurationFor(
        d.sibs,
        d.origStart,
        snap(d.origDuration + delta),
      );
      patchClip(d.id, { duration: nd });
    }
  };

  const onDragEnd = () => {
    dragRef.current = null;
  };

  // ---- Playback ----
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (playhead >= totalDuration) setPlayhead(0);
      lastTickRef.current = performance.now();
      setPlaying(true);
    }
  };

  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setPlayhead((p) => {
        const next = p + dt;
        if (next >= totalDuration) {
          setPlaying(false);
          return totalDuration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, totalDuration]);

  const activeNarration = useMemo(
    () =>
      narrationClips.find(
        (c) => playhead >= c.start && playhead < c.start + c.duration,
      ) ?? null,
    [narrationClips, playhead],
  );

  const activeVideoClip = useMemo(
    () =>
      videoClips.find(
        (c) => playhead >= c.start && playhead < c.start + c.duration,
      ) ?? null,
    [videoClips, playhead],
  );

  useEffect(() => {
    const el = audioElRef.current;
    if (!el) return;
    const n = activeNarration;
    const v = activeVideoClip;
    const sourcePath =
      n?.audio_path ?? (v?.video_path && !v?.audio_path ? v.video_path : null);
    if (playing && sourcePath) {
      if (lastAudioClipRef.current !== sourcePath) {
        lastAudioClipRef.current = sourcePath;
        el.src = mediaUrl(sourcePath);
        const t = n ? (n.audio_in ?? 0) + (playhead - n.start) : 0;
        el.currentTime = Math.min(t, n?.audio_out ?? Number.MAX_SAFE_INTEGER);
        void el.play().catch(() => {});
      }
    } else if (lastAudioClipRef.current !== null) {
      el.pause();
      lastAudioClipRef.current = null;
    }
  }, [activeNarration, activeVideoClip, playing, mediaUrl]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      audioElRef.current?.pause();
    };
  }, []);

  // ---- Seek ----
  const seekFromEvent = (e: React.PointerEvent) => {
    const rect = innerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const time = (e.clientX - rect.left) / pxPerSec;
    lastAudioClipRef.current = null;
    audioElRef.current?.pause();
    setPlayhead(Math.max(0, Math.min(time, totalDuration)));
    setPlaying(false);
  };

  // ---- Inspector number inputs ----
  const applyDuration = (id: string, value: number) => {
    if (!Number.isFinite(value)) return;
    const clip = timeline.clips.find((c) => c.id === id);
    if (!clip) return;
    patchClip(id, {
      duration: clampDurationFor(
        getSibs(clip),
        clip.start,
        Math.max(0.5, value),
      ),
    });
  };

  const getSibs = (clip: TimelineClip) =>
    timeline.clips
      .filter((c) => c.track === clip.track && c.id !== clip.id)
      .sort((a, b) => a.start - b.start);

  const applyStart = (id: string, value: number) => {
    if (!Number.isFinite(value)) return;
    const clip = timeline.clips.find((c) => c.id === id);
    if (!clip) return;
    patchClip(id, {
      start: clampStartFor(getSibs(clip), clip.start, clip.duration, value),
    });
  };

  // ---- Keyboard delete ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteClip(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, timeline.clips]);

  // ---- Zoom / fit ----
  const zoomFit = () => {
    const width = scrollRef.current?.clientWidth ?? 800;
    const target = Math.max(
      MIN_PX_PER_SEC,
      Math.min(MAX_PX_PER_SEC, (width - 16) / Math.max(totalDuration, 1)),
    );
    setPxPerSec(Math.round(target));
  };

  const activeClip = selectedId
    ? timeline.clips.find((c) => c.id === selectedId)
    : null;

  // Ruler ticks
  const tickStep = useMemo(() => {
    const target = 90;
    for (const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120]) {
      if (s * pxPerSec >= target) return s;
    }
    return 120;
  }, [pxPerSec]);

  const ticks: number[] = [];
  for (let t = 0; t <= totalDuration + 1e-6; t += tickStep)
    ticks.push(Math.round(t * 1e6) / 1e6);

  const minorTicks: number[] = [];
  if (tickStep >= 0.5) {
    for (let t = 0; t <= totalDuration + 1e-6; t += tickStep / 5)
      minorTicks.push(Math.round(t * 1e6) / 1e6);
  }

  const selected = activeClip;

  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      <audio
        ref={audioElRef}
        onEnded={() => setPlaying(false)}
        onError={() => {}}
      />

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn-primary"
          onClick={togglePlay}
          disabled={videoClips.length === 0}
          style={{
            padding: "0.35rem 0.8rem",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.8rem",
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}{" "}
          {playing ? "Pause" : "Play"}
        </button>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)" }}>{fmtTime(playhead)}</strong>{" "}
          / {fmtTime(totalDuration)}
        </span>
        <div style={{ flex: 1 }} />
        <button
          className="btn-secondary"
          onClick={() => setPxPerSec((z) => Math.max(MIN_PX_PER_SEC, z / 1.3))}
          title="Zoom out"
          style={{ padding: "0.3rem 0.5rem" }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          className="btn-secondary"
          onClick={zoomFit}
          title="Fit timeline"
          style={{ padding: "0.3rem 0.5rem" }}
        >
          <Maximize size={14} />
        </button>
        <button
          className="btn-secondary"
          onClick={() => setPxPerSec((z) => Math.min(MAX_PX_PER_SEC, z * 1.3))}
          title="Zoom in"
          style={{ padding: "0.3rem 0.5rem" }}
        >
          <ZoomIn size={14} />
        </button>
        {selected && (
          <button
            className="btn-secondary"
            onClick={() => deleteClip(selected.id)}
            title="Delete selected clip (or press Delete)"
            style={{ padding: "0.3rem 0.5rem", color: "var(--danger)" }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Preview + Timeline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        <PreviewPanel
          ratio={previewRatio}
          activeClip={activeVideoClip}
          activeNarration={activeNarration}
          scene={
            activeVideoClip
              ? (sceneById.get(activeVideoClip.scene_id) ?? null)
              : null
          }
          playhead={playhead}
          totalDuration={totalDuration}
          playing={playing}
          onTogglePlay={togglePlay}
          mediaUrl={mediaUrl}
        />

        {/* Timeline body */}
        <div
          style={{
            display: "flex",
            width: "100%",
            minWidth: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          {/* Track labels */}
          <div
            style={{
              width: 96,
              flexShrink: 0,
              borderRight: "1px solid var(--border)",
              display: "grid",
              gridTemplateRows: "26px 72px 40px",
            }}
          >
            <div
              style={{
                fontSize: "0.6rem",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              TIME
            </div>
            <div style={labelStyle}>
              <ImageIcon size={11} /> Video
            </div>
            <div style={labelStyle}>
              <Mic size={11} /> Narration
            </div>
          </div>

          {/* Scrollable timeline */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowX: "auto", position: "relative" }}
          >
            <div
              ref={innerRef}
              style={{
                width: Math.max(totalPx + 24, 100),
                position: "relative",
              }}
              onPointerDown={seekFromEvent}
            >
              {/* Ruler */}
              <div
                style={{
                  height: 26,
                  position: "relative",
                  borderBottom: "1px solid var(--border)",
                  cursor: "crosshair",
                }}
              >
                {minorTicks.map((t) => (
                  <div
                    key={`m${t}`}
                    style={{
                      position: "absolute",
                      left: t * pxPerSec,
                      top: 16,
                      width: 1,
                      height: 6,
                      background: "var(--border)",
                    }}
                  />
                ))}
                {ticks.map((t) => (
                  <div
                    key={`t${t}`}
                    style={{
                      position: "absolute",
                      left: t * pxPerSec,
                      top: 8,
                      width: 1,
                      height: 14,
                      background: "var(--text-muted)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 3,
                        top: 0,
                        fontSize: "0.6rem",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtTime(t)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Video track */}
              <div
                style={{
                  height: 72,
                  position: "relative",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg)",
                }}
              >
                {videoClips.map((clip) => (
                  <ClipBox
                    key={clip.id}
                    clip={clip}
                    pxPerSec={pxPerSec}
                    selected={selectedId === clip.id}
                    onClick={() => setSelectedId(clip.id)}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragEnd={onDragEnd}
                    kind="video"
                    mediaUrl={mediaUrl}
                    sceneLabel={sceneById.get(clip.scene_id)?.order_index}
                  />
                ))}
                {videoClips.length === 0 && (
                  <div
                    style={{
                      padding: "0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    No video clips yet. Save a timeline or add scenes first.
                  </div>
                )}
              </div>

              {/* Narration track */}
              <div
                style={{
                  height: 40,
                  position: "relative",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg)",
                }}
              >
                {narrationClips.map((clip) => (
                  <ClipBox
                    key={clip.id}
                    clip={clip}
                    pxPerSec={pxPerSec}
                    selected={selectedId === clip.id}
                    onClick={() => setSelectedId(clip.id)}
                    onDragStart={onDragStart}
                    onDragMove={onDragMove}
                    onDragEnd={onDragEnd}
                    kind="narration"
                    mediaUrl={mediaUrl}
                    sceneLabel={sceneById.get(clip.scene_id)?.order_index}
                  />
                ))}
                {narrationClips.length === 0 && (
                  <div
                    style={{
                      padding: "0.4rem",
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    No narration clips (generate voice or record audio first).
                  </div>
                )}
              </div>

              {/* Playhead */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: playhead * pxPerSec,
                  width: 2,
                  background: "var(--primary)",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: -5,
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "8px solid var(--primary)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inspector */}
      {selected && (
        <div
          className="card"
          style={{
            background: "var(--bg)",
            padding: "0.75rem",
            display: "grid",
            gap: "0.6rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h4 style={{ fontSize: "0.95rem", margin: 0 }}>
              {selected.scene_id === -1
                ? "Video Clip"
                : `Clip — Scene #${sceneById.get(selected.scene_id)?.order_index ?? selected.scene_id}`}
            </h4>
            <span className="badge">{selected.track}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {selected.scene_id === -1
                ? (selected.video_path?.split("/").pop() ?? "")
                : (sceneById.get(selected.scene_id)?.narration || "").slice(
                    0,
                    60,
                  )}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Start (s)
              <input
                type="number"
                step={0.1}
                value={Number(selected.start.toFixed(2))}
                onChange={(e) =>
                  applyStart(selected.id, parseFloat(e.target.value))
                }
                style={{ width: 90, marginLeft: "0.4rem" }}
              />
            </label>
            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Duration (s)
              <input
                type="number"
                step={0.1}
                value={Number(selected.duration.toFixed(2))}
                onChange={(e) =>
                  applyDuration(selected.id, parseFloat(e.target.value))
                }
                style={{ width: 90, marginLeft: "0.4rem" }}
              />
            </label>
            {selected.track === "video" && selected.audio_path && (
              <label
                style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
              >
                Narration trim (s)
                <input
                  type="number"
                  step={0.1}
                  value={Number((selected.audio_in ?? 0).toFixed(2))}
                  onChange={(e) =>
                    patchClip(selected.id, {
                      audio_in: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  style={{ width: 90, marginLeft: "0.4rem" }}
                />
              </label>
            )}
            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Volume
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={selected.volume}
                onChange={(e) =>
                  patchClip(selected.id, { volume: parseFloat(e.target.value) })
                }
                style={{
                  width: 120,
                  marginLeft: "0.4rem",
                  verticalAlign: "middle",
                }}
              />
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginLeft: "0.3rem",
                }}
              >
                {Math.round(selected.volume * 100)}%
              </span>
            </label>
            <button
              className="btn-secondary"
              onClick={() => deleteClip(selected.id)}
              style={{
                color: "var(--danger)",
                fontSize: "0.75rem",
                padding: "0.3rem 0.6rem",
              }}
            >
              Delete Clip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.3rem",
  fontSize: "0.72rem",
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)",
};

const chipStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.55)",
  color: "#fff",
  padding: "0.15rem 0.4rem",
  borderRadius: 4,
  fontSize: "0.7rem",
};

interface PreviewPanelProps {
  ratio?: VideoRatio;
  activeClip: TimelineClip | null;
  activeNarration: TimelineClip | null;
  scene: Scene | null;
  playhead: number;
  totalDuration: number;
  playing: boolean;
  onTogglePlay: () => void;
  mediaUrl: (path: string | null | undefined) => string;
}

function PreviewPanel({
  ratio,
  activeClip,
  activeNarration,
  scene,
  playhead,
  totalDuration,
  playing,
  onTogglePlay,
  mediaUrl,
}: PreviewPanelProps) {
  const w = ratio?.width ?? 1920;
  const h = ratio?.height ?? 1080;
  const scale = Math.min(400 / w, 400 / h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  const narrationText = scene?.narration || "";
  const audioPlaying = playing && !!activeNarration?.audio_path;
  const progress =
    totalDuration > 0 ? Math.min(1, playhead / totalDuration) : 0;

  return (
    <div
      style={{
        width: pw,
        display: "grid",
        gap: "0.5rem",
        alignSelf: "center",
      }}
    >
      <div
        onClick={onTogglePlay}
        title="Click to play / pause"
        style={{
          position: "relative",
          width: pw,
          height: ph,
          borderRadius: 8,
          overflow: "hidden",
          background: "linear-gradient(135deg, #101018, #1a1a24)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
          cursor: "pointer",
        }}
      >
        {activeClip?.video_path ? (
          <video
            key={mediaUrl(activeClip.video_path)}
            src={mediaUrl(activeClip.video_path)}
            muted
            loop
            autoPlay
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : activeClip?.image_path ? (
          <img
            src={mediaUrl(activeClip.image_path)}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              color: "var(--text-muted)",
              fontSize: "0.8rem",
            }}
          >
            <Film size={16} /> No image at playhead
          </div>
        )}

        {/* soft overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.15) 45%, transparent 60%)",
          }}
        />

        {/* scene badge */}
        {activeClip && (
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              padding: "0.15rem 0.5rem",
              borderRadius: 4,
              fontSize: "0.7rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            {activeClip.scene_id === -1 ? (
              <>
                <Film size={11} /> Video clip
              </>
            ) : (
              `Scene #${scene?.order_index ?? activeClip.scene_id}`
            )}
          </span>
        )}

        {/* status chips */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            gap: 4,
          }}
        >
          {(audioPlaying || !!activeClip?.audio_path) && (
            <span
              style={chipStyle}
              title={audioPlaying ? "Narration playing" : "Has narration"}
            >
              {audioPlaying ? <EqBars /> : <Mic size={12} />}
            </span>
          )}
        </div>

        {/* narration text overlay */}
        {narrationText && (
          <div style={{ position: "absolute", left: 8, right: 8, bottom: 10 }}>
            <div
              style={{
                color: "#fff",
                fontSize: 11,
                lineHeight: 1.35,
                textShadow: "0 1px 3px #000",
                maxHeight: 44,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {narrationText}
            </div>
          </div>
        )}

        {/* play indicator */}
        {!playing && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(255,0,51,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              }}
            >
              <Play size={20} color="#fff" style={{ marginLeft: 2 }} />
            </div>
          </div>
        )}

        {/* progress bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 3,
            width: `${progress * 100}%`,
            background: "var(--primary)",
          }}
        />
      </div>

      {/* transport */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0 0.15rem",
        }}
      >
        <button
          className="btn-primary"
          onClick={onTogglePlay}
          disabled={!activeClip}
          style={{
            padding: "0.3rem 0.6rem",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            fontSize: "0.75rem",
          }}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}{" "}
          {playing ? "Pause" : "Play"}
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {fmtTime(playhead)} / {fmtTime(totalDuration)}
        </span>
        <div style={{ flex: 1 }} />
        <span className="badge" title="Preview aspect ratio">
          {ratio?.id ?? "16:9"} ·{" "}
          {ratio ? `${ratio.width}×${ratio.height}` : "1920×1080"}
        </span>
      </div>
    </div>
  );
}

function EqBars() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
        gap: 2,
        height: 12,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: 2,
            height: "100%",
            background: "#8fe3a0",
            display: "inline-block",
            transformOrigin: "bottom",
            animation: `tl-eq 0.7s ease-in-out ${i * 0.12}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

interface ClipBoxProps {
  clip: TimelineClip;
  pxPerSec: number;
  selected: boolean;
  kind: "video" | "narration";
  onClick: () => void;
  onDragStart: (e: React.PointerEvent, id: string, mode: DragMode) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: () => void;
  mediaUrl: (path: string | null | undefined) => string;
  sceneLabel?: number;
}

function ClipBox({
  clip,
  pxPerSec,
  selected,
  kind,
  onClick,
  onDragStart,
  onDragMove,
  onDragEnd,
  mediaUrl,
  sceneLabel,
}: ClipBoxProps) {
  const width = clip.duration * pxPerSec;
  const left = clip.start * pxPerSec;
  const isVideo = kind === "video";
  const isClip = isVideo && !!clip.video_path;
  const hasAudio = !!clip.audio_path;
  const waveform = isVideo ? null : useWaveform(mediaUrl(clip.audio_path));

  return (
    <div
      onPointerDown={(e) => {
        onClick();
        onDragStart(e, clip.id, "move");
      }}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      onPointerCancel={onDragEnd}
      style={{
        position: "absolute",
        left,
        top: isVideo ? 4 : 4,
        width,
        height: isVideo ? 64 : 32,
        borderRadius: 6,
        overflow: "hidden",
        cursor: "grab",
        background: isClip
          ? "rgba(139,92,246,0.16)"
          : isVideo
            ? "var(--surface)"
            : "rgba(62,166,255,0.12)",
        border: `1.5px solid ${selected ? "var(--accent)" : isClip ? "rgba(139,92,246,0.7)" : isVideo ? "var(--border)" : "rgba(62,166,255,0.5)"}`,
        boxShadow: selected ? "0 0 0 2px rgba(62,166,255,0.25)" : "none",
        touchAction: "none",
        userSelect: "none",
      }}
      title={`${isClip ? "Video clip" : `Scene ${sceneLabel ?? clip.scene_id}`} — ${clip.duration.toFixed(1)}s`}
    >
      {isVideo ? (
        <>
          {isClip && (
            <video
              src={mediaUrl(clip.video_path)}
              muted
              playsInline
              preload="metadata"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.65,
              }}
            />
          )}
          {!isClip && clip.image_path && (
            <img
              src={mediaUrl(clip.image_path)}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.65,
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.55))",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "2px 6px",
            }}
          >
            <span
              style={{
                fontSize: "0.62rem",
                fontWeight: 700,
                color: "#fff",
                textShadow: "0 1px 2px #000",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              {isClip ? <Film size={11} /> : `#${sceneLabel ?? clip.scene_id}`}{" "}
              · {clip.duration.toFixed(1)}s
            </span>
            <span
              style={{
                fontSize: "0.58rem",
                color: hasAudio ? "#8fe3a0" : "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              {isClip ? (
                "video clip"
              ) : hasAudio ? (
                <>
                  <Mic size={10} /> narration
                </>
              ) : (
                "no audio"
              )}
            </span>
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 3,
              background: isClip
                ? "var(--accent)"
                : hasAudio
                  ? "var(--success)"
                  : "transparent",
              width: "100%",
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            padding: "2px 6px",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: "0.58rem",
              color: "#a9d4ff",
              whiteSpace: "nowrap",
            }}
          >
            #{sceneLabel ?? clip.scene_id}
          </span>
          {waveform && waveform.length > 0 && (
            <div
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: 1,
                overflow: "hidden",
              }}
            >
              {waveform.map((v, i) => (
                <div
                  key={i}
                  style={{
                    width: 2,
                    height: `${Math.max(8, v * 100)}%`,
                    background: "var(--accent)",
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {!isVideo && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 6,
          }}
        >
          <span style={{ fontSize: "0.55rem", color: "#a9d4ff" }}>
            {clip.duration.toFixed(1)}s
          </span>
        </div>
      )}

      {/* Trim handles */}
      {["left", "right"].map((side) => (
        <div
          key={side}
          onPointerDown={(e) => {
            e.stopPropagation();
            onDragStart(
              e,
              clip.id,
              side === "left" ? "trim-left" : "trim-right",
            );
          }}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 10,
            [side]: 0,
            cursor: "ew-resize",
            background: selected ? "rgba(62,166,255,0.35)" : "transparent",
            touchAction: "none",
          }}
        />
      ))}
    </div>
  );
}
