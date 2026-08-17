import { Check, List } from "lucide-react";
import type { Scene } from "../../types";

interface Props {
  scenes: Scene[];
  activeIdx: number;
  onSelectScene: (idx: number) => void;
  stepKind: "images" | "voice";
}

export default function ScenesSidebar({
  scenes,
  activeIdx,
  onSelectScene,
  stepKind,
}: Props) {
  const getSceneLabel = (idx: number) => {
    return `Scene ${idx + 1}`;
  };

  const isCompleted = (scene: Scene) => {
    if (stepKind === "voice") {
      return !!scene.audio_path;
    } else {
      return !!(scene.image_path || scene.video_path || scene.images?.length > 0);
    }
  };

  const formatDuration = (sec: number | null) => {
    if (!sec || sec <= 0) return "00:05";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "0.85rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.85rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.5rem",
        }}
      >
        <List size={16} color="var(--text-muted)" />
        <h3 style={{ fontSize: "0.95rem", margin: 0, fontWeight: 700 }}>Scenes</h3>
      </div>

      {/* Scrollable list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem",
          paddingRight: "0.15rem",
          minHeight: 0,
        }}
      >
        {scenes.map((scene, i) => {
          const active = i === activeIdx;
          const done = isCompleted(scene);
          const label = getSceneLabel(i);
          const durText = formatDuration(scene.duration_seconds);

          let dotBg = "rgba(255, 255, 255, 0.1)";
          let ringColor = "transparent";
          let badgeTextColor = "var(--text-muted)";

          if (active) {
            dotBg = "var(--accent)";
            ringColor = "rgba(0, 184, 212, 0.25)";
            badgeTextColor = "#fff";
          } else if (done) {
            dotBg = "var(--success)";
            badgeTextColor = "var(--success)";
          }

          return (
            <button
              key={scene.id}
              onClick={() => onSelectScene(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                width: "100%",
                background: active ? "rgba(255, 255, 255, 0.03)" : "transparent",
                border: active ? "1px solid rgba(0, 184, 212, 0.4)" : "1px solid transparent",
                borderRadius: "6px",
                padding: "0.45rem 0.6rem",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: active ? "0 0 10px rgba(0, 184, 212, 0.08)" : "none",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "rgba(255, 255, 255, 0.015)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              {/* Badge/Dot */}
              <div
                style={{
                  position: "relative",
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: dotBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: badgeTextColor,
                  border: `2px solid ${ringColor}`,
                  flexShrink: 0,
                }}
              >
                {done && !active ? <Check size={11} color="#fff" /> : (i + 1).toString().padStart(2, "0")}
              </div>

              {/* Title & Duration */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: active ? 600 : 500,
                    color: active ? "var(--text)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" }}>
                  {durText}
                </div>
              </div>

              {/* Active Soundwave Indicator */}
              {active && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "10px" }}>
                  <div className="wave-bar" style={{ animationDelay: "0.1s" }} />
                  <div className="wave-bar" style={{ animationDelay: "0.3s" }} />
                  <div className="wave-bar" style={{ animationDelay: "0.5s" }} />
                  <style>{`
                    .wave-bar {
                      width: 2px;
                      background: var(--accent);
                      height: 100%;
                      animation: soundwave 0.8s ease-in-out infinite alternate;
                    }
                    @keyframes soundwave {
                      from { height: 3px; }
                      to { height: 12px; }
                    }
                  `}</style>
                </div>
              )}

              {/* Completion status icon */}
              {!active && done && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: "0.5rem",
          marginTop: "0.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.45rem",
          fontSize: "0.64rem",
          color: "var(--text-muted)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }} />
          <span>Done</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
          <span>Active</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}
