import { useState, useEffect } from "react";
import { X, Film, Check, Trash2, Upload } from "lucide-react";
import type { VideoClip } from "../../types";
import { api, mediaUrl } from "../../api/client";
import Tabs from "../ui/Tabs";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectClip: (clip: VideoClip) => void;
  title?: string;
  sceneId?: number;
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

function getClipCategory(filename: string): "hook" | "cta" | "background" | "other" {
  const f = filename.toLowerCase();
  if (f.includes("hook") || f.includes("intro") || f.includes("start")) return "hook";
  if (f.includes("cta") || f.includes("end") || f.includes("outro") || f.includes("sub") || f.includes("like") || f.includes("subscribe")) return "cta";
  if (f.includes("bg") || f.includes("back") || f.includes("loop")) return "background";
  return "other";
}

export default function GalleryPickerModal({
  isOpen,
  onClose,
  onSelectClip,
  title = "Select Media from Gallery",
  sceneId,
}: Props) {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeCat, setActiveCat] = useState<CategoryTab>("all");
  const [selectedClip, setSelectedClip] = useState<VideoClip | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api
      .listGlobalClips()
      .then(setClips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const file = files[0];
      const isImg = isImageFile(file.name);
      if (sceneId) {
        if (isImg) {
          await api.uploadSceneImage(sceneId, file);
        } else {
          await api.uploadSceneVideo(sceneId, file);
        }
      }
      const newClip = await api.uploadGlobalClip(file);
      const updatedClips = await api.listGlobalClips();
      setClips(updatedClips);
      onSelectClip(newClip);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload file to scene and gallery");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const filteredClips = clips.filter((clip) => {
    if (activeCat === "all") return true;
    if (activeCat === "videos") return isVideoFile(clip.filename);
    if (activeCat === "images") return isImageFile(clip.filename);
    return getClipCategory(clip.filename) === activeCat;
  });

  const handleConfirm = () => {
    if (selectedClip) {
      onSelectClip(selectedClip);
      onClose();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      let lastClip: VideoClip | null = null;
      for (const file of files) {
        const isImg = isImageFile(file.name);
        const isVid = isVideoFile(file.name);
        if (isImg || isVid) {
          if (sceneId) {
            if (isImg) {
              await api.uploadSceneImage(sceneId, file);
            } else {
              await api.uploadSceneVideo(sceneId, file);
            }
          }
          lastClip = await api.uploadGlobalClip(file);
        }
      }
      if (lastClip) {
        const updatedClips = await api.listGlobalClips();
        setClips(updatedClips);
        onSelectClip(lastClip);
        onClose();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload dropped media");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(4px)",
        zIndex: 650,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          overflow: "hidden",
          padding: "1rem",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{title}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label
              className="btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.3rem 0.65rem",
                fontSize: "0.75rem",
                cursor: uploading ? "not-allowed" : "pointer",
                opacity: uploading ? 0.7 : 1,
              }}
            >
              <Upload size={13} />
              {uploading ? "Uploading..." : "Upload New File"}
              <input
                type="file"
                hidden
                accept="video/*,image/*"
                disabled={uploading}
                onChange={handleFileUpload}
              />
            </label>
            <button onClick={onClose} className="seo-icon-btn">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <Tabs
          value={activeCat}
          onChange={(val) => setActiveCat(val as CategoryTab)}
          options={[
            { label: "All", value: "all", count: clips.length },
            { label: "Videos", value: "videos", count: clips.filter((c) => isVideoFile(c.filename)).length },
            { label: "Images", value: "images", count: clips.filter((c) => isImageFile(c.filename)).length },
            { label: "Hooks & Intros", value: "hook", count: clips.filter((c) => getClipCategory(c.filename) === "hook").length },
            { label: "Ending & CTAs", value: "cta", count: clips.filter((c) => getClipCategory(c.filename) === "cta").length },
            { label: "Backgrounds", value: "background", count: clips.filter((c) => getClipCategory(c.filename) === "background").length },
            { label: "Other", value: "other", count: clips.filter((c) => getClipCategory(c.filename) === "other").length },
          ]}
          style={{ marginBottom: "0.8rem" }}
        />

        {/* Clip Grid */}
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: "0.65rem", paddingRight: "4px" }}>
          {loading ? (
            <div style={{ gridColumn: "1 / -1", padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Loading Gallery media...
            </div>
          ) : filteredClips.length > 0 ? (
            filteredClips.map((clip) => {
              const isSel = selectedClip?.filename === clip.filename;
              const cat = getClipCategory(clip.filename);
              const isImg = isImageFile(clip.filename);
              return (
                <div
                  key={clip.filename}
                  onClick={() => {
                    onSelectClip(clip);
                    onClose();
                  }}
                  style={{
                    border: isSel ? "2px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "8px",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "var(--surface)",
                    position: "relative",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ width: "100%", aspectRatio: "16/9", background: "#000", position: "relative" }}>
                    {isImg ? (
                      <img src={mediaUrl(clip.file_path)} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={clip.name} />
                    ) : (
                      <video src={mediaUrl(clip.file_path)} style={{ width: "100%", height: "100%", objectFit: "cover" }} preload="metadata" muted />
                    )}
                    <span className={`gallery-badge ${isImg ? "image" : cat}`} style={{ fontSize: "0.58rem", ...(isImg ? { background: "rgba(168, 85, 247, 0.85)" } : {}) }}>
                      {isImg ? "📷 Image" : cat === "hook" ? "Hook" : cat === "cta" ? "CTA" : cat === "background" ? "BG" : "Video"}
                    </span>
                    <span className="gallery-duration">{isImg ? "Image" : formatDuration(clip.duration_seconds)}</span>
                    {isSel && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(99, 102, 241, 0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ background: "var(--primary)", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                          <Check size={18} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "0.5rem", fontSize: "0.72rem", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {clip.name}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ gridColumn: "1 / -1", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
              <Film size={28} opacity={0.5} style={{ marginBottom: "0.4rem" }} />
              <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>No clips in this category</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
          {selectedClip ? (
            <button
              className="btn-secondary"
              style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem" }}
              onClick={async () => {
                if (!window.confirm(`Remove "${selectedClip.name}" from global gallery?`)) return;
                try {
                  await api.deleteGlobalClip(selectedClip.filename);
                  setClips((prev) => prev.filter((c) => c.filename !== selectedClip.filename));
                  setSelectedClip(null);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Failed to remove clip");
                }
              }}
            >
              <Trash2 size={13} /> Remove Clip
            </button>
          ) : <div />}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!selectedClip} onClick={handleConfirm}>
              Use Selected Clip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
