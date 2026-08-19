import { Type, Eye, Zap, Film, Feather, AlignCenter } from "lucide-react";
import type { Scene } from "../../types";

interface Props {
  scenes: Scene[];
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
}: Props) {
  const totalWords = scenes.reduce((sum, s) => sum + (s.narration?.split(/\s+/).length || 0), 0);
  const hasNarration = scenes.some((s) => s.narration);
  const activeStyle = STYLES.find((s) => s.value === subtitleStyle) || STYLES[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Type size={20} color="var(--primary)" />
          <h3 style={{ margin: 0 }}>Subtitles & Captions</h3>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
          Configure how narration text appears on screen. These settings are applied when you build the final video.
        </p>

        {/* Stats */}
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.25rem" }}>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text)" }}>{scenes.length}</strong> scenes
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text)" }}>{totalWords}</strong> words
          </div>
          {activeStyle.value === "word_by_word" && totalWords > 0 && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              ~<strong style={{ color: "var(--text)" }}>{Math.ceil(totalWords / 4)}</strong> caption blocks
            </div>
          )}
        </div>
      </div>

      {/* Enable / Disable Toggle */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.2rem",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Burn Captions on Video</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
            Hardcode subtitles directly onto the video frames (not a separate .srt file)
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnableSubtitles(!enableSubtitles)}
          style={{
            minWidth: "48px",
            height: "26px",
            borderRadius: "13px",
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
              left: enableSubtitles ? "25px" : "3px",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </button>
      </div>

      {/* Style Presets */}
      {enableSubtitles && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Choose Caption Style</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            {STYLES.map((style) => {
              const Icon = style.icon;
              const active = subtitleStyle === style.value;
              return (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setSubtitleStyle(style.value)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "0.4rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius)",
                    border: active ? `2px solid var(--primary)` : `1px solid var(--border)`,
                    background: active ? "rgba(255, 0, 60, 0.06)" : "var(--bg)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Icon size={15} color={active ? "var(--primary)" : "var(--text-muted)"} />
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        color: active ? "var(--primary)" : "var(--text)",
                      }}
                    >
                      {style.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.35 }}>
                    {style.description}
                  </span>
                  {/* Mini preview */}
                    <div
                      style={{
                        marginTop: "0.15rem",
                        padding: "0.3rem 0.5rem",
                        borderRadius: "4px",
                        background: "#000",
                        fontSize: "0.65rem",
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
      )}

      {enableSubtitles && (
        <>
          {/* Position, Color & Outline Controls */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <AlignCenter size={16} color="var(--text-muted)" />
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Position & Appearance</span>
            </div>

            {/* Position */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                Text Position
              </label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {POSITIONS.map((pos) => (
                  <button
                    key={pos.value}
                    type="button"
                    onClick={() => setSubtitlePosition(pos.value)}
                    style={{
                      flex: 1,
                      padding: "0.45rem 0",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      borderRadius: "6px",
                      border: subtitlePosition === pos.value ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                      background: subtitlePosition === pos.value ? "rgba(255, 0, 60, 0.08)" : "var(--bg)",
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

            {/* Text Color */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                Text Color
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSubtitleColor(c)}
                    title={c}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: c,
                      border: subtitleColor === c ? "2.5px solid var(--primary)" : "2px solid var(--border)",
                      cursor: "pointer",
                      boxShadow: subtitleColor === c ? "0 0 0 2px rgba(255,0,60,0.2)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  />
                ))}
                <label
                  title="Custom color"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                    border: "2px solid var(--border)",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <input
                    type="color"
                    value={subtitleColor}
                    onChange={(e) => setSubtitleColor(e.target.value)}
                    style={{ position: "absolute", width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                  />
                </label>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {subtitleColor}
                </span>
              </div>
            </div>

            {/* Outline Color */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                Outline / Border Color
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                {["#000000", "#FFFFFF", "#1A1A1A", "#333333", "#222222", "#0D0D0D"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSubtitleOutlineColor(c)}
                    title={c}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: c,
                      border: subtitleOutlineColor === c ? "2.5px solid var(--primary)" : "2px solid var(--border)",
                      cursor: "pointer",
                      boxShadow: subtitleOutlineColor === c ? "0 0 0 2px rgba(255,0,60,0.2)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  />
                ))}
                <label
                  title="Custom outline color"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                    border: "2px solid var(--border)",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <input
                    type="color"
                    value={subtitleOutlineColor}
                    onChange={(e) => setSubtitleOutlineColor(e.target.value)}
                    style={{ position: "absolute", width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                  />
                </label>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {subtitleOutlineColor}
                </span>
              </div>
            </div>

            {/* Outline Thickness */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>Outline Thickness</span>
                <span style={{ fontFamily: "monospace", color: "var(--text)" }}>{subtitleOutline.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={6}
                step={0.5}
                value={subtitleOutline}
                onChange={(e) => setSubtitleOutline(parseFloat(e.target.value))}
                style={{ width: "100%", marginTop: "0.3rem", accentColor: "var(--primary)", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                <span>None</span>
                <span>Thick</span>
              </div>
            </div>

            {/* Live Preview Box */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                Live Preview
              </label>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "120px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: "0.6rem", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
                  VIDEO AREA
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    ...(subtitlePosition === "top"
                      ? { top: "8px", transform: "translateX(-50%)" }
                      : subtitlePosition === "center"
                      ? { top: "50%", transform: "translate(-50%, -50%)" }
                      : { bottom: "8px", transform: "translateX(-50%)" }),
                    padding: "0.2rem 0.6rem",
                    borderRadius: "3px",
                    background: "rgba(0,0,0,0.5)",
                    maxWidth: "90%",
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.7rem",
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
        </>
      )}

      {/* Scene Narration Preview */}
      {hasNarration && enableSubtitles && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Eye size={16} color="var(--text-muted)" />
            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>Narration Preview</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "280px", overflowY: "auto" }}>
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
                    padding: "0.5rem 0.65rem",
                    borderRadius: "6px",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                    Scene {scene.order_index}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {chunks.map((chunk, ci) => (
                      <span
                        key={ci}
                        style={{
                          padding: "0.15rem 0.4rem",
                          borderRadius: "3px",
                          background: "rgba(255,255,255,0.08)",
                          fontSize: "0.72rem",
                          color: "var(--text)",
                          lineHeight: 1.4,
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
