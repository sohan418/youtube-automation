import { useRef, useState } from "react";
import { Clapperboard, Video, Package, Mic, Image, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Scene, VideoStatus, ExportResult, TimelineData } from "../../types";

interface Props {
  projectId: number;
  scenes: Scene[];
  actionLoading: string;
  ratio: string;
  videoStatus: VideoStatus | null;
  onBuild: (options?: {
    ratio?: string; subtitles?: boolean; subtitle_style?: string;
    subtitle_position?: string; subtitle_color?: string;
    subtitle_outline_color?: string; subtitle_outline?: number;
    subtitle_font_size?: number | null; force_rebuild?: boolean;
    timeline?: TimelineData | null;
  }) => Promise<void>;
  mediaUrl: (path: string | null | undefined) => string;
  enableSubtitles: boolean;
  subtitleStyle: string;
  subtitlePosition: string;
  subtitleColor: string;
  subtitleOutlineColor: string;
  subtitleOutline: number;
  subtitleFontSize: number | null;
  exportInfo: ExportResult | null;
  onExport: () => void;
  activeSceneIdx: number;
  setActiveSceneIdx: (idx: number) => void;
}

const badgeStyle = (ok: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  padding: "0.22rem 0.5rem",
  borderRadius: "999px",
  fontSize: "0.68rem",
  fontWeight: 600,
  border: `1px solid ${ok ? "var(--success)" : "var(--border)"}`,
  color: ok ? "var(--success)" : "var(--text-muted)",
  background: ok ? "transparent" : "var(--bg)",
});

