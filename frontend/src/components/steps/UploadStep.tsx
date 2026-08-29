import { useState, useEffect } from "react";
import { Play, Upload, Check, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import type { YouTubeUploadStatus, VideoStatus, SEOMetadata } from "../../types";
import "./UploadStep.css";

interface Props {
  projectId: number;
  actionLoading: string;
  videoStatus: VideoStatus | null;
  seo: SEOMetadata | null;
  youtubeConfig: { youtube_api_key_configured: boolean; youtube_playlist_id: string; youtube_client_id_configured: boolean; youtube_connected: boolean } | null;
  youtubeUploadStatus: YouTubeUploadStatus | null;
  onUploadYouTube: (privacy: string) => void;
}

type YoutubeVerify = { connected: boolean; needs_reconnect: boolean; reason: string };

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
  const [youtubeVerify, setYoutubeVerify] = useState<YoutubeVerify | null>(null);

  useEffect(() => {
    if (youtubeConfig?.youtube_connected) {
      (async () => {
        try {
          const res = await fetch("/api/youtube/verify");
          setYoutubeVerify(await res.json());
        } catch {
          setYoutubeVerify(null);
        }
      })();
    } else {
      setYoutubeVerify(null);
    }
  }, [youtubeConfig]);

  const startYoutubeAuth = async () => {
    try {
      const res = await fetch("/api/youtube/auth/url");
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } catch {}
  };

  const connectionOk = youtubeVerify ? youtubeVerify.connected : youtubeConfig?.youtube_connected;
  const needsReconnect = !!youtubeVerify && !youtubeVerify.connected && youtubeVerify.needs_reconnect;
  const hasVideo = !!videoStatus?.output;
  const isUploading = youtubeUploadStatus?.running;
  const isDone = youtubeUploadStatus?.stage === "done" && youtubeUploadStatus.video_url;
  const isFailed = youtubeUploadStatus?.stage === "failed";

  return (
    <div className="upload-step">
      {/* Header */}
      <div>
        <h2>Upload to YouTube</h2>
        <p className="upload-step-subtitle">Publish your video directly to YouTube</p>
      </div>

      {/* Connection Status */}
      <div className="card upload-card">
        <div className="upload-status-row">
          <div
            className="upload-status-icon"
            style={{ background: connectionOk ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}
          >
            {connectionOk ? <Check size={18} color="var(--success)" /> : <AlertCircle size={18} color="var(--danger)" />}
          </div>
          <div>
            <div className="upload-status-title">
              {needsReconnect ? "YouTube Connection Expired" : connectionOk ? "YouTube Connected" : "YouTube Not Connected"}
            </div>
            <div className="upload-status-desc">
              {needsReconnect
                ? "Your access token expired or was revoked — reconnect to resume uploads"
                : connectionOk
                ? "Your YouTube account is ready for uploads"
                : "Configure YouTube OAuth in Project Settings to enable uploads"}
            </div>
          </div>
          {needsReconnect && (
            <button className="btn-primary" onClick={startYoutubeAuth} style={{ marginLeft: "auto", background: "#ff0000", border: "none", fontSize: "0.78rem" }}>
              <Play size={14} /> Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Video Ready */}
      <div className="card upload-card">
        <div className="upload-status-row">
          <div
            className="upload-status-icon"
            style={{ background: hasVideo ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}
          >
            {hasVideo ? <Check size={18} color="var(--success)" /> : <AlertCircle size={18} color="var(--danger)" />}
          </div>
          <div>
            <div className="upload-status-title">
              {hasVideo ? "Video Ready" : "Video Not Built"}
            </div>
            <div className="upload-status-desc">
              {hasVideo ? "Final video is built and ready to upload" : "Build your video in the Editor tab first"}
            </div>
          </div>
        </div>
      </div>

      {/* SEO Summary */}
      {seo && (
        <div className="card upload-card">
          <div className="upload-meta-label">VIDEO METADATA</div>
          <div className="upload-meta">
            <div className="upload-meta-title">{seo.title || "No title set"}</div>
            {seo.description && (
              <div className="upload-meta-desc">
                {seo.description.slice(0, 200)}
              </div>
            )}
            <div className="upload-meta-tags">
              {seo.tags && <span className="upload-tag">Tags: {seo.tags.split(/[\s,]+/).filter(Boolean).length}</span>}
              {seo.category && <span className="upload-tag">{seo.category}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress or Action */}
      {isDone && youtubeUploadStatus.video_url ? (
        <div className="card upload-card">
          <div className="upload-done-content">
            <div className="upload-done-icon">
              <Check size={28} color="var(--success)" />
            </div>
            <div>
              <div className="upload-done-title">Upload Complete!</div>
              <div className="upload-done-desc">Your video is now on YouTube</div>
            </div>
            <a
              href={youtubeUploadStatus.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary upload-view-btn"
            >
              <Play size={15} /> View on YouTube <ExternalLink size={12} />
            </a>
          </div>
        </div>
      ) : isUploading ? (
        <div className="card upload-card">
          <div className="upload-uploading-content">
            <Loader2 size={28} color="var(--primary)" className="upload-spinner" />
            <div className="upload-uploading-message">{youtubeUploadStatus?.message}</div>
            <div className="upload-progress-track">
              <div className="upload-progress-fill" style={{ width: `${youtubeUploadStatus?.progress ?? 0}%` }} />
            </div>
            <div className="upload-progress-label">{youtubeUploadStatus?.progress ?? 0}%</div>
          </div>
        </div>
      ) : isFailed ? (
        <div className="card upload-card">
          <div className="upload-failed-content">
            <AlertCircle size={28} color="var(--danger)" />
            <div className="upload-failed-title">Upload Failed</div>
            <div className="upload-failed-desc">{youtubeUploadStatus?.error}</div>
          </div>
        </div>
      ) : (
        <div className="card upload-card">
          <div className="upload-privacy-content">
            <div className="upload-privacy-label">PRIVACY</div>
            <div className="upload-privacy-options">
              {[
                { value: "private", label: "Private", desc: "Only you" },
                { value: "unlisted", label: "Unlisted", desc: "Anyone with link" },
                { value: "public", label: "Public", desc: "Everyone" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPrivacy(opt.value)}
                  className="upload-privacy-btn"
                  style={{
                    border: privacy === opt.value ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                    background: privacy === opt.value ? "rgba(124,92,255,0.08)" : "transparent",
                  }}
                >
                  <div className="upload-privacy-btn-title" style={{ color: privacy === opt.value ? "var(--primary)" : "var(--text)" }}>{opt.label}</div>
                  <div className="upload-privacy-btn-desc">{opt.desc}</div>
                </button>
              ))}
            </div>
            <button
              className="btn-primary upload-primary-btn"
              disabled={!hasVideo || !connectionOk || !!actionLoading}
              onClick={() => onUploadYouTube(privacy)}
            >
              <Upload size={16} /> Upload to YouTube
            </button>
          </div>
        </div>
      )}
    </div>
  );
}