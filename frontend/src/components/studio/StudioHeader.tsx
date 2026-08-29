import { Link } from "react-router-dom";
import { Home, HelpCircle, Settings, Clapperboard, Download } from "lucide-react";
import { getProgressPercent, getCompletedCount, type StepStatusData, STUDIO_STEPS } from "./studioSteps";
import type { Project, VideoStatus } from "../../types";

const RATIOS = [
  { value: "16:9", label: "16:9", sub: "Landscape" },
  { value: "9:16", label: "9:16", sub: "Shorts" },
];

interface Props {
  project: Project;
  statusData: StepStatusData;
  openSettings: () => void;
  selectedRatio: string;
  onRatioChange: (ratio: string) => void;
  actionLoading: string;
  videoStatus: VideoStatus | null;
  onBuildVideo: () => void;
  onExportVideo: () => void;
}

export default function StudioHeader({
  project,
  statusData,
  openSettings,
  selectedRatio,
  onRatioChange,
  actionLoading,
  videoStatus,
  onBuildVideo,
  onExportVideo,
}: Props) {
  const pct = getProgressPercent(statusData);
  const completed = getCompletedCount(statusData);
  const total = STUDIO_STEPS.length;
  const building = actionLoading === "video" || videoStatus?.running;
  const hasBuiltVideo = !!videoStatus?.output;

  return (
    <header className="studio-header">
      {/* Left: Brand + project */}
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          textDecoration: "none",
          color: "var(--text)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: "0.9rem", color: "var(--primary)" }}>&#9654;</span>
        <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>Content Studio</span>
      </Link>

      <span style={{ color: "var(--border)", fontSize: "0.75rem" }}>|</span>

      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
        <span
          style={{
            fontSize: "0.82rem",
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "200px",
          }}
          title={project.name}
        >
          {project.name}
        </span>
        <span
          className="badge"
          style={{
            background: "rgba(124,92,255,0.15)",
            color: "var(--primary)",
            fontSize: "0.6rem",
          }}
        >
          {project.language.toUpperCase()}
        </span>
      </div>

      {/* Ratio Switcher */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "2px",
          marginLeft: "0.5rem",
          flexShrink: 0,
        }}
      >
        {RATIOS.map((r) => {
          const active = selectedRatio === r.value;
          let boxW: number, boxH: number;
          if (r.value === "16:9") { boxW = 20; boxH = 11; }
          else { boxW = 11; boxH = 20; }
          return (
            <button
              key={r.value}
              onClick={() => onRatioChange(r.value)}
              title={`${r.label} ${r.sub}`}
              style={{
                padding: "0.2rem 0.4rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.3rem",
                background: active ? "var(--primary)" : "transparent",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: boxW,
                  height: boxH,
                  border: `1.5px solid ${active ? "#fff" : "var(--text-muted)"}`,
                  borderRadius: 2,
                  flexShrink: 0,
                  transition: "border-color 0.15s",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Center: Progress */}
      <div className="progress-bar-container" style={{ marginLeft: "auto" }}>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-bar-text">
          {completed}/{total}
        </span>
      </div>

      {/* Right: Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        
        {/* Build Video Button */}
        {building ? (
          <button
            className="btn-primary"
            disabled
            style={{
              fontSize: "0.72rem",
              padding: "0.28rem 0.65rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            Building ({videoStatus?.progress ?? 0}%)
          </button>
        ) : (
          <button
            className="btn-secondary"
            onClick={onBuildVideo}
            disabled={!!actionLoading}
            style={{
              fontSize: "0.72rem",
              padding: "0.28rem 0.65rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Clapperboard size={12} /> Build
          </button>
        )}

        {/* Export Video Button */}
        <button
          className="btn-primary"
          onClick={onExportVideo}
          disabled={!hasBuiltVideo || !!actionLoading}
          style={{
            fontSize: "0.72rem",
            padding: "0.28rem 0.65rem",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            background: hasBuiltVideo ? "var(--primary)" : "var(--border)",
            color: hasBuiltVideo ? "#fff" : "var(--text-muted)",
            border: "none",
            cursor: hasBuiltVideo ? "pointer" : "not-allowed"
          }}
        >
          <Download size={12} /> Export
        </button>

        <span style={{ color: "var(--border)", fontSize: "0.75rem", margin: "0 0.2rem" }}>|</span>

        <Link to="/" className="btn-ghost" style={{ padding: "0.3rem 0.5rem", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", textDecoration: "none" }}>
          <Home size={14} />
        </Link>
        <button className="btn-ghost" style={{ padding: "0.3rem 0.5rem" }} title="Help">
          <HelpCircle size={15} />
        </button>
        <button className="btn-ghost" style={{ padding: "0.3rem 0.5rem" }} title="Settings" onClick={openSettings}>
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
