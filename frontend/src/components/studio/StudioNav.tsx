import { ChevronLeft, ChevronRight } from "lucide-react";
import type { StepDef, StudioStep } from "./studioSteps";
import "./StudioNav.css";

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
    <div className="studio-nav">
      <button
        className="btn-secondary studio-nav-btn"
        disabled={!prev}
        onClick={() => prev && onNavigate(prev.key)}
      >
        <ChevronLeft size={13} /> {prev ? `Prev Step: ${prev.label}` : "Start"}
      </button>
      <div className="studio-nav-center">
        <strong className="studio-nav-current">
          <current.icon size={14} /> {current.label}
        </strong>
        <span className="studio-nav-step-count">
          · Step {idx + 1} of {steps.length}
        </span>
      </div>
      <button
        className="btn-primary studio-nav-btn"
        disabled={!next}
        onClick={() => next && onNavigate(next.key)}
      >
        {next ? `Next Step: ${next.label}` : "Export"} <ChevronRight size={13} />
      </button>
    </div>
  );
}
