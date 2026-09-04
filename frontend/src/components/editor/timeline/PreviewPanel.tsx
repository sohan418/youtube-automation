import { memo, useEffect, useRef } from "react";
import { Film, Image as ImageIcon, Pause, Play, Type } from "lucide-react";
import type { Scene, TimelineClip, VideoRatio } from "../../../types";
import { fmtTime } from "./utils";

const MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

function motionTransform(type: string | undefined, progRaw: number): string {
  const p = Math.max(0, Math.min(1, progRaw));
  switch (type) {
    case "zoom_in":
      return `scale(${(1 + 0.22 * p).toFixed(3)})`;
    case "zoom_out":
      return `scale(${(1.22 - 0.22 * p).toFixed(3)})`;
    case "pan_right":
      return `scale(1.12) translateX(${(-6 + 12 * p).toFixed(2)}%)`;
    case "pan_left":
      return `scale(1.12) translateX(${(6 - 12 * p).toFixed(2)}%)`;
    case "pan_up":
      return `scale(1.12) translateY(${(6 - 12 * p).toFixed(2)}%)`;
    case "pan_down":
      return `scale(1.12) translateY(${(-6 + 12 * p).toFixed(2)}%)`;
    default:
      return "none";
  }
}

interface Props {
  ratio?: VideoRatio;
  activeVideo: TimelineClip | null;
  activeCaption: string | null;
  scene: Scene | null;
  time: number;
  totalDuration: number;
  playing: boolean;
  onTogglePlay: () => void;
  mediaUrl: (path: string | null | undefined) => string;
}

export const PreviewPanel = memo(function PreviewPanel({
  ratio,
  activeVideo,
  activeCaption,
  scene,
  time,
  totalDuration,
  playing,
  onTogglePlay,
  mediaUrl,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const lastCorrectRef = useRef(0);
  const w = ratio?.width ?? 1920;
  const h = ratio?.height ?? 1080;
  const scale = Math.min(238 / w, 238 / h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  const progress = totalDuration > 0 ? Math.min(1, time / totalDuration) : 0;

  const localT = activeVideo
    ? Math.max(0, time - activeVideo.start)
    : 0;
  const transform = motionTransform(activeVideo?.motion_effect, localT / Math.max(0.001, activeVideo?.duration ?? 1));

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideo?.video_path) return;
    el.playbackRate = activeVideo.speed || 1.0;

    const seekTo = (t: number) => {
      if (!isFinite(t)) return;
      try {
        el.currentTime = t;
      } catch {
        pendingSeekRef.current = t;
      }
    };

    const onMeta = () => {
      if (pendingSeekRef.current != null) {
        seekTo(pendingSeekRef.current);
        pendingSeekRef.current = null;
      }
    };
    el.addEventListener("loadedmetadata", onMeta);

    if (playing) {
      const drift = Math.abs(el.currentTime - localT);
      const now = performance.now();
      let corrected = false;
      if (drift > 0.15 && now - lastCorrectRef.current > 300) {
        lastCorrectRef.current = now;
        corrected = true;
        seekTo(localT);
      }
      if (corrected || el.paused || el.ended) void el.play().catch(() => {});
    } else {
      el.pause();
      lastCorrectRef.current = 0;
      seekTo(localT);
    }

    return () => el.removeEventListener("loadedmetadata", onMeta);
  }, [time, playing, localT, activeVideo?.video_path]);

  const badge = activeVideo ? (
    activeVideo.scene_id >= 0 && scene ? (
      `Scene ${scene.order_index}`
    ) : activeVideo.video_path ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Film size={10} /> {activeVideo.video_path.split(/[\\/]/).pop()}
      </span>
    ) : (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <ImageIcon size={10} /> Image
      </span>
    )
  ) : null;

  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        alignContent: "start",
        justifyItems: "center",
      }}
    >
      <div
        onClick={onTogglePlay}
        title="Click to play / pause"
        style={{
          position: "relative",
          width: pw,
          height: ph,
          borderRadius: 10,
          overflow: "hidden",
          background: "linear-gradient(135deg,#141419,#1c1c24)",
          border: `1px solid ${"#303038"}`,
          cursor: "pointer",
          boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        }}
      >
        {activeVideo?.video_path ? (
          <video
            ref={videoRef}
            key={mediaUrl(activeVideo.video_path)}
            src={mediaUrl(activeVideo.video_path)}
            muted
            playsInline
            preload="auto"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform,
              willChange: "transform",
            }}
          />
        ) : activeVideo?.image_path ? (
          <img
            src={mediaUrl(activeVideo.image_path)}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform,
              willChange: "transform",
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
              gap: 6,
              color: "#5b5b66",
              fontSize: 11,
            }}
          >
            <Film size={15} /> No clip at playhead
          </div>
        )}

        {badge && (
          <span
            style={{
              position: "absolute",
              top: 7,
              left: 7,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              padding: "2px 7px",
              borderRadius: 5,
              fontSize: 9.5,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              maxWidth: pw - 40,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {badge}
          </span>
        )}

        {activeCaption && (
          <div
            style={{
              position: "absolute",
              left: 10,
              right: 10,
              bottom: 12,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(0,0,0,0.62)",
                color: "#fff",
                fontSize: Math.max(9, Math.round(pw * 0.052)),
                fontWeight: 800,
                lineHeight: 1.25,
                padding: "3px 9px",
                borderRadius: 6,
                textAlign: "center",
                textShadow: "0 1px 3px #000",
              }}
            >
              <Type size={11} style={{ flexShrink: 0 }} />
              <span
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {activeCaption}
              </span>
            </span>
          </div>
        )}

        
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: 2.5,
            width: `${progress * 100}%`,
            background: "#ff4757",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 2px",
          width: pw,
        }}
      >
        <button
          className="btn-primary"
          onClick={onTogglePlay}
          title="Play / Pause (Space)"
          style={{
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            fontSize: 11,
          }}
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <span
          style={{
            fontSize: 10.5,
            color: "#8e8e98",
            fontFamily: MONO,
            whiteSpace: "nowrap",
          }}
        >
          {fmtTime(time)} / {fmtTime(totalDuration)}
        </span>
      </div>
    </div>
  );
});
