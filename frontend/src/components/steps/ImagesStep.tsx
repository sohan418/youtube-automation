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
} from "lucide-react";
import type { Scene } from "../../types";
import FreeAIGuide from "../editors/FreeAIGuide";

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
  imagePrompts?: { system: string; user: string };
  onUpdateSceneEffect?: (sceneId: number, effect: string) => void;
}

export default function ImagesStep({
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
  imagePrompts,
  onUpdateSceneEffect,
}: Props) {
  const [copiedImagePromptId, setCopiedImagePromptId] = useState<number | null>(null);
  const [copiedVideoPromptId, setCopiedVideoPromptId] = useState<number | null>(null);
  const [videoDurations, setVideoDurations] = useState<Record<number, number>>({});

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

  const handleCopyImagePrompt = (scene: Scene) => {
    const promptText = scene.image_prompt || scene.narration;
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopiedImagePromptId(scene.id);
    setTimeout(() => setCopiedImagePromptId(null), 2000);
  };

  const handleCopyVideoPrompt = (scene: Scene) => {
    const promptText = scene.video_prompt || scene.narration;
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopiedVideoPromptId(scene.id);
    setTimeout(() => setCopiedVideoPromptId(null), 2000);
  };
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <style>{`
        @keyframes scene-zoom-in {
          0% { transform: scale(1); }
          100% { transform: scale(1.2); }
        }
        @keyframes scene-pan-right {
          0% { transform: scale(1.2) translateX(-4%); }
          100% { transform: scale(1.2) translateX(4%); }
        }
      `}</style>
      <div className="card" style={{ padding: "0.6rem 0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", gap: "0.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.05rem", margin: 0 }}>Scene Media Strip</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: 0 }}>
              Generate AI images or upload custom clips per scene
            </p>
          </div>
          <button
            className="btn-secondary"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={onGenerateAll}
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            {actionLoading === "images" ? (
              "..."
            ) : (
              <>
                <Sparkles size={12} style={{ verticalAlign: "-1px" }} />{" "}
                Generate All Images
              </>
            )}
          </button>
        </div>
        {scenes.length === 0 ? (
          <div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No scenes yet. Generate scenes first.
            </p>
            <FreeAIGuide
              title="Generate Image Prompts with Free AI"
              prompt={imagePrompts ? undefined : `SYSTEM PROMPT:\nYou are an expert image prompt engineer for AI art generation. Create ONE detailed image prompt in English that visually shows what the scene's narration is describing. Describe concrete visual imagery: setting, subject, objects, mood, and lighting. Output only the prompt itself. No text, no words, no watermarks, no labels. Cinematic, ultra detailed, 16:9 aspect ratio.\n\nUSER PROMPT:\nScene narration: [paste your scene narration here]\nCreate a detailed cinematic image prompt that visualizes this scene. Always include the 16:9 aspect ratio.`}
              promptPair={imagePrompts}
              responsePlaceholder="Paste AI-generated image prompt here..."
              onParseResponse={(text) => {
                navigator.clipboard.writeText(text.trim());
              }}
            />
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", width: "100%" }}>
              {/* Row 1: Pager Navigation */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <button
                  className="btn-secondary"
                  disabled={activeIdx <= 0}
                  onClick={() => setActiveIdx(activeIdx - 1)}
                  style={{
                    fontSize: "0.78rem",
                    padding: "0.35rem 0.75rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  <ChevronLeft size={14} /> Prev Scene
                </button>

                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "var(--text)",
                    letterSpacing: "0.02em"
                  }}
                >
                  Scene {scenes[activeIdx]?.order_index ?? activeIdx + 1} of {scenes.length}
                </span>

                <button
                  className="btn-secondary"
                  disabled={activeIdx >= scenes.length - 1}
                  onClick={() => setActiveIdx(activeIdx + 1)}
                  style={{
                    fontSize: "0.78rem",
                    padding: "0.35rem 0.75rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  Next Scene <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: "0.5rem" }}>
              {scenes.map((scene, idx) => {
                const strip = buildMediaStrip(scene);
                const narrationDur = scene.duration_seconds;
                const maxFit =
                  narrationDur && narrationDur > 0
                    ? Math.max(1, Math.floor(narrationDur / 0.5))
                    : null;
                return idx === activeIdx ? (
                  <div
                    key={scene.id}
                    className="card"
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragMedia && dragMedia.sourceSceneId !== scene.id) {
                        setDraggingOverScene(scene.id);
                        e.dataTransfer.dropEffect = "copy";
                      }
                    }}
                    onDragLeave={() =>
                      setDraggingOverScene((prev) =>
                        prev === scene.id ? null : prev,
                      )
                    }
                    onDrop={(e) => handleSceneDrop(e, scene.id)}
                    style={{
                      background: "var(--bg)",
                      padding: "0.6rem 0.85rem",
                      borderColor:
                        draggingOverScene === scene.id
                          ? "var(--accent)"
                          : undefined,
                      borderStyle:
                        draggingOverScene === scene.id ? "dashed" : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: "0.5rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: "0.55rem" }}>
                          {scene.image_prompt && (
                            <div
                              className="card"
                              style={{
                                padding: "0.6rem 0.8rem",
                                background: "rgba(255, 255, 255, 0.015)",
                                border: "1px solid var(--border)",
                                borderRadius: "6px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.35rem",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                  <Image size={12} />
                                  Image Prompt
                                </span>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleCopyImagePrompt(scene)}
                                  style={{
                                    fontSize: "0.65rem",
                                    padding: "0.15rem 0.4rem",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.2rem",
                                    color: copiedImagePromptId === scene.id ? "var(--success)" : "var(--text)",
                                    borderColor: copiedImagePromptId === scene.id ? "var(--success)" : "var(--border)",
                                    background: "transparent",
                                    borderRadius: "4px"
                                  }}
                                  title="Copy image prompt to clipboard"
                                >
                                  {copiedImagePromptId === scene.id ? <Check size={10} /> : <Copy size={10} />}
                                  {copiedImagePromptId === scene.id ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic", lineHeight: 1.45 }}>
                                {scene.image_prompt}
                              </p>
                            </div>
                          )}
                          {scene.video_prompt && (
                            <div
                              className="card"
                              style={{
                                padding: "0.6rem 0.8rem",
                                background: "rgba(255, 255, 255, 0.015)",
                                border: "1px solid var(--border)",
                                borderRadius: "6px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.35rem",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                                  <Video size={12} />
                                  Video Prompt
                                </span>
                                <button
                                  className="btn-secondary"
                                  onClick={() => handleCopyVideoPrompt(scene)}
                                  style={{
                                    fontSize: "0.65rem",
                                    padding: "0.15rem 0.4rem",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.2rem",
                                    color: copiedVideoPromptId === scene.id ? "var(--success)" : "var(--text)",
                                    borderColor: copiedVideoPromptId === scene.id ? "var(--success)" : "var(--border)",
                                    background: "transparent",
                                    borderRadius: "4px"
                                  }}
                                  title="Copy video prompt to clipboard"
                                >
                                  {copiedVideoPromptId === scene.id ? <Check size={10} /> : <Copy size={10} />}
                                  {copiedVideoPromptId === scene.id ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic", lineHeight: 1.45 }}>
                                {scene.video_prompt}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Motion Animation selector */}
                        <div
                          style={{
                            paddingLeft: "2.3rem",
                            marginBottom: "0.65rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              color: "var(--text-muted)",
                            }}
                          >
                            Motion Animation (FX):
                          </span>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                            {[
                              { value: "none", label: "Static 📷" },
                              { value: "zoom_in", label: "Zoom In 🎬" },
                              { value: "zoom_out", label: "Zoom Out 🎬" },
                              { value: "pan_right", label: "Pan Right 🎬" },
                              { value: "pan_left", label: "Pan Left 🎬" },
                              { value: "pan_up", label: "Pan Up 🎬" },
                              { value: "pan_down", label: "Pan Down 🎬" }
                            ].map((opt) => {
                              const active = (scene.motion_effect || "none") === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => onUpdateSceneEffect && onUpdateSceneEffect(scene.id, opt.value)}
                                  style={{
                                    padding: "0.3rem 0.6rem",
                                    fontSize: "0.74rem",
                                    fontWeight: 600,
                                    borderRadius: "4px",
                                    border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                                    background: active ? "rgba(255, 0, 60, 0.08)" : "transparent",
                                    color: active ? "var(--primary)" : "var(--text-muted)",
                                    cursor: "pointer",
                                    transition: "all 0.1s ease",
                                  }}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "0.4rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                          paddingLeft: "2.3rem",
                        }}
                      >
                        <button
                          className="btn-accent"
                          disabled={
                            !!actionLoading || generatingSceneId !== null
                          }
                          onClick={() => onGenerateScene(scene.id)}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.3rem 0.6rem",
                          }}
                        >
                          {generatingSceneId === scene.id ? (
                            "Generating..."
                          ) : (
                            <>
                              <Sparkles
                                size={13}
                                style={{ verticalAlign: "middle" }}
                              />{" "}
                              Generate
                            </>
                          )}
                        </button>
                        <button
                          className="btn-secondary"
                          disabled={!!actionLoading || clipboardImageId == null}
                          onClick={() => onPaste(scene.id)}
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.3rem 0.6rem",
                          }}
                          title="Paste the copied image into this scene"
                        >
                          Paste
                        </button>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            marginLeft: "auto",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          {strip.length > 0 ? (
                            <>
                              <Check
                                size={12}
                                style={{
                                  color: "var(--success)",
                                  verticalAlign: "-2px",
                                }}
                              />{" "}
                              {strip.length} media item
                              {strip.length > 1 ? "s" : ""}
                            </>
                          ) : (
                            <>
                              <Square
                                size={11}
                                style={{ verticalAlign: "-2px" }}
                              />{" "}
                              Empty strip
                            </>
                          )}
                          {narrationDur && narrationDur > 0 && (
                            <span
                              title="Narration (voice) duration — the strip is split to match it"
                              style={{
                                background: "var(--surface2, var(--bg))",
                                padding: "0.1rem 0.4rem",
                                borderRadius: 4,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                            >
                              <Mic size={11} /> {narrationDur.toFixed(1)}s
                            </span>
                          )}
                          {maxFit && strip.length > maxFit ? (
                            <span
                              style={{
                                color: "var(--danger)",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                              title={`Narration is ${narrationDur!.toFixed(1)}s; each item needs ≥0.5s, so max ${maxFit} items`}
                            >
                              <AlertTriangle size={12} /> Exceeds narration
                            </span>
                          ) : (
                            maxFit &&
                            strip.length > 0 && (
                              <span style={{ color: "var(--text-muted)" }}>
                                (max {maxFit})
                              </span>
                            )
                          )}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(140px, 1fr))",
                        gap: "0.6rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {strip.map((tile) => {
                        if (tile.kind === "video") {
                          const clipDur = videoDurations[tile.id];
                          const tooLong =
                            !!clipDur &&
                            !!narrationDur &&
                            clipDur > narrationDur + 0.3;
                          return (
                            <div
                              key={`video-${tile.id}`}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData(
                                  "text/plain",
                                  `video:${tile.id}`,
                                );
                                e.dataTransfer.effectAllowed = "copyMove";
                                setDragMedia({
                                  kind: "video",
                                  id: tile.id,
                                  sourceSceneId: scene.id,
                                });
                              }}
                              onDragEnd={() => setDragMedia(null)}
                              onDragOver={handleTileDragOver}
                              onDrop={(e) => handleTileDrop(e, scene, tile)}
                              onClick={() => onPreview(tile.file_path, "video")}
                              title="Click to preview the video clip; drag to reorder the scene strip"
                              style={{
                                position: "relative",
                                borderRadius: "var(--radius)",
                                overflow: "hidden",
                                border: tooLong
                                  ? "2px solid var(--danger)"
                                  : "2px solid var(--accent)",
                                background: "#000",
                                cursor: "zoom-in",
                              }}
                            >
                              <video
                                src={mediaUrl(tile.file_path)}
                                muted
                                controls
                                preload="metadata"
                                onLoadedMetadata={(e) => {
                                  const d = e.currentTarget.duration;
                                  if (d && d !== Infinity) {
                                    setVideoDurations((prev) => ({
                                      ...prev,
                                      [tile.id]: d,
                                    }));
                                  }
                                }}
                                style={{
                                  width: "100%",
                                  aspectRatio: "16 / 10",
                                  objectFit: "cover",
                                  display: "block",
                                  background: "#000",
                                  pointerEvents: "none",
                                }}
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: 6,
                                  left: 6,
                                  fontSize: "0.62rem",
                                  color: "#fff",
                                  background: "rgba(0,0,0,0.6)",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: 3,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                }}
                              >
                                <Clapperboard size={11} /> Video clip
                              </span>
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: 6,
                                  right: 6,
                                  fontSize: "0.62rem",
                                  color: "#fff",
                                  background: tooLong
                                    ? "rgba(220,53,69,0.85)"
                                    : "rgba(0,0,0,0.6)",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: 3,
                                  fontWeight: 600,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                }}
                                title={
                                  tooLong
                                    ? `Clip is ${clipDur!.toFixed(1)}s but narration is ${narrationDur!.toFixed(1)}s — longer clips are rejected on upload`
                                    : "Clip duration"
                                }
                              >
                                {tooLong ? (
                                  <>
                                    <AlertTriangle size={11} />{" "}
                                    {clipDur!.toFixed(1)}s{" "}
                                    {narrationDur!.toFixed(1)}s
                                  </>
                                ) : (
                                  <>
                                    <Timer size={11} />{" "}
                                    {clipDur ? `${clipDur.toFixed(1)}s` : "…"}
                                  </>
                                )}
                              </span>
                              <button
                                title="Remove video clip"
                                disabled={!!actionLoading}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveVideo(scene.id, tile.id);
                                }}
                                style={{
                                  position: "absolute",
                                  top: 6,
                                  right: 6,
                                  border: "none",
                                  cursor: "pointer",
                                  borderRadius: "4px",
                                  fontSize: "0.7rem",
                                  padding: "0.15rem 0.35rem",
                                  background: "rgba(0,0,0,0.65)",
                                  color: "var(--danger)",
                                }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={`image-${tile.id}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                "text/plain",
                                `image:${tile.id}`,
                              );
                              e.dataTransfer.effectAllowed = "copyMove";
                              setDragMedia({
                                kind: "image",
                                id: tile.id,
                                sourceSceneId: scene.id,
                              });
                            }}
                            onDragEnd={() => setDragMedia(null)}
                            onDragOver={handleTileDragOver}
                            onDrop={(e) => handleTileDrop(e, scene, tile)}
                            onClick={() => onPreview(tile.file_path, "image")}
                            title="Click to preview; drag to reorder; drag onto another scene to copy"
                            style={{
                              position: "relative",
                              borderRadius: "var(--radius)",
                              overflow: "hidden",
                              border: tile.isPrimary
                                ? "2px solid var(--accent)"
                                : "1px solid var(--border)",
                              background: "var(--surface)",
                              cursor: "zoom-in",
                            }}
                          >
                             <img
                              src={mediaUrl(tile.file_path)}
                              alt={`Scene ${scene.order_index} image`}
                              loading="lazy"
                              style={{
                                width: "100%",
                                aspectRatio: "16 / 10",
                                objectFit: "cover",
                                display: "block",
                                pointerEvents: "none",
                                animation: tile.isPrimary && scene.motion_effect === "zoom_in"
                                  ? "scene-zoom-in 10s ease-in-out infinite alternate"
                                  : tile.isPrimary && scene.motion_effect === "pan_right"
                                  ? "scene-pan-right 12s ease-in-out infinite alternate"
                                  : "none",
                                transformOrigin: "center",
                              }}
                            />
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "0.25rem",
                                padding: "0.35rem 0.4rem",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--text-muted)",
                                  textTransform: "capitalize",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.2rem",
                                }}
                              >
                                {tile.isPrimary ? (
                                  <strong
                                    style={{
                                      color: "var(--accent)",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "0.2rem",
                                    }}
                                  >
                                    <Star size={11} fill="currentColor" />{" "}
                                    Primary
                                  </strong>
                                ) : (
                                  tile.source
                                )}
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.25rem",
                                  flexShrink: 0,
                                }}
                              >
                                <button
                                  title="Copy image"
                                  disabled={!!actionLoading}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCopy(tile.id);
                                  }}
                                  style={{
                                    border: "none",
                                    background: "var(--surface2, var(--bg))",
                                    cursor: "pointer",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    padding: "0.15rem 0.35rem",
                                    color: "var(--text-muted)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <Copy size={12} />
                                </button>
                                {!tile.isPrimary && (
                                  <button
                                    title="Set as primary image (used in video)"
                                    disabled={!!actionLoading}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMakePrimary(tile.id);
                                    }}
                                    style={{
                                      border: "none",
                                      background: "var(--surface2, var(--bg))",
                                      cursor: "pointer",
                                      borderRadius: "4px",
                                      fontSize: "0.7rem",
                                      padding: "0.15rem 0.35rem",
                                      color: "var(--text-muted)",
                                      display: "inline-flex",
                                      alignItems: "center",
                                    }}
                                  >
                                    <Star size={12} />
                                  </button>
                                )}
                                <button
                                  title="Remove image"
                                  disabled={!!actionLoading}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(tile.id);
                                  }}
                                  style={{
                                    border: "none",
                                    background: "var(--surface2, var(--bg))",
                                    cursor: "pointer",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    padding: "0.15rem 0.35rem",
                                    color: "var(--danger)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <label
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e) => handleUploadTileDrop(e, scene.id)}
                        title="Click to upload, or drag & drop an image or video clip here. Drop an image from another scene to copy it."
                        style={{
                          position: "relative",
                          borderRadius: "var(--radius)",
                          border: "2px dashed var(--border)",
                          minHeight: 120,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          background: "var(--surface)",
                        }}
                      >
                        <Plus size={24} />
                        <span
                          style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}
                        >
                          Upload Image
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                          disabled={!!actionLoading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUpload(scene.id, file);
                            e.target.value = "";
                          }}
                          style={{ display: "none" }}
                        />
                      </label>
                      <label
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e) => handleUploadTileDrop(e, scene.id)}
                        title="Click to upload, or drag & drop an image or video clip here."
                        style={{
                          position: "relative",
                          borderRadius: "var(--radius)",
                          border: "2px dashed var(--border)",
                          minHeight: 120,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                          cursor: "pointer",
                          color: "var(--text-muted)",
                          background: "var(--surface)",
                        }}
                      >
                        <Clapperboard size={24} />
                        <span
                          style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}
                        >
                          Add Video Clip
                        </span>
                        <input
                          type="file"
                          accept="video/mp4,video/mov,video/m4v,video/webm,video/x-matroska,video/avi,video/*"
                          disabled={!!actionLoading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUploadVideo(scene.id, file);
                            e.target.value = "";
                          }}
                          style={{ display: "none" }}
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Paste image URL..."
                        value={imageUrlInputs[scene.id] || ""}
                        disabled={!!actionLoading}
                        onChange={(e) => onUrlChange(scene.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onAddUrl(scene.id);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 200,
                          padding: "0.45rem 0.6rem",
                          borderRadius: "var(--radius)",
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--text)",
                        }}
                      />
                      <button
                        className="btn-secondary"
                        disabled={
                          !!actionLoading ||
                          !(imageUrlInputs[scene.id] || "").trim()
                        }
                        onClick={() => onAddUrl(scene.id)}
                        style={{ fontSize: "0.8rem" }}
                      >
                        Add URL
                      </button>
                      <label
                        className="btn-secondary"
                        style={{
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          margin: 0,
                        }}
                      >
                        Upload
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                          disabled={!!actionLoading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUpload(scene.id, file);
                            e.target.value = "";
                          }}
                          style={{ display: "none" }}
                        />
                      </label>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
