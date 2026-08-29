import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Mic,
  Plus,
  Sparkles,
  Square,
  Star,
  Timer,
  X,
  Image,
  Video,
  Film,
} from "lucide-react";
import type { Scene } from "../../types";
import { api } from "../../api/client";
import FreeAIGuide from "../editors/FreeAIGuide";
import "./ImagesStep.css";


export interface DragMedia {
  kind: "image" | "video";
  id: number;
  sourceSceneId: number;
}

export interface MediaTile {
  kind: "image" | "video";
  id: number;
  position: number;
  file_path: string;
  source: string;
  isPrimary: boolean;
}

export function buildMediaStrip(scene: Scene): MediaTile[] {
  const images: MediaTile[] = (scene.images || []).map((img) => ({
    kind: "image",
    id: img.id,
    position: img.position,
    file_path: img.file_path,
    source: img.source,
    isPrimary: img.file_path === scene.image_path,
  }));
  const videos: MediaTile[] = (scene.videos || []).map((vid) => ({
    kind: "video",
    id: vid.id,
    position: vid.position,
    file_path: vid.file_path,
    source: vid.source,
    isPrimary: false,
  }));
  return [...images, ...videos].sort((a, b) => a.position - b.position);
}



interface Props {
  projectRatio?: string;
  scenes: Scene[];
  activeIdx: number;
  setActiveIdx: React.Dispatch<React.SetStateAction<number>>;
  actionLoading: string;
  generatingSceneId: number | null;
  clipboardImageId: number | null;
  imageUrlInputs: Record<number, string>;
  dragMedia: DragMedia | null;
  draggingOverScene: number | null;
  mediaUrl: (p: string) => string;
  onGenerateAll: () => void;
  onGenerateScene: (sceneId: number) => void;
  onUrlChange: (sceneId: number, value: string) => void;
  onAddUrl: (sceneId: number) => void;
  onUpload: (sceneId: number, file: File) => void;
  onUploadVideo: (sceneId: number, file: File) => void;
  onRemoveVideo: (sceneId: number, videoId: number) => void;
  onCopy: (imageId: number) => void;
  onMakePrimary: (imageId: number) => void;
  onRemove: (imageId: number) => void;
  onPreview: (path: string, kind: "image" | "video") => void;
  onPaste: (sceneId: number) => void;
  setDragMedia: (d: DragMedia | null) => void;
  setDraggingOverScene: React.Dispatch<React.SetStateAction<number | null>>;
  handleTileDragOver: (e: React.DragEvent) => void;
  handleTileDrop: (e: React.DragEvent, scene: Scene, target: MediaTile) => void;
  handleSceneDrop: (e: React.DragEvent, sceneId: number) => void;
  handleUploadTileDrop: (e: React.DragEvent, sceneId: number) => void;
  onUpdateSceneEffect?: (sceneId: number, effect: string) => void;
}

