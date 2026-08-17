import { Clapperboard, Video } from "lucide-react";
import type { Scene, VideoStatus } from "../../types";

interface Props {
  projectId: number;
  scenes: Scene[];
  actionLoading: string;
  ratio: string;
  videoStatus: VideoStatus | null;
  onBuild: (options?: { ratio?: string }) => Promise<void>;
  mediaUrl: (path: string | null | undefined) => string;
}

export default function VideoStep({
  projectId: _projectId,
  scenes,
  actionLoading,
  ratio,
  videoStatus,
  onBuild,
  mediaUrl: _mediaUrl,
}: Props) {
  const building = actionLoading === "video" || videoStatus?.running;

  return (
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
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
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
            onClick={() => onBuild({ ratio })}
            style={{ padding: "0.45rem 1rem", fontWeight: 600 }}
          >
            {building ? (
              `Building... ${videoStatus?.progress ?? 0}%`
            ) : (
              <>
                <Clapperboard size={16} style={{ verticalAlign: "-3px" }} />{" "}
                Build Video
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
  );
}
