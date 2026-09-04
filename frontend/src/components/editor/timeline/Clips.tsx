import { memo, useEffect, useRef } from "react";
import { Film, Image as ImageIcon, Mic, Music2, Type, VolumeX, Lock } from "lucide-react";
import type { TimelineClip } from "../../../types";
import { TRACK_BY_ID } from "./constants";
import type { PeaksData } from "./peaks";
import { usePeaks } from "./peaks";
import { useMediaDuration } from "./mediaMeta";
import { clipLabel } from "./utils";

const MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

interface ViewProps {
  clip: TimelineClip;
  widthPx: number;
  heightPx: number;
  selected: boolean;
  dragging: boolean;
  orderIndex?: number;
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "warn" | "dim";
}) {
  return (
    <span
      style={{
        background:
          tone === "warn" ? "rgba(255,209,102,0.92)" : "rgba(0,0,0,0.5)",
        color: tone === "warn" ? "#1a1a10" : "#fff",
        opacity: tone === "dim" ? 0.72 : 1,
        fontSize: 9,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 4,
        lineHeight: 1.4,
        fontFamily: MONO,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Shell({
  clip,
  widthPx,
  heightPx,
  selected,
  dragging,
  children,
}: ViewProps & { children: React.ReactNode }) {
  const def = TRACK_BY_ID[clip.track];
  return (
    <div
      className={`vtl-clip${selected ? " vtl-sel" : ""}${dragging ? " vtl-drag" : ""}${
        clip.locked ? " vtl-locked" : ""
      }`}
      style={{
        position: "absolute",
        left: 0,
        top: 3,
        width: Math.max(6, widthPx),
        height: heightPx - 6,
        borderRadius: 7,
        overflow: "hidden",
        background: def.softColor,
        boxShadow: `inset 0 0 0 1px ${def.color}44`,
        cursor: clip.locked ? "default" : "grab",
        willChange: "transform",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: def.color,
          opacity: 0.9,
        }}
      />
      {children}
      <div className="vtl-hl" />
      <div className="vtl-hr" />
    </div>
  );
}

function TopRow({
  clip,
  icon,
  label,
  showLabel,
  srcDur,
  onSrcClick,
}: {
  clip: TimelineClip;
  icon: React.ReactNode;
  label: string;
  showLabel: boolean;
  widthPx: number;
  srcDur?: number | null;
  onSrcClick?: () => void;
}) {
  const overruns = srcDur != null && srcDur > clip.duration + 0.05;
  return (
    <div
      style={{
        position: "absolute",
        top: 3,
        left: 7,
        right: 6,
        display: "flex",
        alignItems: "center",
        gap: 4,
        pointerEvents: "none",
      }}
    >
      <span style={{ display: "inline-flex", color: "#fff", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.7))" }}>
        {icon}
      </span>
      {clip.muted && (
        <span title="Audio muted" style={{ display: "inline-flex", color: "#ff8a94", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.7))" }}>
          <VolumeX size={10} />
        </span>
      )}
      {showLabel && (
        <span
          style={{
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow: "0 1px 2px rgba(0,0,0,.8)",
          }}
        >
          {label}
        </span>
      )}
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 3, alignItems: "center" }}>
        {clip.speed && clip.speed !== 1 && (
          <span title={`Playback speed: ${clip.speed}x`} style={{ fontSize: 9, fontWeight: 700, background: "rgba(99,102,241,0.3)", color: "#a5b4fc", padding: "1px 3px", borderRadius: 3, border: "1px solid rgba(165,180,252,0.4)" }}>
            ⚡{clip.speed}x
          </span>
        )}
        {clip.muted && <VolumeX size={10} color="#ffb4b4" />}
        {clip.locked && <Lock size={10} color="#ffd166" />}
        <Chip>{clip.duration.toFixed(1)}s</Chip>
        {srcDur != null && (
          <span
            style={{
              display: "inline-flex",
              pointerEvents: overruns ? "auto" : "none",
              cursor: overruns ? "pointer" : "default",
            }}
            title={
              overruns
                ? `Source is ${srcDur.toFixed(1)}s — click to extend clip to full length`
                : undefined
            }
            onClick={
              overruns
                ? (e) => {
                    e.stopPropagation();
                    onSrcClick?.();
                  }
                : undefined
            }
          >
            <Chip tone={overruns ? "warn" : "dim"}>
              {srcDur.toFixed(1)}s src{overruns ? "!" : ""}
            </Chip>
          </span>
        )}
      </span>
    </div>
  );
}

// function videoThumb(clip: TimelineClip): string | null {
//   return clip.image_path ?? null;
// }

export const VideoClipView = memo(function VideoClipView(
  props: ViewProps & {
    thumbUrl: string | null;
    probeUrl?: string | null;
    onExtendToSource?: () => void;
  },
) {
  const { clip, widthPx, orderIndex, thumbUrl, probeUrl, onExtendToSource } =
    props;
  const hasVideo = !!clip.video_path;
  const srcDur = useMediaDuration(probeUrl ?? null, "video");
  const label = clipLabel(clip, orderIndex);
  return (
    <Shell {...props}>
      {thumbUrl ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${thumbUrl}")`,
            backgroundSize: "auto 100%",
            backgroundRepeat: "repeat-x",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hasVideo
              ? "repeating-linear-gradient(115deg,#23233a 0 26px,#1d1d30 26px 52px)"
              : "linear-gradient(135deg,#20263a,#171a26)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 42px, rgba(8,10,14,0.55) 42px 44px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg,rgba(10,12,18,0.62) 0%,rgba(10,12,18,0) 38%,rgba(10,12,18,0) 55%,rgba(10,12,18,0.66) 100%)",
        }}
      />
      <TopRow
        clip={clip}
        icon={hasVideo ? <Film size={11} /> : <ImageIcon size={11} />}
        label={label}
        showLabel={widthPx > 64}
        widthPx={widthPx}
        srcDur={hasVideo ? srcDur : null}
        onSrcClick={onExtendToSource}
      />
    </Shell>
  );
});

function WaveformCanvas({
  width,
  height,
  data,
  audioIn,
  duration,
  color,
  dimmed,
  fadeIn,
  fadeOut,
}: {
  width: number;
  height: number;
  data: PeaksData | null;
  audioIn: number;
  duration: number;
  color: string;
  dimmed: boolean;
  fadeIn: number;
  fadeOut: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const rw = Math.min(w, 1600);
    cv.width = Math.min(rw * dpr, 32000);
    cv.height = Math.max(1, Math.min(h * dpr, 32000));
    const g = cv.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, rw, h);

    const peaks = data?.peaks;
    const srcDur = data?.real ? data.duration : 0;
    const mid = h / 2;
    const barW = 2;
    const gap = 1;
    g.fillStyle = dimmed ? `${color}55` : color;
    const count = Math.floor(rw / (barW + gap));
    for (let i = 0; i < count; i++) {
      const tFrac = (i * (barW + gap)) / rw;
      let idx: number;
      if (srcDur > 0) {
        const srcT = audioIn + tFrac * duration;
        idx = Math.floor((srcT / srcDur) * (peaks?.length ?? 1));
      } else {
        idx = Math.floor(tFrac * (peaks?.length ?? 1));
      }
      const p = peaks
        ? (peaks[Math.max(0, Math.min(peaks.length - 1, idx))] ?? 0)
        : 0.4;
      const bh = Math.max(2, p * (h - 6));
      g.fillRect(i * (barW + gap), mid - bh / 2, barW, bh);
    }

    if (fadeIn > 0 || fadeOut > 0) {
      g.strokeStyle = "rgba(255,255,255,0.65)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, h - 2);
      if (fadeIn > 0) {
        g.lineTo((fadeIn / duration) * rw, 3);
      } else {
        g.lineTo(0, 3);
      }
      g.lineTo(rw - ((fadeOut > 0 ? fadeOut : 0) / duration) * rw, 3);
      if (fadeOut > 0) {
        g.lineTo(rw, h - 2);
      } else {
        g.lineTo(rw, 3);
      }
      g.stroke();
    }
  }, [width, height, data, audioIn, duration, color, dimmed, fadeIn, fadeOut]);
  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

