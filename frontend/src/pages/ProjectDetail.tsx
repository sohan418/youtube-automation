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
import TimelineVideoCanvas, { type TimelinePlaybackState } from "../components/studio/TimelineVideoCanvas";
import StudioRightInspector from "../components/studio/StudioRightInspector";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import "./ProjectDetail.css";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const h = useProjectDetail(projectId);

  const [timelineHeight, setTimelineHeight] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [playbackState, setPlaybackState] = useState<TimelinePlaybackState | null>(null);
  const [selectedClipInfo, setSelectedClipInfo] = useState<any | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [toolPanelCollapsed, setToolPanelCollapsed] = useState(false);

  const handleFetchLogo = (refresh = false) => {
    if (!projectId) return;
    api
      .getYoutubeChannel()
      .then((ch) => {
        if (ch.connected && ch.avatar) {
          setLogoUrl(ch.avatar);
        } else {
          api
            .getProjectLogo(projectId, refresh)
            .then((res) => setLogoUrl(mediaUrl(res.logo_url)))
            .catch(() => {
              if (h.project?.slug) {
                setLogoUrl(mediaUrl(`projects/${h.project.slug}/branding/logo.png`));
              }
            });
        }
      })
      .catch(() => {
        api
          .getProjectLogo(projectId, refresh)
          .then((res) => setLogoUrl(mediaUrl(res.logo_url)))
          .catch(() => {
            if (h.project?.slug) {
              setLogoUrl(mediaUrl(`projects/${h.project.slug}/branding/logo.png`));
            }
          });
      });
  };

  useEffect(() => {
    handleFetchLogo(false);
  }, [projectId, h.project?.slug]);

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
        onImportVideo={h.importVideo}
        logoOverlay={h.logoOverlay}
        onLogoOverlayChange={(value) => void h.saveLogoOverlay(value)}
        logoConfig={h.logoConfig}
        onLogoConfigChange={(patch) => void h.saveLogoConfig(patch)}
        onTogglePreview={() => setPreviewModalOpen((v) => !v)}
        previewActive={previewModalOpen}
        onRefreshLogo={() => handleFetchLogo(true)}
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

      {/* Standalone Final Video Preview Modal */}
      {previewModalOpen && (
        <div className="preview-modal-backdrop" onClick={() => setPreviewModalOpen(false)}>
          <div className="preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <div className="preview-modal-title">
                <span>Final Video Preview</span>
                <span className="badge" style={{ background: "rgba(124, 92, 255, 0.2)", color: "#7c5cff" }}>
                  {h.selectedRatio} ({h.selectedRatio === "9:16" ? "1080×1920" : "1920×1080"})
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="btn-secondary"
                  onClick={() => h.onRatioChange(h.selectedRatio === "9:16" ? "16:9" : "9:16")}
                  style={{ fontSize: 11, padding: "4px 8px" }}
                >
                  Switch to {h.selectedRatio === "9:16" ? "16:9" : "9:16"}
                </button>
                <button
                  className="modal-close-btn"
                  onClick={() => setPreviewModalOpen(false)}
                  title="Close preview"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="preview-modal-body">
              <div
                className="preview-frame"
                style={{
                  maxWidth: h.selectedRatio === "9:16" ? "320px" : "720px",
                  aspectRatio: h.selectedRatio === "9:16" ? "9 / 16" : "16 / 9",
                  margin: "0 auto",
                  width: "100%",
                }}
              >
                {h.videoStatus?.output ? (
                  <video
                    src={mediaUrl(h.videoStatus.output)}
                    controls
                    autoPlay
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
                        autoPlay
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
                      No media available for preview
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="preview-modal-footer">
              <button className="btn-secondary" onClick={() => setPreviewModalOpen(false)}>
                Close
              </button>
              {h.videoStatus?.output ? (
                <button className="btn-primary" onClick={handleExportVideo}>
                  Export Video
                </button>
              ) : (
                <button className="btn-primary" onClick={handleBuildVideo}>
                  Build Video
                </button>
              )}
            </div>
          </div>
        </div>
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
          onSelect={(tab) => {
            h.setActiveTab(tab);
            setToolPanelCollapsed(false);
          }}
        />

        {/* Column 2: Tool Step Control Panel (Stretches 100% height, full vertical space) */}
        <div className={`tool-panel ${toolPanelCollapsed ? "is-collapsed" : ""}`}>
          <div className="tool-panel-top-actions">
            <button
              className="tool-panel-collapse-btn"
              onClick={() => setToolPanelCollapsed(true)}
              title="Collapse Tool Panel (Give 100% Full Screen Width to Video Preview & Timeline)"
            >
              <PanelLeftClose size={14} />
              <span>Collapse</span>
            </button>
          </div>
          <StudioStepContent ctx={h} />
        </div>

        {/* Column 3: Player + Timeline Column (Spans the rest of the screen width, divided vertically) */}
        <div className="player-column">
          {toolPanelCollapsed && (
            <div className="player-column-floating-bar">
              <button
                className="tool-panel-expand-btn"
                onClick={() => setToolPanelCollapsed(false)}
                title="Expand Tool Panel"
              >
                <PanelLeftOpen size={14} />
                <span>Show Panel ({h.activeTab.toUpperCase()})</span>
              </button>
            </div>
          )}

              {/* Custom Timeline Video Preview Player Canvas */}
              <div className={`preview-player-container ${isResizing ? "resizing" : ""}`}>
                <TimelineVideoCanvas
                  playbackState={playbackState}
                  activeSceneFallback={h.scenes[h.activeSceneIdx] ?? null}
                  selectedRatio={h.selectedRatio}
                  enableSubtitles={h.enableSubtitles}
                  subtitleStyle={h.subtitleStyle}
                  subtitlePosition={h.subtitlePosition}
                  subtitleCustomY={h.subtitleCustomY}
                  subtitleColor={h.subtitleColor}
                  subtitleOutlineColor={h.subtitleOutlineColor}
                  subtitleOutline={h.subtitleOutline}
                  subtitleFontSize={h.subtitleFontSize}
                  logoOverlay={h.logoOverlay}
                  logoConfig={h.logoConfig}
                  logoUrl={logoUrl}
                  onSubtitlePositionChange={h.handleSubtitlePositionChange}
                />

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
                  onActiveSceneChange={h.setActiveSceneIdx}
                  onPlaybackStateChange={setPlaybackState}
                  onSelectedClipInfoChange={setSelectedClipInfo}
                />
              </div>
            </div>

            {/* Column 4: Clipchamp-style 100% Full-Height Right Inspector Drawer */}
            <StudioRightInspector clipInfo={selectedClipInfo} />
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
