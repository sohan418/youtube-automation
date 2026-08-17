import { useEffect, useState, useRef } from "react";
import {
  Mic,
  Pause,
  Play,
  Sparkles,
  X,
  Volume2,
  MoreVertical,
  CheckCircle2,
  Upload,
} from "lucide-react";
import type { Scene, VoiceProvider } from "../../types";

const WAVEFORM_HEIGHTS = [
  8, 12, 16, 8, 4, 16, 24, 32, 20, 12, 24, 36, 28, 16, 8, 20, 32, 24, 16, 8,
  12, 20, 28, 24, 16, 8, 12, 24, 32, 28, 20, 12, 8, 16, 24, 16, 8, 4, 8, 12
];

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.85rem",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "0.55rem 0.85rem",
        width: "100%",
        marginTop: "0.5rem",
        marginBottom: "0.5rem",
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
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "var(--primary)",
          border: "none",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: "0 0 10px rgba(255, 0, 60, 0.2)",
          transition: "transform 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" style={{ marginLeft: "2px" }} />}
      </button>

      {/* Current Time */}
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: "30px", textAlign: "right", flexShrink: 0 }}>
        {formatTime(currentTime)}
      </span>

      {/* Visual Waveform Tracker */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "2px",
          height: "30px",
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
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: "30px", flexShrink: 0 }}>
        {formatTime(duration)}
      </span>

      {/* Volume Icon */}
      <Volume2 size={16} color="var(--text-muted)" style={{ cursor: "pointer", flexShrink: 0 }} />

      {/* Extra actions */}
      <MoreVertical size={16} color="var(--text-muted)" style={{ cursor: "pointer", flexShrink: 0 }} />
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", height: "100%", overflow: "hidden" }}>
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

      {/* 1. Voice Settings Top Card */}
      <div className="card" style={{ padding: "0.8rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h3 style={{ fontSize: "1rem", margin: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
              🎙️ Voice Settings
            </h3>
          </div>
          <span
            style={{
              fontSize: "0.68rem",
              background: "rgba(46, 204, 113, 0.15)",
              color: "var(--success)",
              border: "1px solid rgba(46, 204, 113, 0.25)",
              padding: "0.15rem 0.5rem",
              borderRadius: "20px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <CheckCircle2 size={11} />
            Voice Ready
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.85rem", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem", color: "var(--text-muted)", flex: 1, minWidth: "120px" }}>
            Provider
            <select
              value={selectedProvider}
              disabled={!!actionLoading}
              onChange={(e) => onProviderChange(e.target.value)}
              style={{ padding: "0.35rem 0.5rem", fontSize: "0.78rem" }}
            >
              {voiceProviders.length === 0 ? (
                <option value="gemini">Google Gemini</option>
              ) : (
                voiceProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem", color: "var(--text-muted)", flex: 1, minWidth: "140px" }}>
            Voice
            <select
              value={selectedVoice}
              disabled={!!actionLoading}
              onChange={(e) => onVoiceChange(e.target.value)}
              style={{ padding: "0.35rem 0.5rem", fontSize: "0.78rem" }}
            >
              {currentVoices.length === 0 ? (
                <option value="Kore">Kore</option>
              ) : (
                [...(currentVoices.includes(selectedVoice) ? [] : [selectedVoice]), ...currentVoices].map((voice) => (
                  <option key={voice} value={voice}>
                    {currentProvider?.voice_labels?.[voice] ?? voice}
                  </option>
                ))
              )}
            </select>
          </label>

          <label style={{ display: "inline-flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem", color: "var(--text-muted)", width: "85px" }}>
            Speed
            <select
              value={selectedVoiceRate}
              disabled={!!actionLoading || currentProvider?.id !== "edgetts"}
              onChange={(e) => onVoiceRateChange(e.target.value)}
              style={{ padding: "0.35rem 0.5rem", fontSize: "0.78rem" }}
              title="Only Microsoft Edge TTS supports speed control"
            >
              {["-50%", "-25%", "+0%", "+10%", "+20%", "+30%", "+40%", "+50%", "+75%", "+100%"].map((rate) => (
                <option key={rate} value={rate}>
                  {rate}
                </option>
              ))}
            </select>
          </label>

          <button
            className="btn-primary"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={onGenerateAll}
            style={{
              fontSize: "0.78rem",
              padding: "0.45rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              alignSelf: "flex-end",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              boxShadow: "0 0 10px rgba(255, 0, 60, 0.15)",
            }}
          >
            <Sparkles size={13} />
            {actionLoading === "voice" ? "Generating..." : "Generate All Voice"}
          </button>
        </div>

        {voiceProgress && (
          <p style={{ color: "var(--accent)", fontSize: "0.75rem", margin: "0.4rem 0 0 0", fontWeight: 500 }}>
            {voiceProgress}
          </p>
        )}
      </div>

      {/* 2. Active Scene Card */}
      {scenes.length > 0 && activeScene && (
        <div
          className="card"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            padding: "0.85rem 1rem",
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Scene {(activeIdx + 1).toString().padStart(2, "0")} / {scenes.length.toString().padStart(2, "0")}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.68rem",
                  background: activeScene.audio_path ? "rgba(46, 204, 113, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  color: activeScene.audio_path ? "var(--success)" : "var(--text-muted)",
                  border: `1px solid ${activeScene.audio_path ? "rgba(46, 204, 113, 0.25)" : "var(--border)"}`,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "20px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                {activeScene.audio_path && <CheckCircle2 size={11} />}
                {activeScene.audio_path ? "Audio Ready" : "No Audio"}
              </span>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "0.2rem",
                }}
              >
                <MoreVertical size={16} />
              </button>
            </div>
          </div>

          {/* Hindi Narration Quote Container */}
          <div
            style={{
              position: "relative",
              background: "rgba(255, 255, 255, 0.012)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "0.5rem",
                top: "-0.25rem",
                fontSize: "2.5rem",
                color: "rgba(255, 0, 60, 0.15)",
                fontFamily: "Georgia, serif",
                lineHeight: 1,
              }}
            >
              “
            </span>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text)",
                lineHeight: 1.6,
                margin: 0,
                paddingLeft: "0.85rem",
                fontWeight: 500,
              }}
            >
              {activeScene.narration}
            </p>
          </div>

          {/* Custom Audio Waveform Player */}
          {activeScene.audio_path ? (
            <CustomAudioPlayer
              src={`${mediaUrl(activeScene.audio_path)}?v=${audioVersion[activeScene.id] || 0}`}
              audioVersionKey={audioVersion[activeScene.id] || 0}
            />
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "1rem",
                border: "1px dashed var(--border)",
                borderRadius: "10px",
                color: "var(--text-muted)",
                fontSize: "0.78rem",
              }}
            >
              Choose an audio source below to add voiceover for this scene
            </div>
          )}

          {/* Audio Source Options Grid */}
          <div style={{ marginTop: "0.35rem" }}>
            <h4
              style={{
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                marginBottom: "0.55rem",
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
                  gap: "0.85rem",
                  background: "rgba(255,0,60,0.03)",
                  border: "1px solid rgba(255,0,60,0.2)",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
                  <div style={{ width: "100%", height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${micLevel}%`, height: "100%", background: micLevel > 4 ? "var(--accent)" : "var(--primary)", transition: "width 100ms linear" }} />
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {recordingPaused ? "Recording Paused" : "Listening for voice input..."}
                  </span>
                </div>

                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                  <Pause size={12} />
                  {formatRecordTime(recordingSeconds)}
                </span>

                <button className="btn-secondary" onClick={onToggleRecordingPause} style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}>
                  {recordingPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={onStopRecording}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.6rem",
                    background: "var(--primary)",
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.85rem" }}>
                {/* 1. Record Card */}
                <div
                  onClick={() => onStartRecording(activeScene.id)}
                  style={{
                    background: "rgba(255, 255, 255, 0.015)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "0.85rem",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "rgba(255, 0, 60, 0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.015)";
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255, 0, 60, 0.15)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                    <Mic size={16} />
                  </div>
                  <div>
                    <h5 style={{ fontSize: "0.78rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>Record Voice</h5>
                    <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>Record your own voice</p>
                  </div>
                  {/* soundwave graphics */}
                  <div style={{ display: "flex", gap: "2px", alignItems: "center", height: "8px", marginTop: "0.2rem" }}>
                    {[6, 12, 8, 4, 10, 6, 8, 12, 4, 6].map((h, i) => (
                      <div key={i} style={{ width: "2px", height: `${h}px`, background: "var(--primary)", opacity: 0.4 }} />
                    ))}
                  </div>
                </div>

                {/* 2. Upload Card */}
                <div
                  onClick={() => {
                    setAudioTargetSceneId(activeScene.id);
                    audioInputRef.current?.click();
                  }}
                  style={{
                    background: "rgba(255, 255, 255, 0.015)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "0.85rem",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.background = "rgba(0, 184, 212, 0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.015)";
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0, 184, 212, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                    <Upload size={15} />
                  </div>
                  <div>
                    <h5 style={{ fontSize: "0.78rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>Upload Audio</h5>
                    <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>Upload MP3 / WAV</p>
                  </div>
                  {/* graphics */}
                  <div style={{ display: "flex", gap: "2px", alignItems: "center", height: "8px", marginTop: "0.2rem" }}>
                    {[4, 6, 8, 12, 10, 6, 4, 8, 12, 6].map((h, i) => (
                      <div key={i} style={{ width: "2px", height: `${h}px`, background: "var(--accent)", opacity: 0.4 }} />
                    ))}
                  </div>
                </div>

                {/* 3. AI TTS Generation Card */}
                <div
                  onClick={() => onGenerateScene(activeScene.id)}
                  style={{
                    background: "rgba(255, 255, 255, 0.015)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    padding: "0.85rem",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.4rem",
                    borderColor: hasVoiceKeys ? "rgba(46, 204, 113, 0.3)" : "var(--border)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "rgba(255, 0, 60, 0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = hasVoiceKeys ? "rgba(46, 204, 113, 0.3)" : "var(--border)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.015)";
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255, 0, 60, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <h5 style={{ fontSize: "0.78rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>Generate with AI</h5>
                    <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>{providerLabel} TTS</p>
                  </div>
                  {/* graphics */}
                  <div style={{ display: "flex", gap: "2px", alignItems: "center", height: "8px", marginTop: "0.2rem" }}>
                    {[12, 10, 6, 8, 4, 12, 8, 6, 10, 12].map((h, i) => (
                      <div key={i} style={{ width: "2px", height: `${h}px`, background: "var(--primary)", opacity: 0.4 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Delete active audio button if present */}
          {activeScene.audio_path && (
            <button
              onClick={() => onClearAudio(activeScene.id)}
              disabled={!!actionLoading}
              style={{
                alignSelf: "center",
                fontSize: "0.7rem",
                color: "var(--danger)",
                border: "1px solid rgba(255, 0, 60, 0.25)",
                background: "rgba(255, 0, 60, 0.05)",
                padding: "0.25rem 0.65rem",
                borderRadius: "4px",
                cursor: "pointer",
                marginTop: "0.35rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <X size={12} /> Clear Scene Audio
            </button>
          )}

          {/* 3. Bottom Pager Actions */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "0.75rem",
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
                fontSize: "0.78rem",
                padding: "0.35rem 0.8rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              ← Previous Scene
            </button>

            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" }}>
                Scene {(activeIdx + 1).toString().padStart(2, "0")} of {scenes.length.toString().padStart(2, "0")}
              </span>
              <span style={{ display: "block", fontSize: "0.62rem", color: "var(--text-muted)", marginTop: "1px" }}>
                Use ← / → keys to switch scenes
              </span>
            </div>

            <button
              disabled={activeIdx >= scenes.length - 1}
              onClick={() => setActiveIdx(activeIdx + 1)}
              style={{
                fontSize: "0.78rem",
                padding: "0.35rem 0.8rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                background: activeIdx >= scenes.length - 1 ? "var(--border)" : "var(--primary)",
                color: activeIdx >= scenes.length - 1 ? "var(--text-muted)" : "white",
                border: "none",
                borderRadius: "var(--radius)",
                cursor: activeIdx >= scenes.length - 1 ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              Next Scene →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
