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
  YouTubeVideo,
} from "../../types";
import type { DragMedia, MediaTile } from "../steps/ImagesStep";



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

interface PromptPair {
  system: string;
  user: string;
}

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  projectId: number;
  project: { name: string; language: string; category?: string | null; ratio?: string } | null;
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
  recentVideos: YouTubeVideo[];
  youtubeConfig: { youtube_api_key_configured: boolean; youtube_playlist_id: string; youtube_client_id_configured: boolean; youtube_connected: boolean } | null;
  youtubeUploadStatus: import("../../types").YouTubeUploadStatus | null;
  onUploadYouTube: (privacy: string) => void;

  ideaTopic: string;
  setIdeaTopic: (v: string) => void;
  generateIdeas: () => Promise<void>;
  selectIdea: (id: number) => Promise<void>;
  importFreeIdeas: (items: { title: string; description: string; category?: string; trending_score?: number }[]) => Promise<void>;

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
  quickAddScene: () => Promise<Scene | null>;
  editingSceneId: number | null;
  sceneEditForm: { narration: string; image_prompt: string; video_prompt: string; motion_effect: string; duration_seconds: number | null };
  setSceneEditForm: React.Dispatch<React.SetStateAction<{ narration: string; image_prompt: string; video_prompt: string; motion_effect: string; duration_seconds: number | null }>>;
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
  combineAudioPreview: () => Promise<void>;
  downloadCombinedAudio: () => void;
  audioPreviewUrl: string | null;
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
          projectId={p.projectId}
          projectLanguage={p.project?.language}
          projectCategory={p.project?.category ?? undefined}
          ideas={p.ideas}
          actionLoading={p.actionLoading}
          ideaTopic={p.ideaTopic}
          onTopicChange={p.setIdeaTopic}
          onGenerate={p.generateIdeas}
          onSelect={p.selectIdea}
          onFreeAIResponse={p.importFreeIdeas}
          recentVideos={p.recentVideos}
        />
      )}

      {p.activeTab === "script" && (
        <ScriptStep
          projectId={p.projectId}
          projectLanguage={p.project?.language}
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
          projectId={p.projectId}
          projectLanguage={p.project?.language}
          projectRatio={p.project?.ratio ?? undefined}
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
          onAddBlank={() => { void p.quickAddScene(); }}
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
        />
      )}

      {p.activeTab === "images" && (
        <ImagesStep
          projectRatio={p.project?.ratio ?? undefined}
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
          onCombineAudioPreview={p.combineAudioPreview}
          onDownloadCombinedAudio={p.downloadCombinedAudio}
          audioPreviewUrl={p.audioPreviewUrl}
          mediaUrl={mediaUrl}
          audioVersion={p.audioVersion}
          formatRecordTime={p.formatRecordTime}
        />
      )}

      {p.activeTab === "music" && (
        <MusicStep
          onAddToTimeline={(track) => {
            if (!p.timeline) return;
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
              ...p.timeline,
              clips: [...p.timeline.clips, newClip],
              music: { file_path: track.file_path, volume: 0.15 },
            };
            p.setTimeline(updated);
            api.saveTimeline(p.projectId, updated).catch(() => {});
          }}
        />
      )}


      {p.activeTab === "captions" && (
        <CaptionsStep
          scenes={p.scenes}
          ratio={p.selectedRatio}
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

      {p.activeTab === "timeline" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>🎞️ Timeline Guide</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0, lineHeight: 1.4 }}>
            Use the timeline editor at the bottom right to arrange clips, trim audio narrations, and adjust layout durations.
          </p>
          <div style={{ padding: "0.75rem", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <strong style={{ color: "var(--text)" }}>Keyboard & Editor Shortcuts:</strong>
            <ul style={{ paddingLeft: "1.2rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <li><strong>Spacebar:</strong> Play/pause final video preview.</li>
              <li><strong>Shift + Drag:</strong> Hold shift and drag to slide clips horizontally.</li>
              <li><strong>Resize Edges:</strong> Drag crop boundaries to adjust durations.</li>
            </ul>
          </div>
        </div>
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
          projectId={p.projectId}
          projectLanguage={p.project?.language}
          seo={p.seo}
          scenes={p.scenes}
          activeScript={p.activeScript}
          actionLoading={p.actionLoading}
          projectCategory={p.project?.category ?? ""}
          onGenerate={() =>
            p.runAction("seo", async () => {
              await api.generateSEO(p.projectId, p.project?.language ?? "en");
              p.setSuccess("SEO metadata generated!");
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
        />
      )}

      {p.activeTab === "upload" && (
        <UploadStep
          projectId={p.projectId}
          actionLoading={p.actionLoading}
          videoStatus={p.videoStatus}
          seo={p.seo}
          youtubeConfig={p.youtubeConfig}
          youtubeUploadStatus={p.youtubeUploadStatus}
          onUploadYouTube={p.onUploadYouTube}
        />
      )}



    </div>
  );
}
