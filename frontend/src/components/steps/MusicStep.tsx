import { useEffect, useRef, useState } from "react";
import { Music, Upload, Trash2, Play, Pause, Clock, HardDrive, Plus, Check, Pencil, X } from "lucide-react";
import type { MusicTrack } from "../../types";
import { api, mediaUrl } from "../../api/client";
import StepHeader from "../studio/StepHeader";
import Tabs from "../ui/Tabs";
import "./MusicStep.css";

interface Props {
  onAddToTimeline?: (track: MusicTrack, targetTrack?: "music" | "sfx") => void;
  activeMusicPath?: string | null;
  onCollapse?: () => void;
}

type MusicCategoryTab = "all" | "background" | "upbeat" | "cinematic" | "short" | "other";

function getMusicCategory(filename: string, durationSeconds: number | null): MusicCategoryTab {
  const f = filename.toLowerCase();
  if (durationSeconds && durationSeconds < 30) return "short";
  if (f.includes("bg") || f.includes("background") || f.includes("ambient") || f.includes("lofi") || f.includes("chill") || f.includes("soft")) return "background";
  if (f.includes("upbeat") || f.includes("dance") || f.includes("pop") || f.includes("fast") || f.includes("hype") || f.includes("synth") || f.includes("beat") || f.includes("energetic")) return "upbeat";
  if (f.includes("cinematic") || f.includes("epic") || f.includes("dramatic") || f.includes("trailer") || f.includes("orchestral") || f.includes("action")) return "cinematic";
  return "other";
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MusicStep({ onAddToTimeline, activeMusicPath, onCollapse }: Props) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [justAddedPath, setJustAddedPath] = useState<string | null>(null);
  const [editingFilename, setEditingFilename] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [activeCat, setActiveCat] = useState<MusicCategoryTab>("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTracks = () => {
    api.listGlobalMusic().then(setTracks).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadTracks(); }, []);

  const filteredTracks = tracks.filter((track) => {
    if (activeCat === "all") return true;
    if (activeCat === "short") return track.duration_seconds && track.duration_seconds < 30;
    const cat = getMusicCategory(track.filename, track.duration_seconds);
    return cat === activeCat;
  });

  const handleRenameTrack = async (track: MusicTrack, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === track.name) {
      setEditingFilename(null);
      return;
    }
    try {
      const updated = await api.renameGlobalMusic(track.filename, trimmed);
      setTracks((prev) => prev.map((t) => (t.filename === track.filename ? updated : t)));
      if (playing === track.file_path) {
        setPlaying(updated.file_path);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename music track");
    } finally {
      setEditingFilename(null);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      await api.uploadGlobalMusic(file);
      loadTracks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handleDelete = async (filename: string) => {
    if (!confirm("Delete this music track?")) return;
    try {
      await api.deleteGlobalMusic(filename);
      loadTracks();
    } catch {}
  };

  const releaseAudio = () => {
    const current = audioRef.current;
    if (current) {
      current.pause();
      current.removeAttribute("src");
      current.load();
      audioRef.current = null;
    }
  };

  const togglePlay = (track: MusicTrack) => {
    const current = audioRef.current;
    if (playing === track.file_path && current) {
      if (current.paused) {
        current.play().catch(() => {});
        setPaused(false);
      } else {
        current.pause();
        setPaused(true);
      }
      return;
    }
    releaseAudio();
    const audio = new Audio(mediaUrl(track.file_path));
    audioRef.current = audio;
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("ended", () => { setPlaying(null); setPaused(false); setCurrentTime(0); });
    audio.play().catch(() => {});
    setPlaying(track.file_path);
    setPaused(false);
    setCurrentTime(0);
  };

  useEffect(() => () => releaseAudio(), []);

  return (
    <div className="music-step">
      <StepHeader
        title="Music Library"
        subtitle=""
        onCollapse={onCollapse}
      />

      {/* Category Filter Tabs */}
      <Tabs
        value={activeCat}
        onChange={(val) => setActiveCat(val as MusicCategoryTab)}
        options={[
          { label: "All Tracks", value: "all", count: tracks.length },
          { label: "Background & Chill", value: "background", count: tracks.filter((t) => getMusicCategory(t.filename, t.duration_seconds) === "background").length },
          { label: "Upbeat & Energy", value: "upbeat", count: tracks.filter((t) => getMusicCategory(t.filename, t.duration_seconds) === "upbeat").length },
          { label: "Cinematic & Epic", value: "cinematic", count: tracks.filter((t) => getMusicCategory(t.filename, t.duration_seconds) === "cinematic").length },
          { label: "Short Clips (<30s)", value: "short", count: tracks.filter((t) => t.duration_seconds && t.duration_seconds < 30).length },
          { label: "Other", value: "other", count: tracks.filter((t) => getMusicCategory(t.filename, t.duration_seconds) === "other").length },
        ]}
        style={{ margin: "0.5rem 0 0.8rem 0", width: "100%" }}
      />

      {/* Upload area with Drag and Drop */}
      <div
        className={`music-upload-zone card ${isDragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleUpload}
          hidden
        />
        <Upload size={22} color={isDragging ? "var(--primary)" : "var(--text-muted)"} className="music-upload-icon" />
        <div className="music-upload-title">
          {uploading ? "Uploading music..." : isDragging ? "Drop your audio file here!" : "Drag & drop audio here or click to browse"}
        </div>
        <div className="music-upload-hint">
          Supports MP3, WAV, M4A, AAC, OGG, FLAC
        </div>
      </div>

      {/* Track list */}
      {loading ? (
        <div className="empty-state">
          <Music size={40} strokeWidth={1.5} className="music-empty-icon" />
          <div className="empty-state-desc">Loading music library...</div>
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="empty-state">
          <Music size={40} strokeWidth={1.5} className="music-empty-icon" />
          <div className="empty-state-title">
            {tracks.length === 0 ? "No music tracks yet" : "No tracks in this category"}
          </div>
          <div className="empty-state-desc">
            {tracks.length === 0 ? "Upload audio files to build your global music library." : "Try selecting another category tab or upload a new track."}
          </div>
        </div>
      ) : (
        <div className="music-list">
          {filteredTracks.map((track) => (
            <div
              key={track.filename}
              className={`card music-item ${playing === track.file_path ? "playing" : ""}`}
            >
              {/* Play button */}
              <button
                onClick={() => togglePlay(track)}
                className={`music-play-btn ${playing === track.file_path ? "playing" : ""}`}
                title={playing === track.file_path && !paused ? "Pause preview" : "Play preview"}
              >
                {playing === track.file_path && !paused ? (
                  <Pause size={30} fill="#fff" color="#fff" />
                ) : (
                  <Play size={30} fill="#fff" color="#fff" />
                )}
              </button>

              {/* Track info */}
              <div className="music-info">
                {editingFilename === track.filename ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameTrack(track, editNameValue);
                        if (e.key === "Escape") setEditingFilename(null);
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        fontSize: "0.8rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(0,0,0,0.5)",
                        border: "1px solid var(--primary)",
                        color: "#fff",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRenameTrack(track, editNameValue)}
                      style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", padding: "2px" }}
                      title="Save Name"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingFilename(null)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div className="music-name">{track.name}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFilename(track.filename);
                        setEditNameValue(track.name);
                      }}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", opacity: 0.7 }}
                      title="Rename music track"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                )}
                <div className="music-meta">
                  <span className="music-meta-item">
                    <Clock size={13} /> {formatDuration(track.duration_seconds)}
                  </span>
                  <span className="music-meta-item">
                    <HardDrive size={13} /> {formatSize(track.size_bytes)}
                  </span>
                </div>
              </div>

              {/* Progress bar when playing */}
              {playing === track.file_path && duration > 0 && (
                <div className="music-progress">
                  <div className="music-progress-fill" style={{ width: `${(currentTime / duration) * 100}%` }} />
                </div>
              )}

              {/* Actions */}
              <div className="music-actions" style={{ display: "flex", gap: "4px" }}>
                {onAddToTimeline && (
                  (() => {
                    const isCurrent = activeMusicPath === track.file_path || justAddedPath === track.file_path;
                    return (
                      <>
                        <button
                          className={isCurrent ? "btn-primary music-add-btn" : "btn-primary music-add-btn"}
                          onClick={() => {
                            onAddToTimeline(track, "music");
                            setJustAddedPath(track.file_path);
                            setTimeout(() => setJustAddedPath(null), 1500);
                          }}
                          title="Add to Music track at playhead"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}
                        >
                          {isCurrent ? <Check size={11} /> : <Plus size={11} />} Music
                        </button>
                        <button
                          className="btn-secondary music-add-btn"
                          onClick={() => {
                            onAddToTimeline(track, "sfx");
                            setJustAddedPath(track.file_path);
                            setTimeout(() => setJustAddedPath(null), 1500);
                          }}
                          title="Add to SFX track at playhead"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}
                        >
                          <Plus size={11} /> SFX
                        </button>
                      </>
                    );
                  })()
                )}
                <button
                  className="btn-secondary music-delete-btn"
                  onClick={() => handleDelete(track.filename)}
                  title="Delete track"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
