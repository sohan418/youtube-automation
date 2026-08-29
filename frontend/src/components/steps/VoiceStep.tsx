import { useEffect, useState, useRef } from "react";
import {
  Mic,
  Pause,
  Play,
  Sparkles,
  X,
  Volume2,
  CheckCircle2,
  Upload,
  Download,
} from "lucide-react";
import type { Scene, VoiceProvider } from "../../types";
import Select from "../ui/Select";
import "./VoiceStep.css";

const WAVEFORM_HEIGHTS = [
  8, 12, 16, 8, 4, 16, 24, 32, 20, 12, 24, 36, 28, 16, 8, 20, 32, 24, 16, 8,
  12, 20, 28, 24, 16, 8, 12, 24, 32, 28, 20, 12, 8, 16, 24, 16, 8, 4, 8, 12
];


// ── Task #4: Compact Audio Player ────────────────────────────────────────────
function CustomAudioPlayer({ src, audioVersionKey }: { src: string; audioVersionKey: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [src, audioVersionKey]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time <= 0) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleWaveClick = (index: number) => {
    if (!audioRef.current || duration <= 0) return;
    const newTime = ((index + 1) / WAVEFORM_HEIGHTS.length) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    // Removed marginTop/marginBottom — parent gap handles spacing (#4)
    // Tightened padding from 0.55rem 0.85rem → 0.4rem 0.7rem (#4)
    <div className="voice-player">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
      />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className="voice-play-btn"
      >
        {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" className="voice-play-icon" />}
      </button>

      {/* Current Time */}
      <span className="voice-player-time voice-player-time-right">
        {formatTime(currentTime)}
      </span>

      {/* Visual Waveform Tracker */}
      <div
        className="voice-waveform"
      >
        {WAVEFORM_HEIGHTS.map((h, i) => {
          const percent = ((i + 1) / WAVEFORM_HEIGHTS.length) * 100;
          const active = percent <= progress;
          return (
            <div
              key={i}
              onClick={() => handleWaveClick(i)}
              className="voice-wave-bar"
              style={{
                height: `${h}px`,
                background: active ? "var(--primary)" : "rgba(255, 255, 255, 0.15)",
              }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className="voice-player-time">
        {formatTime(duration)}
      </span>

      {/* Volume Icon */}
      <Volume2 size={15} color="var(--text-muted)" className="voice-volume-icon" />
      {/* MoreVertical removed — was non-functional decoration */}
    </div>
  );
}

interface Props {
  scenes: Scene[];
  activeIdx: number;
  setActiveIdx: React.Dispatch<React.SetStateAction<number>>;
  actionLoading: string;
  voiceProviders: VoiceProvider[];
  selectedProvider: string;
  onProviderChange: (id: string) => void;
  selectedVoice: string;
  onVoiceChange: (v: string) => void;
  selectedVoiceRate: string;
  onVoiceRateChange: (v: string) => void;
  voiceProgress: string;
  onGenerateAll: () => void;
  onGenerateScene: (sceneId: number) => void;
  recordingSceneId: number | null;
  recordingSeconds: number;
  recordingPaused: boolean;
  micLevel: number;
  onToggleRecordingPause: () => void;
  onStopRecording: () => void;
  onStartRecording: (sceneId: number) => void;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelected: (sceneId: number, file: File) => void;
  onClearAudio: (sceneId: number) => void;
  onCombineAudioPreview: () => void;
  onDownloadCombinedAudio: () => void;
  audioPreviewUrl: string | null;
  mediaUrl: (p: string) => string;
  audioVersion: Record<number, number>;
  formatRecordTime: (s: number) => string;
}

export default function VoiceStep({
  scenes,
  activeIdx,
  setActiveIdx,
  actionLoading,
  voiceProviders,
  selectedProvider,
  onProviderChange,
  selectedVoice,
  onVoiceChange,
  selectedVoiceRate,
  onVoiceRateChange,
  voiceProgress,
  onGenerateAll,
  onGenerateScene,
  recordingSceneId,
  recordingSeconds,
  recordingPaused,
  micLevel,
  onToggleRecordingPause,
  onStopRecording,
  onStartRecording,
  audioInputRef,
  onFileSelected,
  onClearAudio,
  onCombineAudioPreview,
  onDownloadCombinedAudio,
  audioPreviewUrl,
  mediaUrl,
  audioVersion,
  formatRecordTime,
}: Props) {
  const currentProvider = voiceProviders.find((p) => p.id === selectedProvider);
  const currentVoices = currentProvider?.voices || [];
  const providerLabel = currentProvider?.name || selectedProvider || "gemini";
  const [audioTargetSceneId, setAudioTargetSceneId] = useState<number | null>(null);

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
  }, [scenes.length, setActiveIdx]);

  const activeScene = scenes[activeIdx];
  const hasVoiceKeys = currentProvider?.key_configured;

  return (
    <div className="voice-step">
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg"
        hidden
        onChange={(e) => {
          const sceneId = audioTargetSceneId;
          setAudioTargetSceneId(null);
          const file = e.target.files?.[0];
          e.target.value = "";
          if (sceneId != null && file) onFileSelected(sceneId, file);
        }}
      />

      <div className="card voice-header-card">
        <div className="voice-header-row">
          <span className="voice-title">
            <Mic size={13} /> Voice
          </span>

          <Select
            value={selectedProvider}
            disabled={!!actionLoading}
            onChange={(v) => onProviderChange(String(v))}
            size="sm"
            options={
              voiceProviders.length === 0
                ? [{ label: "Google Gemini", value: "gemini" }]
                : voiceProviders.map((p) => ({ label: p.name, value: p.id }))
            }
            style={{ flex: 1, minWidth: "105px" }}
          />

          <Select
            value={selectedVoice}
            disabled={!!actionLoading}
            onChange={(v) => onVoiceChange(String(v))}
            size="sm"
            options={
              currentVoices.length === 0
                ? [{ label: "Kore", value: "Kore" }]
                : [...(currentVoices.includes(selectedVoice) ? [] : [selectedVoice]), ...currentVoices].map((voice) => ({
                    label: currentProvider?.voice_labels?.[voice] ?? voice,
                    value: voice,
                  }))
            }
            style={{ flex: 1, minWidth: "110px" }}
          />

          <Select
            value={selectedVoiceRate}
            disabled={!!actionLoading}
            onChange={(v) => onVoiceRateChange(String(v))}
            size="sm"
            title={currentProvider?.id === "gemini" ? "Gemini TTS does not support speed control" : "Speed"}
            options={["-50%", "-25%", "+0%", "+10%", "+20%", "+30%", "+40%", "+50%", "+75%", "+100%"].map((rate) => ({
              label: rate,
              value: rate,
              disabled: currentProvider?.id === "gemini" && rate !== "+0%",
            }))}
            style={{ width: "66px" }}
          />

          <button
            className="btn-primary voice-generate-btn"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={onGenerateAll}
          >
            <Sparkles size={11} />
            {actionLoading === "voice" ? "Generating..." : "Generate All"}
          </button>
        </div>

        {voiceProgress && (
          <p className="voice-progress-text">
            {voiceProgress}
          </p>
        )}
      </div>

      {scenes.length > 0 && activeScene && (
        <div
          className="card voice-scene-card"
        >
          <div className="voice-scene-header">
            <h3 className="voice-scene-title">
              Scene {(activeIdx + 1).toString().padStart(2, "0")} <span className="voice-scene-count">/ {scenes.length.toString().padStart(2, "0")}</span>
            </h3>
            <span
              className="voice-audio-status"
              style={{
                background: activeScene.audio_path ? "var(--bg)" : "transparent",
                color: activeScene.audio_path ? "var(--success)" : "var(--text-muted)",
                border: `1px solid ${activeScene.audio_path ? "var(--success)" : "var(--border)"}`,
              }}
            >
              {activeScene.audio_path && <CheckCircle2 size={9} />}
              {activeScene.audio_path ? "Audio Ready" : "No Audio"}
            </span>
          </div>

          <div
            className="voice-narration-box"
          >
            <p
              className="voice-narration-text"
            >
              {activeScene.narration}
            </p>
          </div>

          {audioPreviewUrl && (
            <div className="voice-preview-box">
              <div className="voice-preview-header">
                <span className="voice-preview-title">🎧 Full Audio Preview</span>
                <span className="voice-preview-sub">All scenes combined</span>
              </div>
              <CustomAudioPlayer src={audioPreviewUrl} audioVersionKey={0} />
              <button
                onClick={onDownloadCombinedAudio}
                disabled={!!actionLoading}
                className="voice-download-btn"
              >
                <Download size={13} />
                Download Combined Audio
              </button>
            </div>
          )}

          <button
            onClick={onCombineAudioPreview}
            disabled={!!actionLoading || scenes.length === 0}
            className="voice-preview-all-btn"
          >
            <Volume2 size={13} />
            {actionLoading === "audio-preview" ? "Combining..." : "Preview All Audio"}
          </button>

          {activeScene.audio_path ? (
            <CustomAudioPlayer
              src={`${mediaUrl(activeScene.audio_path)}?v=${audioVersion[activeScene.id] || 0}`}
              audioVersionKey={audioVersion[activeScene.id] || 0}
            />
          ) : (
            <div className="voice-no-audio">
              Choose an audio source below to add voiceover
            </div>
          )}

          <div>
            <h4 className="voice-source-title">
              Audio Source
            </h4>

            {recordingSceneId === activeScene.id ? (
              <div className="voice-recording-box">
                <div className="voice-recording-col">
                  <div className="voice-meter-track">
                    <div style={{ width: `${micLevel}%`, height: "100%", background: micLevel > 4 ? "var(--success)" : "var(--primary)", transition: "width 100ms linear" }} />
                  </div>
                  <span className="voice-recording-label">
                    {recordingPaused ? "Recording Paused" : "Listening…"}
                  </span>
                </div>

                <span className="voice-recording-time">
                  <Pause size={10} />
                  {formatRecordTime(recordingSeconds)}
                </span>

                <button className="btn-secondary voice-rec-pause-btn" onClick={onToggleRecordingPause}>
                  {recordingPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={onStopRecording}
                  className="voice-rec-stop-btn"
                >
                  ■ Stop
                </button>
              </div>
            ) : (
              <div className="voice-source-grid">
                <div
                  onClick={() => onStartRecording(activeScene.id)}
                  className="voice-source-card voice-source-card-record"
                >
                  <div className="voice-source-chip voice-source-chip-danger">
                    <Mic size={18} />
                  </div>
                  <div className="voice-source-text">
                    <div className="voice-source-name">Record Voice</div>
                    <div className="voice-source-sub">Use microphone</div>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setAudioTargetSceneId(activeScene.id);
                    audioInputRef.current?.click();
                  }}
                  className="voice-source-card voice-source-card-upload"
                >
                  <div className="voice-source-chip voice-source-chip-success">
                    <Upload size={16} />
                  </div>
                  <div className="voice-source-text">
                    <div className="voice-source-name">Upload Audio</div>
                    <div className="voice-source-sub">MP3 / WAV</div>
                  </div>
                </div>

                <div
                  onClick={() => onGenerateScene(activeScene.id)}
                  className={`voice-source-card voice-source-card-generate ${hasVoiceKeys ? "voice-source-has" : ""}`}
                >
                  <div className="voice-source-chip voice-source-chip-primary">
                    <Sparkles size={16} />
                  </div>
                  <div className="voice-source-text">
                    <div className="voice-source-name">Generate AI</div>
                    <div className="voice-source-sub-ellipsis">{providerLabel} TTS</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeScene.audio_path && (
            <button
              onClick={() => onClearAudio(activeScene.id)}
              disabled={!!actionLoading}
              className="voice-clear-btn"
            >
              <X size={10} /> Clear Audio
            </button>
          )}

          <div className="voice-footer">
            <button
              className="btn-secondary voice-nav-btn"
              disabled={activeIdx <= 0}
              onClick={() => setActiveIdx(activeIdx - 1)}
            >
              ← Prev
            </button>

            <span className="voice-pager">
              {(activeIdx + 1).toString().padStart(2, "0")} / {scenes.length.toString().padStart(2, "0")}
            </span>

            <button
              disabled={activeIdx >= scenes.length - 1}
              onClick={() => setActiveIdx(activeIdx + 1)}
              className="voice-next-btn"
              style={{
                background: activeIdx >= scenes.length - 1 ? "var(--border)" : "var(--primary)",
                color: activeIdx >= scenes.length - 1 ? "var(--text-muted)" : "white",
                cursor: activeIdx >= scenes.length - 1 ? "not-allowed" : "pointer",
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
