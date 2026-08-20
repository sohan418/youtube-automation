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

// Motion FX options — used by dropdown (#1)
const MOTION_OPTIONS = [
  { value: "none",       label: "Static 📷" },
  { value: "zoom_in",    label: "Zoom In 🎬" },
  { value: "zoom_out",   label: "Zoom Out 🎬" },
  { value: "pan_right",  label: "Pan Right →" },
  { value: "pan_left",   label: "Pan Left ←" },
  { value: "pan_up",     label: "Pan Up ↑" },
  { value: "pan_down",   label: "Pan Down ↓" },
];

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
  // Task #6: active prompt tab per scene
  const [promptTab, setPromptTab] = useState<"image" | "video">("image");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
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
        .tile-action-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .tile-action-btn-danger:hover { background: rgba(255,0,60,0.12) !important; color: var(--danger) !important; }
        .tile-action-btn-star:hover { background: rgba(255,184,0,0.12) !important; color: #f0b429 !important; }
        .tile-action-btn-copy:hover { background: rgba(0,184,212,0.1) !important; color: var(--accent) !important; }
      `}</style>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "0.6rem 0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
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
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
          >
            {actionLoading === "images" ? "..." : (
              <><Sparkles size={12} style={{ verticalAlign: "-1px" }} /> Generate All Images</>
            )}
          </button>
        </div>

        {scenes.length === 0 ? (
          <div style={{ marginTop: "0.5rem" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No scenes yet. Generate scenes first.
            </p>
            <FreeAIGuide
              title="Generate Image Prompts with Free AI"
              prompt={imagePrompts ? undefined : `SYSTEM PROMPT:\nYou are an expert image prompt engineer for AI art generation. Create ONE detailed image prompt in English that visually shows what the scene's narration is describing. Describe concrete visual imagery: setting, subject, objects, mood, and lighting. Output only the prompt itself. No text, no words, no watermarks, no labels. Cinematic, ultra detailed, 16:9 aspect ratio.\n\nUSER PROMPT:\nScene narration: [paste your scene narration here]\nCreate a detailed cinematic image prompt that visualizes this scene. Always include the 16:9 aspect ratio.`}
              promptPair={imagePrompts}
              responsePlaceholder="Paste AI-generated image prompt here..."
              onParseResponse={(text) => { navigator.clipboard.writeText(text.trim()); }}
            />
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.45rem" }}>

            {/* ── Pager ─────────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                className="btn-secondary"
                disabled={activeIdx <= 0}
                onClick={() => setActiveIdx(activeIdx - 1)}
                style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)" }}>
                Scene {scenes[activeIdx]?.order_index ?? activeIdx + 1} of {scenes.length}
              </span>
              <button
                className="btn-secondary"
                disabled={activeIdx >= scenes.length - 1}
                onClick={() => setActiveIdx(activeIdx + 1)}
                style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
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
                  className="card"
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
                    background: "var(--bg)",
                    padding: "0.65rem 0.85rem",
                    borderColor: draggingOverScene === scene.id ? "var(--accent)" : undefined,
                    borderStyle: draggingOverScene === scene.id ? "dashed" : undefined,
                    display: "grid",
                    gap: "0.55rem",
                  }}
                >
                  {/* ── Task #3: Scene narration (2-line truncated) ──────── */}
                  {scene.narration && (
                    <p
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                        margin: 0,
                        lineHeight: 1.45,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        borderLeft: "2px solid var(--border)",
                        paddingLeft: "0.5rem",
                      }}
                    >
                      {scene.narration}
                    </p>
                  )}

                  {/* ── Task #6: Tabbed prompt block ─────────────────────── */}
                  {(hasImagePrompt || hasVideoPrompt) && (
                    <div
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        overflow: "hidden",
                      }}
                    >
                      {/* Tab bar */}
                      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                        {hasImagePrompt && (
                          <button
                            type="button"
                            onClick={() => setPromptTab("image")}
                            style={{
                              flex: 1,
                              padding: "0.3rem 0.5rem",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.25rem",
                              background: promptTab === "image" ? "rgba(255,255,255,0.06)" : "transparent",
                              color: promptTab === "image" ? "var(--text)" : "var(--text-muted)",
                              borderBottom: promptTab === "image" ? "2px solid var(--primary)" : "2px solid transparent",
                              transition: "all 0.12s ease",
                            }}
                          >
                            <Image size={11} /> Image Prompt
                          </button>
                        )}
                        {hasVideoPrompt && (
                          <button
                            type="button"
                            onClick={() => setPromptTab("video")}
                            style={{
                              flex: 1,
                              padding: "0.3rem 0.5rem",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              border: "none",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.25rem",
                              background: promptTab === "video" ? "rgba(255,255,255,0.06)" : "transparent",
                              color: promptTab === "video" ? "var(--text)" : "var(--text-muted)",
                              borderBottom: promptTab === "video" ? "2px solid var(--primary)" : "2px solid transparent",
                              transition: "all 0.12s ease",
                            }}
                          >
                            <Video size={11} /> Video Prompt
                          </button>
                        )}
                      </div>

                      {/* Prompt body */}
                      <div style={{ padding: "0.5rem 0.7rem", background: "rgba(255,255,255,0.012)", display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
                        <p style={{ fontSize: "0.77rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic", lineHeight: 1.45, flex: 1 }}>
                          {activePromptText}
                        </p>
                        <button
                          className="btn-secondary"
                          onClick={() => handleCopyPrompt(scene)}
                          style={{
                            fontSize: "0.65rem",
                            padding: "0.15rem 0.4rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                            color: copiedPrompt ? "var(--success)" : "var(--text)",
                            borderColor: copiedPrompt ? "var(--success)" : "var(--border)",
                            background: "transparent",
                            borderRadius: "4px",
                            flexShrink: 0,
                          }}
                        >
                          {copiedPrompt ? <Check size={10} /> : <Copy size={10} />}
                          {copiedPrompt ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Task #1: Motion FX dropdown ──────────────────────── */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      Motion FX:
                    </span>
                    <select
                      value={scene.motion_effect || "none"}
                      disabled={!!actionLoading}
                      onChange={(e) => onUpdateSceneEffect && onUpdateSceneEffect(scene.id, e.target.value)}
                      style={{ padding: "0.28rem 0.45rem", fontSize: "0.77rem", flex: 1, maxWidth: "200px" }}
                    >
                      {MOTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {/* Action buttons row */}
                    <div style={{ display: "flex", gap: "0.35rem", marginLeft: "auto", alignItems: "center" }}>
                      <button
                        className="btn-accent"
                        disabled={!!actionLoading || generatingSceneId !== null}
                        onClick={() => onGenerateScene(scene.id)}
                        style={{ fontSize: "0.74rem", padding: "0.28rem 0.55rem" }}
                      >
                        {generatingSceneId === scene.id ? "Generating..." : (
                          <><Sparkles size={12} style={{ verticalAlign: "middle" }} /> Generate</>
                        )}
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={!!actionLoading || clipboardImageId == null}
                        onClick={() => onPaste(scene.id)}
                        style={{ fontSize: "0.74rem", padding: "0.28rem 0.55rem" }}
                        title="Paste the copied image into this scene"
                      >
                        Paste
                      </button>
                    </div>
                  </div>

                  {/* ── Strip stats + warnings ───────────────────────────── */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      {strip.length > 0 ? (
                        <><Check size={12} style={{ color: "var(--success)" }} /> {strip.length} item{strip.length > 1 ? "s" : ""}</>
                      ) : (
                        <><Square size={11} /> Empty strip</>
                      )}
                    </span>
                    {narrationDur && narrationDur > 0 && (
                      <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", background: "var(--surface2, var(--bg))", padding: "0.1rem 0.4rem", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Mic size={11} /> {narrationDur.toFixed(1)}s
                      </span>
                    )}
                    {maxFit && strip.length > 0 && strip.length <= maxFit && (
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>(max {maxFit})</span>
                    )}
                  </div>

                  {/* ── Task #8: Exceeds narration banner ────────────────── */}
                  {maxFit && strip.length > maxFit && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      background: "rgba(255,180,0,0.08)",
                      border: "1px solid rgba(255,180,0,0.3)",
                      borderRadius: "6px",
                      padding: "0.35rem 0.6rem",
                      fontSize: "0.73rem",
                      color: "#f0b429",
                      fontWeight: 600,
                    }}>
                      <AlertTriangle size={13} />
                      Strip has {strip.length} items but narration is {narrationDur!.toFixed(1)}s — max {maxFit} items at 0.5s each
                    </div>
                  )}

                  {/* ── Media tile grid ──────────────────────────────────── */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: "0.55rem",
                  }}>
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
                            style={{
                              position: "relative",
                              borderRadius: "var(--radius)",
                              overflow: "hidden",
                              border: tooLong ? "2px solid var(--danger)" : "2px solid var(--accent)",
                              background: "#000",
                              cursor: "zoom-in",
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
                              style={{
                                width: "100%",
                                aspectRatio: "16 / 10",
                                objectFit: "cover",
                                display: "block",
                                background: "#000",
                                pointerEvents: "none",
                              }}
                            />
                            <span style={{
                              position: "absolute", bottom: 6, left: 6,
                              fontSize: "0.6rem", color: "#fff",
                              background: "rgba(0,0,0,0.6)",
                              padding: "0.1rem 0.3rem", borderRadius: 3,
                              display: "inline-flex", alignItems: "center", gap: "0.2rem",
                            }}>
                              <Clapperboard size={10} /> Clip
                            </span>
                            <span style={{
                              position: "absolute", bottom: 6, right: 6,
                              fontSize: "0.6rem", color: "#fff",
                              background: tooLong ? "rgba(220,53,69,0.85)" : "rgba(0,0,0,0.6)",
                              padding: "0.1rem 0.3rem", borderRadius: 3,
                              fontWeight: 600,
                              display: "inline-flex", alignItems: "center", gap: "0.2rem",
                            }}>
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
                              className="tile-action-btn tile-action-btn-danger"
                              style={{ position: "absolute", top: 5, right: 5, border: "none", cursor: "pointer", borderRadius: "4px", padding: "0.2rem 0.4rem", background: "rgba(0,0,0,0.65)", color: "var(--danger)", display: "inline-flex", alignItems: "center" }}
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
                          style={{
                            position: "relative",
                            borderRadius: "var(--radius)",
                            overflow: "hidden",
                            border: tile.isPrimary ? "2px solid var(--accent)" : "1px solid var(--border)",
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
                              animation:
                                tile.isPrimary && scene.motion_effect === "zoom_in"
                                  ? "scene-zoom-in 10s ease-in-out infinite alternate"
                                  : tile.isPrimary && scene.motion_effect === "pan_right"
                                  ? "scene-pan-right 12s ease-in-out infinite alternate"
                                  : "none",
                              transformOrigin: "center",
                            }}
                          />
                          {/* Task #8: action bar with hover colors */}
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.2rem",
                            padding: "0.3rem 0.4rem",
                          }}>
                            <span style={{
                              fontSize: "0.63rem",
                              color: "var(--text-muted)",
                              textTransform: "capitalize",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.2rem",
                            }}>
                              {tile.isPrimary ? (
                                <strong style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: "0.15rem" }}>
                                  <Star size={10} fill="currentColor" /> Primary
                                </strong>
                              ) : tile.source}
                            </span>
                            <div style={{ display: "flex", gap: "0.2rem", flexShrink: 0 }}>
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
                      <div style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.6rem 0.85rem",
                        border: "1px dashed var(--border)",
                        borderRadius: "var(--radius)",
                        color: "var(--text-muted)",
                        fontSize: "0.75rem",
                      }}>
                        <Film size={16} style={{ flexShrink: 0, opacity: 0.4 }} />
                        <span>No media yet — generate AI images or upload your own using the tiles below.</span>
                      </div>
                    )}

                    <label
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                      onDrop={(e) => handleUploadTileDrop(e, scene.id)}
                      title="Click to upload image or drag & drop here"
                      style={{
                        position: "relative",
                        borderRadius: "var(--radius)",
                        border: "2px dashed var(--border)",
                        minHeight: 80,   // Task #4: was 120px
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        background: "var(--surface)",
                        gap: "0.2rem",
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      <Plus size={20} />
                      <span style={{ fontSize: "0.68rem" }}>Upload Image</span>
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
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                      onDrop={(e) => handleUploadTileDrop(e, scene.id)}
                      title="Click to upload video clip or drag & drop here"
                      style={{
                        position: "relative",
                        borderRadius: "var(--radius)",
                        border: "2px dashed var(--border)",
                        minHeight: 80,   // Task #4: was 120px
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        background: "var(--surface)",
                        gap: "0.2rem",
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      <Clapperboard size={20} />
                      <span style={{ fontSize: "0.68rem" }}>Add Video Clip</span>
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

                  {/* ── URL bar — Task #2: Upload button removed ─────────── */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Paste image URL and press Enter..."
                      value={imageUrlInputs[scene.id] || ""}
                      disabled={!!actionLoading}
                      onChange={(e) => onUrlChange(scene.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") onAddUrl(scene.id); }}
                      style={{
                        flex: 1,
                        padding: "0.4rem 0.6rem",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--text)",
                        fontSize: "0.8rem",
                      }}
                    />
                    <button
                      className="btn-secondary"
                      disabled={!!actionLoading || !(imageUrlInputs[scene.id] || "").trim()}
                      onClick={() => onAddUrl(scene.id)}
                      style={{ fontSize: "0.78rem", padding: "0.4rem 0.7rem" }}
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
