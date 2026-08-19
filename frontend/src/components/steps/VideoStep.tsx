import { Clapperboard, Video, Package } from "lucide-react";
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
  }) => Promise<void>;
  mediaUrl: (path: string | null | undefined) => string;
  enableSubtitles: boolean;
  subtitleStyle: string;
  subtitlePosition: string;
  subtitleColor: string;
  subtitleOutlineColor: string;
  subtitleOutline: number;
  exportInfo: ExportResult | null;
  onExport: () => void;
}

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
  exportInfo,
  onExport,
}: Props) {
  const building = actionLoading === "video" || videoStatus?.running;

  return (
    <div style={{ display: "grid", gridTemplateColumns: videoStatus?.output ? "1.2fr 0.8fr" : "1fr", gap: "1rem", alignItems: "start" }}>
      {/* Left Column: Build Settings & Progress */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div className="card" style={{ display: "grid", gap: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Video size={20} color="var(--primary)" /> Video Builder
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
                Combines images and spoken narration using FFmpeg
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn-primary"
                disabled={!!actionLoading || scenes.length === 0}
                onClick={() => onBuild({
                  ratio,
                  subtitles: enableSubtitles,
                  subtitle_style: subtitleStyle,
                  subtitle_position: subtitlePosition,
                  subtitle_color: subtitleColor,
                  subtitle_outline_color: subtitleOutlineColor,
                  subtitle_outline: subtitleOutline,
                })}
                style={{ padding: "0.45rem 1rem", fontWeight: 600 }}
              >
                {building ? (
                  `Building... ${videoStatus?.progress ?? 0}%`
                ) : (
                  <>
                    <Clapperboard size={16} style={{ verticalAlign: "-3px", marginRight: "0.25rem" }} />{" "}
                    Build Video
                  </>
                )}
              </button>

              <button
                className="btn-secondary"
                disabled={!!actionLoading || scenes.length === 0}
                onClick={onExport}
                style={{ padding: "0.45rem 1rem", fontWeight: 600 }}
              >
                {actionLoading === "export" ? (
                  "Exporting..."
                ) : (
                  <>
                    <Package size={16} style={{ verticalAlign: "-3px", marginRight: "0.25rem" }} />{" "}
                    Export Project
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Build Progress Bar */}
          {building && videoStatus && (
            <div
              style={{
                padding: "0.75rem",
                background: "var(--bg)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.35rem",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>
                  {videoStatus.message}
                </span>
                <strong>{videoStatus.progress}%</strong>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${videoStatus.progress}%`,
                    background: "var(--accent)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Right Column: Rendered Video Preview Player */}
      {videoStatus?.output && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>
          <h4 style={{ fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.4rem", margin: 0 }}>
            🎬 Rendered Video Preview
          </h4>
          <div
            style={{
              background: "#000",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              aspectRatio: ratio === "9:16" ? "9 / 16" : "16 / 9",
              maxHeight: ratio === "9:16" ? "420px" : "320px",
              margin: "0 auto",
              border: "1px solid var(--border)",
              width: "100%"
            }}
          >
            <video
              src={mediaUrl(videoStatus.output)}
              controls
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
