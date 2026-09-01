import { type StepDef, type StudioStep } from "./studioSteps";
import "./StudioSidebar.css";

interface Props {
  activeTab: StudioStep;
  steps: StepDef[];
  done: Record<StudioStep, boolean>;
  onSelect: (key: StudioStep) => void;
}

export default function StudioSidebar({ activeTab, steps, done, onSelect }: Props) {
  return (
    <aside className="studio-sidebar">
      <div className="sidebar-steps">
        {steps.map((step) => {
          const isActive = step.key === activeTab;
          const isDone = done[step.key];
          const classes = ["sidebar-step"];
          if (isActive) classes.push("is-active");
          if (isDone) classes.push("is-done");
          return (
            <button
              key={step.key}
              onClick={() => onSelect(step.key)}
              title={step.hint}
              className={classes.join(" ")}
            >
              <step.icon size={18} />
              <span className="sidebar-step-label">
                {step.label}
              </span>

              {isDone && (
                <div className="sidebar-step-dot" />
              )}

              {isActive && (
                <div className="sidebar-step-active-line" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
