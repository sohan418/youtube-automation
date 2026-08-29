import { useEffect, useRef, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";

declare global {
  interface HTMLVideoElement {
    captureStream?: () => MediaStream;
  }
}

interface Props {
  file: File;
  maxDuration?: number | null;
  onCancel: () => void;
  onConfirm: (blob: Blob, name: string) => void;
}

const MIN_TRIM = 0.3;

function fmt(s: number): string {
  return `${s.toFixed(1)}s`;
}

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "video/webm";
}

function trimVideo(video: HTMLVideoElement, start: number, end: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const stream = video.captureStream!();
      const mime = pickMime();
      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 8_000_000,
        audioBitsPerSecond: 128_000,
      });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      rec.onerror = () => reject(new Error("Recording failed"));
      rec.onstop = () => resolve(new Blob(chunks, { type: mime }));

      video.pause();
      let started = false;
      let fallbackId: number | null = null;
      const startRecording = () => {
        if (started || rec.state === "recording") return;
        started = true;
        if (fallbackId !== null) {
          window.clearTimeout(fallbackId);
          fallbackId = null;
        }
        video.removeEventListener("seeked", startRecording);
        rec.start(200);
        video.play().catch(() => {});
        const timer = window.setInterval(() => {
          if (video.currentTime >= end - 0.05 || video.paused) {
            window.clearInterval(timer);
            if (rec.state !== "inactive") rec.stop();
            video.pause();
          }
        }, 100);
      };
      video.addEventListener("seeked", startRecording);
      fallbackId = window.setTimeout(startRecording, 600);
      video.currentTime = start;
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Trimming not supported in this browser"));
    }
  });
}

export default function VideoTrimDialog({ file, maxDuration, onCancel, onConfirm }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlRef = useRef("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [supported] = useState(() => {
    const v = typeof HTMLVideoElement !== "undefined" ? HTMLVideoElement.prototype : null;
    return (
      typeof v?.captureStream === "function" &&
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("video/webm")
    );
  });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    objectUrlRef.current = URL.createObjectURL(file);
    v.src = objectUrlRef.current;
    v.preload = "auto";
    const onLoaded = () => {
      const d = v.duration;
      if (Number.isFinite(d) && d > 0) {
        setDuration(d);
        const max = maxDuration && maxDuration > 0 ? Math.min(d, maxDuration) : d;
        setEnd(max);
        setStart(0);
      }
    };
    v.addEventListener("loadedmetadata", onLoaded);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [file, maxDuration]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    let t = v.currentTime;
    if (t < start) {
      v.currentTime = start;
      t = start;
    } else if (t > effectiveEnd) {
      v.pause();
      v.currentTime = effectiveEnd;
      t = effectiveEnd;
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || !duration) return;
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= effectiveEnd) v.currentTime = start;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const handleApply = () => {
    const v = videoRef.current;
    if (!v || !duration) return;
    if (!supported) {
      onConfirm(file, file.name);
      return;
    }
    setSaving(true);
    setError("");
    trimVideo(v, start, effectiveEnd)
      .then((blob) => {
        const base = file.name.replace(/\.[^.]+$/, "") || "clip";
        setSaving(false);
        onConfirm(blob, `${base}.webm`);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Trimming failed");
        setSaving(false);
      });
  };

  const effectiveEnd = maxDuration && maxDuration > 0 ? Math.min(end, maxDuration) : end;
  const selStart = ((start / Math.max(duration, 1)) * 100).toFixed(1);
  const selWidth = (((effectiveEnd - start) / Math.max(duration, 1)) * 100).toFixed(1);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.88)", zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{ background: "var(--bg)", padding: "1rem", maxWidth: "90vw", width: "min(820px, 94vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Trim Video Clip</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {maxDuration && maxDuration > 0 && (
              <span style={{ fontSize: "0.72rem", color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: "0.25rem", fontWeight: 600 }}>
                <Clock size={12} /> Voice: {fmt(maxDuration)}
              </span>
            )}
            {duration > 0 && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                {fmt(start)} <ChevronRight size={13} /> {fmt(end)} <span style={{ opacity: 0.6 }}>/</span> {fmt(duration)}
              </span>
            )}
          </div>
        </div>

        <video
          ref={videoRef}
          playsInline
          preload="auto"
          onTimeUpdate={onTimeUpdate}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          style={{
            width: "100%", maxHeight: "50vh", background: "#000", borderRadius: "var(--radius)", display: "block",
          }}
        />

        {duration > 0 && (
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ position: "relative", height: 26, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <div
                style={{
                  position: "absolute", top: 0, bottom: 0, left: `${selStart}%`, width: `${selWidth}%`,
                  background: "rgba(46, 204, 113, 0.4)", borderRadius: "var(--radius)",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
              <label style={{ flex: 1, fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>
                Start {fmt(start)}
                <input
                  type="range"
                  min={0}
                  max={Math.max(MIN_TRIM, end - MIN_TRIM)}
                  step={0.1}
                  value={Math.min(start, Math.max(0, end - MIN_TRIM))}
                  onChange={(e) => setStart(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </label>
              <label style={{ flex: 1, fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>
                End {fmt(effectiveEnd)}
                <input
                  type="range"
                  min={start + MIN_TRIM}
                  max={maxDuration && maxDuration > 0 ? Math.min(duration, maxDuration) : duration}
                  step={0.1}
                  value={Math.max(effectiveEnd, start + MIN_TRIM)}
                  onChange={(e) => setEnd(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
          </div>
        )}

        {!supported && (
          <p style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "0.6rem" }}>
            Trimming isn't supported in this browser — the original file will be uploaded unchanged.
          </p>
        )}
        {error && <p style={{ fontSize: "0.78rem", color: "var(--danger)", marginTop: "0.6rem" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", marginTop: "1rem", flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={togglePlay} disabled={!duration || saving}>
            {playing ? "Pause" : "Play preview"}
          </button>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={() => onConfirm(file, file.name)} disabled={saving}>
              Use original
            </button>
            <button className="btn-secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button className="btn-accent" onClick={handleApply} disabled={!duration || saving}>
              {saving ? "Trimming…" : "Apply & Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
