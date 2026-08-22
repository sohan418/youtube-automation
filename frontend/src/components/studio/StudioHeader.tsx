import { Link } from "react-router-dom";
import { Home, HelpCircle, Settings } from "lucide-react";
import { getProgressPercent, getCompletedCount, type StepStatusData } from "./studioSteps";
import type { Project } from "../../types";

interface Props {
  project: Project;
  statusData: StepStatusData;
  openSettings: () => void;
}

export default function StudioHeader({ project, statusData, openSettings }: Props) {
  const pct = getProgressPercent(statusData);
  const completed = getCompletedCount(statusData);
  const total = 9;

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
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
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
