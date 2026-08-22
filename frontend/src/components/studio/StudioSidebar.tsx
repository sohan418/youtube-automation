import { Check, Zap } from "lucide-react";
import { STEP_GROUPS, type StepDef, type StudioStep } from "./studioSteps";

interface Props {
  activeTab: StudioStep;
  steps: StepDef[];
  done: Record<StudioStep, boolean>;
  onSelect: (key: StudioStep) => void;
}

export default function StudioSidebar({ activeTab, steps, done, onSelect }: Props) {
  const grouped = STEP_GROUPS.map((g) => ({
    ...g,
    items: steps.filter((s) => s.group === g.key),
  }));

  return (
    <aside className="studio-sidebar">
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0 0.25rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "6px",
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "0.8rem",
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          <Zap size={14} />
        </div>
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "var(--text)",
            whiteSpace: "nowrap",
          }}
        >
          Content Studio
        </span>
      </div>

      {/* Groups */}
      {grouped.map((group) => (
        <div key={group.key} className="sidebar-section">
          <div className="sidebar-section-label">{group.label}</div>
          {group.items.map((step) => {
            const isActive = step.key === activeTab;
            const isDone = done[step.key];
            return (
              <button
                key={step.key}
                className={`sidebar-item ${isActive ? "active" : ""} ${isDone ? "sidebar-item-done" : ""}`}
                onClick={() => onSelect(step.key)}
                title={step.hint}
              >
                <step.icon size={15} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {step.label}
                </span>
                {isDone && !isActive && <Check size={12} />}
                {isActive && <span className="sidebar-status" style={{ background: "var(--primary)" }} />}
                {isDone && !isActive && <span className="sidebar-status" />}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
