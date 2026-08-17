import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { Scene } from "../types";

interface Args {
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  setActionLoading: (v: string) => void;
  setError: (v: string) => void;
  setSuccess: (v: string) => void;
  runAction: (label: string, action: () => Promise<void>) => Promise<void>;
}

export interface RecordingControl {
  recordingSceneId: number | null;
  recordingSeconds: number;
  recordingPaused: boolean;
  micLevel: number;
  audioVersion: Record<number, number>;
  audioTargetSceneId: number | null;
  setAudioTargetSceneId: (v: number | null) => void;
  audioInputRef: React.RefObject<HTMLInputElement | null>;
  startRecording: (sceneId: number) => Promise<void>;
  stopRecording: () => void;
  toggleRecordingPause: () => void;
  handleAudioFileSelected: (sceneId: number, file: File | undefined) => Promise<void>;
  clearSceneAudio: (sceneId: number) => Promise<void>;
  bumpAudioVersions: (sceneIds: number[]) => void;
  formatRecordTime: (s: number) => string;
}

export function useVoiceRecording({
  setScenes,
  setActionLoading,
  setError,
  setSuccess,
  runAction,
}: Args): RecordingControl {
  const [recordingSceneId, setRecordingSceneId] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [audioVersion, setAudioVersion] = useState<Record<number, number>>({});
  const [audioTargetSceneId, setAudioTargetSceneId] = useState<number | null>(null);

  const recordingRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const recordingPeakRef = useRef(0);
  const meterActiveRef = useRef(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (recordingRef.current && recordingRef.current.state !== "inactive") {
        recordingRef.current.stop();
      }
    };
  }, []);

  const bumpAudioVersions = (sceneIds: number[]) =>
    setAudioVersion((v) => {
      const next = { ...v };
      for (const id of sceneIds) next[id] = (next[id] || 0) + 1;
      return next;
    });

  const formatRecordTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const stopMicMeter = () => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    analyserRef.current = null;
    try {
      void audioCtxRef.current?.close();
    } catch {
      /* noop */
    }
    audioCtxRef.current = null;
    setMicLevel(0);
  };

  const startMicMeter = (stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (ctx.state === "suspended") void ctx.resume();
        if (ctx.state === "running") meterActiveRef.current = true;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const level = Math.min(100, Math.round((avg / 255) * 100));
        setMicLevel(level);
        if (level > recordingPeakRef.current) recordingPeakRef.current = level;
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* meter is optional */
    }
  };

  const startRecording = async (sceneId: number) => {
    if (recordingSceneId !== null) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopMicMeter();
        const duration = (Date.now() - recordingStartRef.current) / 1000;
        const type = (mediaRecorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(recordingChunksRef.current, { type });
        if (recordingChunksRef.current.length === 0) {
          setError("No audio was captured. Check your microphone.");
          return;
        }
        void uploadRecording(sceneId, blob, duration);
      };
      startMicMeter(stream);
      recordingPeakRef.current = 0;
      meterActiveRef.current = false;
      recordingRef.current = mediaRecorder;
      recordingStartRef.current = Date.now();
      setRecordingSceneId(sceneId);
      setRecordingSeconds(0);
      setRecordingPaused(false);
      mediaRecorder.start();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      setError("");
    } catch {
      setError("Could not access the microphone. Allow microphone permission in your browser.");
    }
  };

  const toggleRecordingPause = () => {
    const recorder = recordingRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (recorder.state === "paused") {
      recorder.resume();
      setRecordingPaused(false);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      recorder.pause();
      setRecordingPaused(true);
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingRef.current && recordingRef.current.state !== "inactive") {
      recordingRef.current.stop();
    }
    setRecordingSceneId(null);
    setRecordingSeconds(0);
    setRecordingPaused(false);
  };

  const uploadRecording = async (sceneId: number, blob: Blob, duration: number) => {
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `recording_${Date.now()}.${ext}`, { type: blob.type });
    try {
      setActionLoading("upload-audio");
      const scene = await api.uploadVoice(sceneId, file, duration);
      setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, audio_path: scene.audio_path, duration_seconds: scene.duration_seconds } : s)));
      bumpAudioVersions([scene.id]);
      setSuccess("Your own voice recording was saved for this scene.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setActionLoading("");
    }
  };

  const handleAudioFileSelected = async (sceneId: number, file: File | undefined) => {
    if (!file) return;
    try {
      setActionLoading("upload-audio");
      const scene = await api.uploadVoice(sceneId, file, 0);
      setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, audio_path: scene.audio_path, duration_seconds: scene.duration_seconds } : s)));
      bumpAudioVersions([scene.id]);
      setSuccess("Audio file saved for this scene.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setActionLoading("");
    }
  };

  const clearSceneAudio = async (sceneId: number) => {
    if (!window.confirm("Remove this scene's audio?")) return;
    await runAction(`clear-audio-${sceneId}`, async () => {
      await api.clearSceneAudio(sceneId);
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, audio_path: null, duration_seconds: null } : s)));
      bumpAudioVersions([sceneId]);
      setSuccess("Scene audio removed.");
    });
  };

  return {
    recordingSceneId,
    recordingSeconds,
    recordingPaused,
    micLevel,
    audioVersion,
    audioTargetSceneId,
    setAudioTargetSceneId,
    audioInputRef,
    startRecording,
    stopRecording,
    toggleRecordingPause,
    handleAudioFileSelected,
    clearSceneAudio,
    bumpAudioVersions,
    formatRecordTime,
  };
}
