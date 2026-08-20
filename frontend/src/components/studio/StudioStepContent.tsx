import { api, mediaUrl } from "../../api/client";
import type {
  ExportResult,
  Idea,
  Scene,
  Script,
  SEOCategory,
  SEOMetadata,
  Thumbnail,
  TimelineData,
  VideoStatus,
  VoiceProvider,
} from "../../types";
import type { DragMedia, MediaTile } from "../steps/ImagesStep";

import IdeasStep from "../steps/IdeasStep";
import ScriptStep from "../steps/ScriptStep";
import ScenesStep from "../steps/ScenesStep";
import ImagesStep from "../steps/ImagesStep";
import VoiceStep from "../steps/VoiceStep";
import VideoStep from "../steps/VideoStep";
import CaptionsStep from "../steps/CaptionsStep";
import ThumbnailStep from "../steps/ThumbnailStep";
import SeoStep from "../steps/SeoStep";

interface PromptPair {
  system: string;
  user: string;
}

interface Props {
  activeTab: string;
  projectId: number;
  project: { name: string; language: string } | null;
  ideas: Idea[];
  scripts: Script[];
  activeScript: Script | null;
  scenes: Scene[];
  thumbnails: Thumbnail[];
  seo: SEOMetadata | null;
  setSeo: (v: SEOMetadata | null) => void;
  categories: SEOCategory[];
  exportInfo: ExportResult | null;
  videoStatus: VideoStatus | null;
  timeline: TimelineData | null;
  actionLoading: string;
  activeSceneIdx: number;
  setActiveSceneIdx: React.Dispatch<React.SetStateAction<number>>;
  prompts: Record<string, PromptPair>;

  ideaTopic: string;
  setIdeaTopic: (v: string) => void;
  generateIdeas: () => Promise<void>;
  selectIdea: (id: number) => Promise<void>;
  importFreeIdeas: (items: { title: string; description: string; category?: string }[]) => Promise<void>;

  scriptTopic: string;
  setScriptTopic: (v: string) => void;
  editingScript: boolean;
  creatingScript: boolean;
  setEditingScript: (v: boolean) => void;
  setCreatingScript: (v: boolean) => void;
  openScriptEdit: () => void;
  saveScript: () => Promise<void>;
  createScript: () => Promise<void>;
  generateScript: () => Promise<void>;
  scriptForm: { title: string; hook: string; body: string; ending: string };
  setScriptForm: React.Dispatch<React.SetStateAction<{ title: string; hook: string; body: string; ending: string }>>;
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
  setSuccess: (msg: string) => void;

  sceneCount: string;
  setSceneCount: (v: string) => void;
  addingScene: boolean;
  addSceneAt: number | null;
  newSceneNarration: string;
  setNewSceneNarration: (v: string) => void;
  addScene: () => Promise<void>;
  openAddScene: (pos: number | null) => void;
  closeAddScene: () => void;
  editingSceneId: number | null;
  sceneEditForm: { narration: string; image_prompt: string; video_prompt: string; motion_effect: string };
  setSceneEditForm: React.Dispatch<React.SetStateAction<{ narration: string; image_prompt: string; video_prompt: string; motion_effect: string }>>;
  openSceneEdit: (scene: Scene) => void;
  cancelSceneEdit: () => void;
  saveSceneEdit: (id: number) => Promise<void>;
  removeScene: (id: number) => Promise<void>;
  generateScenes: () => Promise<void>;
  clearScenes: () => Promise<void>;
  updateSceneEffect: (sceneId: number, effect: string) => Promise<void>;

