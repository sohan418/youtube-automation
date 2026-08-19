import { useParams } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { useProjectDetail } from "../hooks/useProjectDetail";
import ProjectSettingsDialog from "../components/editors/ProjectSettingsDialog";
import ImageCropDialog from "../components/editors/ImageCropDialog";
import VideoTrimDialog from "../components/editors/VideoTrimDialog";
import { STUDIO_STEPS, getDoneMap } from "../components/studio/studioSteps";
import StudioHeader from "../components/studio/StudioHeader";
import StudioSidebar from "../components/studio/StudioSidebar";
import StudioStepContent from "../components/studio/StudioStepContent";
import ScenesSidebar from "../components/studio/ScenesSidebar";
import MediaPreviewOverlay from "../components/studio/MediaPreviewOverlay";
import ToastNotification from "../components/studio/ToastNotification";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const h = useProjectDetail(projectId);

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
  });

  return (
    <div
      style={{
        maxWidth: "1560px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <StudioHeader project={h.project} activeTab={h.activeTab} openSettings={h.openSettings} />

      {h.project && (
        <ProjectSettingsDialog
          isOpen={h.editingSettings}
          project={h.project}
          categories={h.categories}
          voiceConfig={h.voiceConfig}
          actionLoading={h.actionLoading}
          onClose={() => h.setEditingSettings(false)}
          onSave={h.saveSettings}
        />
      )}

      {h.error && <ToastNotification message={h.error} type="error" onClose={() => h.setError("")} duration={6000} />}
      {h.success && <ToastNotification message={h.success} type="success" onClose={() => h.setSuccess("")} duration={4000} />}

      <div
        className={`studio-layout ${h.sidebarCollapsed ? "sidebar-collapsed" : ""} ${
          h.activeTab === "images" || h.activeTab === "voice" ? "has-right-sidebar" : ""
        }`}
      >
        <StudioSidebar
          activeTab={h.activeTab as never}
          steps={STUDIO_STEPS}
          done={doneMap}
          onSelect={(tab) => h.setActiveTab(tab)}
          collapsed={h.sidebarCollapsed}
          onToggleCollapse={h.toggleSidebarCollapse}
        />

        <StudioStepContent
          activeTab={h.activeTab}
          projectId={projectId}
          project={h.project}
          ideas={h.ideas}
          scripts={h.scripts}
          activeScript={h.activeScript}
          scenes={h.scenes}
          thumbnails={h.thumbnails}
          seo={h.seo}
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
          
        />

        {(h.activeTab === "images" || h.activeTab === "voice") && (
          <ScenesSidebar
            scenes={h.scenes}
            activeIdx={h.activeSceneIdx}
            onSelectScene={h.setActiveSceneIdx}
            stepKind={h.activeTab === "voice" ? "voice" : "images"}
          />
        )}
      </div>

      {h.cropFile && (
        <ImageCropDialog file={h.cropFile.file} onCancel={() => h.setCropFile(null)} onConfirm={h.applyImageCrop} />
      )}

      {h.trimFile && (
        <VideoTrimDialog file={h.trimFile.file} onCancel={() => h.setTrimFile(null)} onConfirm={h.applyVideoUpload} />
      )}

      <MediaPreviewOverlay previewMedia={h.previewMedia} onClose={() => h.setPreviewMedia(null)} />

      {h.showScrollTop && (
        <button
          className="scroll-to-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="Scroll to Top"
        >
          <ArrowUp size={14} style={{ verticalAlign: "-2px" }} /> Top
        </button>
      )}
    </div>
  );
}
