import { Type, Eye, Zap, Film, Feather, AlignCenter } from "lucide-react";
import type { Scene } from "../../types";
import "./CaptionsStep.css";

interface Props {
  scenes: Scene[];
  ratio: string;
  enableSubtitles: boolean;
  setEnableSubtitles: (v: boolean) => void;
  subtitleStyle: string;
  setSubtitleStyle: (v: string) => void;
  subtitlePosition: string;
  setSubtitlePosition: (v: string) => void;
  subtitleColor: string;
  setSubtitleColor: (v: string) => void;
  subtitleOutlineColor: string;
  setSubtitleOutlineColor: (v: string) => void;
  subtitleOutline: number;
  setSubtitleOutline: (v: number) => void;
  subtitleFontSize: number | null;
  setSubtitleFontSize: (v: number | null) => void;
  onSave?: (patch: Record<string, unknown>) => Promise<void>;
}

const STYLES = [
  {
    value: "shorts",
    label: "Impact Bold",
    icon: Zap,
    description: "Large yellow Impact font — perfect for Shorts & TikTok",
    color: "#FFD700",
    preview: "THIS IS HOW YOUR CAPTION LOOKS",
  },
  {
    value: "classic",
    label: "Classic White",
    icon: Film,
    description: "Clean white Arial text with subtle outline — cinematic feel",
    color: "#FFFFFF",
    preview: "This is how your caption looks",
  },
  {
    value: "default",
    label: "Arial Standard",
    icon: Feather,
    description: "Yellow Arial text — balanced and readable on any background",
    color: "#FFFF00",
    preview: "This is how your caption looks",
  },
  {
    value: "word_by_word",
    label: "Word by Word",
    icon: Type,
    description: "Shows 3-5 words at a time, synced with the narrator — karaoke style",
    color: "#00E5FF",
    preview: "Shows a few words → then next few → and so on",
  },
];

const POSITIONS = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

const COLOR_PRESETS = [
  "#FFFF00", "#FFFFFF", "#FFD700", "#00E5FF",
  "#FF4081", "#76FF03", "#FF6D00", "#E040FB",
];

const OUTLINE_PRESETS = ["#000000", "#FFFFFF", "#1A1A1A", "#333333", "#222222", "#0D0D0D"];

