import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useProjectDetail } from "../hooks/useProjectDetail";
import ProjectSettingsDialog from "../components/editors/ProjectSettingsDialog";
import ImageCropDialog from "../components/editors/ImageCropDialog";
import VideoTrimDialog from "../components/editors/VideoTrimDialog";
import { STUDIO_STEPS, getDoneMap } from "../components/studio/studioSteps";
import StudioHeader from "../components/studio/StudioHeader";
import StudioSidebar from "../components/studio/StudioSidebar";
import StudioStepContent from "../components/studio/StudioStepContent";
import MediaPreviewOverlay from "../components/studio/MediaPreviewOverlay";
import ToastNotification from "../components/studio/ToastNotification";
import { api, mediaUrl } from "../api/client";
import TimelineStep from "../components/steps/TimelineStep";
import "./ProjectDetail.css";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const h = useProjectDetail(projectId);

  const [timelineHeight, setTimelineHeight] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = timelineHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY; // upward drag increases height
      const newHeight = Math.max(140, Math.min(window.innerHeight * 0.7, startHeight + deltaY));
      setTimelineHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+K: focus AI bar
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const aiInput = document.querySelector<HTMLInputElement>(".ai-input-wrapper input");
        aiInput?.focus();
      }
      // Space: play/pause (only when not in an input)
      if (e.key === " " && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        const video = document.querySelector<HTMLVideoElement>(".studio-preview video");
        if (video) {
          e.preventDefault();
          video.paused ? video.play().catch(() => {}) : video.pause();
        }
      }
      // Ctrl+S: save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        // Trigger save based on active tab
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (h.loading)
    return (
      <div className="loading">
        <span className="spinner" /> Loading project...
      </div>
    );
  if (!h.project) return <div className="error">Project not found</div>;

  const doneMap = getDoneMap({
    ideas: h.ideas,
    activeScript: h.activeScript,
    scenes: h.scenes,
    thumbnails: h.thumbnails,
    seo: h.seo,
    exportInfo: h.exportInfo,
    videoStatus: h.videoStatus,
    timeline: h.timeline,
    youtubeUploaded: h.youtubeUploadStatus?.stage === "done",
  });

  const handleBuildVideo = async () => {
    await h.buildVideo({
      ratio: h.selectedRatio,
      subtitles: h.enableSubtitles,
      subtitle_style: h.subtitleStyle,
      subtitle_position: h.subtitlePosition,
      subtitle_color: h.subtitleColor,
      subtitle_outline_color: h.subtitleOutlineColor,
      subtitle_outline: h.subtitleOutline,
      subtitle_font_size: h.subtitleFontSize,
      timeline: h.timeline,
      force_rebuild: false,
      logo_overlay: h.logoOverlay,
    });
  };

  const handleExportVideo = () => {
    h.runAction("export", async () => {
      const result = await api.exportProject(projectId);
      h.setExportInfo(result);
      h.setSuccess(`${result.message} (${result.files.length} files)`);
      if (result.files.includes("video/final.mp4")) {
        const downloadUrl = mediaUrl(`${result.export_path}/video/final.mp4`);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", "final_video.mp4");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  return (
    <div className="studio-root">
      {/* Top header */}
      <StudioHeader
        project={h.project}
        statusData={{
          ideas: h.ideas,
          activeScript: h.activeScript,
          scenes: h.scenes,
          thumbnails: h.thumbnails,
          seo: h.seo,
          exportInfo: h.exportInfo,
          videoStatus: h.videoStatus,
          timeline: h.timeline,
          youtubeUploaded: h.youtubeUploadStatus?.stage === "done",
        }}
        openSettings={h.openSettings}
        selectedRatio={h.selectedRatio}
        onRatioChange={h.onRatioChange}
        actionLoading={h.actionLoading}
        videoStatus={h.videoStatus}
        onBuildVideo={handleBuildVideo}
        onExportVideo={handleExportVideo}
        logoOverlay={h.logoOverlay}
        onLogoOverlayChange={(value) => void h.saveLogoOverlay(value)}
      />

      {/* Dialogs */}
      {h.project && (
        <ProjectSettingsDialog
          isOpen={h.editingSettings}
          project={h.project}
          categories={h.categories}
          voiceConfig={h.voiceConfig}
          youtubeConfig={h.youtubeConfig}
          actionLoading={h.actionLoading}
          onClose={() => h.setEditingSettings(false)}
          onSave={h.saveSettings}
        />
      )}

      {h.error && <ToastNotification message={h.error} type="error" onClose={() => h.setError("")} duration={6000} />}
      {h.success && <ToastNotification message={h.success} type="success" onClose={() => h.setSuccess("")} duration={4000} />}

      {/* Body: sidebar (full height) + main workspace (preview top, timeline bottom) */}
      <div className="studio-body studio-body-flex">
        
        {/* Column 1: Narrow Sidebar (Stretches 100% height on the far left) */}
        <StudioSidebar
          activeTab={h.activeTab as never}
          steps={STUDIO_STEPS}
          done={doneMap}
          onSelect={(tab) => h.setActiveTab(tab)}
        />

        {/* Column 2: Tool Step Control Panel (Stretches 100% height, full vertical space) */}
        <div className="tool-panel">
              <StudioStepContent ctx={h} />
            </div>

            {/* Column 3: Player + Timeline Column (Spans the rest of the screen width, divided vertically) */}
            <div className="player-column">

              {/* Video Preview Player Canvas */}
              <div className={`preview-player-container ${isResizing ? "resizing" : ""}`}>
              <div className="preview-frame" style={{
                maxWidth: h.selectedRatio === "9:16" ? "260px" : "580px",
                aspectRatio: h.selectedRatio === "9:16" ? "9 / 16" : "16 / 9",
              }}>
                {h.videoStatus?.output ? (
                  <video
                    src={mediaUrl(h.videoStatus.output)}
                    controls
                    className="preview-frame-media"
                  />
                ) : (() => {
                  const activeScene = h.scenes[h.activeSceneIdx];
                  const activeMediaUrl = activeScene
                    ? (activeScene.video_path || activeScene.image_path || (activeScene.images && activeScene.images[0]?.file_path))
                    : null;
                  
                  return activeMediaUrl ? (
                    activeScene.video_path ? (
                      <video
                        src={mediaUrl(activeScene.video_path)}
                        controls
                        className="preview-frame-media"
                      />
                    ) : (
                      <img
                        src={mediaUrl(activeScene.image_path || (activeScene.images && activeScene.images[0]?.file_path))}
                        className="preview-frame-media"
                        alt="Scene Preview"
                      />
                    )
                  ) : (
                    <div className="preview-empty">
                      No media selected for active scene
                    </div>
                  );
                })()}

                {/* Live subtitle preview overlay */}
                {h.enableSubtitles && h.scenes[h.activeSceneIdx]?.narration && !h.videoStatus?.output && (
                  <div className="preview-subtitle-overlay">
                    <span className="preview-subtitle-text" style={{
                      fontFamily: h.subtitleStyle === "shorts" ? "Impact, sans-serif" : "Arial, sans-serif",
                      fontSize: h.selectedRatio === "9:16" ? "0.95rem" : "1.25rem",
                      color: h.subtitleStyle === "shorts" ? "#ffe600" : "#ffffff",
                      textTransform: h.subtitleStyle === "shorts" ? "uppercase" : "none",
                    }}>
                      {h.scenes[h.activeSceneIdx].narration}
                    </span>
                  </div>
                )}

                {/* Status overlays (e.g. Building status) */}
                {(h.actionLoading === "video" || h.videoStatus?.running) && (
                  <div className="preview-status-overlay">
                    <span className="spinner" />
                    <span className="preview-status-title">
                      Building Video... {h.videoStatus?.progress ?? 0}%
                    </span>
                    <span className="preview-status-message">
                      {h.videoStatus?.message}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Workspace Bottom Row: Full-Width Timeline Tracks (starts after the step panel) */}
            <div
              className="timeline-pane"
              style={{ height: `${timelineHeight}px` }}
            >
              {/* Resize Handle: Hoverable and draggable bar at the top */}
              <div
                onMouseDown={handleResizeStart}
                className={`timeline-resize-handle ${isResizing ? "active" : ""}`}
                title="Drag up/down to resize timeline"
              />
              <TimelineStep
                projectId={projectId}
                scenes={h.scenes}
                actionLoading={h.actionLoading}
                videoStatus={h.videoStatus}
                ratio={h.selectedRatio}
                mediaUrl={mediaUrl}
                timeline={h.timeline}
                onTimelineChange={h.setTimeline}
                onAddScene={h.quickAddScene}
              />
            </div>
        </div>
      </div>

      {/* Overlays */}
      {h.cropFile && (
        <ImageCropDialog file={h.cropFile.file} onCancel={() => h.setCropFile(null)} onConfirm={h.applyImageCrop} />
      )}
      {h.trimFile && (
        <VideoTrimDialog
          file={h.trimFile.file}
          maxDuration={h.scenes.find((s) => s.id === h.trimFile!.sceneId)?.duration_seconds}
          onCancel={() => h.setTrimFile(null)}
          onConfirm={h.applyVideoUpload}
        />
      )}
      <MediaPreviewOverlay previewMedia={h.previewMedia} onClose={() => h.setPreviewMedia(null)} />
    </div>
  );
}
