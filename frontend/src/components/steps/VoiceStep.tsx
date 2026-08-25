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
    const newTime = (index / WAVEFORM_HEIGHTS.length) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    // Removed marginTop/marginBottom — parent gap handles spacing (#4)
    // Tightened padding from 0.55rem 0.85rem → 0.4rem 0.7rem (#4)
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "0.4rem 0.7rem",
        width: "100%",
      }}
    >
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
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          background: "var(--primary)",
          border: "none",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: "0 0 8px rgba(255, 0, 60, 0.2)",
          transition: "transform 0.15s ease",
          padding: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" style={{ marginLeft: "2px" }} />}
      </button>

      {/* Current Time */}
      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", width: "28px", textAlign: "right", flexShrink: 0 }}>
        {formatTime(currentTime)}
      </span>

      {/* Visual Waveform Tracker */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "2px",
          height: "26px",
          cursor: "pointer",
        }}
      >
        {WAVEFORM_HEIGHTS.map((h, i) => {
          const percent = (i / WAVEFORM_HEIGHTS.length) * 100;
          const active = percent <= progress;
          return (
            <div
              key={i}
              onClick={() => handleWaveClick(i)}
              style={{
                flex: 1,
                height: `${h}px`,
                borderRadius: "1px",
                background: active ? "var(--primary)" : "rgba(255, 255, 255, 0.15)",
                transition: "background 0.1s ease",
              }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", width: "28px", flexShrink: 0 }}>
        {formatTime(duration)}
      </span>

      {/* Volume Icon */}
      <Volume2 size={15} color="var(--text-muted)" style={{ cursor: "pointer", flexShrink: 0 }} />
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

  const sourceCardBase: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "0.9rem 1.1rem",
    minHeight: "78px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    display: "flex",
    alignItems: "center",
    gap: "0.85rem",
  };

  const sourceChip = (color: string): React.CSSProperties => ({
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color,
    flexShrink: 0,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", height: "100%", overflow: "hidden" }}>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg"
        style={{ display: "none" }}
        onChange={(e) => {
          const sceneId = audioTargetSceneId;
          setAudioTargetSceneId(null);
          const file = e.target.files?.[0];
          e.target.value = "";
          if (sceneId != null && file) onFileSelected(sceneId, file);
        }}
      />

      <div className="card" style={{ padding: "0.45rem 0.7rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
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
            className="btn-primary"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={onGenerateAll}
            style={{
              fontSize: "0.72rem",
              padding: "0.28rem 0.7rem",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            <Sparkles size={11} />
            {actionLoading === "voice" ? "Generating..." : "Generate All"}
          </button>
        </div>

        {voiceProgress && (
          <p style={{ color: "var(--primary)", fontSize: "0.68rem", margin: "0.25rem 0 0 0", fontWeight: 500 }}>
            {voiceProgress}
          </p>
        )}
      </div>

      {scenes.length > 0 && activeScene && (
        <div
          className="card"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            padding: "0.55rem 0.7rem",
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "0.82rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Scene {(activeIdx + 1).toString().padStart(2, "0")} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>/ {scenes.length.toString().padStart(2, "0")}</span>
            </h3>
            <span
              style={{
                fontSize: "0.62rem",
                background: activeScene.audio_path ? "var(--bg)" : "transparent",
                color: activeScene.audio_path ? "var(--success)" : "var(--text-muted)",
                border: `1px solid ${activeScene.audio_path ? "var(--success)" : "var(--border)"}`,
                padding: "0.12rem 0.4rem",
                borderRadius: "20px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.18rem",
              }}
            >
              {activeScene.audio_path && <CheckCircle2 size={9} />}
              {activeScene.audio_path ? "Audio Ready" : "No Audio"}
            </span>
          </div>

          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.4rem 0.6rem",
            }}
          >
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text)",
                lineHeight: 1.45,
                margin: 0,
                fontWeight: 500,
              }}
            >
              {activeScene.narration}
            </p>
          </div>

          {audioPreviewUrl && (
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.4rem 0.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--primary)" }}>🎧 Full Audio Preview</span>
                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>All scenes combined</span>
              </div>
              <CustomAudioPlayer src={audioPreviewUrl} audioVersionKey={0} />
              <button
                onClick={onDownloadCombinedAudio}
                disabled={!!actionLoading}
                style={{
                  marginTop: "0.4rem",
                  width: "100%",
                  padding: "0.3rem",
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  background: "var(--surface)",
                  border: "1px solid var(--success)",
                  color: "var(--success)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.35rem",
                }}
              >
                <Download size={13} />
                Download Combined Audio
              </button>
            </div>
          )}

          <button
            onClick={onCombineAudioPreview}
            disabled={!!actionLoading || scenes.length === 0}
            style={{
              width: "100%",
              padding: "0.35rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              background: "var(--surface)",
              border: "1px dashed var(--primary)",
              color: "var(--primary)",
              borderRadius: "8px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
            }}
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
            <div
              style={{
                textAlign: "center",
                padding: "0.35rem 0.6rem",
                border: "1px dashed var(--border)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "0.7rem",
              }}
            >
              Choose an audio source below to add voiceover
            </div>
          )}

          <div>
            <h4
              style={{
                fontSize: "0.62rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                marginBottom: "0.3rem",
                marginTop: 0,
                fontWeight: 700,
              }}
            >
              Audio Source
            </h4>

            {recordingSceneId === activeScene.id ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  background: "var(--bg)",
                  border: "1px solid var(--danger)",
                  borderRadius: "8px",
                  padding: "0.4rem 0.6rem",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.18rem", flex: 1 }}>
                  <div style={{ width: "100%", height: 4, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${micLevel}%`, height: "100%", background: micLevel > 4 ? "var(--success)" : "var(--primary)", transition: "width 100ms linear" }} />
                  </div>
                  <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                    {recordingPaused ? "Recording Paused" : "Listening…"}
                  </span>
                </div>

                <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: "0.18rem" }}>
                  <Pause size={10} />
                  {formatRecordTime(recordingSeconds)}
                </span>

                <button className="btn-secondary" onClick={onToggleRecordingPause} style={{ fontSize: "0.68rem", padding: "0.18rem 0.4rem" }}>
                  {recordingPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={onStopRecording}
                  style={{
                    fontSize: "0.68rem",
                    padding: "0.18rem 0.5rem",
                    background: "var(--danger)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ■ Stop
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
                <div
                  onClick={() => onStartRecording(activeScene.id)}
                  style={sourceCardBase}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--danger)";
                    e.currentTarget.style.background = "var(--bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--surface)";
                  }}
                >
                  <div style={sourceChip("var(--danger)")}>
                    <Mic size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>Record Voice</div>
                    <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Use microphone</div>
                  </div>
                </div>

                <div
                  onClick={() => {
                    setAudioTargetSceneId(activeScene.id);
                    audioInputRef.current?.click();
                  }}
                  style={sourceCardBase}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--success)";
                    e.currentTarget.style.background = "var(--bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--surface)";
                  }}
                >
                  <div style={sourceChip("var(--success)")}>
                    <Upload size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>Upload Audio</div>
                    <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>MP3 / WAV</div>
                  </div>
                </div>

                <div
                  onClick={() => onGenerateScene(activeScene.id)}
                  style={{
                    ...sourceCardBase,
                    border: `1px solid ${hasVoiceKeys ? "var(--success)" : "var(--border)"}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "var(--bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = hasVoiceKeys ? "var(--success)" : "var(--border)";
                    e.currentTarget.style.background = "var(--surface)";
                  }}
                >
                  <div style={sourceChip("var(--primary)")}>
                    <Sparkles size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>Generate AI</div>
                    <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{providerLabel} TTS</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeScene.audio_path && (
            <button
              onClick={() => onClearAudio(activeScene.id)}
              disabled={!!actionLoading}
              style={{
                alignSelf: "center",
                fontSize: "0.64rem",
                color: "var(--danger)",
                border: "1px solid var(--danger)",
                background: "transparent",
                padding: "0.16rem 0.5rem",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.18rem",
              }}
            >
              <X size={10} /> Clear Audio
            </button>
          )}

          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "0.35rem",
              marginTop: "auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              className="btn-secondary"
              disabled={activeIdx <= 0}
              onClick={() => setActiveIdx(activeIdx - 1)}
              style={{
                fontSize: "0.7rem",
                padding: "0.2rem 0.55rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              ← Prev
            </button>

            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)" }}>
              {(activeIdx + 1).toString().padStart(2, "0")} / {scenes.length.toString().padStart(2, "0")}
            </span>

            <button
              disabled={activeIdx >= scenes.length - 1}
              onClick={() => setActiveIdx(activeIdx + 1)}
              style={{
                fontSize: "0.7rem",
                padding: "0.2rem 0.55rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2rem",
                background: activeIdx >= scenes.length - 1 ? "var(--border)" : "var(--primary)",
                color: activeIdx >= scenes.length - 1 ? "var(--text-muted)" : "white",
                border: "none",
                borderRadius: "var(--radius)",
                cursor: activeIdx >= scenes.length - 1 ? "not-allowed" : "pointer",
                fontWeight: 600,
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
