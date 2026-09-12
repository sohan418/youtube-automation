import { useState, useEffect } from "react";
import { Play, Upload, Check, ExternalLink, Loader2, AlertCircle, Calendar, Clock, Sun, Sunset, Lock, AlertTriangle } from "lucide-react";
import type { YouTubeUploadStatus, VideoStatus, SEOMetadata, YouTubeConfig } from "../../types";
import StepHeader from "../studio/StepHeader";
import "./UploadStep.css";

interface Props {
  projectId: number;
  actionLoading: string;
  videoStatus: VideoStatus | null;
  seo: SEOMetadata | null;
  youtubeConfig: YouTubeConfig | null;
  youtubeUploadStatus: YouTubeUploadStatus | null;
  onUploadYouTube: (privacy: string, publishAt?: string) => void;
  onCollapse?: () => void;
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
  onCollapse,
}: Props) {
  const [privacy, setPrivacy] = useState("private");
  const [youtubeVerify, setYoutubeVerify] = useState<YoutubeVerify | null>(null);

  // Upload scheduling state
  const [uploadMode, setUploadMode] = useState<"now" | "scheduled">("now");
  const [scheduledDay, setScheduledDay] = useState<"today" | "tomorrow" | "custom">("today");
  const [scheduledSlot, setScheduledSlot] = useState<"morning" | "evening" | "custom">("morning");

  // Custom datetime state (YYYY-MM-DDTHH:mm)
  const getInitialCustomDateTime = () => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  };
  const [customDateTime, setCustomDateTime] = useState<string>(getInitialCustomDateTime());

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

  const getTargetDate = (): Date => {
    if (scheduledDay === "custom" || scheduledSlot === "custom") {
      const dt = new Date(customDateTime);
      return isNaN(dt.getTime()) ? new Date() : dt;
    }
    const d = new Date();
    if (scheduledDay === "tomorrow") {
      d.setDate(d.getDate() + 1);
    }
    if (scheduledSlot === "morning") {
      d.setHours(10, 0, 0, 0);
    } else if (scheduledSlot === "evening") {
      d.setHours(18, 0, 0, 0);
    }
    // If today's slot has already passed, auto-roll to tomorrow
    if (scheduledDay === "today" && d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  const targetDate = getTargetDate();
  const isPastDate = targetDate.getTime() <= Date.now() + 60000;

  const handleUploadSubmit = () => {
    if (uploadMode === "scheduled") {
      const publishAtISO = targetDate.toISOString();
      onUploadYouTube("private", publishAtISO);
    } else {
      onUploadYouTube(privacy);
    }
  };

  const connectionOk = youtubeVerify ? youtubeVerify.connected : youtubeConfig?.youtube_connected;
  const needsReconnect = !!youtubeVerify && !youtubeVerify.connected && youtubeVerify.needs_reconnect;
  const hasVideo = !!videoStatus?.output;
  const isUploading = youtubeUploadStatus?.running;
  const isDone = youtubeUploadStatus?.stage === "done" && youtubeUploadStatus.video_url;
  const isFailed = youtubeUploadStatus?.stage === "failed";

  return (
    <div className="upload-step">
      <StepHeader
        title="Upload to YouTube"
        subtitle="Publish or schedule your video directly to YouTube"
        onCollapse={onCollapse}
      />

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
          <div className="upload-failed-content" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "1rem 0" }}>
            <AlertCircle size={28} color="var(--danger)" />
            <div className="upload-failed-title" style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--danger)" }}>Upload Failed</div>
            <div className="upload-failed-desc" style={{ fontSize: "0.82rem", color: "var(--text-muted)", textAlign: "center", maxWidth: "420px" }}>{youtubeUploadStatus?.error}</div>
            <button className="btn-primary" onClick={handleUploadSubmit} style={{ marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <Upload size={14} /> Retry Upload
            </button>
          </div>
        </div>
      ) : (
        <div className="card upload-card">
          <div className="upload-mode-toggle-group">
            <button
              className={`upload-mode-btn ${uploadMode === "now" ? "active" : ""}`}
              onClick={() => setUploadMode("now")}
            >
              <Upload size={15} /> Upload Now
            </button>
            <button
              className={`upload-mode-btn ${uploadMode === "scheduled" ? "active" : ""}`}
              onClick={() => setUploadMode("scheduled")}
            >
              <Calendar size={15} /> Schedule Upload
            </button>
          </div>

          {uploadMode === "now" ? (
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
                onClick={handleUploadSubmit}
              >
                <Upload size={16} /> Upload Now
              </button>
            </div>
          ) : (
            <div className="upload-schedule-content">
              <div className="upload-section-title">
                <Clock size={16} /> Select Publishing Schedule
              </div>

              {/* Day Selection */}
              <div className="schedule-group">
                <div className="upload-privacy-label">SELECT DAY</div>
                <div className="schedule-btn-grid">
                  <button
                    className={`schedule-option-btn ${scheduledDay === "today" ? "active" : ""}`}
                    onClick={() => setScheduledDay("today")}
                  >
                    Today
                  </button>
                  <button
                    className={`schedule-option-btn ${scheduledDay === "tomorrow" ? "active" : ""}`}
                    onClick={() => setScheduledDay("tomorrow")}
                  >
                    Tomorrow
                  </button>
                  <button
                    className={`schedule-option-btn ${scheduledDay === "custom" ? "active" : ""}`}
                    onClick={() => setScheduledDay("custom")}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Slots of the day */}
              {scheduledDay !== "custom" && (
                <div className="schedule-group">
                  <div className="upload-privacy-label">TIME OF THE DAY</div>
                  <div className="schedule-btn-grid">
                    <button
                      className={`schedule-option-btn slot-btn ${scheduledSlot === "morning" ? "active" : ""}`}
                      onClick={() => setScheduledSlot("morning")}
                    >
                      <span className="slot-btn-label">
                        <Sun size={14} /> Morning
                      </span>
                      <small>10:00 AM</small>
                    </button>
                    <button
                      className={`schedule-option-btn slot-btn ${scheduledSlot === "evening" ? "active" : ""}`}
                      onClick={() => setScheduledSlot("evening")}
                    >
                      <span className="slot-btn-label">
                        <Sunset size={14} /> Evening
                      </span>
                      <small>06:00 PM</small>
                    </button>
                    <button
                      className={`schedule-option-btn slot-btn ${scheduledSlot === "custom" ? "active" : ""}`}
                      onClick={() => setScheduledSlot("custom")}
                    >
                      <span className="slot-btn-label">
                        <Clock size={14} /> Custom
                      </span>
                      <small>Pick exact time</small>
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Date & Time input */}
              {(scheduledDay === "custom" || scheduledSlot === "custom") && (
                <div className="schedule-group">
                  <div className="upload-privacy-label">CUSTOM DATE & TIME</div>
                  <input
                    type="datetime-local"
                    className="schedule-datetime-input"
                    value={customDateTime}
                    onChange={(e) => setCustomDateTime(e.target.value)}
                  />
                </div>
              )}

              {/* Preview card */}
              <div className="schedule-summary-card">
                <div className="schedule-summary-title">Publishing Target</div>
                <div className="schedule-summary-time">
                  <Calendar size={15} />{" "}
                  {targetDate.toLocaleString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="schedule-summary-note">
                  <Lock size={13} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>
                    YouTube will upload the video as Private and automatically transition it to Public at the scheduled time.
                  </span>
                </div>
                {isPastDate && (
                  <div className="schedule-warning">
                    <AlertTriangle size={14} />
                    <span>Selected time must be in the future.</span>
                  </div>
                )}
              </div>

              <button
                className="btn-primary upload-primary-btn"
                disabled={!hasVideo || !connectionOk || !!actionLoading || isPastDate}
                onClick={handleUploadSubmit}
              >
                <Calendar size={16} /> Schedule Video Upload
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}