  generatingSceneId: number | null;
  clipboardImageId: number | null;
  setClipboardImageId: (v: number | null) => void;
  imageUrlInputs: Record<number, string>;
  dragMedia: DragMedia | null;
  draggingOverScene: number | null;
  setImageUrlInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setDragMedia: (v: DragMedia | null) => void;
  setDraggingOverScene: React.Dispatch<React.SetStateAction<number | null>>;
  generateSceneImage: (id: number) => Promise<void>;
  addSceneImageUrl: (id: number) => Promise<void>;
  handleImageFileSelected: (id: number, file: File) => void;
  handleVideoFileSelected: (id: number, file: File) => void;
  removeSceneVideo: (sceneId: number, videoId: number) => Promise<void>;
  removeSceneImage: (id: number) => Promise<void>;
  makePrimaryImage: (id: number) => Promise<void>;
  handleTileDragOver: (e: React.DragEvent) => void;
  handleTileDrop: (e: React.DragEvent, scene: Scene, target: MediaTile) => void;
  handleSceneDrop: (e: React.DragEvent, sceneId: number) => void;
  handleUploadTileDrop: (e: React.DragEvent, sceneId: number) => void;
  handlePaste: (sceneId: number) => Promise<void>;
  setPreviewMedia: (v: { path: string; kind: "image" | "video" } | null) => void;
  voiceProviders: VoiceProvider[];
  selectedProvider: string;
  selectedVoice: string;
  selectedVoiceRate: string;
  voiceProgress: string;
  recordingSceneId: number | null;
  recordingSeconds: number;
  recordingPaused: boolean;
  micLevel: number;
  audioVersion: Record<number, number>;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  formatRecordTime: (s: number) => string;
  generateAllVoice: () => Promise<void>;
  generateSceneVoice: (id: number) => Promise<void>;
  startRecording: (id: number) => Promise<void>;
  toggleRecordingPause: () => void;
  stopRecording: () => void;
  handleAudioFileSelected: (id: number, file: File) => Promise<void>;
  clearSceneAudio: (id: number) => Promise<void>;
  setSelectedProvider: (v: string) => void;
  setSelectedVoice: (v: string) => void;
  setSelectedVoiceRate: (v: string) => void;
  
  selectedRatio: string;
  buildVideo: (options?: { timeline?: TimelineData | null; ratio?: string; subtitles?: boolean; subtitle_style?: string; subtitle_position?: string; subtitle_color?: string; subtitle_outline_color?: string; subtitle_outline?: number; subtitle_font_size?: number | null }) => Promise<void>;
  setTimeline: (v: TimelineData | null) => void;

  setExportInfo: (v: ExportResult | null) => void;

  enableSubtitles: boolean;
  setEnableSubtitles: (v: boolean) => void;
  subtitleStyle: string;
  setSubtitleStyle: (v: string) => void;
  subtitlePosition: string;
  setSubtitlePosition: (v: string) => void;
  subtitleColor: string;
  setSubtitleColor: (v: string) => void;
  subtitleOutlineColor: string;
  setSubtitleOutlineColor: (v: string) => void;
  subtitleOutline: number;
  setSubtitleOutline: (v: number) => void;
  subtitleFontSize: number | null;
  setSubtitleFontSize: (v: number | null) => void;
  saveCaptions: (patch: {
    captions_enabled?: boolean;
    caption_style?: string;
    caption_position?: string;
    caption_color?: string;
    caption_outline_color?: string;
    caption_outline?: number;
    caption_font_size?: number | null;
  }) => Promise<void>;

}

