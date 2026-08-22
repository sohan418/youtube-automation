import { useRef } from "react";
import { Clapperboard, Video, Package, Mic, Image, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Scene, VideoStatus, ExportResult } from "../../types";

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
    subtitle_font_size?: number | null;
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
  exportInfo,
  onExport,
  activeSceneIdx,
  setActiveSceneIdx,
}: Props) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const building = actionLoading === "video" || videoStatus?.running;
  const portrait = ratio === "9:16";
  const hasBuiltVideo = !!videoStatus?.output;

  const safeIdx = scenes.length > 0 ? Math.min(Math.max(activeSceneIdx, 0), scenes.length - 1) : 0;
  const activeScene: Scene | null = scenes[safeIdx] ?? null;

  const imageCount = scenes.filter((s) => s.image_path || (s.images && s.images.length > 0)).length;
  const audioCount = scenes.filter((s) => s.audio_path).length;
  const totalDuration = scenes.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  const scrollStrip = (dir: number) => {
    stripRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  const narrationText = activeScene?.narration ?? "";
  const narrationSnippet =
    narrationText.length > 200 ? `${narrationText.slice(0, 200)}…` : narrationText;
  const subtitleSample =
    narrationText.length > 70 ? `${narrationText.slice(0, 70)}…` : narrationText;

  const subtitlePosStyle: React.CSSProperties =
    subtitlePosition === "top"
      ? { top: "5%", transform: "translateX(-50%)" }
      : subtitlePosition === "center"
      ? { top: "50%", transform: "translate(-50%, -50%)" }
      : { bottom: "6%", transform: "translateX(-50%)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {/* Big Preview Player */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
          <Video size={16} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Editor</h3>
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              padding: "0.15rem 0.5rem",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              background: "var(--bg)",
            }}
          >
            {ratio}
          </span>
          {hasBuiltVideo && (
            <span style={{ ...badgeStyle(true), background: "var(--bg)" }}>
              <Check size={11} /> Built
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.35rem", alignItems: "center" }}>
            {building && videoStatus && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {videoStatus.message}
                </span>
                <div style={{ width: 80, height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${videoStatus.progress}%`, background: "var(--primary)", transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: "0.68rem", fontWeight: 700 }}>{videoStatus.progress}%</span>
              </div>
            )}
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
                })
              }
              style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              {building ? `Building...` : <><Clapperboard size={13} /> Build</>}
            </button>
            <button
              className="btn-secondary"
              disabled={!!actionLoading || scenes.length === 0}
              onClick={onExport}
              style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              {actionLoading === "export" ? "Exporting..." : <><Package size={13} /> Export</>}
            </button>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            background: "#000",
            borderRadius: "calc(var(--radius) - 2px)",
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            aspectRatio: portrait ? "9 / 16" : "16 / 9",
            maxHeight: portrait ? "520px" : "380px",
            margin: "0 auto",
            border: "1px solid var(--border)",
            width: "100%",
          }}
        >
          {hasBuiltVideo ? (
            <video
              src={mediaUrl(videoStatus!.output)}
              controls
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : activeScene?.image_path ? (
            <>
              <img
                src={mediaUrl(activeScene.image_path)}
                alt={`Scene ${safeIdx + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
              {enableSubtitles && subtitleSample && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    ...subtitlePosStyle,
                    maxWidth: "88%",
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15em 0.5em",
                      borderRadius: "4px",
                      background: "rgba(0,0,0,0.55)",
                      fontSize: subtitleFontSize
                        ? `${Math.round(subtitleFontSize * (portrait ? 0.32 : 0.42))}px`
                        : portrait
                        ? "1rem"
                        : "1.25rem",
                      fontWeight: 700,
                      lineHeight: 1.3,
                      color: subtitleColor,
                      fontFamily: subtitleStyle === "shorts" ? "Impact, sans-serif" : "Arial, sans-serif",
                      letterSpacing: subtitleStyle === "shorts" ? "0.5px" : "normal",
                      textTransform: subtitleStyle === "shorts" ? "uppercase" : "none",
                      textShadow:
                        subtitleOutline > 0
                          ? `1px 1px ${subtitleOutline}px ${subtitleOutlineColor}, -1px -1px ${subtitleOutline}px ${subtitleOutlineColor}, 1px -1px ${subtitleOutline}px ${subtitleOutlineColor}, -1px 1px ${subtitleOutline}px ${subtitleOutlineColor}`
                          : "none",
                    }}
                  >
                    {subtitleSample}
                  </span>
                </div>
              )}
              {!enableSubtitles && (
                <span
                  style={{
                    position: "absolute",
                    bottom: "8px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: "0.62rem",
                    color: "rgba(255,255,255,0.55)",
                    background: "rgba(0,0,0,0.45)",
                    padding: "0.12rem 0.5rem",
                    borderRadius: "999px",
                    whiteSpace: "nowrap",
                  }}
                >
                  Scene {safeIdx + 1} preview — subtitles off
                </span>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "1rem" }}>
              <Clapperboard size={28} style={{ opacity: 0.4 }} />
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem" }}>
                {scenes.length === 0
                  ? "No scenes yet — generate scenes first"
                  : `Scene ${safeIdx + 1} has no image yet`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Scene Strip */}
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
                  width: portrait ? "52px" : "86px",
                  height: portrait ? "82px" : "52px",
                  padding: 0,
                  borderRadius: "var(--radius)",
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
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                    }}
                  >
                    {idx + 1}
                  </span>
                )}
                <span
                  style={{
                    position: "absolute",
                    bottom: "2px",
                    left: "2px",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    color: "#fff",
                    background: isActive ? "var(--primary)" : "rgba(0,0,0,0.6)",
                    borderRadius: "3px",
                    padding: "0.05rem 0.3rem",
                    lineHeight: 1.5,
                  }}
                >
                  {idx + 1}
                </span>
                {scene.audio_path && (
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "2px",
                      display: "flex",
                      color: "var(--success)",
                      background: "rgba(0,0,0,0.55)",
                      borderRadius: "3px",
                      padding: "0.08rem",
                    }}
                  >
                    <Mic size={9} />
                  </span>
                )}
              </button>
            );
          })}
          {scenes.length === 0 && (
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", alignSelf: "center" }}>
              No scenes available
            </span>
          )}
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

      {/* Bottom: Active Scene Details */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <h4 style={{ margin: 0, fontSize: "0.85rem" }}>
              Scene {safeIdx + 1}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> / {scenes.length}</span>
            </h4>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "999px",
                padding: "0.12rem 0.5rem",
              }}
            >
              {(activeScene?.duration_seconds ?? 0).toFixed(1)}s
            </span>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "0.76rem",
              lineHeight: 1.5,
              color: "var(--text-muted)",
              fontStyle: "italic",
              minHeight: "2.2em",
            }}
          >
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

          {exportInfo && !building && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.68rem",
                color: "var(--success)",
              }}
            >
              <Check size={11} /> {exportInfo.message} ({exportInfo.files.length} files)
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.35rem" }}>
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
                <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}