export const AudioClipView = memo(function AudioClipView(
  props: ViewProps & {
    audioUrl: string | null;
    enabled: boolean;
    music: boolean;
    onExtendToSource?: () => void;
  },
) {
  const { clip, widthPx, heightPx, audioUrl, enabled, music, orderIndex, onExtendToSource } =
    props;
  const peaks = usePeaks(audioUrl, enabled);
  const def = TRACK_BY_ID[clip.track];
  const label = clipLabel(clip, orderIndex);
  return (
    <Shell {...props}>
      <div style={{ position: "absolute", inset: 0 }}>
        <WaveformCanvas
          width={Math.max(6, widthPx)}
          height={heightPx - 6}
          data={peaks}
          audioIn={clip.audio_in ?? 0}
          duration={clip.duration}
          color={def.color}
          dimmed={!!clip.muted}
          fadeIn={clip.fade_in ?? 0}
          fadeOut={clip.fade_out ?? 0}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg,rgba(8,10,14,0.55) 0%,rgba(8,10,14,0) 45%,rgba(8,10,14,0.5) 100%)",
        }}
      />
      <TopRow
        clip={clip}
        icon={music ? <Music2 size={11} /> : <Mic size={11} />}
        label={label}
        showLabel={widthPx > 70}
        widthPx={widthPx}
        srcDur={peaks?.real ? peaks.duration : null}
        onSrcClick={onExtendToSource}
      />
    </Shell>
  );
});

export const TextView = memo(function TextView(props: ViewProps) {
  const { clip, widthPx, orderIndex } = props;
  const label = clipLabel(clip, orderIndex);
  const isCaptionText = !!clip.text?.trim();
  return (
    <Shell {...props}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 8px 0 10px",
        }}
      >
        <Type size={11} color="#cdd6ff" style={{ flexShrink: 0 }} />
        {isCaptionText ? (
          <span
            style={{
              color: "#eef1ff",
              fontSize: 11,
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {clip.text}
          </span>
        ) : (
          <span
            style={{
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textShadow: "0 1px 2px rgba(0,0,0,.8)",
            }}
          >
            {label}
          </span>
        )}
        <span style={{ marginLeft: "auto", flexShrink: 0 }}>
          {clip.locked && <Lock size={10} color="#ffd166" />}
        </span>
      </div>
      {widthPx >= 46 && (
        <span
          style={{
            position: "absolute",
            right: 5,
            bottom: 2,
            pointerEvents: "none",
          }}
        >
          <Chip>{clip.duration.toFixed(1)}s</Chip>
        </span>
      )}
    </Shell>
  );
});
