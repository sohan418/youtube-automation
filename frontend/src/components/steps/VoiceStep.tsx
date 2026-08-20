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
} from "lucide-react";
import type { Scene, VoiceProvider } from "../../types";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", height: "100%", overflow: "hidden" }}>
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

      {/* ── Task #1: Voice Settings Card — single row, no label stacking ─── */}
      <div className="card" style={{ padding: "0.55rem 0.85rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
          {/* Title */}
          <span style={{ fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            🎙️ Voice
          </span>

          {/* Provider select */}
          <select
            value={selectedProvider}
            disabled={!!actionLoading}
            onChange={(e) => onProviderChange(e.target.value)}
            title="Provider"
            style={{ padding: "0.3rem 0.45rem", fontSize: "0.78rem", flex: 1, minWidth: "110px" }}
          >
            {voiceProviders.length === 0 ? (
              <option value="gemini">Google Gemini</option>
            ) : (
              voiceProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            )}
          </select>

          {/* Voice select */}
          <select
            value={selectedVoice}
            disabled={!!actionLoading}
            onChange={(e) => onVoiceChange(e.target.value)}
            title="Voice"
            style={{ padding: "0.3rem 0.45rem", fontSize: "0.78rem", flex: 1, minWidth: "120px" }}
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

          {/* Speed select */}
          <select
            value={selectedVoiceRate}
            disabled={!!actionLoading}
            onChange={(e) => onVoiceRateChange(e.target.value)}
            title={currentProvider?.id === "gemini" ? "Gemini TTS does not support speed control" : "Speed"}
            style={{ padding: "0.3rem 0.45rem", fontSize: "0.78rem", width: "72px" }}
          >
            {["-50%", "-25%", "+0%", "+10%", "+20%", "+30%", "+40%", "+50%", "+75%", "+100%"].map((rate) => (
              <option key={rate} value={rate} disabled={currentProvider?.id === "gemini" && rate !== "+0%"}>
                {rate}
              </option>
            ))}
          </select>

          {/* Status badge */}
          <span
            style={{
              fontSize: "0.67rem",
              background: "rgba(46, 204, 113, 0.15)",
              color: "var(--success)",
              border: "1px solid rgba(46, 204, 113, 0.25)",
              padding: "0.15rem 0.45rem",
              borderRadius: "20px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.2rem",
              whiteSpace: "nowrap",
            }}
          >
            <CheckCircle2 size={10} /> Ready
          </span>

          {/* Generate All button */}
          <button
            className="btn-primary"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={onGenerateAll}
            style={{
              fontSize: "0.76rem",
              padding: "0.35rem 0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              background: "var(--primary)",
              color: "white",
              fontWeight: 600,
              whiteSpace: "nowrap",
              boxShadow: "0 0 8px rgba(255, 0, 60, 0.15)",
            }}
          >
            <Sparkles size={12} />
            {actionLoading === "voice" ? "Generating..." : "Generate All"}
          </button>
        </div>

        {voiceProgress && (
          <p style={{ color: "var(--accent)", fontSize: "0.72rem", margin: "0.3rem 0 0 0", fontWeight: 500 }}>
            {voiceProgress}
          </p>
        )}
      </div>

      {/* ── Active Scene Card ─────────────────────────────────────────────── */}
      {scenes.length > 0 && activeScene && (
        <div
          className="card"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.55rem",
            padding: "0.7rem 0.85rem",
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          {/* ── Task #7: Header — MoreVertical removed ────────────────────── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Scene {(activeIdx + 1).toString().padStart(2, "0")} / {scenes.length.toString().padStart(2, "0")}
            </h3>
            <span
              style={{
                fontSize: "0.67rem",
                background: activeScene.audio_path ? "rgba(46, 204, 113, 0.15)" : "rgba(255, 255, 255, 0.05)",
                color: activeScene.audio_path ? "var(--success)" : "var(--text-muted)",
                border: `1px solid ${activeScene.audio_path ? "rgba(46, 204, 113, 0.25)" : "var(--border)"}`,
                padding: "0.15rem 0.45rem",
                borderRadius: "20px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              {activeScene.audio_path && <CheckCircle2 size={10} />}
              {activeScene.audio_path ? "Audio Ready" : "No Audio"}
            </span>
          </div>

          {/* ── Task #2: Narration Block — no decorative quote, less padding ─ */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.012)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "0.55rem 0.8rem",
            }}
          >
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text)",
                lineHeight: 1.5,
                margin: 0,
                fontWeight: 500,
              }}
            >
              {activeScene.narration}
            </p>
          </div>

          {/* ── Task #4 + #6: Audio Player or No-Audio empty state ─────────── */}
          {activeScene.audio_path ? (
            <CustomAudioPlayer
              src={`${mediaUrl(activeScene.audio_path)}?v=${audioVersion[activeScene.id] || 0}`}
              audioVersionKey={audioVersion[activeScene.id] || 0}
            />
          ) : (
            // Task #6: Smaller padding, tighter text
            <div
              style={{
                textAlign: "center",
                padding: "0.45rem 0.75rem",
                border: "1px dashed var(--border)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "0.73rem",
              }}
            >
              Choose an audio source below to add voiceover
            </div>
          )}

          {/* ── Task #3: Audio Source Cards — horizontal, no waveform graphics */}
          <div>
            <h4
              style={{
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                marginBottom: "0.4rem",
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
                  gap: "0.75rem",
                  background: "rgba(255,0,60,0.03)",
                  border: "1px solid rgba(255,0,60,0.2)",
                  borderRadius: "8px",
                  padding: "0.6rem 0.85rem",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1 }}>
                  <div style={{ width: "100%", height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${micLevel}%`, height: "100%", background: micLevel > 4 ? "var(--accent)" : "var(--primary)", transition: "width 100ms linear" }} />
                  </div>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                    {recordingPaused ? "Recording Paused" : "Listening…"}
                  </span>
                </div>

                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                  <Pause size={11} />
                  {formatRecordTime(recordingSeconds)}
                </span>

                <button className="btn-secondary" onClick={onToggleRecordingPause} style={{ fontSize: "0.72rem", padding: "0.2rem 0.45rem" }}>
                  {recordingPaused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={onStopRecording}
                  style={{
                    fontSize: "0.72rem",
                    padding: "0.2rem 0.55rem",
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
              // Horizontal layout, no waveform graphics, compact padding
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                {/* Record Card */}
                <div
                  onClick={() => onStartRecording(activeScene.id)}
                  style={{
                    background: "rgba(255, 255, 255, 0.015)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.5rem 0.7rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "rgba(255, 0, 60, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.015)";
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255, 0, 60, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", flexShrink: 0 }}>
                    <Mic size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text)" }}>Record Voice</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Use microphone</div>
                  </div>
                </div>

                {/* Upload Card */}
                <div
                  onClick={() => {
                    setAudioTargetSceneId(activeScene.id);
                    audioInputRef.current?.click();
                  }}
                  style={{
                    background: "rgba(255, 255, 255, 0.015)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "0.5rem 0.7rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.background = "rgba(0, 184, 212, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.015)";
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0, 184, 212, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                    <Upload size={13} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text)" }}>Upload Audio</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>MP3 / WAV</div>
                  </div>
                </div>

                {/* AI TTS Card */}
                <div
                  onClick={() => onGenerateScene(activeScene.id)}
                  style={{
                    background: "rgba(255, 255, 255, 0.015)",
                    border: `1px solid ${hasVoiceKeys ? "rgba(46, 204, 113, 0.3)" : "var(--border)"}`,
                    borderRadius: "8px",
                    padding: "0.5rem 0.7rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.background = "rgba(255, 0, 60, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = hasVoiceKeys ? "rgba(46, 204, 113, 0.3)" : "var(--border)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.015)";
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255, 0, 60, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", flexShrink: 0 }}>
                    <Sparkles size={13} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text)" }}>Generate AI</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{providerLabel} TTS</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Clear audio button */}
          {activeScene.audio_path && (
            <button
              onClick={() => onClearAudio(activeScene.id)}
              disabled={!!actionLoading}
              style={{
                alignSelf: "center",
                fontSize: "0.68rem",
                color: "var(--danger)",
                border: "1px solid rgba(255, 0, 60, 0.25)",
                background: "rgba(255, 0, 60, 0.05)",
                padding: "0.2rem 0.55rem",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <X size={11} /> Clear Audio
            </button>
          )}

          {/* ── Task #5: Scene Pager — smaller buttons, no keyboard hint ───── */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "0.4rem",
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
                fontSize: "0.74rem",
                padding: "0.25rem 0.65rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              ← Prev
            </button>

            {/* Scene counter only — keyboard hint removed */}
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text)" }}>
              {(activeIdx + 1).toString().padStart(2, "0")} / {scenes.length.toString().padStart(2, "0")}
            </span>

            <button
              disabled={activeIdx >= scenes.length - 1}
              onClick={() => setActiveIdx(activeIdx + 1)}
              style={{
                fontSize: "0.74rem",
                padding: "0.25rem 0.65rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
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
