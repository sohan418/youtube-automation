import { lazy, Suspense } from "react";
import { api, mediaUrl } from "../../api/client";
import { useProjectDetail } from "../../hooks/useProjectDetail";
import type { TimelineData, TimelineClip } from "../../types";
import "./StudioStepContent.css";

import StepHeader from "./StepHeader";
import type { TimelinePlaybackState } from "./TimelineVideoCanvas";

const IdeasStep = lazy(() => import("../steps/IdeasStep"));
const ScriptStep = lazy(() => import("../steps/ScriptStep"));
const ScenesStep = lazy(() => import("../steps/ScenesStep"));
const ImagesStep = lazy(() => import("../steps/ImagesStep"));
const GalleryStep = lazy(() => import("../steps/GalleryStep"));
const VoiceStep = lazy(() => import("../steps/VoiceStep"));
const MusicStep = lazy(() => import("../steps/MusicStep"));
const CaptionsStep = lazy(() => import("../steps/CaptionsStep"));
const ThumbnailStep = lazy(() => import("../steps/ThumbnailStep"));
const SeoStep = lazy(() => import("../steps/SeoStep"));
const UploadStep = lazy(() => import("../steps/UploadStep"));

interface Props {
  ctx: ReturnType<typeof useProjectDetail>;
  playbackState?: TimelinePlaybackState | null;
  onCollapse?: () => void;
}

