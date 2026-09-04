import { api, mediaUrl } from "../../api/client";
import { useProjectDetail } from "../../hooks/useProjectDetail";
import type { TimelineData } from "../../types";
import "./StudioStepContent.css";

import IdeasStep from "../steps/IdeasStep";
import ScriptStep from "../steps/ScriptStep";
import ScenesStep from "../steps/ScenesStep";
import ImagesStep from "../steps/ImagesStep";
import VoiceStep from "../steps/VoiceStep";
import MusicStep from "../steps/MusicStep";

import CaptionsStep from "../steps/CaptionsStep";
import ThumbnailStep from "../steps/ThumbnailStep";
import SeoStep from "../steps/SeoStep";
import UploadStep from "../steps/UploadStep";

interface Props {
  ctx: ReturnType<typeof useProjectDetail>;
}

export default function StudioStepContent({ ctx }: Props) {
  const { activeTab } = ctx;

  return (
    <div className="studio-main-content">
      {activeTab === "ideas" && (
        <IdeasStep
          projectId={ctx.projectId}
          projectLanguage={ctx.project?.language}
          projectCategory={ctx.project?.category ?? undefined}
          ideas={ctx.ideas}
          actionLoading={ctx.actionLoading}
          ideaTopic={ctx.ideaTopic}
          onTopicChange={ctx.setIdeaTopic}
          onGenerate={ctx.generateIdeas}
          onSelect={ctx.selectIdea}
          onDeleteIdea={ctx.deleteIdea}
          onFreeAIResponse={ctx.importFreeIdeas}
          recentVideos={ctx.recentVideos}
          onOpenSettings={ctx.openSettings}
        />
      )}

      {activeTab === "script" && (
        <ScriptStep
          projectId={ctx.projectId}
          projectLanguage={ctx.project?.language}
          ideas={ctx.ideas}
          projectName={ctx.project?.name ?? ""}
          scripts={ctx.scripts}
          actionLoading={ctx.actionLoading}
          scriptTopic={ctx.scriptTopic}
          onTopicChange={ctx.setScriptTopic}
          onGenerate={ctx.generateScript}
          editing={ctx.editingScript}
          creating={ctx.creatingScript}
          onStartEdit={ctx.openScriptEdit}
          onStartCreate={() => ctx.setCreatingScript(true)}
          onCancelEditor={() => { ctx.setEditingScript(false); ctx.setCreatingScript(false); }}
          onSave={ctx.creatingScript ? ctx.createScript : ctx.saveScript}
          form={ctx.scriptForm}
          onFormChange={(patch) => ctx.setScriptForm((f) => ({ ...f, ...patch }))}
          onImportScript={async (imported, replace) => {
            await ctx.runAction("import-script", async () => {
              await api.importScript(ctx.projectId, {
                title: imported.title,
                hook: imported.hook,
                body: imported.body,
                ending: imported.ending,
                language: ctx.project?.language ?? "en",
                replace,
              });
              ctx.setSuccess(replace ? "Script imported and made active!" : "Script imported as a new version.");
            });
          }}
        />
      )}

      {activeTab === "scenes" && (
        <ScenesStep
          projectId={ctx.projectId}
          projectLanguage={ctx.project?.language}
          projectRatio={ctx.project?.ratio ?? undefined}
          scenes={ctx.scenes}
          activeScript={ctx.activeScript}
          actionLoading={ctx.actionLoading}
          sceneCount={ctx.sceneCount}
          onSceneCountChange={ctx.setSceneCount}
          onGenerate={ctx.generateScenes}
          onClearAll={ctx.clearScenes}
          addingScene={ctx.addingScene}
          addSceneAt={ctx.addSceneAt}
          newSceneNarration={ctx.newSceneNarration}
          onNewSceneNarration={ctx.setNewSceneNarration}
          onAddScene={ctx.addScene}
          onOpenAdd={ctx.openAddScene}
          onAddBlank={() => { void ctx.quickAddScene(); }}
          onCloseAdd={ctx.closeAddScene}
          editingSceneId={ctx.editingSceneId}
          sceneEditForm={ctx.sceneEditForm}
          onEditFormChange={(patch) => ctx.setSceneEditForm((f) => ({ ...f, ...patch }))}
          onStartEdit={ctx.openSceneEdit}
          onCancelEdit={ctx.cancelSceneEdit}
          onSaveEdit={ctx.saveSceneEdit}
          onRemove={ctx.removeScene}
          onImportScenes={async (importedList, replace) => {
            await ctx.runAction("import-scenes", async () => {
              await api.importScenes(ctx.projectId, { scenes: importedList, replace });
              ctx.setSuccess(`Imported ${importedList.length} scenes successfully!`);
            });
          }}
          projectName={ctx.project?.name ?? ""}
        />
      )}

      {activeTab === "images" && (
        <ImagesStep
          projectRatio={ctx.project?.ratio ?? undefined}
          scenes={ctx.scenes}
          activeIdx={ctx.activeSceneIdx}
          setActiveIdx={ctx.setActiveSceneIdx}
          actionLoading={ctx.actionLoading}
          generatingSceneId={ctx.generatingSceneId}
          clipboardImageId={ctx.clipboardImageId}
          imageUrlInputs={ctx.imageUrlInputs}
          dragMedia={ctx.dragMedia}
          draggingOverScene={ctx.draggingOverScene}
          mediaUrl={mediaUrl}
          onGenerateAll={() =>
            ctx.runAction("images", async () => {
              await api.generateAllImages(ctx.projectId);
              ctx.setSuccess("All scene images generated!");
            })
          }
          onGenerateScene={ctx.generateSceneImage}
          onUrlChange={(sceneId, value) => ctx.setImageUrlInputs((prev) => ({ ...prev, [sceneId]: value }))}
          onAddUrl={ctx.addSceneImageUrl}
          onUpload={ctx.handleImageFileSelected}
          onUploadVideo={ctx.handleVideoFileSelected}
          onRemoveVideo={ctx.removeSceneVideo}
          onCopy={ctx.setClipboardImageId}
          onMakePrimary={ctx.makePrimaryImage}
          onRemove={ctx.removeSceneImage}
          onPreview={(path, kind) => ctx.setPreviewMedia({ path, kind })}
          onPaste={ctx.handlePaste}
          setDragMedia={ctx.setDragMedia}
          setDraggingOverScene={ctx.setDraggingOverScene}
          handleTileDragOver={ctx.handleTileDragOver}
          handleTileDrop={ctx.handleTileDrop}
          handleSceneDrop={ctx.handleSceneDrop}
          handleUploadTileDrop={ctx.handleUploadTileDrop}
          onUpdateSceneEffect={ctx.updateSceneEffect}
        />
      )}

      {activeTab === "voice" && (
        <VoiceStep
          scenes={ctx.scenes}
          activeIdx={ctx.activeSceneIdx}
          setActiveIdx={ctx.setActiveSceneIdx}
          actionLoading={ctx.actionLoading}
          voiceProviders={ctx.voiceProviders}
          selectedProvider={ctx.selectedProvider}
          onProviderChange={(providerId) => {
            const provider = ctx.voiceProviders.find((pr) => pr.id === providerId);
            ctx.setSelectedProvider(providerId);
            if (provider) ctx.setSelectedVoice(provider.default);
            if (providerId === "gemini") ctx.setSelectedVoiceRate("+0%");
          }}
          selectedVoice={ctx.selectedVoice}
          onVoiceChange={ctx.setSelectedVoice}
          selectedVoiceRate={ctx.selectedVoiceRate}
          onVoiceRateChange={ctx.setSelectedVoiceRate}
          voiceProgress={ctx.voiceProgress}
          onGenerateAll={ctx.generateAllVoice}
          onGenerateScene={ctx.generateSceneVoice}
          recordingSceneId={ctx.recordingSceneId}
          recordingSeconds={ctx.recordingSeconds}
          recordingPaused={ctx.recordingPaused}
          micLevel={ctx.micLevel}
          onToggleRecordingPause={ctx.toggleRecordingPause}
          onStopRecording={ctx.stopRecording}
          onStartRecording={ctx.startRecording}
          audioInputRef={ctx.audioInputRef}
          onFileSelected={ctx.handleAudioFileSelected}
          onClearAudio={ctx.clearSceneAudio}
          onCombineAudioPreview={ctx.combineAudioPreview}
          onDownloadCombinedAudio={ctx.downloadCombinedAudio}
          audioPreviewUrl={ctx.audioPreviewUrl}
          mediaUrl={mediaUrl}
          audioVersion={ctx.audioVersion}
          formatRecordTime={ctx.formatRecordTime}
        />
      )}

      {activeTab === "music" && (
        <MusicStep
          onAddToTimeline={(track) => {
            if (!ctx.timeline) return;
            const newClip = {
              id: `music-${Date.now()}`,
              track: "music" as const,
              source: mediaUrl(track.file_path),
              start: 0,
              duration: track.duration_seconds || 30,
              in: 0,
              out: track.duration_seconds || 30,
              audio_path: track.file_path,
              audio_in: 0,
              audio_out: track.duration_seconds || 30,
              volume: 0.15,
              muted: false,
              locked: false,
              scene_id: 0,
              image_path: null,
              video_path: null,
            };
            const updated: TimelineData = {
              ...ctx.timeline,
              clips: [...ctx.timeline.clips, newClip],
              music: { file_path: track.file_path, volume: 0.15 },
            };
            ctx.setTimeline(updated);
            api.saveTimeline(ctx.projectId, updated).catch(() => {});
          }}
        />
      )}

      {activeTab === "captions" && (
        <CaptionsStep
          scenes={ctx.scenes}
          ratio={ctx.selectedRatio}
          enableSubtitles={ctx.enableSubtitles}
          setEnableSubtitles={ctx.setEnableSubtitles}
          subtitleStyle={ctx.subtitleStyle}
          setSubtitleStyle={ctx.setSubtitleStyle}
          subtitlePosition={ctx.subtitlePosition}
          setSubtitlePosition={ctx.setSubtitlePosition}
          subtitleColor={ctx.subtitleColor}
          setSubtitleColor={ctx.setSubtitleColor}
          subtitleOutlineColor={ctx.subtitleOutlineColor}
          setSubtitleOutlineColor={ctx.setSubtitleOutlineColor}
          subtitleOutline={ctx.subtitleOutline}
          setSubtitleOutline={ctx.setSubtitleOutline}
          subtitleFontSize={ctx.subtitleFontSize}
          setSubtitleFontSize={ctx.setSubtitleFontSize}
          onSave={ctx.saveCaptions}
        />
      )}

      {activeTab === "timeline" && (
        <div className="card timeline-guide">
          <h3>🎞️ Timeline Guide</h3>
          <p>
            Use the timeline editor at the bottom right to arrange clips, trim audio narrations, and adjust layout durations.
          </p>
          <div className="timeline-guide-box">
            <strong>Keyboard & Editor Shortcuts:</strong>
            <ul>
              <li><strong>Spacebar:</strong> Play/pause final video preview.</li>
              <li><strong>Shift + Drag:</strong> Hold shift and drag to slide clips horizontally.</li>
              <li><strong>Resize Edges:</strong> Drag crop boundaries to adjust durations.</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "thumbnail" && (
        <ThumbnailStep
          thumbnails={ctx.thumbnails}
          actionLoading={ctx.actionLoading}
          mediaUrl={mediaUrl}
          videoTopic={ctx.scriptTopic}
          promptPair={ctx.prompts.thumbnail}
          onGenerate={(customPrompt?: string, topic?: string) =>
            ctx.runAction("thumbnails", async () => {
              await api.generateThumbnails(ctx.projectId, 3, customPrompt, topic);
              ctx.setSuccess("Generated 3 thumbnail options!");
            })
          }
          onSelect={(thumbId) =>
            ctx.runAction("select-thumb", async () => {
              await api.selectThumbnail(thumbId);
              ctx.setSuccess("Thumbnail selected");
            })
          }
          onUpload={(file) =>
            ctx.runAction("upload-thumb", async () => {
              await api.uploadThumbnail(ctx.projectId, file);
              ctx.setSuccess("Thumbnail uploaded!");
            })
          }
          onDelete={(thumbId) =>
            ctx.runAction("delete-thumb", async () => {
              await api.deleteThumbnail(thumbId);
              ctx.setSuccess("Thumbnail deleted!");
            })
          }
        />
      )}

      {activeTab === "seo" && (
        <SeoStep
          projectId={ctx.projectId}
          projectLanguage={ctx.project?.language}
          seo={ctx.seo}
          scenes={ctx.scenes}
          timeline={ctx.timeline}
          activeScript={ctx.activeScript}
          actionLoading={ctx.actionLoading}
          projectCategory={ctx.project?.category ?? ""}
          onGenerate={() =>
            ctx.runAction("seo", async () => {
              await api.generateSEO(ctx.projectId, ctx.project?.language ?? "en");
              ctx.setSuccess("SEO metadata generated!");
            })
          }
          onSave={async (data) => {
            await ctx.runAction("seo-save", async () => {
              const updated = await api.updateSEO(ctx.projectId, data);
              ctx.setSeo(updated);
              ctx.setSuccess("SEO saved");
            });
          }}
          onFreeAIResponse={(data) =>
            ctx.runAction("seo-import", async () => {
              const update: { title?: string; description?: string; tags?: string; hashtags?: string } = {};
              if (data.title != null) update.title = data.title;
              if (data.description != null) update.description = data.description;
              if (data.tags != null) update.tags = data.tags;
              if (data.hashtags != null) update.hashtags = data.hashtags;
              const updated = await api.updateSEO(ctx.projectId, update);
              ctx.setSeo(updated);
              ctx.setSuccess("SEO data imported!");
            })
          }
        />
      )}

      {activeTab === "upload" && (
        <UploadStep
          projectId={ctx.projectId}
          actionLoading={ctx.actionLoading}
          videoStatus={ctx.videoStatus}
          seo={ctx.seo}
          youtubeConfig={ctx.youtubeConfig}
          youtubeUploadStatus={ctx.youtubeUploadStatus}
          onUploadYouTube={ctx.uploadYouTube}
        />
      )}
    </div>
  );
}
