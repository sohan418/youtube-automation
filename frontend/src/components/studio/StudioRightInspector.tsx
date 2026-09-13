import { useState, useEffect } from "react";
import {
  Film,
  Image as ImageIcon,
  Mic,
  Music2,
  Type,
  Volume2,
  VolumeX,
  Scissors,
  Trash2,
  Copy,
  Clipboard,
  CopyPlus,
  Waves,
  Clock,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  Ban,
  Layers,
  Square,
  Maximize2,
  Wind,
  Zap,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type { TimelineClip } from "../../types";
import { mediaUrl } from "../../api/client";
import { getCachedMediaDuration } from "../editor/timeline/mediaMeta";



const TRANSITION_ITEMS = [
  { value: "none", label: "None", icon: <Ban size={14} /> },
  { value: "cut", label: "Cut", icon: <Scissors size={14} /> },
  { value: "crossfade", label: "Crossfade", icon: <Layers size={14} /> },
  { value: "fade_black", label: "Fade Black", icon: <Square size={14} fill="#000" stroke="#888" /> },
  { value: "fade_white", label: "Fade White", icon: <Square size={14} fill="#fff" stroke="#ccc" /> },
  { value: "zoom_in", label: "Zoom In", icon: <Maximize2 size={14} /> },
  { value: "whip_pan", label: "Whip Pan", icon: <Wind size={14} /> },
  { value: "glitch", label: "Glitch", icon: <Zap size={14} /> },
  { value: "slide_left", label: "Slide Left", icon: <ArrowLeft size={14} /> },
  { value: "slide_right", label: "Slide Right", icon: <ArrowRight size={14} /> },
];

function TransitionGridPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const currentVal = value || "none";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "6px",
        marginTop: "6px",
      }}
    >
      {TRANSITION_ITEMS.map((item) => {
        const active = currentVal === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
              padding: "7px 4px",
              borderRadius: "6px",
              border: active ? "1.5px solid #f59e0b" : "1px solid rgba(255,255,255,0.12)",
              background: active
                ? "linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)"
                : "rgba(255, 255, 255, 0.04)",
              color: active ? "#fef08a" : "var(--text-muted, #ccc)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontSize: "14px", lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: "0.68rem", fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  clipInfo: {
    clip: TimelineClip;
    orderIndex?: number;
    canSplit: boolean;
    canTrimStart: boolean;
    canTrimEnd: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    sourceDuration?: number | null;
    onPatch: (patch: Partial<TimelineClip>, mergeKey?: string) => void;
    onSplit: () => void;
    onTrimStart: () => void;
    onTrimEnd: () => void;
    onCleanSilence?: () => void;
    onCopy?: () => void;
    onPaste?: () => void;
    canPaste?: boolean;
    onDuplicate: () => void;
    onDelete: () => void;
    onMoveRow: (dir: -1 | 1) => void;
  } | null;
}

export default function StudioRightInspector({ clipInfo }: Props) {
  const [activeTab, setActiveTab] = useState<"audio" | "motion" | "timing" | "text">("audio");
  const [collapsed, setCollapsed] = useState(true);

  // Auto-switch tab & expand when clip is selected, collapse when clip is unselected
  useEffect(() => {
    if (clipInfo) {
      const track = clipInfo.clip.track;
      if (track === "text") setActiveTab("text");
      else setActiveTab("audio");
      setCollapsed(false);
    } else {
      setCollapsed(true);
    }
  }, [clipInfo?.clip.id, clipInfo?.clip.track]);

  const handleTabClick = (tab: "audio" | "motion" | "timing" | "text") => {
    if (activeTab === tab) {
      setCollapsed(!collapsed);
    } else {
      setActiveTab(tab);
      setCollapsed(false);
    }
  };

  if (!clipInfo) {
    return null;
  }

  const {
    clip,
    orderIndex,
    canSplit,
    canTrimStart,
    canTrimEnd,
    canMoveUp,
    canMoveDown,
    sourceDuration,
    onPatch,
    onSplit,
    onTrimStart,
    onTrimEnd,
    onCleanSilence,
    onCopy,
    onPaste,
    canPaste,
    onDuplicate,
    onDelete,
    onMoveRow,
  } = clipInfo;

  const isAudio = clip.track === "narration" || clip.track === "music" || clip.track === "sfx";
  const name =
    clip.track === "text"
      ? clip.text || "Caption Text"
      : (clip.video_path ?? clip.audio_path ?? `Scene ${orderIndex ?? ""}`)
          .split(/[\\/]/)
          .pop();

  return (
    <aside className={`studio-right-inspector ${collapsed ? "is-collapsed" : ""}`}>
      {/* Full-Height Content Panel on Left */}
      {!collapsed && (
        <div className="right-inspector-body">
          {/* Header Bar */}
          <div className="right-inspector-header">
            <div className="right-inspector-title">
              <span className="right-inspector-icon">
                {clip.track === "video" ? (
                  clip.video_path ? <Film size={14} /> : <ImageIcon size={14} />
                ) : clip.track === "text" ? (
                  <Type size={14} />
                ) : clip.track === "music" || clip.track === "sfx" ? (
                  <Music2 size={14} />
                ) : (
                  <Mic size={14} />
                )}
              </span>
              <div className="right-inspector-name-group">
                <strong title={name}>{name}</strong>
                <span className="right-inspector-badge">{clip.track.toUpperCase()}</span>
              </div>
            </div>

            <div className="right-inspector-actions">
              <button
                className="btn-secondary right-mini-btn"
                onClick={() => onMoveRow(-1)}
                disabled={!canMoveUp}
                title="Move track up"
              >
                ▲
              </button>
              <button
                className="btn-secondary right-mini-btn"
                onClick={() => onMoveRow(1)}
                disabled={!canMoveDown}
                title="Move track down"
              >
                ▼
              </button>
              <button className="btn-secondary right-mini-btn" onClick={onCopy} title="Copy (Ctrl+C)">
                <Copy size={12} />
              </button>
              <button className="btn-secondary right-mini-btn" onClick={onPaste} disabled={!canPaste} title="Paste (Ctrl+V)">
                <Clipboard size={12} />
              </button>
              <button className="btn-secondary right-mini-btn" onClick={onDuplicate} title="Duplicate (Ctrl+D)">
                <CopyPlus size={12} />
              </button>
              <button className="btn-danger right-mini-btn" onClick={onDelete} title="Delete (Del)">
                <Trash2 size={12} />
              </button>
              <button className="btn-secondary right-mini-btn" onClick={() => setCollapsed(true)} title="Close Inspector">
                <PanelRightClose size={12} />
              </button>
            </div>
          </div>

          {/* Tab 1: Captions / Text */}
          {activeTab === "text" && clip.track === "text" && (
            <div className="inspector-card-group">
              <div className="card-group-title">Caption Text</div>
              <textarea
                value={clip.text ?? ""}
                onChange={(e) => onPatch({ text: e.target.value }, `txt:${clip.id}`)}
                rows={4}
                placeholder="Enter caption text…"
                className="right-inspector-textarea"
              />
            </div>
          )}

          {/* Tab 2: Audio & Fade */}
          {activeTab === "audio" && clip.track !== "text" && (
            <div className="inspector-card-group">
              <div className="card-group-title">
                <span>Volume & Audio</span>
                <button
                  type="button"
                  onClick={() => onPatch({ muted: !clip.muted }, `mu:${clip.id}`)}
                  className={`right-mute-badge ${clip.muted ? "is-muted" : ""}`}
                  title={clip.muted ? "Unmute audio" : "Mute audio"}
                >
                  {clip.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  <span>{clip.muted ? "Muted" : `${Math.round(clip.volume * 100)}%`}</span>
                </button>
              </div>

              <div className="card-group-field">
                <label className="field-label">Volume Level</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={clip.muted ? 0 : clip.volume}
                  disabled={clip.muted}
                  onChange={(e) => onPatch({ volume: parseFloat(e.target.value) }, `vo:${clip.id}`)}
                  className="right-inspector-slider"
                />
              </div>

              {clip.track === "video" && (
                <div className="card-group-field" style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="field-label">Playback Speed</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        min={0.1}
                        max={4.0}
                        step={0.01}
                        value={Number((clip.speed ?? 1.0).toFixed(2))}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) {
                            onPatch({ speed: Math.min(4.0, Math.max(0.1, v)) }, `sp:${clip.id}`);
                          }
                        }}
                        style={{
                          width: 56,
                          padding: "2px 4px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          borderRadius: "4px",
                          border: "1px solid var(--border)",
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "#fff",
                          textAlign: "center",
                        }}
                      />
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>x</span>
                      {(() => {
                        const srcPath = clip.video_path || clip.audio_path || "";
                        const srcDur = srcPath ? getCachedMediaDuration(mediaUrl(srcPath), clip.audio_path ? "audio" : "video") : null;
                        const autoSpeed = srcDur && srcDur > 0 ? parseFloat((srcDur / clip.duration).toFixed(2)) : null;
                        return (
                          <>
                            {autoSpeed != null && autoSpeed > 0 && Math.abs(autoSpeed - (clip.speed ?? 1.0)) > 0.02 && (
                              <button
                                type="button"
                                title={`Auto-fit speed to ${autoSpeed}x so video length matches scene duration`}
                                onClick={() => onPatch({ speed: Math.min(4.0, Math.max(0.1, autoSpeed)) }, `sp:${clip.id}`)}
                                style={{
                                  background: "rgba(99, 102, 241, 0.25)",
                                  border: "1px solid rgba(99, 102, 241, 0.5)",
                                  color: "#a5b4fc",
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
                                  padding: "1px 5px",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  marginLeft: 2,
                                }}
                              >
                                ⚡ Auto-Fit ({autoSpeed}x)
                              </button>
                            )}
                            {(clip.speed ?? 1) !== 1 && (
                              <button
                                type="button"
                                onClick={() => onPatch({ speed: 1.0 }, `sp:${clip.id}`)}
                                style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "0.7rem", cursor: "pointer", marginLeft: 4 }}
                              >
                                Reset 1x
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.25rem", margin: "4px 0" }}>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onPatch({ speed: s }, `sp:${clip.id}`)}
                        style={{
                          flex: 1,
                          padding: "0.2rem 0.1rem",
                          fontSize: "0.68rem",
                          borderRadius: "4px",
                          border: `1px solid ${(clip.speed ?? 1.0) === s ? "var(--primary)" : "var(--border)"}`,
                          background: (clip.speed ?? 1.0) === s ? "rgba(99, 102, 241, 0.25)" : "transparent",
                          color: (clip.speed ?? 1.0) === s ? "var(--primary)" : "var(--text-muted)",
                          cursor: "pointer",
                          fontWeight: (clip.speed ?? 1.0) === s ? 700 : 400,
                        }}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={3.0}
                    step={0.05}
                    value={clip.speed ?? 1.0}
                    onChange={(e) => onPatch({ speed: parseFloat(e.target.value) }, `sp:${clip.id}`)}
                    className="right-inspector-slider"
                  />
                </div>
              )}

              {isAudio && (
                <>
                  <div className="card-group-grid-2">
                    <div className="card-group-field">
                      <label className="field-label">Audio In (s)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={Number((clip.audio_in ?? 0).toFixed(2))}
                        onChange={(e) =>
                          onPatch({ audio_in: Math.max(0, parseFloat(e.target.value) || 0) }, `ai:${clip.id}`)
                        }
                        className="right-inspector-input"
                      />
                    </div>
                    <div className="card-group-field">
                      <label className="field-label">Fade In (s)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={clip.fade_in ?? 0}
                        onChange={(e) =>
                          onPatch({ fade_in: Math.max(0, parseFloat(e.target.value) || 0) }, `fi:${clip.id}`)
                        }
                        className="right-inspector-input"
                      />
                    </div>
                  </div>

                  <div className="card-group-field" style={{ marginTop: 6 }}>
                    <label className="field-label">Fade Out (s)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={clip.fade_out ?? 0}
                      onChange={(e) =>
                        onPatch({ fade_out: Math.max(0, parseFloat(e.target.value) || 0) }, `fo:${clip.id}`)
                      }
                      className="right-inspector-input"
                    />
                  </div>

                  {onCleanSilence && (
                    <button
                      className="btn-secondary right-block-btn"
                      onClick={onCleanSilence}
                      title="Detect silent space at clip edges and trim it"
                    >
                      <Waves size={13} /> Clean Audio Silence
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab 3: Visual Transitions */}
          {activeTab === "motion" && clip.track === "video" && (
            <div className="inspector-card-group">
              <div className="card-group-title">Visual Transitions</div>
              <div className="card-group-field">
                <label className="field-label">Transition Style</label>
                <TransitionGridPicker
                  value={clip.transition ?? "none"}
                  onChange={(t) => onPatch({ transition: t })}
                />
              </div>
              {clip.transition && clip.transition !== "none" && (
                <div className="card-group-field" style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label className="field-label">Transition Duration</label>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      {(clip.transition_duration ?? 1.0).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={3.0}
                    step={0.1}
                    value={clip.transition_duration ?? 1.0}
                    onChange={(e) => onPatch({ transition_duration: parseFloat(e.target.value) })}
                    className="right-inspector-slider"
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Timing & Split */}
          {activeTab === "timing" && (
            <div className="inspector-card-group">
              <div className="card-group-title">Timing & Trim Controls</div>
              <div className="card-group-grid-2">
                <div className="card-group-field">
                  <label className="field-label">Start Time (s)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={Number(clip.start.toFixed(2))}
                    onChange={(e) =>
                      onPatch({ start: Math.max(0, parseFloat(e.target.value) || 0) }, `st:${clip.id}`)
                    }
                    className="right-inspector-input"
                  />
                </div>
                <div className="card-group-field">
                  <label className="field-label">Duration (s)</label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={Number(clip.duration.toFixed(2))}
                    onChange={(e) =>
                      onPatch({ duration: Math.max(0.1, parseFloat(e.target.value) || 0.1) }, `du:${clip.id}`)
                    }
                    className="right-inspector-input"
                  />
                </div>
              </div>

              {sourceDuration != null && (
                <div className="right-subtext">
                  Actual Media File Length: <strong>{sourceDuration.toFixed(1)}s</strong>
                </div>
              )}

              {clip.track === "video" && (
                <div style={{ marginTop: 12 }}>
                  <div className="card-group-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Playback Speed ({(clip.speed ?? 1).toFixed(2)}x)</span>
                    {(clip.speed ?? 1) !== 1 && (
                      <button
                        type="button"
                        onClick={() => onPatch({ speed: 1.0 }, `sp:${clip.id}`)}
                        style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "0.7rem", cursor: "pointer" }}
                      >
                        Reset 1x
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.25rem", margin: "6px 0" }}>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onPatch({ speed: s }, `sp:${clip.id}`)}
                        style={{
                          flex: 1,
                          padding: "0.25rem 0.1rem",
                          fontSize: "0.68rem",
                          borderRadius: "4px",
                          border: `1px solid ${(clip.speed ?? 1.0) === s ? "var(--primary)" : "var(--border)"}`,
                          background: (clip.speed ?? 1.0) === s ? "rgba(99, 102, 241, 0.25)" : "transparent",
                          color: (clip.speed ?? 1.0) === s ? "var(--primary)" : "var(--text-muted)",
                          cursor: "pointer",
                          fontWeight: (clip.speed ?? 1.0) === s ? 700 : 400,
                        }}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={3.0}
                    step={0.05}
                    value={clip.speed ?? 1.0}
                    onChange={(e) => onPatch({ speed: parseFloat(e.target.value) }, `sp:${clip.id}`)}
                    style={{ width: "100%", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                </div>
              )}

              <div className="card-group-title" style={{ marginTop: 12 }}>Trim & Split</div>
              <div className="card-group-grid-2">
                <button className="btn-secondary right-block-btn" onClick={onSplit} disabled={!canSplit}>
                  <Scissors size={12} /> Split (S)
                </button>
                <button className="btn-secondary right-block-btn" onClick={onTrimStart} disabled={!canTrimStart}>
                  ◀ Trim In
                </button>
              </div>
              <button className="btn-secondary right-block-btn" onClick={onTrimEnd} disabled={!canTrimEnd} style={{ marginTop: 6 }}>
                Trim Out ▶
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clipchamp-style Right Dock Icon Tabs on Absolute Far-Right Edge */}
      <div className="right-dock-tabs">
        {/* 1. Audio Tab FIRST for video & audio clips */}
        {clip.track !== "text" && (
          <button
            className={`dock-tab-btn ${activeTab === "audio" && !collapsed ? "is-active" : ""}`}
            onClick={() => handleTabClick("audio")}
            title="Audio & Fade Controls"
          >
            <Volume2 size={16} />
            <span>Audio</span>
          </button>
        )}

        {/* 2. Motion Tab SECOND for video clips */}
        {clip.track === "video" && (
          <button
            className={`dock-tab-btn ${activeTab === "motion" && !collapsed ? "is-active" : ""}`}
            onClick={() => handleTabClick("motion")}
            title="Motion & Zoom Effects"
          >
            <Sparkles size={16} />
            <span>Motion</span>
          </button>
        )}

        {/* 3. Text Tab for caption clips */}
        {clip.track === "text" && (
          <button
            className={`dock-tab-btn ${activeTab === "text" && !collapsed ? "is-active" : ""}`}
            onClick={() => handleTabClick("text")}
            title="Captions & Text"
          >
            <Type size={16} />
            <span>Text</span>
          </button>
        )}

        {/* 4. Timing & Split Controls */}
        <button
          className={`dock-tab-btn ${activeTab === "timing" && !collapsed ? "is-active" : ""}`}
          onClick={() => handleTabClick("timing")}
          title="Timing & Split Controls"
        >
          <Clock size={16} />
          <span>Timing</span>
        </button>

        <button
          className="dock-tab-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand Right Panel" : "Collapse Right Panel"}
          style={{ marginTop: "auto" }}
        >
          {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          <span>{collapsed ? "Open" : "Close"}</span>
        </button>
      </div>
    </aside>
  );
}
