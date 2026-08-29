import { Check, List } from "lucide-react";
import type { Scene } from "../../types";
import "./ScenesSidebar.css";

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
    <div className="card scenes-sidebar">
      <div className="scenes-sidebar-header">
        <List size={16} color="var(--text-muted)" />
        <h3 className="scenes-sidebar-title">Scenes</h3>
      </div>

      <div className="scenes-list">
        {scenes.map((scene, i) => {
          const active = i === activeIdx;
          const done = isCompleted(scene);
          const label = getSceneLabel(i);
          const durText = formatDuration(scene.duration_seconds);

          let badgeClass = "scene-badge pending";
          if (active) badgeClass = "scene-badge active";
          else if (done) badgeClass = "scene-badge done";

          return (
            <button
              key={scene.id}
              onClick={() => onSelectScene(i)}
              className={`scene-item${active ? " is-active" : ""}`}
            >
              <div className={badgeClass}>
                {done && !active ? <Check size={11} color="#fff" /> : (i + 1).toString().padStart(2, "0")}
              </div>

              <div className="scene-item-info">
                <div className="scene-item-title">{label}</div>
                <div className="scene-item-duration">{durText}</div>
              </div>

              {active && (
                <div className="scene-wave">
                  <div className="wave-bar" style={{ animationDelay: "0.1s" }} />
                  <div className="wave-bar" style={{ animationDelay: "0.3s" }} />
                  <div className="wave-bar" style={{ animationDelay: "0.5s" }} />
                </div>
              )}

              {!active && done && (
                <div className="scene-dot" />
              )}
            </button>
          );
        })}
      </div>

      <div className="scenes-legend">
        <div className="scenes-legend-item">
          <div className="scenes-legend-dot" style={{ background: "var(--success)" }} />
          <span>Done</span>
        </div>
        <div className="scenes-legend-item">
          <div className="scenes-legend-dot" style={{ background: "var(--accent)" }} />
          <span>Active</span>
        </div>
        <div className="scenes-legend-item">
          <div className="scenes-legend-dot" style={{ background: "rgba(255,255,255,0.15)" }} />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}
