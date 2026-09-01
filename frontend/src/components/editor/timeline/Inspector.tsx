import {
  Film,
  Image as ImageIcon,
  Mic,
  Music2,
  Scissors,
  Trash2,
  Type,
  Copy,
  Waves,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { TimelineClip } from "../../../types";
import { THEME, TRACK_BY_ID } from "./constants";

const MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const ZOOM_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "zoom_in", label: "Zoom In" },
  { value: "zoom_out", label: "Zoom Out" },
  { value: "pan_left", label: "Pan Left" },
  { value: "pan_right", label: "Pan Right" },
  { value: "pan_up", label: "Pan Up" },
  { value: "pan_down", label: "Pan Down" },
];

interface Props {
  clip: TimelineClip;
  orderIndex?: number;
  canSplit: boolean;
  canTrimStart: boolean;
  canTrimEnd: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  textAreaRef?: React.RefObject<HTMLTextAreaElement | null>;
  sourceDuration?: number | null;
  variant?: "bar" | "sidebar";
  onPatch: (patch: Partial<TimelineClip>, mergeKey?: string) => void;
  onSplit: () => void;
  onTrimStart: () => void;
  onTrimEnd: () => void;
  onCleanSilence?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveRow: (dir: -1 | 1) => void;
}

function Field({
  label,
  children,
  extra,
}: {
  label: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        color: "#8e8e98",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {children}
      {extra}
    </label>
  );
}

const numInputStyle: React.CSSProperties = {
  width: 74,
  padding: "3px 7px",
  fontSize: 11.5,
  fontFamily: MONO,
};

