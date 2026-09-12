import { useState, useEffect, useRef } from "react";
import { Upload, Play, Trash2, X, Plus, Film, Check, LayoutGrid, List, Pencil } from "lucide-react";
import type { VideoClip, Scene } from "../../types";
import { api, mediaUrl } from "../../api/client";
import StepHeader from "../studio/StepHeader";
import Tabs from "../ui/Tabs";
import "./GalleryStep.css";

interface Props {
  projectId: number;
  scenes: Scene[];
  activeSceneIdx?: number;
  onAddClipToTimeline?: (clip: VideoClip) => Promise<void>;
  onUpdateSceneMedia?: (sceneId: number, mediaPath: string, isVideo?: boolean) => Promise<void>;
  onQuickAddScene?: (atTime?: number) => Promise<Scene | null>;
  onRefreshScenes?: () => void;
  onCollapse?: () => void;
}

type CategoryTab = "all" | "videos" | "images" | "hook" | "cta" | "background" | "other";

function isImageFile(filename: string): boolean {
  return /\.(png|jpg|jpeg|webp)$/i.test(filename);
}

function isVideoFile(filename: string): boolean {
  return /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(filename);
}

function formatDuration(sec: number | null): string {
  if (!sec) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function getClipCategory(filename: string): "hook" | "cta" | "background" | "other" {
  const f = filename.toLowerCase();
  if (f.includes("hook") || f.includes("intro") || f.includes("start")) return "hook";
  if (f.includes("cta") || f.includes("end") || f.includes("outro") || f.includes("sub") || f.includes("like") || f.includes("subscribe")) return "cta";
  if (f.includes("bg") || f.includes("back") || f.includes("loop")) return "background";
  return "other";
}

export default function GalleryStep({
  projectId,
  scenes,
  activeSceneIdx = 0,
  onAddClipToTimeline,
  onUpdateSceneMedia,
  onQuickAddScene,
  onRefreshScenes,
  onCollapse,
}: Props) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeCat, setActiveCat] = useState<CategoryTab>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [previewClip, setPreviewClip] = useState<VideoClip | null>(null);
  const [applyingClipName, setApplyingClipName] = useState<string | null>(null);
  const [appliedClipName, setAppliedClipName] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const loadClips = () => {
    setLoading(true);
    api
      .listGlobalClips()
      .then(setClips)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadClips();
  }, []);

  const filteredClips = clips.filter((clip) => {
    if (activeCat === "all") return true;
    if (activeCat === "videos") return isVideoFile(clip.filename);
    if (activeCat === "images") return isImageFile(clip.filename);
    const cat = getClipCategory(clip.filename);
    return cat === activeCat;
  });

  const processFiles = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(
      (f) =>
        f.type.startsWith("video/") ||
        f.type.startsWith("image/") ||
        /\.(mp4|mov|webm|mkv|avi|m4v|png|jpg|jpeg|webp)$/i.test(f.name)
    );
    if (validFiles.length === 0) {
      alert("Please upload valid video or image files (.mp4, .mov, .webm, .mkv, .png, .jpg, .jpeg, .webp)");
      return;
    }
    setUploading(true);
    try {
      for (const file of validFiles) {
        await api.uploadGlobalClip(file);
      }
      loadClips();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Media upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processFiles(e.target.files);
    }
  };

  const handleRename = async (clip: VideoClip, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === clip.name) {
      setEditingFilename(null);
      return;
    }
    try {
      const updated = await api.renameGlobalClip(clip.filename, trimmed);
      setClips((prev) => prev.map((c) => (c.filename === clip.filename ? updated : c)));
      if (previewClip && previewClip.filename === clip.filename) {
        setPreviewClip(updated);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename media file");
    } finally {
      setEditingFilename(null);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete "${filename}" from global gallery?`)) return;
    try {
      await api.deleteGlobalClip(filename);
      setClips((prev) => prev.filter((c) => c.filename !== filename));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleApplyToScene = async (clip: VideoClip) => {
    const key = `scene-${clip.name}`;
    setApplyingClipName(key);
    try {
      const isImg = isImageFile(clip.filename);
      const targetScene = (activeSceneIdx !== undefined && scenes[activeSceneIdx]) ? scenes[activeSceneIdx] : scenes[0];
      if (targetScene) {
        if (onUpdateSceneMedia) {
          await onUpdateSceneMedia(targetScene.id, clip.file_path, !isImg);
        } else {
          await api.updateScene(targetScene.id, isImg ? { image_path: clip.file_path, video_path: "" } : { video_path: clip.file_path, image_path: "" });
          if (onRefreshScenes) await onRefreshScenes();
        }
      } else {
        if (onQuickAddScene) {
          await onQuickAddScene();
        } else {
          await api.createScene(projectId, {
            narration: `${clip.name} (Global Gallery)`,
            video_prompt: clip.name,
          });
          if (onRefreshScenes) await onRefreshScenes();
        }
      }
      setAppliedClipName(key);
      setTimeout(() => setAppliedClipName(null), 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to apply media to scene");
    } finally {
      setApplyingClipName(null);
    }
  };

  const handleAddToTimeline = async (clip: VideoClip) => {
    const key = `timeline-${clip.name}`;
    setApplyingClipName(key);
    try {
      if (onAddClipToTimeline) {
        await onAddClipToTimeline(clip);
      }
      setAppliedClipName(key);
      setTimeout(() => setAppliedClipName(null), 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add clip to timeline");
    } finally {
      setApplyingClipName(null);
    }
  };

  return (
    <div
      className={`card gallery-root ${isDraggingOver ? "is-dragover" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
          setIsDraggingOver(true);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current <= 0) {
          dragCounterRef.current = 0;
          setIsDraggingOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDraggingOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          void processFiles(e.dataTransfer.files);
        }
      }}
    >
      <StepHeader title="Gallery" count={clips.length} onCollapse={onCollapse} />

      {/* Dynamic Drag & Drop Overlay */}
      {isDraggingOver && (
        <div className="gallery-drag-overlay">
          <div className="gallery-drag-overlay-content">
            <Upload size={36} />
            <span>Drop video or image files here to upload to Gallery</span>
            <span className="gallery-drag-overlay-sub">(.mp4, .mov, .webm, .png, .jpg, .webp)</span>
          </div>
        </div>
      )}

      {/* Uploading progress banner */}
      {uploading && (
        <div className="gallery-uploading-banner">
          <Upload size={14} className="gallery-spin-icon" />
          <span>Uploading media file(s)...</span>
        </div>
      )}

      <div className="gallery-actions-bar">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%" }}>
          <Tabs
            value={activeCat}
            options={[
              { label: "All Media", value: "all", count: clips.length },
              { label: "Videos", value: "videos", count: clips.filter((c) => isVideoFile(c.filename)).length },
              { label: "Images", value: "images", count: clips.filter((c) => isImageFile(c.filename)).length },
              { label: "Hooks & Intros", value: "hook", count: clips.filter((c) => getClipCategory(c.filename) === "hook").length },
              { label: "Ending & CTAs", value: "cta", count: clips.filter((c) => getClipCategory(c.filename) === "cta").length },
              { label: "Backgrounds", value: "background", count: clips.filter((c) => getClipCategory(c.filename) === "background").length },
              { label: "Other", value: "other", count: clips.filter((c) => getClipCategory(c.filename) === "other").length },
            ]}
            onChange={(val) => setActiveCat(val as CategoryTab)}
            style={{ width: "100%" }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem", width: "100%" }}>
            {/* View Mode Toggle */}
            <div style={{ display: "flex", gap: "2px", background: "var(--surface-light, rgba(255,255,255,0.05))", padding: "2px", borderRadius: "6px", border: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="2-Column Compact Grid View"
                style={{
                  padding: "3px 7px",
                  borderRadius: "4px",
                  border: "none",
                  background: viewMode === "grid" ? "var(--primary)" : "transparent",
                  color: viewMode === "grid" ? "#fff" : "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.7rem",
                  fontWeight: viewMode === "grid" ? 600 : 400,
                }}
              >
                <LayoutGrid size={12} /> Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="1-Column Large View"
                style={{
                  padding: "3px 7px",
                  borderRadius: "4px",
                  border: "none",
                  background: viewMode === "list" ? "var(--primary)" : "transparent",
                  color: viewMode === "list" ? "#fff" : "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.7rem",
                  fontWeight: viewMode === "list" ? 600 : 400,
                }}
              >
                <List size={12} /> Large
              </button>
            </div>

            <button
              type="button"
              className="btn-primary gallery-upload-btn"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={13} /> {uploading ? "Uploading..." : "Upload Media"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,image/*,.mp4,.mov,.webm,.mkv,.png,.jpg,.jpeg,.webp"
              onChange={handleUpload}
              style={{ display: "none" }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="gallery-empty">
          <p style={{ margin: 0 }}>Loading global gallery items...</p>
        </div>
      ) : (
        <div className={`gallery-grid ${viewMode === "list" ? "is-list" : "is-grid"}`}>
          {filteredClips.length > 0 ? (
            filteredClips.map((clip) => {
              const cat = getClipCategory(clip.filename);
              const src = mediaUrl(clip.file_path);
              const isImg = isImageFile(clip.filename);
              return (
                <div key={clip.filename} className="gallery-card">
                  <div className="gallery-thumb-wrap" onClick={() => setPreviewClip(clip)}>
                    {isImg ? (
                      <img src={src} className="gallery-video-thumb" alt={clip.name} style={{ objectFit: "cover" }} />
                    ) : (
                      <video src={src} className="gallery-video-thumb" preload="metadata" muted />
                    )}
                    <div className="gallery-play-overlay">
                      <div className="gallery-play-icon">
                        <Play size={18} fill="#fff" />
                      </div>
                    </div>
                    <span className={`gallery-badge ${isImg ? "image" : cat}`} style={isImg ? { background: "rgba(168, 85, 247, 0.85)" } : undefined}>
                      {isImg ? "📷 Image" : cat === "hook" ? "Hook" : cat === "cta" ? "CTA / Outro" : cat === "background" ? "BG" : "Video"}
                    </span>
                    <span className="gallery-duration">
                      {isImg ? "Image" : formatDuration(clip.duration_seconds)}
                    </span>
                  </div>

                  <div className="gallery-info">
                    {editingFilename === clip.filename ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", margin: "2px 0" }}>
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(clip, editNameValue);
                            if (e.key === "Escape") setEditingFilename(null);
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(0,0,0,0.5)",
                            border: "1px solid var(--primary)",
                            color: "#fff",
                            width: "100%",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRename(clip, editNameValue)}
                          style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", padding: "2px" }}
                          title="Save Name"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingFilename(null)}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                          title="Cancel"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                        <div className="gallery-title" title={clip.name} style={{ flex: 1 }}>
                          {clip.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFilename(clip.filename);
                            setEditNameValue(clip.name);
                          }}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", opacity: 0.7, flexShrink: 0 }}
                          title="Rename file"
                        >
                          <Pencil size={11} />
                        </button>
                      </div>
                    )}
                    <div className="gallery-meta">
                      {clip.width && clip.height ? <span>{clip.width}x{clip.height}</span> : null}
                      <span>{formatBytes(clip.size_bytes)}</span>
                    </div>

                    <div className="gallery-card-actions">
                      <button
                        className="btn-secondary gallery-card-btn"
                        onClick={() => handleApplyToScene(clip)}
                        disabled={applyingClipName === `scene-${clip.name}`}
                        title={`Apply to Scene ${activeSceneIdx + 1}`}
                        style={{ flex: 1, fontSize: "0.62rem" }}
                      >
                        {applyingClipName === `scene-${clip.name}` ? (
                          "Applying..."
                        ) : appliedClipName === `scene-${clip.name}` ? (
                          <>
                            <Check size={10} /> Applied
                          </>
                        ) : (
                          <>
                            <Check size={10} /> Use
                          </>
                        )}
                      </button>
                      <button
                        className="btn-primary gallery-card-btn"
                        onClick={() => handleAddToTimeline(clip)}
                        disabled={applyingClipName === `timeline-${clip.name}`}
                        title="Insert as new clip on timeline at current playhead position"
                        style={{ flex: 1, fontSize: "0.62rem" }}
                      >
                        {applyingClipName === `timeline-${clip.name}` ? (
                          "Adding..."
                        ) : appliedClipName === `timeline-${clip.name}` ? (
                          <>
                            <Check size={10} /> Added
                          </>
                        ) : (
                          <>
                            <Plus size={10} /> Add
                          </>
                        )}
                      </button>
                      <button
                        className="btn-secondary gallery-card-btn"
                        style={{ color: "var(--danger)", flex: "0 0 auto", padding: "0.28rem 0.35rem" }}
                        onClick={() => handleDelete(clip.filename)}
                        title="Remove item from global gallery"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="gallery-empty">
              <Film size={32} opacity={0.5} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem" }}>
                No reusable media items in this category
              </p>
              <p style={{ margin: 0, fontSize: "0.72rem" }}>
                Upload video clips, intro hooks, channel logos, or background images to use across all projects.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Media Preview Modal */}
      {previewClip && (
        <div className="gallery-modal-overlay" onClick={() => setPreviewClip(null)}>
          <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-modal-header">
              {editingFilename === previewClip.filename ? (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
                  <input
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(previewClip, editNameValue);
                      if (e.key === "Escape") setEditingFilename(null);
                    }}
                    autoFocus
                    style={{ flex: 1, fontSize: "0.85rem", padding: "3px 8px", borderRadius: "4px", background: "rgba(0,0,0,0.5)", border: "1px solid var(--primary)", color: "#fff" }}
                  />
                  <button onClick={() => handleRename(previewClip, editNameValue)} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer" }}>
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingFilename(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="gallery-modal-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{previewClip.name}</span>
                  <button
                    onClick={() => {
                      setEditingFilename(previewClip.filename);
                      setEditNameValue(previewClip.name);
                    }}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                    title="Rename"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}
              <button onClick={() => setPreviewClip(null)} className="seo-icon-btn">
                <X size={14} />
              </button>
            </div>
            <div className="gallery-modal-body" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
              {isImageFile(previewClip.filename) ? (
                <img
                  src={mediaUrl(previewClip.file_path)}
                  alt={previewClip.name}
                  style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: "8px" }}
                />
              ) : (
                <video
                  src={mediaUrl(previewClip.file_path)}
                  className="gallery-video-player"
                  controls
                  autoPlay
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
