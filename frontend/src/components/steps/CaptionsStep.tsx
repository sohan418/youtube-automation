import { Type, Eye, Zap, Film, Feather, AlignCenter } from "lucide-react";
import type { Scene } from "../../types";

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
  ratio,
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {/* Header */}
      <div className="card" style={{ padding: "0.6rem 0.85rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <Type size={15} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: "0.9rem" }}>Captions</h3>
          <span style={{ marginLeft: "auto", display: "flex", gap: "0.85rem", fontSize: "0.72rem", color: "var(--text-muted)" }}>
            <span>
              <strong style={{ color: "var(--text)" }}>{scenes.length}</strong> scenes
            </span>
            <span>
              <strong style={{ color: "var(--text)" }}>{totalWords}</strong> words
            </span>
            {activeStyle.value === "word_by_word" && totalWords > 0 && (
              <span>
                ~<strong style={{ color: "var(--text)" }}>{Math.ceil(totalWords / 4)}</strong> blocks
              </span>
            )}
          </span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "0.25rem 0 0" }}>
          Configure how narration text appears on screen. Applied when building the final video.
        </p>
      </div>

      {/* Enable / Disable Toggle */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.6rem 0.85rem",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>Burn Captions on Video</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
            Hardcode subtitles onto video frames (not a separate .srt file)
          </div>
        </div>
        <button
          type="button"
          onClick={() => update({ captions_enabled: !enableSubtitles }, () => setEnableSubtitles(!enableSubtitles))}
          style={{
            minWidth: "44px",
            height: "24px",
            borderRadius: "12px",
            border: "none",
            background: enableSubtitles ? "var(--primary)" : "var(--border)",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "3px",
              left: enableSubtitles ? "23px" : "3px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </button>
      </div>

      {/* Style Presets (left) + Live Preview (right) */}
      {enableSubtitles && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "0.6rem", alignItems: "start" }}>
          {/* Left column: presets + appearance */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.6rem 0.85rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>Caption Style</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                {STYLES.map((style) => {
                  const Icon = style.icon;
                  const active = subtitleStyle === style.value;
                  return (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => update({ caption_style: style.value }, () => setSubtitleStyle(style.value))}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: "0.25rem",
                        padding: "0.45rem 0.55rem",
                        borderRadius: "var(--radius)",
                        border: active ? `2px solid var(--primary)` : `1px solid var(--border)`,
                        background: active ? "var(--surface)" : "var(--bg)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Icon size={13} color={active ? "var(--primary)" : "var(--text-muted)"} />
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            color: active ? "var(--primary)" : "var(--text)",
                          }}
                        >
                          {style.label}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                        {style.description}
                      </span>
                      <div
                        style={{
                          marginTop: "0.1rem",
                          padding: "0.2rem 0.4rem",
                          borderRadius: "4px",
                          background: "#000",
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          color: subtitleColor,
                          fontFamily: style.value === "shorts" ? "Impact, sans-serif" : "Arial, sans-serif",
                          letterSpacing: style.value === "shorts" ? "0.5px" : "normal",
                          textTransform: style.value === "shorts" ? "uppercase" : "none",
                          width: "100%",
                          textAlign: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          boxSizing: "border-box",
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
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.65rem", padding: "0.6rem 0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <AlignCenter size={14} color="var(--text-muted)" />
                  <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>Position & Appearance</span>
                </div>

                {/* Position */}
                <div>
                  <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                    Text Position
                  </label>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos.value}
                        type="button"
                        onClick={() => update({ caption_position: pos.value }, () => setSubtitlePosition(pos.value))}
                        style={{
                          flex: 1,
                          padding: "0.35rem 0",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          borderRadius: "6px",
                          border: subtitlePosition === pos.value ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                          background: subtitlePosition === pos.value ? "var(--surface)" : "var(--bg)",
                          color: subtitlePosition === pos.value ? "var(--primary)" : "var(--text-muted)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color + Outline Color */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <div>
                    <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                      Text Color
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => update({ caption_color: c }, () => setSubtitleColor(c))}
                          title={c}
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            background: c,
                            border: subtitleColor === c ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                            cursor: "pointer",
                            boxShadow: subtitleColor === c ? "0 0 0 2px rgba(139,92,246,0.25)" : "none",
                            transition: "all 0.15s ease",
                          }}
                        />
                      ))}
                      <label
                        title="Custom color"
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                          border: "1.5px solid var(--border)",
                          cursor: "pointer",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <input
                          type="color"
                          value={subtitleColor}
                          onChange={(e) => update({ caption_color: e.target.value }, () => setSubtitleColor(e.target.value))}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                        />
                      </label>
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "0.2rem", display: "inline-block" }}>
                      {subtitleColor}
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                      Outline Color
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap" }}>
                      {OUTLINE_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => update({ caption_outline_color: c }, () => setSubtitleOutlineColor(c))}
                          title={c}
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            background: c,
                            border: subtitleOutlineColor === c ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                            cursor: "pointer",
                            boxShadow: subtitleOutlineColor === c ? "0 0 0 2px rgba(139,92,246,0.25)" : "none",
                            transition: "all 0.15s ease",
                          }}
                        />
                      ))}
                      <label
                        title="Custom outline color"
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                          border: "1.5px solid var(--border)",
                          cursor: "pointer",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <input
                          type="color"
                          value={subtitleOutlineColor}
                          onChange={(e) => update({ caption_outline_color: e.target.value }, () => setSubtitleOutlineColor(e.target.value))}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                        />
                      </label>
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "0.2rem", display: "inline-block" }}>
                      {subtitleOutlineColor}
                    </span>
                  </div>
                </div>

                {/* Outline Thickness */}
                <div>
                  <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                    <span>Outline Thickness</span>
                    <span style={{ fontFamily: "monospace", color: "var(--text)" }}>{subtitleOutline.toFixed(1)}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.5}
                    value={subtitleOutline}
                    onChange={(e) => update({ caption_outline: parseFloat(e.target.value) }, () => setSubtitleOutline(parseFloat(e.target.value)))}
                    style={{ width: "100%", marginTop: "0.15rem", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--text-muted)" }}>
                    <span>None</span>
                    <span>Thick</span>
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Font Size</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {subtitleFontSize === null ? (
                        <span style={{ fontFamily: "monospace", color: "var(--text-muted)", fontSize: "0.68rem" }}>Auto</span>
                      ) : (
                        <span style={{ fontFamily: "monospace", color: "var(--text)" }}>{subtitleFontSize}px</span>
                      )}
                      {subtitleFontSize !== null && (
                        <button
                          type="button"
                          onClick={() => update({ caption_font_size: null }, () => setSubtitleFontSize(null))}
                          title="Reset to auto"
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.68rem", padding: "0 2px", lineHeight: 1 }}
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
                    style={{ width: "100%", marginTop: "0.15rem", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--text-muted)" }}>
                    <span>Small (16px)</span>
                    <span>Auto</span>
                    <span>Large (120px)</span>
                  </div>
                </div>

            </div>

          </div>

          {/* Right column: live preview */}
          <div className="card" style={{ padding: "0.6rem 0.85rem", position: "sticky", top: "1rem" }}>
            <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
              Live Preview
            </label>
            <div
              style={{
                position: "relative",
                width: "100%",
                ...(ratio === "9:16"
                  ? { aspectRatio: "9 / 16", maxHeight: "400px" }
                  : { aspectRatio: "16 / 9", maxHeight: "260px" }),
                borderRadius: "8px",
                background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                overflow: "hidden",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "0.58rem", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
                VIDEO AREA
              </div>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  ...(subtitlePosition === "top"
                    ? { top: "6px", transform: "translateX(-50%)" }
                    : subtitlePosition === "center"
                    ? { top: "50%", transform: "translate(-50%, -50%)" }
                    : { bottom: "6px", transform: "translateX(-50%)" }),
                  padding: "0.15rem 0.5rem",
                  borderRadius: "3px",
                  background: "rgba(0,0,0,0.5)",
                  maxWidth: "90%",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontSize: subtitleFontSize ? `${Math.round(subtitleFontSize * 0.36)}px` : "0.68rem",
                    fontWeight: 700,
                    color: subtitleColor,
                    fontFamily: subtitleStyle === "shorts" ? "Impact, sans-serif" : "Arial, sans-serif",
                    letterSpacing: subtitleStyle === "shorts" ? "0.5px" : "normal",
                    textTransform: subtitleStyle === "shorts" ? "uppercase" : "none",
                    textShadow: subtitleOutline > 0
                      ? `1px 1px ${subtitleOutline}px ${subtitleOutlineColor}, -1px -1px ${subtitleOutline}px ${subtitleOutlineColor}, 1px -1px ${subtitleOutline}px ${subtitleOutlineColor}, -1px 1px ${subtitleOutline}px ${subtitleOutlineColor}`
                      : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Your caption text here
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scene Narration Preview */}
      {hasNarration && enableSubtitles && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.45rem", padding: "0.6rem 0.85rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Eye size={14} color="var(--text-muted)" />
            <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>Narration Preview</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", maxHeight: "240px", overflowY: "auto" }}>
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
                  style={{
                    padding: "0.4rem 0.5rem",
                    borderRadius: "6px",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                    Scene {scene.order_index}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem" }}>
                    {chunks.map((chunk, ci) => (
                      <span
                        key={ci}
                        style={{
                          padding: "0.1rem 0.35rem",
                          borderRadius: "3px",
                          background: "rgba(255,255,255,0.08)",
                          fontSize: "0.7rem",
                          color: "var(--text)",
                          lineHeight: 1.35,
                        }}
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