export default function CaptionsStep({
  scenes,
  enableSubtitles,
  setEnableSubtitles,
  subtitleStyle,
  setSubtitleStyle,
  subtitlePosition,
  setSubtitlePosition,
  subtitleColor,
  setSubtitleColor,
  subtitleOutlineColor,
  setSubtitleOutlineColor,
  subtitleOutline,
  setSubtitleOutline,
  subtitleFontSize,
  setSubtitleFontSize,
  onSave,
}: Props) {
  const totalWords = scenes.reduce((sum, s) => sum + (s.narration?.split(/\s+/).length || 0), 0);
  const hasNarration = scenes.some((s) => s.narration);
  const activeStyle = STYLES.find((s) => s.value === subtitleStyle) || STYLES[0];

  const update = (patch: Record<string, unknown>, local?: () => void) => {
    if (local) local();
    onSave?.(patch);
  };

  return (
    <div className="captions-root">
      {/* Header */}
      <div className="card captions-header">
        <div className="captions-header-row">
          <Type size={15} color="var(--primary)" />
          <h3 className="captions-header-title">Captions</h3>
          <span className="captions-header-stats">
            <span>
              <strong className="captions-stat">{scenes.length}</strong> scenes
            </span>
            <span>
              <strong className="captions-stat">{totalWords}</strong> words
            </span>
            {activeStyle.value === "word_by_word" && totalWords > 0 && (
              <span>
                ~<strong className="captions-stat">{Math.ceil(totalWords / 4)}</strong> blocks
              </span>
            )}
          </span>
        </div>
        <p className="captions-header-desc">
          Configure how narration text appears on screen. Applied when building the final video.
        </p>
      </div>

      {/* Enable / Disable Toggle */}
      <div className="card captions-toggle">
        <div>
          <div className="captions-toggle-title">Burn Captions on Video</div>
          <div className="captions-toggle-desc">
            Hardcode subtitles onto video frames (not a separate .srt file)
          </div>
        </div>
        <button
          type="button"
          onClick={() => update({ captions_enabled: !enableSubtitles }, () => setEnableSubtitles(!enableSubtitles))}
          className="captions-toggle-btn"
          style={{ background: enableSubtitles ? "var(--primary)" : "var(--border)" }}
        >
          <span
            className="captions-toggle-knob"
            style={{ left: enableSubtitles ? "23px" : "3px" }}
          />
        </button>
      </div>

      {/* Caption Customizations stacked vertically */}
      {enableSubtitles && (
        <div className="captions-column">
          <div className="card captions-card">
            <div className="captions-section-title">Caption Style</div>

            <div className="captions-style-grid">
              {STYLES.map((style) => {
                  const Icon = style.icon;
                  const active = subtitleStyle === style.value;
                  return (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => update({ caption_style: style.value }, () => setSubtitleStyle(style.value))}
                      className="captions-style-btn"
                      style={{
                        border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: active ? "var(--surface)" : "var(--bg)",
                      }}
                    >
                      <div className="captions-style-label-row">
                        <Icon size={13} color={active ? "var(--primary)" : "var(--text-muted)"} />
                        <span
                          className="captions-style-label"
                          style={{ color: active ? "var(--primary)" : "var(--text)" }}
                        >
                          {style.label}
                        </span>
                      </div>
                      <span className="captions-style-desc">
                        {style.description}
                      </span>
                      <div
                        className="captions-preview"
                        style={{
                          color: subtitleColor,
                          fontFamily: style.value === "shorts" ? "Impact, sans-serif" : "Arial, sans-serif",
                          letterSpacing: style.value === "shorts" ? "0.5px" : "normal",
                          textTransform: style.value === "shorts" ? "uppercase" : "none",
                          textShadow: `1px 1px 2px ${subtitleOutlineColor}, -1px -1px 2px ${subtitleOutlineColor}, 1px -1px 2px ${subtitleOutlineColor}, -1px 1px 2px ${subtitleOutlineColor}`,
                        }}
                      >
                        {style.preview}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Position & Appearance */}
            <div className="card captions-appearance-card">
                <div className="captions-appearance-row">
                  <AlignCenter size={14} color="var(--text-muted)" />
                  <span className="captions-section-title">Position & Appearance</span>
                </div>

                {/* Position */}
                <div>
                  <label className="captions-label">
                    Text Position
                  </label>
                  <div className="captions-position-group">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos.value}
                        type="button"
                        onClick={() => update({ caption_position: pos.value }, () => setSubtitlePosition(pos.value))}
                        className="captions-position-btn"
                        style={{
                          border: subtitlePosition === pos.value ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                          background: subtitlePosition === pos.value ? "var(--surface)" : "var(--bg)",
                          color: subtitlePosition === pos.value ? "var(--primary)" : "var(--text-muted)",
                        }}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color + Outline Color */}
                <div className="captions-color-grid">
                  <div>
                    <label className="captions-label">
                      Text Color
                    </label>
                    <div className="captions-swatch-group">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => update({ caption_color: c }, () => setSubtitleColor(c))}
                          title={c}
                          className="captions-swatch"
                          style={{
                            background: c,
                            border: subtitleColor === c ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                            boxShadow: subtitleColor === c ? "0 0 0 2px rgba(139,92,246,0.25)" : "none",
                          }}
                        />
                      ))}
                      <label
                        title="Custom color"
                        className="captions-swatch-custom"
                      >
                        <input
                          type="color"
                          value={subtitleColor}
                          onChange={(e) => update({ caption_color: e.target.value }, () => setSubtitleColor(e.target.value))}
                          className="captions-swatch-input"
                        />
                      </label>
                    </div>
                    <span className="captions-color-value">
                      {subtitleColor}
                    </span>
                  </div>

                  <div>
                    <label className="captions-label">
                      Outline Color
                    </label>
                    <div className="captions-swatch-group">
                      {OUTLINE_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => update({ caption_outline_color: c }, () => setSubtitleOutlineColor(c))}
                          title={c}
                          className="captions-swatch"
                          style={{
                            background: c,
                            border: subtitleOutlineColor === c ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                            boxShadow: subtitleOutlineColor === c ? "0 0 0 2px rgba(139,92,246,0.25)" : "none",
                          }}
                        />
                      ))}
                      <label
                        title="Custom outline color"
                        className="captions-swatch-custom"
                      >
                        <input
                          type="color"
                          value={subtitleOutlineColor}
                          onChange={(e) => update({ caption_outline_color: e.target.value }, () => setSubtitleOutlineColor(e.target.value))}
                          className="captions-swatch-input"
                        />
                      </label>
                    </div>
                    <span className="captions-color-value">
                      {subtitleOutlineColor}
                    </span>
                  </div>
                </div>

                {/* Outline Thickness */}
                <div>
                  <label className="captions-outline-label">
                    <span>Outline Thickness</span>
                    <span className="captions-monospace-value">{subtitleOutline.toFixed(1)}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.5}
                    value={subtitleOutline}
                    onChange={(e) => update({ caption_outline: parseFloat(e.target.value) }, () => setSubtitleOutline(parseFloat(e.target.value)))}
                    className="captions-range"
                  />
                  <div className="captions-range-marks">
                    <span>None</span>
                    <span>Thick</span>
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className="captions-font-label">
                    <span>Font Size</span>
                    <span className="captions-font-value-row">
                      {subtitleFontSize === null ? (
                        <span className="captions-monospace-muted">Auto</span>
                      ) : (
                        <span className="captions-monospace-value">{subtitleFontSize}px</span>
                      )}
                      {subtitleFontSize !== null && (
                        <button
                          type="button"
                          onClick={() => update({ caption_font_size: null }, () => setSubtitleFontSize(null))}
                          title="Reset to auto"
                          className="captions-reset-btn"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={16}
                    max={120}
                    step={2}
                    value={subtitleFontSize ?? 40}
                    onChange={(e) => update({ caption_font_size: parseInt(e.target.value, 10) }, () => setSubtitleFontSize(parseInt(e.target.value, 10)))}
                    className="captions-range"
                  />
                  <div className="captions-range-marks">
                    <span>Small (16px)</span>
                    <span>Auto</span>
                    <span>Large (120px)</span>
                  </div>
                </div>

            </div>

        </div>
      )}

      {/* Scene Narration Preview */}
      {hasNarration && enableSubtitles && (
        <div className="card captions-preview-card">
          <div className="captions-appearance-row">
            <Eye size={14} color="var(--text-muted)" />
            <span className="captions-section-title">Narration Preview</span>
          </div>
          <div className="captions-preview-list">
            {scenes.map((scene) => {
              const narration = scene.narration || "";
              if (!narration) return null;
              const chunks =
                subtitleStyle === "word_by_word"
                  ? narration.split(/\s+/).reduce<string[][]>((acc, word) => {
                      const last = acc[acc.length - 1];
                      if (!last || last.length >= 4) acc.push([word]);
                      else last.push(word);
                      return acc;
                    }, [])
                  : [narration.split(/\s+/)];
              return (
                <div
                  key={scene.id}
                  className="captions-narration-item"
                >
                  <div className="captions-scene-label">
                    Scene {scene.order_index}
                  </div>
                  <div className="captions-chunks">
                    {chunks.map((chunk, ci) => (
                      <span
                        key={ci}
                        className="captions-chunk"
                      >
                        {chunk.join(" ")}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