export default function ImagesStep({
  projectRatio,
  scenes,
  activeIdx,
  setActiveIdx,
  actionLoading,
  generatingSceneId,
  clipboardImageId,
  imageUrlInputs,
  dragMedia,
  draggingOverScene,
  mediaUrl,
  onGenerateAll,
  onGenerateScene,
  onUrlChange,
  onAddUrl,
  onUpload,
  onUploadVideo,
  onRemoveVideo,
  onCopy,
  onMakePrimary,
  onRemove,
  onPreview,
  onPaste,
  setDragMedia,
  setDraggingOverScene,
  handleTileDragOver,
  handleTileDrop,
  handleSceneDrop,
  handleUploadTileDrop,
}: Props) {
  // Task #6: active prompt tab per scene
  const [promptTab, setPromptTab] = useState<"image" | "video">("image");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);
  const [videoDurations, setVideoDurations] = useState<Record<number, number>>({});
  const [dynamicImagePrompt, setDynamicImagePrompt] = useState<{ system: string; user: string } | null>(null);

  useEffect(() => {
    api.buildImagePrompt({
      scene_narration: "Scene narration: [paste your scene narration here]",
      ratio: projectRatio || "16:9",
    }).then(setDynamicImagePrompt).catch(() => {});
  }, [projectRatio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;
      if (e.key === "ArrowLeft") setActiveIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setActiveIdx((i) => Math.min(scenes.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenes.length]);

  const handleCopyPrompt = (scene: Scene) => {
    const text =
      promptTab === "image"
        ? scene.image_prompt || scene.narration
        : scene.video_prompt || scene.narration;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyBothPrompts = (scene: Scene) => {
    const imgPrompt = scene.image_prompt || scene.narration || "";
    const vidPrompt = scene.video_prompt || scene.narration || "";
    const text = `Image Prompt:\n${imgPrompt}\n\nVideo Prompt:\n${vidPrompt}`;
    navigator.clipboard.writeText(text);
    setCopiedBoth(true);
    setTimeout(() => setCopiedBoth(false), 2000);
  };

  // Tile action button style helpers (#8)
  const tileActionBtn = (color?: string): React.CSSProperties => ({
    border: "none",
    background: "var(--surface2, var(--bg))",
    cursor: "pointer",
    borderRadius: "4px",
    fontSize: "0.75rem",
    padding: "0.22rem 0.45rem",
    color: color || "var(--text-muted)",
    display: "inline-flex",
    alignItems: "center",
    transition: "background 0.12s ease, color 0.12s ease",
  });

  return (
    <div className="images-root">
      {/* ── Compact Header Toolbar ─────────────────────────────────────── */}
      <div className="images-header">
        {/* Left Side: Title */}
        <div className="images-header-title">
          <Film size={14} color="var(--primary)" className="images-header-title-icon" />
          <span className="images-header-title-text">Scene Media Strip</span>
        </div>

        {/* Right Side: Generate All Button */}
        <button
          className="btn-secondary images-generate-btn"
          disabled={!!actionLoading || scenes.length === 0}
          onClick={onGenerateAll}
        >
          {actionLoading === "images" ? (
            "Generating..."
          ) : (
            <>
              <Sparkles size={11} /> Generate All
            </>
          )}
        </button>
      </div>

      <div className="images-column">
        {scenes.length === 0 ? (
          <div className="images-empty-wrapper">
            <p className="images-empty-text">
              No scenes yet. Generate scenes first.
            </p>
            <FreeAIGuide
              title="Generate Image Prompts with Free AI"
              prompt={dynamicImagePrompt ? undefined : `SYSTEM PROMPT:\nYou are an expert image prompt engineer for AI art generation. Create ONE detailed image prompt in English that visually shows what the scene's narration is describing. Describe concrete visual imagery: setting, subject, objects, mood, and lighting. Output only the prompt itself. No text, no words, no watermarks, no labels. Cinematic, ultra detailed, ${projectRatio || "16:9"} aspect ratio.\n\nUSER PROMPT:\nScene narration: [paste your scene narration here]\nCreate a detailed cinematic image prompt that visualizes this scene. Always include the ${projectRatio || "16:9"} aspect ratio.`}
              promptPair={dynamicImagePrompt || undefined}
              responsePlaceholder="Paste AI-generated image prompt here..."
              onParseResponse={(text) => { navigator.clipboard.writeText(text.trim()); }}
            />
          </div>
        ) : (
          <div className="images-scene-list">

            {/* ── Pager ─────────────────────────────────────────────────── */}
            <div className="images-pager">
              <button
                className="btn-secondary images-pager-btn"
                disabled={activeIdx <= 0}
                onClick={() => setActiveIdx(activeIdx - 1)}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="images-pager-text">
                Scene {scenes[activeIdx]?.order_index ?? activeIdx + 1} of {scenes.length}
              </span>
              <button
                className="btn-secondary images-pager-btn"
                disabled={activeIdx >= scenes.length - 1}
                onClick={() => setActiveIdx(activeIdx + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>

            {/* ── Active scene card ──────────────────────────────────────── */}
            {scenes.map((scene, idx) => {
              if (idx !== activeIdx) return null;

              const strip = buildMediaStrip(scene);
              const narrationDur = scene.duration_seconds;
              const maxFit = narrationDur && narrationDur > 0
                ? Math.max(1, Math.floor(narrationDur / 0.5))
                : null;
              const hasImagePrompt = !!scene.image_prompt;
              const hasVideoPrompt = !!scene.video_prompt;
              const activePromptText =
                promptTab === "image"
                  ? scene.image_prompt || scene.narration
                  : scene.video_prompt || scene.narration;

              return (
                <div
                  key={scene.id}
                  className="card images-card"
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragMedia && dragMedia.sourceSceneId !== scene.id) {
                      setDraggingOverScene(scene.id);
                      e.dataTransfer.dropEffect = "copy";
                    }
                  }}
                  onDragLeave={() =>
                    setDraggingOverScene((prev) => prev === scene.id ? null : prev)
                  }
                  onDrop={(e) => handleSceneDrop(e, scene.id)}
                  style={{
                    borderColor: draggingOverScene === scene.id ? "var(--accent)" : undefined,
                    borderStyle: draggingOverScene === scene.id ? "dashed" : undefined,
                  }}
                >
                  {/* ── Task #3: Scene narration (2-line truncated) ──────── */}
                  {scene.narration && (
                    <p className="images-narration">
                      {scene.narration}
                    </p>
                  )}

                  {/* ── Task #6: Tabbed prompt block ─────────────────────── */}
                  {(hasImagePrompt || hasVideoPrompt) && (
                    <div className="images-prompt-block">
                      {/* Tab bar */}
                      <div className="images-tab-bar">
                        {hasImagePrompt && (
                          <button
                            type="button"
                            onClick={() => setPromptTab("image")}
                            className="images-tab-btn"
                            style={{
                              background: promptTab === "image" ? "rgba(255,255,255,0.06)" : "transparent",
                              color: promptTab === "image" ? "var(--text)" : "var(--text-muted)",
                              borderBottom: promptTab === "image" ? "2px solid var(--primary)" : "2px solid transparent",
                            }}
                          >
                            <Image size={11} /> Image Prompt
                          </button>
                        )}
                        {hasVideoPrompt && (
                          <button
                            type="button"
                            onClick={() => setPromptTab("video")}
                            className="images-tab-btn"
                            style={{
                              background: promptTab === "video" ? "rgba(255,255,255,0.06)" : "transparent",
                              color: promptTab === "video" ? "var(--text)" : "var(--text-muted)",
                              borderBottom: promptTab === "video" ? "2px solid var(--primary)" : "2px solid transparent",
                            }}
                          >
                            <Video size={11} /> Video Prompt
                          </button>
                        )}
                      </div>

                      {/* Prompt body */}
                      <div className="images-prompt-body">
                        <p className="images-prompt-text">
                          {activePromptText}
                        </p>
                        <div className="images-prompt-btns">
                          <button
                            className="btn-secondary images-prompt-btn"
                            onClick={() => handleCopyPrompt(scene)}
                            style={{
                              color: copiedPrompt ? "var(--success)" : "var(--text)",
                              borderColor: copiedPrompt ? "var(--success)" : "var(--border)",
                            }}
                          >
                            {copiedPrompt ? <Check size={10} /> : <Copy size={10} />}
                            {copiedPrompt ? "Copied" : "Copy"}
                          </button>
                          <button
                            className="btn-secondary images-prompt-btn"
                            onClick={() => handleCopyBothPrompts(scene)}
                            style={{
                              color: copiedBoth ? "var(--success)" : "var(--text)",
                              borderColor: copiedBoth ? "var(--success)" : "var(--border)",
                            }}
                          >
                            {copiedBoth ? <Check size={10} /> : <Copy size={10} />}
                            {copiedBoth ? "Copied Both" : "Copy Both"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action buttons row */}
                  <div className="images-action-row">
                    <button
                      className="btn-accent images-action-btn"
                      disabled={!!actionLoading || generatingSceneId !== null}
                      onClick={() => onGenerateScene(scene.id)}
                    >
                      {generatingSceneId === scene.id ? "Generating..." : (
                        <><Sparkles size={12} className="images-generate-icon" /> Generate</>
                      )}
                    </button>
                    <button
                      className="btn-secondary images-action-btn"
                      disabled={!!actionLoading || clipboardImageId == null}
                      onClick={() => onPaste(scene.id)}
                      title="Paste the copied image into this scene"
                    >
                      Paste
                    </button>
                  </div>

                  {/* ── Strip stats + warnings ───────────────────────────── */}
                  <div className="images-strip-stats">
                    <span className="images-strip-stat">
                      {strip.length > 0 ? (
                        <><Check size={12} className="images-strip-stat-check" /> {strip.length} item{strip.length > 1 ? "s" : ""}</>
                      ) : (
                        <><Square size={11} /> Empty strip</>
                      )}
                    </span>
                    {narrationDur && narrationDur > 0 && (
                      <span className="images-strip-dur">
                        <Mic size={11} /> {narrationDur.toFixed(1)}s
                      </span>
                    )}
                    {maxFit && strip.length > 0 && strip.length <= maxFit && (
                      <span className="images-strip-max">(max {maxFit})</span>
                    )}
                  </div>

                  {/* ── Task #8: Exceeds narration banner ────────────────── */}
                  {maxFit && strip.length > maxFit && (
                    <div className="images-exceeds-banner">
                      <AlertTriangle size={13} />
                      Strip has {strip.length} items but narration is {narrationDur!.toFixed(1)}s — max {maxFit} items at 0.5s each
                    </div>
                  )}

                  {/* ── Media tile grid ──────────────────────────────────── */}
                  <div className="images-tile-grid">
                    {strip.map((tile) => {
                      if (tile.kind === "video") {
                        const clipDur = videoDurations[tile.id];
                        const tooLong = !!clipDur && !!narrationDur && clipDur > narrationDur + 0.3;
                        return (
                          <div
                            key={`video-${tile.id}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", `video:${tile.id}`);
                              e.dataTransfer.effectAllowed = "copyMove";
                              setDragMedia({ kind: "video", id: tile.id, sourceSceneId: scene.id });
                            }}
                            onDragEnd={() => setDragMedia(null)}
                            onDragOver={handleTileDragOver}
                            onDrop={(e) => handleTileDrop(e, scene, tile)}
                            onClick={() => onPreview(tile.file_path, "video")}
                            title="Click to preview; drag to reorder"
                            className="images-tile"
                            style={{
                              border: tooLong ? "2px solid var(--danger)" : "2px solid var(--accent)",
                            }}
                          >
                            <video
                              src={mediaUrl(tile.file_path)}
                              muted
                              preload="metadata"
                              onLoadedMetadata={(e) => {
                                const d = e.currentTarget.duration;
                                if (d && d !== Infinity) {
                                  setVideoDurations((prev) => ({ ...prev, [tile.id]: d }));
                                }
                              }}
                              className="images-tile-media"
                            />
                            <span className="images-tile-badge images-tile-badge-left">
                              <Clapperboard size={10} /> Clip
                            </span>
                            <span
                              className="images-tile-badge images-tile-badge-right"
                              style={{
                                background: tooLong ? "rgba(220,53,69,0.85)" : "rgba(0,0,0,0.6)",
                              }}
                            >
                              {tooLong ? (
                                <><AlertTriangle size={10} /> {clipDur!.toFixed(1)}s</>
                              ) : (
                                <><Timer size={10} /> {clipDur ? `${clipDur.toFixed(1)}s` : "…"}</>
                              )}
                            </span>
                            {/* Task #8: Remove button with hover */}
                            <button
                              title="Remove video clip"
                              disabled={!!actionLoading}
                              onClick={(e) => { e.stopPropagation(); onRemoveVideo(scene.id, tile.id); }}
                              className="tile-action-btn tile-action-btn-danger images-tile-remove-btn"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      }

                      // Image tile
                      return (
                        <div
                          key={`image-${tile.id}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", `image:${tile.id}`);
                            e.dataTransfer.effectAllowed = "copyMove";
                            setDragMedia({ kind: "image", id: tile.id, sourceSceneId: scene.id });
                          }}
                          onDragEnd={() => setDragMedia(null)}
                          onDragOver={handleTileDragOver}
                          onDrop={(e) => handleTileDrop(e, scene, tile)}
                          onClick={() => onPreview(tile.file_path, "image")}
                          title="Click to preview; drag to reorder; drag to another scene to copy"
                          className="images-tile images-tile-img-tile"
                          style={{
                            border: tile.isPrimary ? "2px solid var(--accent)" : "1px solid var(--border)",
                          }}
                        >
                          <img
                            src={mediaUrl(tile.file_path)}
                            alt={`Scene ${scene.order_index} image`}
                            loading="lazy"
                            className="images-tile-media"
                            style={{
                              animation:
                                tile.isPrimary && scene.motion_effect === "zoom_in"
                                  ? "scene-zoom-in 10s ease-in-out infinite alternate"
                                  : tile.isPrimary && scene.motion_effect === "pan_right"
                                  ? "scene-pan-right 12s ease-in-out infinite alternate"
                                  : "none",
                            }}
                          />
                          {/* Task #8: action bar with hover colors */}
                          <div className="images-tile-actions">
                            <span className="images-tile-source">
                              {tile.isPrimary ? (
                                <strong className="images-tile-primary">
                                  <Star size={10} fill="currentColor" /> Primary
                                </strong>
                              ) : tile.source}
                            </span>
                            <div className="images-tile-btns">
                              <button
                                title="Copy image"
                                disabled={!!actionLoading}
                                onClick={(e) => { e.stopPropagation(); onCopy(tile.id); }}
                                className="tile-action-btn tile-action-btn-copy"
                                style={tileActionBtn()}
                              >
                                <Copy size={12} />
                              </button>
                              {!tile.isPrimary && (
                                <button
                                  title="Set as primary image"
                                  disabled={!!actionLoading}
                                  onClick={(e) => { e.stopPropagation(); onMakePrimary(tile.id); }}
                                  className="tile-action-btn tile-action-btn-star"
                                  style={tileActionBtn()}
                                >
                                  <Star size={12} />
                                </button>
                              )}
                              <button
                                title="Remove image"
                                disabled={!!actionLoading}
                                onClick={(e) => { e.stopPropagation(); onRemove(tile.id); }}
                                className="tile-action-btn tile-action-btn-danger"
                                style={tileActionBtn("var(--danger)")}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Task #4: Upload tiles — 80px min-height ─────────── */}
                    {/* Task #7: Show empty state when no media */}
                    {strip.length === 0 && (
                      <div className="images-empty-state">
                        <Film size={16} className="images-upload-empty-icon" />
                        <span>No media yet — generate AI images or upload your own using the tiles below.</span>
                      </div>
                    )}

                    <label
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                      onDrop={(e) => handleUploadTileDrop(e, scene.id)}
                      title="Click to upload image or drag & drop here"
                      className="images-upload-tile"
                    >
                      <Plus size={20} />
                      <span className="images-upload-tile-text">Upload Image</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                        disabled={!!actionLoading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUpload(scene.id, file);
                          e.target.value = "";
                        }}
                        className="images-hidden-input"
                      />
                    </label>

                    <label
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                      onDrop={(e) => handleUploadTileDrop(e, scene.id)}
                      title="Click to upload video clip or drag & drop here"
                      className="images-upload-tile"
                    >
                      <Clapperboard size={20} />
                      <span className="images-upload-tile-text">Add Video Clip</span>
                      <input
                        type="file"
                        accept="video/mp4,video/mov,video/m4v,video/webm,video/x-matroska,video/avi,video/*"
                        disabled={!!actionLoading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUploadVideo(scene.id, file);
                          e.target.value = "";
                        }}
                        className="images-hidden-input"
                      />
                    </label>
                  </div>

                  {/* ── URL bar — Task #2: Upload button removed ─────────── */}
                  <div className="images-url-bar">
                    <input
                      type="text"
                      placeholder="Paste image URL and press Enter..."
                      value={imageUrlInputs[scene.id] || ""}
                      disabled={!!actionLoading}
                      onChange={(e) => onUrlChange(scene.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") onAddUrl(scene.id); }}
                      className="images-url-input"
                    />
                    <button
                      className="btn-secondary images-url-btn"
                      disabled={!!actionLoading || !(imageUrlInputs[scene.id] || "").trim()}
                      onClick={() => onAddUrl(scene.id)}
                    >
                      Add URL
                    </button>
                    {/* Duplicate Upload button removed (#2) */}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
