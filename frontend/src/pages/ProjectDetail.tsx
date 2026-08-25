import { useParams } from "react-router-dom";
import { useEffect } from "react";
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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const h = useProjectDetail(projectId);

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

      {/* Body: sidebar + workspace + preview */}
      <div className="studio-body">
        <StudioSidebar
          activeTab={h.activeTab as never}
          steps={STUDIO_STEPS}
          done={doneMap}
          onSelect={(tab) => h.setActiveTab(tab)}
        />

        <div className="studio-workspace">
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