export default function VideoStep({
  projectId: _projectId,
  scenes,
  actionLoading,
  ratio,
  videoStatus,
  onBuild,
  mediaUrl,
  enableSubtitles,
  subtitleStyle,
  subtitlePosition,
  subtitleColor,
  subtitleOutlineColor,
  subtitleOutline,
  subtitleFontSize,
  exportInfo: _exportInfo,
  onExport,
  activeSceneIdx,
  setActiveSceneIdx,
}: Props) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const building = actionLoading === "video" || videoStatus?.running;
  const hasBuiltVideo = !!videoStatus?.output;
  const [forceRebuild, setForceRebuild] = useState(false);

  const sceneStatuses = videoStatus?.scene_statuses || {};
  const safeIdx = scenes.length > 0 ? Math.min(Math.max(activeSceneIdx, 0), scenes.length - 1) : 0;
  const activeScene: Scene | null = scenes[safeIdx] ?? null;

  const imageCount = scenes.filter((s) => s.image_path || (s.images && s.images.length > 0)).length;
  const audioCount = scenes.filter((s) => s.audio_path).length;
  const totalDuration = scenes.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  const scrollStrip = (dir: number) => {
    stripRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  };

  const narrationText = activeScene?.narration ?? "";
  const narrationSnippet =
    narrationText.length > 200 ? `${narrationText.slice(0, 200)}…` : narrationText;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      {/* Editor Control Card */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem", padding: "0.85rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Video size={16} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Editor</h3>
            <span style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              padding: "0.15rem 0.5rem",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              background: "var(--bg)",
            }}>
              {ratio}
            </span>
          </div>
          {hasBuiltVideo && (
            <span style={badgeStyle(true)}>
              <Check size={11} /> Built
            </span>
          )}
        </div>

        <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
          {hasBuiltVideo
            ? "Final video has been rendered. Use the player on the right to preview."
            : "Assemble images, narration audio, and transition effects into the compiled video."}
        </p>

        {building && videoStatus && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", padding: "0.5rem", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{videoStatus.message}</span>
              <span style={{ fontSize: "0.68rem", fontWeight: 700 }}>{videoStatus.progress}%</span>
            </div>
            <div style={{ width: "100%", height: 5, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${videoStatus.progress}%`, background: "var(--primary)", transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", alignItems: "center" }}>
          <button
            className="btn-primary"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={() =>
              onBuild({
                ratio,
                subtitles: enableSubtitles,
                subtitle_style: subtitleStyle,
                subtitle_position: subtitlePosition,
                subtitle_color: subtitleColor,
                subtitle_outline_color: subtitleOutlineColor,
                subtitle_outline: subtitleOutline,
                subtitle_font_size: subtitleFontSize,
                force_rebuild: forceRebuild,
              })
            }
            style={{ flex: 1, padding: "0.45rem 0.8rem", fontSize: "0.8rem", fontWeight: 600 }}
          >
            {building ? `Building...` : <><Clapperboard size={13} style={{ marginRight: "0.25rem", verticalAlign: "-2px" }} /> Build Video</>}
          </button>
          
          <button
            className="btn-secondary"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={onExport}
            style={{ padding: "0.45rem 0.8rem", fontSize: "0.8rem", fontWeight: 600 }}
          >
            {actionLoading === "export" ? "Exporting..." : <><Package size={13} style={{ marginRight: "0.25rem", verticalAlign: "-2px" }} /> Export</>}
          </button>
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "var(--text-muted)", cursor: "pointer", marginTop: "0.25rem" }}>
          <input
            type="checkbox"
            checked={forceRebuild}
            onChange={(e) => setForceRebuild(e.target.checked)}
            disabled={building}
          />
          Force rebuild all scene clips from scratch
        </label>
      </div>

      {/* Horizontal Scene Strip */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.6rem 0.85rem" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Quick Navigation</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <button
            className="btn-secondary"
            onClick={() => scrollStrip(-1)}
            aria-label="Scroll scenes left"
            style={{ padding: "0.3rem 0.35rem", flexShrink: 0 }}
          >
            <ChevronLeft size={14} />
          </button>
          <div
            ref={stripRef}
            style={{
              display: "flex",
              gap: "0.4rem",
              overflowX: "auto",
              flex: 1,
              minWidth: 0,
              padding: "2px",
              scrollbarWidth: "thin",
            }}
          >
            {scenes.map((scene, idx) => {
              const isActive = idx === safeIdx;
              return (
                <button
                  key={scene.id}
                  onClick={() => setActiveSceneIdx(idx)}
                  title={`Scene ${idx + 1}`}
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    width: "48px",
                    height: "36px",
                    padding: 0,
                    borderRadius: "4px",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "var(--bg)",
                    border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
                    opacity: isActive ? 1 : 0.75,
                    transition: "border-color 0.15s ease, opacity 0.15s ease",
                  }}
                >
                  {scene.image_path ? (
                    <img
                      src={mediaUrl(scene.image_path)}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}
                  {sceneStatuses[idx + 1] === "rendering" && (
                    <span style={{ position: "absolute", inset: 0, border: "2px solid var(--primary)", borderRadius: "4px", background: "rgba(59,130,246,0.15)", animation: "pulse 1.5s infinite" }} />
                  )}
                  {sceneStatuses[idx + 1] === "done" && (
                    <span style={{ position: "absolute", inset: 0, border: "2px solid var(--success)", borderRadius: "4px", background: "rgba(34,197,94,0.1)" }} />
                  )}
                  {sceneStatuses[idx + 1] === "failed" && (
                    <span style={{ position: "absolute", inset: 0, border: "2px solid #ef4444", borderRadius: "4px", background: "rgba(239,68,68,0.15)" }} />
                  )}
                </button>
              );
            })}
          </div>
          <button
            className="btn-secondary"
            onClick={() => scrollStrip(1)}
            aria-label="Scroll scenes right"
            style={{ padding: "0.3rem 0.35rem", flexShrink: 0 }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Active Scene Details */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.55rem", padding: "0.85rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", justifyContent: "space-between" }}>
          <h4 style={{ margin: 0, fontSize: "0.85rem" }}>
            Scene {safeIdx + 1} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/ {scenes.length}</span>
          </h4>
          <span style={{
            fontSize: "0.68rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "999px",
            padding: "0.12rem 0.5rem",
          }}>
            {activeScene?.duration_seconds != null ? `${activeScene.duration_seconds.toFixed(1)}s` : "—"}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: "0.74rem", lineHeight: 1.4, color: "var(--text-muted)", fontStyle: "italic", background: "var(--bg)", padding: "0.45rem", borderRadius: "6px", border: "1px solid var(--border)" }}>
          {narrationSnippet || "No narration for this scene."}
        </p>

        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {activeScene?.image_path || (activeScene?.images && activeScene.images.length > 0) ? (
            <span style={badgeStyle(true)}>
              <Check size={11} /> <Image size={11} /> Image ready
            </span>
          ) : (
            <span style={badgeStyle(false)}>
              <Image size={11} /> No image
            </span>
          )}
          {activeScene?.audio_path ? (
            <span style={badgeStyle(true)}>
              <Check size={11} /> <Mic size={11} /> Audio ready
            </span>
          ) : (
            <span style={badgeStyle(false)}>
              <Mic size={11} /> No audio
            </span>
          )}
          {totalDuration > 0 && (
            <span style={badgeStyle(false)}>Total ≈ {totalDuration.toFixed(1)}s</span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.35rem", marginTop: "0.2rem" }}>
          {[
            { icon: <Video size={12} />, value: scenes.length, label: "Scenes" },
            { icon: <Image size={12} />, value: imageCount, label: "Images" },
            { icon: <Mic size={12} />, value: audioCount, label: "Audio" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.1rem",
                padding: "0.4rem 0.25rem",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <span style={{ color: "var(--primary)", display: "flex" }}>{stat.icon}</span>
              <strong style={{ fontSize: "0.85rem" }}>{stat.value}</strong>
              <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
