import { ChevronLeft, ChevronRight } from "lucide-react";
import type { StepDef, StudioStep } from "./studioSteps";

interface Props {
  steps: StepDef[];
  activeTab: StudioStep;
  onNavigate: (key: StudioStep) => void;
}

export default function StudioNav({ steps, activeTab, onNavigate }: Props) {
  const idx = steps.findIndex((s) => s.key === activeTab);
  const current = steps[idx];
  const prev = idx > 0 ? steps[idx - 1] : null;
  const next = idx < steps.length - 1 ? steps[idx + 1] : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.5rem",
        marginBottom: "0.6rem",
        padding: "0.4rem 0.6rem",
        background: "rgba(15, 15, 19, 0.85)",
        backdropFilter: "blur(12px)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        position: "sticky",
        top: "0.25rem",
        zIndex: 40,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
        flexWrap: "wrap",
      }}
    >
      <button
        className="btn-secondary"
        disabled={!prev}
        onClick={() => prev && onNavigate(prev.key)}
        style={{ fontSize: "0.78rem", minWidth: 140, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", padding: "0.35rem 0.6rem" }}
      >
        <ChevronLeft size={13} /> {prev ? `Prev Step: ${prev.label}` : "Start"}
      </button>
      <div style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)", flex: 1, minWidth: 160 }}>
        <strong style={{ color: "var(--text)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <current.icon size={14} /> {current.label}
        </strong>
        <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", opacity: 0.8 }}>
          · Step {idx + 1} of {steps.length}
        </span>
      </div>
      <button
        className="btn-primary"
        disabled={!next}
        onClick={() => next && onNavigate(next.key)}
        style={{ fontSize: "0.78rem", minWidth: 140, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", padding: "0.35rem 0.6rem" }}
      >
        {next ? `Next Step: ${next.label}` : "Export"} <ChevronRight size={13} />
      </button>
    </div>
  );
}
