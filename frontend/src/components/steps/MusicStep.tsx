import { useEffect, useRef, useState } from "react";
import { Music, Upload, Trash2, Play, Pause, Clock, HardDrive, Plus } from "lucide-react";
import type { MusicTrack } from "../../types";
import { api, mediaUrl } from "../../api/client";
import "./MusicStep.css";

interface Props {
  onAddToTimeline?: (track: MusicTrack) => void;
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

export default function MusicStep({ onAddToTimeline }: Props) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTracks = () => {
    api.listGlobalMusic().then(setTracks).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadTracks(); }, []);

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
      {/* Header */}
      <div>
        <h2>Music Library</h2>
        <p className="music-step-subtitle">
          Global music tracks — available across all projects
        </p>
      </div>

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
      ) : tracks.length === 0 ? (
        <div className="empty-state">
          <Music size={40} strokeWidth={1.5} className="music-empty-icon" />
          <div className="empty-state-title">No music tracks yet</div>
          <div className="empty-state-desc">Upload audio files to build your global music library.</div>
        </div>
      ) : (
        <div className="music-list">
          {tracks.map((track) => (
            <div
              key={track.filename}
              className={`card music-item ${playing === track.file_path ? "playing" : ""}`}
            >
              {/* Play button */}
              <button
                onClick={() => togglePlay(track)}
                className={`music-play-btn ${playing === track.file_path ? "playing" : ""}`}
              >
                {playing === track.file_path && !paused ? <Pause size={14} /> : <Play size={14} className="music-play-icon" />}
              </button>

              {/* Track info */}
              <div className="music-info">
                <div className="music-name">
                  {track.name}
                </div>
                <div className="music-meta">
                  <span className="music-meta-item">
                    <Clock size={10} /> {formatDuration(track.duration_seconds)}
                  </span>
                  <span className="music-meta-item">
                    <HardDrive size={10} /> {formatSize(track.size_bytes)}
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
              <div className="music-actions">
                {onAddToTimeline && (
                  <button
                    className="btn-secondary music-add-btn"
                    onClick={() => onAddToTimeline(track)}
                    title="Add to timeline"
                  >
                    <Plus size={11} /> Add
                  </button>
                )}
                <button
                  className="btn-secondary music-delete-btn"
                  onClick={() => handleDelete(track.filename)}
                  title="Delete"
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