export function Inspector({
  clip,
  orderIndex,
  canSplit,
  canTrimStart,
  canTrimEnd,
  canMoveUp,
  canMoveDown,
  textAreaRef,
  onPatch,
  onSplit,
  onTrimStart,
  onTrimEnd,
  onCleanSilence,
  sourceDuration,
  onDuplicate,
  onDelete,
  onMoveRow,
  variant = "bar",
}: Props) {
  const def = TRACK_BY_ID[clip.track];
  const isAudio = clip.track === "narration" || clip.track === "music";
  const name =
    clip.track === "text"
      ? clip.text || "Caption"
      : (clip.video_path ?? clip.audio_path ?? `Scene ${orderIndex ?? ""}`)
          .split(/[\\/]/)
          .pop();

  if (variant === "sidebar") {
    return (
      <div className="inspector-sidebar-card">
        {/* Header */}
        <div className="inspector-sidebar-header">
          <span className="inspector-track-icon" style={{ background: def.softColor, borderColor: `${def.color}55`, color: def.color }}>
            {clip.track === "video" ? (clip.video_path ? <Film size={13} /> : <ImageIcon size={13} />) : clip.track === "text" ? <Type size={13} /> : clip.track === "music" ? <Music2 size={13} /> : <Mic size={13} />}
          </span>
          <div className="inspector-title-group">
            <strong title={name}>{name}</strong>
            <span className="inspector-track-badge" style={{ color: def.color, background: def.softColor, borderColor: `${def.color}44` }}>{def.label}</span>
          </div>
          <div className="inspector-header-actions">
            <button className="btn-secondary" onClick={() => onMoveRow(-1)} disabled={!canMoveUp} title="Move to track above" style={{ padding: "3px 5px", fontSize: 10 }}>▲</button>
            <button className="btn-secondary" onClick={() => onMoveRow(1)} disabled={!canMoveDown} title="Move to track below" style={{ padding: "3px 5px", fontSize: 10 }}>▼</button>
            <button className="btn-secondary" onClick={onDuplicate} title="Duplicate (Ctrl+D)"><Copy size={12} /></button>
            <button className="btn-danger" onClick={onDelete} title="Delete (Del)"><Trash2 size={12} /></button>
          </div>
        </div>

        {/* Text editor for captions */}
        {clip.track === "text" && (
          <div className="inspector-section">
            <label className="inspector-section-label">Caption Content</label>
            <textarea
              ref={textAreaRef}
              value={clip.text ?? ""}
              onChange={(e) => onPatch({ text: e.target.value }, `txt:${clip.id}`)}
              rows={2}
              placeholder="Caption text…"
              className="inspector-textarea"
            />
          </div>
        )}

        {/* Timing Section */}
        <div className="inspector-section">
          <label className="inspector-section-label">Timing & Duration</label>
          <div className="inspector-grid-2">
            <Field label="Start">
              <input type="number" min={0} step={0.1} value={Number(clip.start.toFixed(2))} onChange={(e) => onPatch({ start: Math.max(0, parseFloat(e.target.value) || 0) }, `st:${clip.id}`)} style={numInputStyle} />
            </Field>
            <Field label="Duration">
              <input type="number" min={0.1} step={0.1} value={Number(clip.duration.toFixed(2))} onChange={(e) => onPatch({ duration: Math.max(0.1, parseFloat(e.target.value) || 0.1) }, `du:${clip.id}`)} style={numInputStyle} />
            </Field>
          </div>
          {sourceDuration != null && (
            <div className="inspector-subtext">
              Media Length: <strong>{sourceDuration.toFixed(1)}s</strong>
            </div>
          )}
        </div>

        {/* Audio Section */}
        {clip.track !== "text" && (
          <div className="inspector-section">
            <div className="inspector-section-header">
              <label className="inspector-section-label">Volume & Audio ({Math.round(clip.volume * 100)}%)</label>
              <button
                type="button"
                title={clip.muted ? "Unmute clip audio" : "Mute clip audio"}
                onClick={() => onPatch({ muted: !clip.muted }, `mu:${clip.id}`)}
                className={`inspector-mute-btn ${clip.muted ? "is-muted" : ""}`}
              >
                {clip.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={clip.muted ? 0 : clip.volume}
              disabled={clip.muted}
              onChange={(e) => onPatch({ volume: parseFloat(e.target.value) }, `vo:${clip.id}`)}
              className="inspector-volume-slider"
            />
            {isAudio && (
              <div className="inspector-grid-2" style={{ marginTop: 6 }}>
                <Field label="Audio In">
                  <input type="number" min={0} step={0.1} value={Number((clip.audio_in ?? 0).toFixed(2))} onChange={(e) => onPatch({ audio_in: Math.max(0, parseFloat(e.target.value) || 0) }, `ai:${clip.id}`)} style={numInputStyle} />
                </Field>
                <Field label="Fade In">
                  <input type="number" min={0} step={0.1} value={clip.fade_in ?? 0} onChange={(e) => onPatch({ fade_in: Math.max(0, parseFloat(e.target.value) || 0) }, `fi:${clip.id}`)} style={numInputStyle} />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* Motion Section */}
        {clip.track === "video" && (
          <div className="inspector-section">
            <label className="inspector-section-label">Motion Effect</label>
            <select
              value={clip.motion_effect ?? "none"}
              onChange={(e) => onPatch({ motion_effect: e.target.value })}
              className="inspector-select"
            >
              {ZOOM_OPTIONS.map((z) => (
                <option key={z.value} value={z.value}>{z.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="inspector-section">
          <label className="inspector-section-label">Quick Actions</label>
          <div className="inspector-actions-grid">
            <button className="btn-secondary inspector-action-btn" onClick={onSplit} disabled={!canSplit} title="Split at playhead (S)">
              <Scissors size={12} /> Split
            </button>
            <button className="btn-secondary inspector-action-btn" onClick={onTrimStart} disabled={!canTrimStart} title="Trim start to playhead">
              ◀ Trim In
            </button>
            <button className="btn-secondary inspector-action-btn" onClick={onTrimEnd} disabled={!canTrimEnd} title="Trim end to playhead">
              Trim Out ▶
            </button>
            {isAudio && onCleanSilence && (
              <button className="btn-secondary inspector-action-btn" onClick={onCleanSilence} title="Detect silent space at clip edges and trim it">
                <Waves size={12} /> Clean Silence
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="vtl-inspector"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: THEME.surfaceAlt,
        border: `1px solid ${THEME.separator}`,
        borderRadius: 10,
        padding: "9px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: def.softColor,
            border: `1px solid ${def.color}55`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: def.color,
          }}
        >
          {clip.track === "video" ? (
            clip.video_path ? (
              <Film size={12} />
            ) : (
              <ImageIcon size={12} />
            )
          ) : clip.track === "text" ? (
            <Type size={12} />
          ) : clip.track === "music" ? (
            <Music2 size={12} />
          ) : (
            <Mic size={12} />
          )}
        </span>
        <strong style={{ fontSize: 12.5, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </strong>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: def.color,
            background: def.softColor,
            border: `1px solid ${def.color}44`,
            padding: "1px 7px",
            borderRadius: 99,
            textTransform: "uppercase",
          }}
        >
          {def.label}
        </span>
        <span style={{ flex: 1 }} />
        <button
          className="btn-secondary"
          onClick={() => onMoveRow(-1)}
          disabled={!canMoveUp}
          title="Move to track above"
          style={{ padding: "4px 6px", fontSize: 11 }}
        >
          ▲
        </button>
        <button
          className="btn-secondary"
          onClick={() => onMoveRow(1)}
          disabled={!canMoveDown}
          title="Move to track below"
          style={{ padding: "4px 6px", fontSize: 11 }}
        >
          ▼
        </button>
        <button
          className="btn-secondary"
          onClick={onDuplicate}
          title="Duplicate (Ctrl+D)"
          style={{ padding: "4px 7px", display: "inline-flex" }}
        >
          <Copy size={13} />
        </button>
        <button
          className="btn-danger"
          onClick={onDelete}
          title="Delete (Del)"
          style={{ padding: "4px 7px", display: "inline-flex" }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {clip.track === "text" && (
        <textarea
          ref={textAreaRef}
          value={clip.text ?? ""}
          onChange={(e) =>
            onPatch({ text: e.target.value }, `txt:${clip.id}`)
          }
          rows={2}
          placeholder="Caption text…"
          style={{ fontSize: 12, minHeight: 46 }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <Field label="Start">
          <input
            type="number"
            min={0}
            step={0.1}
            value={Number(clip.start.toFixed(2))}
            onChange={(e) =>
              onPatch(
                { start: Math.max(0, parseFloat(e.target.value) || 0) },
                `st:${clip.id}`,
              )
            }
            style={numInputStyle}
          />
        </Field>
        <Field label="Duration">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={Number(clip.duration.toFixed(2))}
            onChange={(e) =>
              onPatch(
                {
                  duration: Math.max(
                    0.1,
                    parseFloat(e.target.value) || 0.1,
                  ),
                },
                `du:${clip.id}`,
              )
            }
            style={numInputStyle}
          />
        </Field>
        {sourceDuration != null && (
          <Field label="Source">
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                color:
                  sourceDuration > clip.duration + 0.05
                    ? "#ffd166"
                    : "#8e8e98",
                whiteSpace: "nowrap",
              }}
              title="Actual media file length"
            >
              {sourceDuration.toFixed(1)}s
            </span>
          </Field>
        )}
        {isAudio && (
          <>
            <Field label="Audio In">
              <input
                type="number"
                min={0}
                step={0.1}
                value={Number((clip.audio_in ?? 0).toFixed(2))}
                onChange={(e) =>
                  onPatch(
                    {
                      audio_in: Math.max(
                        0,
                        parseFloat(e.target.value) || 0,
                      ),
                    },
                    `ai:${clip.id}`,
                  )
                }
                style={numInputStyle}
              />
            </Field>
            <Field label="Fade In">
              <input
                type="number"
                min={0}
                step={0.1}
                value={clip.fade_in ?? 0}
                onChange={(e) =>
                  onPatch(
                    { fade_in: Math.max(0, parseFloat(e.target.value) || 0) },
                    `fi:${clip.id}`,
                  )
                }
                style={numInputStyle}
              />
            </Field>
            <Field label="Fade Out">
              <input
                type="number"
                min={0}
                step={0.1}
                value={clip.fade_out ?? 0}
                onChange={(e) =>
                  onPatch(
                    { fade_out: Math.max(0, parseFloat(e.target.value) || 0) },
                    `fo:${clip.id}`,
                  )
                }
                style={numInputStyle}
              />
            </Field>
          </>
        )}
        {clip.track !== "text" && (
          <Field
            label={`Volume ${Math.round(clip.volume * 100)}%`}
            extra={
              <button
                type="button"
                title={clip.muted ? "Unmute clip audio" : "Mute clip audio"}
                onClick={() => onPatch({ muted: !clip.muted }, `mu:${clip.id}`)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border: `1px solid ${clip.muted ? "#ff6b78" : THEME.separator}`,
                  background: clip.muted ? "rgba(255,107,120,0.16)" : THEME.surfaceAlt,
                  color: clip.muted ? "#ff6b78" : "#c9c9d1",
                  cursor: "pointer",
                }}
              >
                {clip.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            }
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={clip.muted ? 0 : clip.volume}
              disabled={clip.muted}
              onChange={(e) =>
                onPatch(
                  { volume: parseFloat(e.target.value) },
                  `vo:${clip.id}`,
                )
              }
              style={{ width: 96, accentColor: THEME.accent, cursor: "pointer" }}
            />
          </Field>
        )}
        {clip.track === "video" && (
          <Field label="Motion">
            <select
              value={clip.motion_effect ?? "none"}
              onChange={(e) => onPatch({ motion_effect: e.target.value })}
              style={{ width: 110, padding: "3px 7px", fontSize: 11.5 }}
            >
              {ZOOM_OPTIONS.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <span style={{ flex: 1 }} />
        <button
          className="btn-secondary"
          onClick={onSplit}
          disabled={!canSplit}
          title="Split at playhead (S)"
          style={{
            fontSize: 11,
            padding: "4px 8px",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Scissors size={12} /> Split
        </button>
        <button
          className="btn-secondary"
          onClick={onTrimStart}
          disabled={!canTrimStart}
          title="Trim start to playhead"
          style={{ fontSize: 11, padding: "4px 8px" }}
        >
          ◀ Trim In
        </button>
        <button
          className="btn-secondary"
          onClick={onTrimEnd}
          disabled={!canTrimEnd}
          title="Trim end to playhead"
          style={{ fontSize: 11, padding: "4px 8px" }}
        >
          Trim Out ▶
        </button>
        {isAudio && onCleanSilence && (
          <button
            className="btn-secondary"
            onClick={onCleanSilence}
            title="Detect silent space at clip edges and trim it"
            style={{
              fontSize: 11,
              padding: "4px 8px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Waves size={12} /> Clean silence
          </button>
        )}
      </div>
    </div>
  );
}
