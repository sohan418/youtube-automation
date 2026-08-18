import { Link } from "react-router-dom";
import { STUDIO_STEPS } from "./studioSteps";
import type { Project } from "../../types";

interface Props {
  project: Project;
  activeTab: string;
  openSettings: () => void;
}

export default function StudioHeader({ project, activeTab, openSettings }: Props) {
  const currentStepIndex = STUDIO_STEPS.findIndex((s) => s.key === activeTab) + 1;
  const currentStep = STUDIO_STEPS[currentStepIndex - 1] || STUDIO_STEPS[0];

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.6rem 1.25rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        flexWrap: "wrap",
        gap: "0.65rem",
      }}
    >
      {/* Left Side Branding & Project Details */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.45rem", textDecoration: "none" }}>
          <div
            style={{
              background: "var(--primary)",
              width: 28,
              height: 28,
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: "1rem",
            }}
          >
            ▶
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)" }}>YouTube</span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500 }}>Content Studio</span>
          </div>
        </Link>

        <span style={{ color: "var(--border)", fontSize: "0.85rem" }}>|</span>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "var(--text)",
              maxWidth: "160px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={project.name}
          >
            {project.name}
          </span>
          <span className={`badge badge-${project.status}`} style={{ fontSize: "0.55rem", padding: "1px 4px" }}>
            {project.status.toUpperCase()}
          </span>
          <span
            className="badge"
            style={{ fontSize: "0.55rem", padding: "1px 4px", background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
          >
            {project.language.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Center Progress flow */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
        <span
          className="badge"
          style={{ background: "rgba(255,0,60,0.12)", color: "var(--primary)", fontSize: "0.72rem", border: "1px solid rgba(255,0,60,0.25)" }}
        >
          {currentStep.label}
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Step {currentStepIndex} of {STUDIO_STEPS.length}
        </span>
        <div style={{ display: "flex", gap: "3px" }}>
          {STUDIO_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 3,
                background: i < currentStepIndex ? "var(--primary)" : "rgba(255,255,255,0.12)",
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      </div>

      {/* Right Side Actions & Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Link
          to="/"
          style={{
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.2rem",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            padding: "0.3rem 0.6rem",
            borderRadius: "var(--radius)",
          }}
        >
          ← Home
        </Link>
        <button
          className="btn-secondary"
          style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
          onClick={() =>
            alert(
              "Welcome to YouTube Content Studio! This local AI production suite helps you brainstorm ideas, generate scripts, voiceovers, images, and package the final video for upload.",
            )
          }
        >
          ❓ Help
        </button>

        <button className="btn-secondary" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }} onClick={openSettings}>
          ⚙️ Settings
        </button>

        {/* Profile indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            borderLeft: "1px solid var(--border)",
            paddingLeft: "0.75rem",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.1 }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>Local MVP</span>
            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Creator</span>
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary) 0%, #e91e63 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "white",
            }}
          >
            C
          </div>
        </div>
      </div>
    </header>
  );
}
