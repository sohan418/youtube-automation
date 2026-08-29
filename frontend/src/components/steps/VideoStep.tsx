import { useRef, useState } from "react";
import { Clapperboard, Video, Package, Mic, Image, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Scene, VideoStatus, ExportResult, TimelineData } from "../../types";
import "./VideoStep.css";

interface Props {
  projectId: number;
  scenes: Scene[];
  actionLoading: string;
  ratio: string;
  videoStatus: VideoStatus | null;
  onBuild: (options?: {
    ratio?: string; subtitles?: boolean; subtitle_style?: string;
    subtitle_position?: string; subtitle_color?: string;
    subtitle_outline_color?: string; subtitle_outline?: number;
    subtitle_font_size?: number | null; force_rebuild?: boolean;
    timeline?: TimelineData | null;
  }) => Promise<void>;
  mediaUrl: (path: string | null | undefined) => string;
  enableSubtitles: boolean;
  subtitleStyle: string;
  subtitlePosition: string;
  subtitleColor: string;
  subtitleOutlineColor: string;
  subtitleOutline: number;
  subtitleFontSize: number | null;
  exportInfo: ExportResult | null;
  onExport: () => void;
  activeSceneIdx: number;
  setActiveSceneIdx: (idx: number) => void;
}

export default function VideoStep({
  projectId: _projectId,
  scenes,
  actionLoading,
  ratio,
  videoStatus,
  onBuild,
  mediaUrl,
  enableSubtitles,
  subtitleStyle,
  subtitlePosition,
  subtitleColor,
  subtitleOutlineColor,
  subtitleOutline,
  subtitleFontSize,
  exportInfo: _exportInfo,
  onExport,
  activeSceneIdx,
  setActiveSceneIdx,
}: Props) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const building = actionLoading === "video" || videoStatus?.running;
  const hasBuiltVideo = !!videoStatus?.output;
  const [forceRebuild, setForceRebuild] = useState(false);

  const sceneStatuses = videoStatus?.scene_statuses || {};
  const safeIdx = scenes.length > 0 ? Math.min(Math.max(activeSceneIdx, 0), scenes.length - 1) : 0;
  const activeScene: Scene | null = scenes[safeIdx] ?? null;

  const imageCount = scenes.filter((s) => s.image_path || (s.images && s.images.length > 0)).length;
  const audioCount = scenes.filter((s) => s.audio_path).length;
  const totalDuration = scenes.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  const scrollStrip = (dir: number) => {
    stripRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  };

  const narrationText = activeScene?.narration ?? "";
  const narrationSnippet =
    narrationText.length > 200 ? `${narrationText.slice(0, 200)}…` : narrationText;

  return (
    <div className="video-step">
      {/* Editor Control Card */}
      <div className="card video-editor-card">
        <div className="video-editor-header">
          <div className="video-editor-title">
            <Video size={16} color="var(--primary)" />
            <h3>Editor</h3>
            <span className="video-ratio-badge">
              {ratio}
            </span>
          </div>
          {hasBuiltVideo && (
            <span className="video-badge video-badge-ok">
              <Check size={11} /> Built
            </span>
          )}
        </div>

        <p className="video-editor-desc">
          {hasBuiltVideo
            ? "Final video has been rendered. Use the player on the right to preview."
            : "Assemble images, narration audio, and transition effects into the compiled video."}
        </p>

        {building && videoStatus && (
          <div className="video-progress-panel">
            <div className="video-progress-row">
              <span className="video-progress-message">{videoStatus.message}</span>
              <span className="video-progress-percent">{videoStatus.progress}%</span>
            </div>
            <div className="video-progress-track">
              <div className="video-progress-fill" style={{ width: `${videoStatus.progress}%` }} />
            </div>
          </div>
        )}

        <div className="video-actions-row">
          <button
            className="btn-primary video-build-btn"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={() =>
              onBuild({
                ratio,
                subtitles: enableSubtitles,
                subtitle_style: subtitleStyle,
                subtitle_position: subtitlePosition,
                subtitle_color: subtitleColor,
                subtitle_outline_color: subtitleOutlineColor,
                subtitle_outline: subtitleOutline,
                subtitle_font_size: subtitleFontSize,
                force_rebuild: forceRebuild,
              })
            }
          >
            {building ? `Building...` : <><Clapperboard size={13} className="video-btn-icon" /> Build Video</>}
          </button>
          
          <button
            className="btn-secondary video-export-btn"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={onExport}
          >
            {actionLoading === "export" ? "Exporting..." : <><Package size={13} className="video-btn-icon" /> Export</>}
          </button>
        </div>

        <label className="video-force-label">
          <input
            type="checkbox"
            checked={forceRebuild}
            onChange={(e) => setForceRebuild(e.target.checked)}
            disabled={building}
          />
          Force rebuild all scene clips from scratch
        </label>
      </div>

      {/* Horizontal Scene Strip */}
      <div className="card video-strip-card">
        <span className="video-strip-title">Quick Navigation</span>
        <div className="video-strip-row">
          <button
            className="btn-secondary video-scroll-btn"
            onClick={() => scrollStrip(-1)}
            aria-label="Scroll scenes left"
          >
            <ChevronLeft size={14} />
          </button>
          <div
            ref={stripRef}
            className="video-strip-scroll"
          >
            {scenes.map((scene, idx) => {
              const isActive = idx === safeIdx;
              return (
                <button
                  key={scene.id}
                  onClick={() => setActiveSceneIdx(idx)}
                  title={`Scene ${idx + 1}`}
                  className="video-scene-thumb"
                  style={{
                    border: isActive ? "2px solid var(--primary)" : "1px solid var(--border)",
                    opacity: isActive ? 1 : 0.75,
                  }}
                >
                  {scene.image_path ? (
                    <img
                      src={mediaUrl(scene.image_path)}
                      alt=""
                      className="video-scene-thumb-img"
                    />
                  ) : (
                    <span className="video-scene-thumb-placeholder">
                      {idx + 1}
                    </span>
                  )}
                  {sceneStatuses[idx + 1] === "rendering" && (
                    <span className="video-scene-thumb-rendering" />
                  )}
                  {sceneStatuses[idx + 1] === "done" && (
                    <span className="video-scene-thumb-done" />
                  )}
                  {sceneStatuses[idx + 1] === "failed" && (
                    <span className="video-scene-thumb-failed" />
                  )}
                </button>
              );
            })}
          </div>
          <button
            className="btn-secondary video-scroll-btn"
            onClick={() => scrollStrip(1)}
            aria-label="Scroll scenes right"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Active Scene Details */}
      <div className="card video-active-card">
        <div className="video-active-header">
          <h4 className="video-active-title">
            Scene {safeIdx + 1} <span className="video-active-count">/ {scenes.length}</span>
          </h4>
          <span className="video-duration-badge">
            {activeScene?.duration_seconds != null ? `${activeScene.duration_seconds.toFixed(1)}s` : "—"}
          </span>
        </div>

        <p className="video-narration">
          {narrationSnippet || "No narration for this scene."}
        </p>

        <div className="video-badges-row">
          {activeScene?.image_path || (activeScene?.images && activeScene.images.length > 0) ? (
            <span className="video-badge video-badge-ok">
              <Check size={11} /> <Image size={11} /> Image ready
            </span>
          ) : (
            <span className="video-badge video-badge-no">
              <Image size={11} /> No image
            </span>
          )}
          {activeScene?.audio_path ? (
            <span className="video-badge video-badge-ok">
              <Check size={11} /> <Mic size={11} /> Audio ready
            </span>
          ) : (
            <span className="video-badge video-badge-no">
              <Mic size={11} /> No audio
            </span>
          )}
          {totalDuration > 0 && (
            <span className="video-badge video-badge-no">Total ≈ {totalDuration.toFixed(1)}s</span>
          )}
        </div>

        <div className="video-stats-grid">
          {[
            { icon: <Video size={12} />, value: scenes.length, label: "Scenes" },
            { icon: <Image size={12} />, value: imageCount, label: "Images" },
            { icon: <Mic size={12} />, value: audioCount, label: "Audio" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="video-stat-item"
            >
              <span className="video-stat-icon">{stat.icon}</span>
              <strong className="video-stat-value">{stat.value}</strong>
              <span className="video-stat-label">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
