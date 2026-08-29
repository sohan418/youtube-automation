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
      <style>{`
        .timeline-resize-handle {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 5px;
          cursor: ns-resize;
          background: transparent;
          z-index: 50;
          transition: background 0.1s ease;
        }
        .timeline-resize-handle:hover,
        .timeline-resize-handle.active {
          background: var(--primary) !important;
          opacity: 0.8;
        }
        .timeline-wrapper {
          min-height: 140px;
          border-top: 1px solid var(--border);
          background: var(--surface);
          overflow-y: auto;
          padding: 0.5rem 1rem;
          width: 100%;
          position: relative;
        }
        .preview-player-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          min-height: 0;
          padding: 1.25rem;
          position: relative;
          background: #0c0d12;
          height: 100%;
        }
        .preview-player-container.resizing {
          pointer-events: none;
        }
      `}</style>
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
      <div className="studio-body" style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        
        {/* Column 1: Narrow Sidebar (Stretches 100% height on the far left) */}
        <StudioSidebar
          activeTab={h.activeTab as never}
          steps={STUDIO_STEPS}
          done={doneMap}
          onSelect={(tab) => h.setActiveTab(tab)}
        />

        {/* Column 2: Tool Step Control Panel (Stretches 100% height, full vertical space) */}
        <div style={{ width: "380px", minWidth: "380px", maxWidth: "380px", height: "100%", borderRight: "1px solid var(--border)", background: "var(--bg)", display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden", padding: "1rem" }}>
              <StudioStepContent
                activeTab={h.activeTab}
                onTabChange={(tab) => h.setActiveTab(tab as never)}
                projectId={projectId}
                project={h.project}
                ideas={h.ideas}
                scripts={h.scripts}
                activeScript={h.activeScript}
                scenes={h.scenes}
                thumbnails={h.thumbnails}
                seo={h.seo}
                setSeo={h.setSeo}
                categories={h.categories}
                exportInfo={h.exportInfo}
                videoStatus={h.videoStatus}
                timeline={h.timeline}
                actionLoading={h.actionLoading}
                activeSceneIdx={h.activeSceneIdx}
                setActiveSceneIdx={h.setActiveSceneIdx}
                prompts={h.prompts}
                ideaTopic={h.ideaTopic}
                setIdeaTopic={h.setIdeaTopic}
                generateIdeas={h.generateIdeas}
                selectIdea={h.selectIdea}
                importFreeIdeas={h.importFreeIdeas}
                recentVideos={h.recentVideos}
                youtubeConfig={h.youtubeConfig}
                youtubeUploadStatus={h.youtubeUploadStatus}
                onUploadYouTube={h.uploadYouTube}
                scriptTopic={h.scriptTopic}
                setScriptTopic={h.setScriptTopic}
                editingScript={h.editingScript}
                creatingScript={h.creatingScript}
                setEditingScript={h.setEditingScript}
                setCreatingScript={h.setCreatingScript}
                openScriptEdit={h.openScriptEdit}
                saveScript={h.saveScript}
                createScript={h.createScript}
                generateScript={h.generateScript}
                scriptForm={h.scriptForm}
                setScriptForm={h.setScriptForm}
                runAction={h.runAction}
                setSuccess={h.setSuccess}
                sceneCount={h.sceneCount}
                setSceneCount={h.setSceneCount}
                addingScene={h.addingScene}
                addSceneAt={h.addSceneAt}
                newSceneNarration={h.newSceneNarration}
                setNewSceneNarration={h.setNewSceneNarration}
                addScene={h.addScene}
                openAddScene={h.openAddScene}
                quickAddScene={h.quickAddScene}
                closeAddScene={h.closeAddScene}
                editingSceneId={h.editingSceneId}
                sceneEditForm={h.sceneEditForm}
                setSceneEditForm={h.setSceneEditForm}
                openSceneEdit={h.openSceneEdit}
                cancelSceneEdit={h.cancelSceneEdit}
                saveSceneEdit={h.saveSceneEdit}
                removeScene={h.removeScene}
                generateScenes={h.generateScenes}
                clearScenes={h.clearScenes}
                generatingSceneId={h.generatingSceneId}
                clipboardImageId={h.clipboardImageId}
                setClipboardImageId={h.setClipboardImageId}
                imageUrlInputs={h.imageUrlInputs}
                dragMedia={h.dragMedia}
                draggingOverScene={h.draggingOverScene}
                setImageUrlInputs={h.setImageUrlInputs}
                setDragMedia={h.setDragMedia}
                setDraggingOverScene={h.setDraggingOverScene}
                generateSceneImage={h.generateSceneImage}
                addSceneImageUrl={h.addSceneImageUrl}
                handleImageFileSelected={h.handleImageFileSelected}
                handleVideoFileSelected={h.handleVideoFileSelected}
                removeSceneVideo={h.removeSceneVideo}
                removeSceneImage={h.removeSceneImage}
                makePrimaryImage={h.makePrimaryImage}
                handleTileDragOver={h.handleTileDragOver}
                handleTileDrop={h.handleTileDrop}
                handleSceneDrop={h.handleSceneDrop}
                handleUploadTileDrop={h.handleUploadTileDrop}
                handlePaste={h.handlePaste}
                setPreviewMedia={h.setPreviewMedia}
                voiceProviders={h.voiceProviders}
                selectedProvider={h.selectedProvider}
                selectedVoice={h.selectedVoice}
                selectedVoiceRate={h.selectedVoiceRate}
                voiceProgress={h.voiceProgress}
                recordingSceneId={h.recordingSceneId}
                recordingSeconds={h.recordingSeconds}
                recordingPaused={h.recordingPaused}
                micLevel={h.micLevel}
                audioVersion={h.audioVersion}
                audioInputRef={h.audioInputRef}
                formatRecordTime={h.formatRecordTime}
                generateAllVoice={h.generateAllVoice}
                generateSceneVoice={h.generateSceneVoice}
                startRecording={h.startRecording}
                toggleRecordingPause={h.toggleRecordingPause}
                stopRecording={h.stopRecording}
                handleAudioFileSelected={h.handleAudioFileSelected}
                clearSceneAudio={h.clearSceneAudio}
                combineAudioPreview={h.combineAudioPreview}
                downloadCombinedAudio={h.downloadCombinedAudio}
                audioPreviewUrl={h.audioPreviewUrl}
                setSelectedProvider={h.setSelectedProvider}
                setSelectedVoice={h.setSelectedVoice}
                setSelectedVoiceRate={h.setSelectedVoiceRate}
                selectedRatio={h.selectedRatio}
                buildVideo={h.buildVideo}
                setTimeline={h.setTimeline}
                setExportInfo={h.setExportInfo}
                updateSceneEffect={h.updateSceneEffect}
                enableSubtitles={h.enableSubtitles}
                setEnableSubtitles={h.setEnableSubtitles}
                subtitleStyle={h.subtitleStyle}
                setSubtitleStyle={h.setSubtitleStyle}
                subtitlePosition={h.subtitlePosition}
                setSubtitlePosition={h.setSubtitlePosition}
                subtitleColor={h.subtitleColor}
                setSubtitleColor={h.setSubtitleColor}
                subtitleOutlineColor={h.subtitleOutlineColor}
                setSubtitleOutlineColor={h.setSubtitleOutlineColor}
                subtitleOutline={h.subtitleOutline}
                setSubtitleOutline={h.setSubtitleOutline}
                subtitleFontSize={h.subtitleFontSize}
                setSubtitleFontSize={h.setSubtitleFontSize}
                saveCaptions={h.saveCaptions}
              />
            </div>

            {/* Column 3: Player + Timeline Column (Spans the rest of the screen width, divided vertically) */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

              {/* Video Preview Player Canvas */}
              <div className={`preview-player-container ${isResizing ? "resizing" : ""}`}>
              <div style={{
                width: "100%",
                maxWidth: h.selectedRatio === "9:16" ? "260px" : "580px",
                aspectRatio: h.selectedRatio === "9:16" ? "9 / 16" : "16 / 9",
                background: "#000",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                overflow: "hidden",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
              }}>
                {h.videoStatus?.output ? (
                  <video
                    src={mediaUrl(h.videoStatus.output)}
                    controls
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
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
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <img
                        src={mediaUrl(activeScene.image_path || (activeScene.images && activeScene.images[0]?.file_path))}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        alt="Scene Preview"
                      />
                    )
                  ) : (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
                      No media selected for active scene
                    </div>
                  );
                })()}

                {/* Live subtitle preview overlay */}
                {h.enableSubtitles && h.scenes[h.activeSceneIdx]?.narration && !h.videoStatus?.output && (
                  <div style={{
                    position: "absolute",
                    bottom: "12%",
                    left: "5%",
                    right: "5%",
                    textAlign: "center",
                    zIndex: 3,
                    pointerEvents: "none"
                  }}>
                    <span style={{
                      fontFamily: h.subtitleStyle === "shorts" ? "Impact, sans-serif" : "Arial, sans-serif",
                      fontSize: h.selectedRatio === "9:16" ? "0.95rem" : "1.25rem",
                      fontWeight: "bold",
                      color: h.subtitleStyle === "shorts" ? "#ffe600" : "#ffffff",
                      textShadow: "2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 2px 0 0 #000, 0 -2px 0 #000, -2px 0 0 #000",
                      letterSpacing: "0.5px",
                      textTransform: h.subtitleStyle === "shorts" ? "uppercase" : "none",
                      padding: "2px 6px",
                      display: "inline-block",
                      lineHeight: 1.2
                    }}>
                      {h.scenes[h.activeSceneIdx].narration}
                    </span>
                  </div>
                )}

                {/* Status overlays (e.g. Building status) */}
                {(h.actionLoading === "video" || h.videoStatus?.running) && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(0,0,0,0.75)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "0.75rem",
                    zIndex: 5
                  }}>
                    <span className="spinner" />
                    <span style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 600 }}>
                      Building Video... {h.videoStatus?.progress ?? 0}%
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.7rem" }}>
                      {h.videoStatus?.message}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Workspace Bottom Row: Full-Width Timeline Tracks (starts after the step panel) */}
            <div
              className="timeline-wrapper"
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