export default function StudioStepContent({ ctx, playbackState, onCollapse }: Props) {
  const { activeTab } = ctx;

  const getSceneIdxAtCursor = () => {
    const time = playbackState?.time ?? 0;
    if (ctx.timeline && ctx.timeline.clips.length > 0) {
      const exactClip = ctx.timeline.clips.find(
        (c) =>
          c.track === "video" &&
          c.scene_id >= 0 &&
          c.start <= time &&
          time <= c.start + c.duration,
      );
      if (exactClip) {
        const idx = ctx.scenes.findIndex((s) => s.id === exactClip.scene_id);
        if (idx !== -1) return idx;
      }
      let closestId = -1;
      let minDiff = Infinity;
      for (const c of ctx.timeline.clips) {
        if (c.track === "video" && c.scene_id >= 0) {
          const mid = c.start + c.duration / 2;
          const diff = Math.abs(time - mid);
          if (diff < minDiff) {
            minDiff = diff;
            closestId = c.scene_id;
          }
        }
      }
      if (closestId >= 0) {
        const idx = ctx.scenes.findIndex((s) => s.id === closestId);
        if (idx !== -1) return idx;
      }
    }
    return ctx.activeSceneIdx ?? 0;
  };

  return (
    <div className="studio-main-content">
      <Suspense
        fallback={
          <div className="loading" style={{ padding: "2rem", textAlign: "center" }}>
            <span className="spinner" /> Loading step...
          </div>
        }
      >
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
            onClearAllIdeas={ctx.clearAllIdeas}
            onFreeAIResponse={ctx.importFreeIdeas}
            recentVideos={ctx.recentVideos}
            onOpenSettings={ctx.openSettings}
            onCollapse={onCollapse}
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
          onClearScript={ctx.clearScript}
          onCollapse={onCollapse}
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
          onCollapse={onCollapse}
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
          onUpdateSceneMedia={ctx.updateSceneMedia}
          onRefreshScenes={ctx.loadAll}
          onQuickAddScene={ctx.quickAddScene}
          onCollapse={onCollapse}
        />
      )}

      {activeTab === "gallery" && (
        <GalleryStep
          projectId={ctx.projectId}
          scenes={ctx.scenes}
          activeSceneIdx={getSceneIdxAtCursor()}
          onAddClipToTimeline={(clip) => ctx.addGalleryClipToTimeline(clip, playbackState?.time)}
          onUpdateSceneMedia={ctx.updateSceneMedia}
          onQuickAddScene={() => ctx.quickAddScene(playbackState?.time)}
          onRefreshScenes={ctx.loadAll}
          onCollapse={onCollapse}
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
          onCollapse={onCollapse}
        />
      )}

      {activeTab === "music" && (
        <MusicStep
          activeMusicPath={
            ctx.timeline?.music?.file_path ||
            ctx.timeline?.clips?.find((c) => c.track === "music")?.audio_path
          }
          onAddToTimeline={(track) => {
            let baseTimeline = ctx.timeline;
            if (!baseTimeline) {
              let t = 0;
              const clips: TimelineClip[] = [];
              for (const s of ctx.scenes) {
                const duration = s.duration_seconds ?? 5;
                clips.push({
                  id: `v-${s.id}-${t.toFixed(2)}`,
                  scene_id: s.id,
                  track: "video",
                  start: t,
                  duration,
                  image_path: s.image_path || s.images?.[0]?.file_path || null,
                  video_path: s.video_path,
                  audio_path: null,
                  audio_in: 0,
                  audio_out: null,
                  volume: 1,
                  motion_effect: s.motion_effect || "none",
                });
                if (s.audio_path) {
                  clips.push({
                    id: `n-${s.id}-${t.toFixed(2)}`,
                    scene_id: s.id,
                    track: "narration",
                    start: t,
                    duration,
                    image_path: null,
                    video_path: null,
                    audio_path: s.audio_path,
                    audio_in: 0,
                    audio_out: null,
                    volume: 1,
                  });
                }
                t += duration;
              }
              baseTimeline = { version: 1, duration: t, clips };
            }

            const filteredClips = baseTimeline.clips.filter((c) => c.track !== "music");

            const musicDur =
              track.duration_seconds && track.duration_seconds > 0
                ? track.duration_seconds
                : Math.max(baseTimeline.duration || 30, 30);

            const newClip: TimelineClip = {
              id: `music-${Date.now()}`,
              scene_id: -1,
              track: "music",
              start: 0,
              duration: musicDur,
              image_path: null,
              video_path: null,
              audio_path: track.file_path,
              audio_in: 0,
              audio_out: musicDur,
              volume: 0.15,
              motion_effect: "none",
            };

            const totalDuration = Math.max(baseTimeline.duration, musicDur);

            const updated: TimelineData = {
              ...baseTimeline,
              duration: totalDuration,
              clips: [...filteredClips, newClip],
              music: { file_path: track.file_path, volume: 0.15 },
            };

            ctx.setTimeline(updated);
            api.saveTimeline(ctx.projectId, updated).catch((err) => {
              console.error("Failed to save timeline with music track:", err);
            });
          }}
          onCollapse={onCollapse}
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
          onCollapse={onCollapse}
        />
      )}

      {activeTab === "timeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <StepHeader
            title="Timeline & Video Layout"
            subtitle="Arrange clips, trim audio narrations, and adjust layout durations"
            onCollapse={onCollapse}
          />
          <div className="card timeline-guide">
            <div className="timeline-guide-box">
              <strong>Keyboard & Editor Shortcuts:</strong>
              <ul>
                <li><strong>Spacebar:</strong> Play/pause final video preview.</li>
                <li><strong>Shift + Drag:</strong> Hold shift and drag to slide clips horizontally.</li>
                <li><strong>Resize Edges:</strong> Drag crop boundaries to adjust durations.</li>
              </ul>
            </div>
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
          onCollapse={onCollapse}
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
              const update: { title?: string; description?: string; tags?: string; hashtags?: string; timestamps?: string } = {};
              if (data.title != null) update.title = data.title;
              if (data.description != null) update.description = data.description;
              if (data.tags != null) update.tags = data.tags;
              if (data.hashtags != null) update.hashtags = data.hashtags;
              if (data.timestamps != null) update.timestamps = data.timestamps;
              const updated = await api.updateSEO(ctx.projectId, update);
              ctx.setSeo(updated);
              ctx.setSuccess("SEO data imported!");
            })
          }
          onCollapse={onCollapse}
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
          onCollapse={onCollapse}
        />
      )}
      </Suspense>
    </div>
  );
}
