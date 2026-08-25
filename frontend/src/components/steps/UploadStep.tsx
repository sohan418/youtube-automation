import { useState } from "react";
import { Play, Upload, Check, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import type { YouTubeUploadStatus, VideoStatus, SEOMetadata } from "../../types";

interface Props {
  projectId: number;
  actionLoading: string;
  videoStatus: VideoStatus | null;
  seo: SEOMetadata | null;
  youtubeConfig: { youtube_api_key_configured: boolean; youtube_playlist_id: string; youtube_client_id_configured: boolean; youtube_connected: boolean } | null;
  youtubeUploadStatus: YouTubeUploadStatus | null;
  onUploadYouTube: (privacy: string) => void;
}

export default function UploadStep({
  projectId: _projectId,
  actionLoading,
  videoStatus,
  seo,
  youtubeConfig,
  youtubeUploadStatus,
  onUploadYouTube,
}: Props) {
  const [privacy, setPrivacy] = useState("private");
  const hasVideo = !!videoStatus?.output;
  const isUploading = youtubeUploadStatus?.running;
  const isDone = youtubeUploadStatus?.stage === "done" && youtubeUploadStatus.video_url;
  const isFailed = youtubeUploadStatus?.stage === "failed";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Upload to YouTube</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>Publish your video directly to YouTube</p>
      </div>

      {/* Connection Status */}
      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: youtubeConfig?.youtube_connected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {youtubeConfig?.youtube_connected ? <Check size={18} color="var(--success)" /> : <AlertCircle size={18} color="var(--danger)" />}
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              {youtubeConfig?.youtube_connected ? "YouTube Connected" : "YouTube Not Connected"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {youtubeConfig?.youtube_connected
                ? "Your YouTube account is ready for uploads"
                : "Configure YouTube OAuth in Project Settings to enable uploads"}
            </div>
          </div>
        </div>
      </div>

      {/* Video Ready */}
      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: hasVideo ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {hasVideo ? <Check size={18} color="var(--success)" /> : <AlertCircle size={18} color="var(--danger)" />}
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              {hasVideo ? "Video Ready" : "Video Not Built"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {hasVideo ? "Final video is built and ready to upload" : "Build your video in the Editor tab first"}
            </div>
          </div>
        </div>
      </div>

      {/* SEO Summary */}
      {seo && (
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.5rem" }}>VIDEO METADATA</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{seo.title || "No title set"}</div>
            {seo.description && (
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {seo.description.slice(0, 200)}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {seo.tags && <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid var(--border)", color: "var(--text-muted)" }}>Tags: {seo.tags.split(",").length}</span>}
              {seo.category && <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "999px", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{seo.category}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress or Action */}
      {isDone && youtubeUploadStatus.video_url ? (
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={28} color="var(--success)" />
            </div>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>Upload Complete!</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>Your video is now on YouTube</div>
            </div>
            <a
              href={youtubeUploadStatus.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1.2rem", textDecoration: "none", background: "#ff0000", border: "none", color: "#fff" }}
            >
              <Play size={15} /> View on YouTube <ExternalLink size={12} />
            </a>
          </div>
        </div>
      ) : isUploading ? (
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <Loader2 size={28} color="var(--primary)" style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{youtubeUploadStatus?.message}</div>
            <div style={{ width: "100%", height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${youtubeUploadStatus?.progress ?? 0}%`, background: "#ff0000", transition: "width 0.3s" }} />
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{youtubeUploadStatus?.progress ?? 0}%</div>
          </div>
        </div>
      ) : isFailed ? (
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", textAlign: "center" }}>
            <AlertCircle size={28} color="var(--danger)" />
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--danger)" }}>Upload Failed</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{youtubeUploadStatus?.error}</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>PRIVACY</div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[
                { value: "private", label: "Private", desc: "Only you" },
                { value: "unlisted", label: "Unlisted", desc: "Anyone with link" },
                { value: "public", label: "Public", desc: "Everyone" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPrivacy(opt.value)}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    borderRadius: "6px",
                    border: privacy === opt.value ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                    background: privacy === opt.value ? "rgba(124,92,255,0.08)" : "transparent",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: privacy === opt.value ? "var(--primary)" : "var(--text)" }}>{opt.label}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{opt.desc}</div>
                </button>
              ))}
            </div>
            <button
              className="btn-primary"
              disabled={!hasVideo || !youtubeConfig?.youtube_connected || !!actionLoading}
              onClick={() => onUploadYouTube(privacy)}
              style={{ width: "100%", padding: "0.6rem", fontSize: "0.9rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "#ff0000", border: "none" }}
            >
              <Upload size={16} /> Upload to YouTube
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
