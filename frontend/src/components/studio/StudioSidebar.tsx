import { Zap } from "lucide-react";
import { type StepDef, type StudioStep } from "./studioSteps";

interface Props {
  activeTab: StudioStep;
  steps: StepDef[];
  done: Record<StudioStep, boolean>;
  onSelect: (key: StudioStep) => void;
}

export default function StudioSidebar({ activeTab, steps, done, onSelect }: Props) {
  return (
    <aside
      className="studio-sidebar"
      style={{
        width: "76px",
        minWidth: "76px",
        height: "100%",
        padding: "0.75rem 0.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        alignItems: "center",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Compact Logo */}
      <div style={{ display: "flex", justifyContent: "center", padding: "0.25rem", marginBottom: "0.5rem" }}>
        <div
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            background: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <Zap size={16} />
        </div>
      </div>

      {/* Steps List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "100%" }}>
        {steps.map((step) => {
          const isActive = step.key === activeTab;
          const isDone = done[step.key];
          return (
            <button
              key={step.key}
              onClick={() => onSelect(step.key)}
              title={step.hint}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                width: "100%",
                padding: "0.55rem 0.2rem",
                borderRadius: "8px",
                background: isActive ? "rgba(255, 0, 60, 0.08)" : "transparent",
                border: "none",
                color: isActive ? "var(--primary)" : isDone ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.15s ease",
              }}
            >
              <step.icon size={18} />
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: isActive ? 700 : 500,
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                }}
              >
                {step.label}
              </span>

              {/* Small dot/indicator for completion */}
              {isDone && (
                <div
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: "var(--success)",
                  }}
                />
              )}

              {/* Active vertical status line on the left */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "20%",
                    bottom: "20%",
                    width: "3px",
                    borderRadius: "0 2px 2px 0",
                    background: "var(--primary)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