export default function StudioStepContent(p: Props) {
  return (
    <div className="studio-main-content">
      {p.activeTab === "ideas" && (
        <IdeasStep
          ideas={p.ideas}
          actionLoading={p.actionLoading}
          ideaTopic={p.ideaTopic}
          onTopicChange={p.setIdeaTopic}
          onGenerate={p.generateIdeas}
          onSelect={p.selectIdea}
          onFreeAIResponse={p.importFreeIdeas}
          prompts={p.prompts.ideas}
        />
      )}

      {p.activeTab === "script" && (
        <ScriptStep
          ideas={p.ideas}
          projectName={p.project?.name ?? ""}
          scripts={p.scripts}
          actionLoading={p.actionLoading}
          scriptTopic={p.scriptTopic}
          onTopicChange={p.setScriptTopic}
          onGenerate={p.generateScript}
          editing={p.editingScript}
          creating={p.creatingScript}
          onStartEdit={p.openScriptEdit}
          onStartCreate={() => p.setCreatingScript(true)}
          onCancelEditor={() => { p.setEditingScript(false); p.setCreatingScript(false); }}
          onSave={p.creatingScript ? p.createScript : p.saveScript}
          form={p.scriptForm}
          onFormChange={(patch) => p.setScriptForm((f) => ({ ...f, ...patch }))}
          prompts={p.prompts.script}
          onImportScript={async (imported, replace) => {
            await p.runAction("import-script", async () => {
              await api.importScript(p.projectId, {
                title: imported.title,
                hook: imported.hook,
                body: imported.body,
                ending: imported.ending,
                language: p.project?.language ?? "en",
                replace,
              });
              p.setSuccess(replace ? "Script imported and made active!" : "Script imported as a new version.");
            });
          }}
        />
      )}

      {p.activeTab === "scenes" && (
        <ScenesStep
          scenes={p.scenes}
          activeScript={p.activeScript}
          actionLoading={p.actionLoading}
          sceneCount={p.sceneCount}
          onSceneCountChange={p.setSceneCount}
          onGenerate={p.generateScenes}
          onClearAll={p.clearScenes}
          addingScene={p.addingScene}
          addSceneAt={p.addSceneAt}
          newSceneNarration={p.newSceneNarration}
          onNewSceneNarration={p.setNewSceneNarration}
          onAddScene={p.addScene}
          onOpenAdd={p.openAddScene}
          onCloseAdd={p.closeAddScene}
          editingSceneId={p.editingSceneId}
          sceneEditForm={p.sceneEditForm}
          onEditFormChange={(patch) => p.setSceneEditForm((f) => ({ ...f, ...patch }))}
          onStartEdit={p.openSceneEdit}
          onCancelEdit={p.cancelSceneEdit}
          onSaveEdit={p.saveSceneEdit}
          onRemove={p.removeScene}
          onImportScenes={async (importedList, replace) => {
            await p.runAction("import-scenes", async () => {
              await api.importScenes(p.projectId, { scenes: importedList, replace });
              p.setSuccess(`Imported ${importedList.length} scenes successfully!`);
            });
          }}
          projectName={p.project?.name ?? ""}
          prompts={p.prompts.scenes}
        />
      )}

      {p.activeTab === "images" && (
        <ImagesStep
          scenes={p.scenes}
          activeIdx={p.activeSceneIdx}
          setActiveIdx={p.setActiveSceneIdx}
          actionLoading={p.actionLoading}
          generatingSceneId={p.generatingSceneId}
          clipboardImageId={p.clipboardImageId}
          imageUrlInputs={p.imageUrlInputs}
          dragMedia={p.dragMedia}
          draggingOverScene={p.draggingOverScene}
          mediaUrl={mediaUrl}
          onGenerateAll={() =>
            p.runAction("images", async () => {
              await api.generateAllImages(p.projectId);
              p.setSuccess("All scene images generated!");
            })
          }
          onGenerateScene={p.generateSceneImage}
          onUrlChange={(sceneId, value) => p.setImageUrlInputs((prev) => ({ ...prev, [sceneId]: value }))}
          onAddUrl={p.addSceneImageUrl}
          onUpload={p.handleImageFileSelected}
          onUploadVideo={p.handleVideoFileSelected}
          onRemoveVideo={p.removeSceneVideo}
          onCopy={p.setClipboardImageId}
          onMakePrimary={p.makePrimaryImage}
          onRemove={p.removeSceneImage}
          onPreview={(path, kind) => p.setPreviewMedia({ path, kind })}
          onPaste={p.handlePaste}
          setDragMedia={p.setDragMedia}
          setDraggingOverScene={p.setDraggingOverScene}
          handleTileDragOver={p.handleTileDragOver}
          handleTileDrop={p.handleTileDrop}
          handleSceneDrop={p.handleSceneDrop}
          handleUploadTileDrop={p.handleUploadTileDrop}
          imagePrompts={p.prompts.image}
          onUpdateSceneEffect={p.updateSceneEffect}
        />
      )}

      {p.activeTab === "voice" && (
        <VoiceStep
          scenes={p.scenes}
          activeIdx={p.activeSceneIdx}
          setActiveIdx={p.setActiveSceneIdx}
          actionLoading={p.actionLoading}
          voiceProviders={p.voiceProviders}
          selectedProvider={p.selectedProvider}
          onProviderChange={(providerId) => {
            const provider = p.voiceProviders.find((pr) => pr.id === providerId);
            p.setSelectedProvider(providerId);
            if (provider) p.setSelectedVoice(provider.default);
          }}
          selectedVoice={p.selectedVoice}
          onVoiceChange={p.setSelectedVoice}
          selectedVoiceRate={p.selectedVoiceRate}
          onVoiceRateChange={p.setSelectedVoiceRate}
          voiceProgress={p.voiceProgress}
          onGenerateAll={p.generateAllVoice}
          onGenerateScene={p.generateSceneVoice}
          recordingSceneId={p.recordingSceneId}
          recordingSeconds={p.recordingSeconds}
          recordingPaused={p.recordingPaused}
          micLevel={p.micLevel}
          onToggleRecordingPause={p.toggleRecordingPause}
          onStopRecording={p.stopRecording}
          onStartRecording={p.startRecording}
          audioInputRef={p.audioInputRef}
          onFileSelected={p.handleAudioFileSelected}
          onClearAudio={p.clearSceneAudio}
          mediaUrl={mediaUrl}
          audioVersion={p.audioVersion}
          formatRecordTime={p.formatRecordTime}
        />
      )}



      {p.activeTab === "captions" && (
        <CaptionsStep
          scenes={p.scenes}
          enableSubtitles={p.enableSubtitles}
          setEnableSubtitles={p.setEnableSubtitles}
          subtitleStyle={p.subtitleStyle}
          setSubtitleStyle={p.setSubtitleStyle}
          subtitlePosition={p.subtitlePosition}
          setSubtitlePosition={p.setSubtitlePosition}
          subtitleColor={p.subtitleColor}
          setSubtitleColor={p.setSubtitleColor}
          subtitleOutlineColor={p.subtitleOutlineColor}
          setSubtitleOutlineColor={p.setSubtitleOutlineColor}
          subtitleOutline={p.subtitleOutline}
          setSubtitleOutline={p.setSubtitleOutline}
          subtitleFontSize={p.subtitleFontSize}
          setSubtitleFontSize={p.setSubtitleFontSize}
          onSave={p.saveCaptions}
        />
      )}

      {p.activeTab === "video" && (
        <VideoStep
          projectId={p.projectId}
          scenes={p.scenes}
          actionLoading={p.actionLoading}
          ratio={p.selectedRatio}
          videoStatus={p.videoStatus}
          onBuild={p.buildVideo}
          mediaUrl={mediaUrl}
          enableSubtitles={p.enableSubtitles}
          subtitleStyle={p.subtitleStyle}
          subtitlePosition={p.subtitlePosition}
          subtitleColor={p.subtitleColor}
          subtitleOutlineColor={p.subtitleOutlineColor}
          subtitleOutline={p.subtitleOutline}
          subtitleFontSize={p.subtitleFontSize}
          exportInfo={p.exportInfo}
          onExport={() =>
            p.runAction("export", async () => {
              const result = await api.exportProject(p.projectId);
              p.setExportInfo(result);
              p.setSuccess(`${result.message} (${result.files.length} files)`);
              if (result.files.includes("video/final.mp4")) {
                const downloadUrl = mediaUrl(`${result.export_path}/video/final.mp4`);
                const link = document.createElement("a");
                link.href = downloadUrl;
                link.setAttribute("download", "final_video.mp4");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            })
          }
        />
      )}

      {p.activeTab === "thumbnail" && (
        <ThumbnailStep
          thumbnails={p.thumbnails}
          actionLoading={p.actionLoading}
          mediaUrl={mediaUrl}
          onGenerate={() =>
            p.runAction("thumbnails", async () => {
              await api.generateThumbnails(p.projectId, 3);
              p.setSuccess("Generated 3 thumbnail options!");
            })
          }
          onSelect={(thumbId) =>
            p.runAction("select-thumb", async () => {
              await api.selectThumbnail(thumbId);
              p.setSuccess("Thumbnail selected");
            })
          }
          onUpload={(file) =>
            p.runAction("upload-thumb", async () => {
              await api.uploadThumbnail(p.projectId, file);
              p.setSuccess("Thumbnail uploaded!");
            })
          }
        />
      )}

      {p.activeTab === "seo" && (
        <SeoStep
          seo={p.seo}
          scenes={p.scenes}
          categories={p.categories}
          activeScript={p.activeScript}
          actionLoading={p.actionLoading}
          onGenerate={() =>
            p.runAction("seo", async () => {
              await api.generateSEO(p.projectId, p.project?.language ?? "en");
              p.setSuccess("SEO metadata generated!");
            })
          }
          onCategoryChange={(categoryId) =>
            p.runAction("seo-category", async () => {
              await api.updateSEOCategory(p.projectId, categoryId);
              p.setSuccess("YouTube category saved");
            })
          }
          onSave={async (data) => {
            await p.runAction("seo-save", async () => {
              const updated = await api.updateSEO(p.projectId, data);
              p.setSeo(updated);
              p.setSuccess("SEO saved");
            });
          }}
          onFreeAIResponse={(data) =>
            p.runAction("seo-import", async () => {
              const update: { title?: string; description?: string; tags?: string; hashtags?: string } = {};
              if (data.title != null) update.title = data.title;
              if (data.description != null) update.description = data.description;
              if (data.tags != null) update.tags = data.tags;
              if (data.hashtags != null) update.hashtags = data.hashtags;
              await api.updateSEO(p.projectId, update);
              p.setSuccess("SEO data imported!");
            })
          }
          prompts={p.prompts.seo}
        />
      )}

    </div>
  );
}
