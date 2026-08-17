import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { StepDef, StudioStep } from "./studioSteps";

interface Props {
  activeTab: StudioStep;
  steps: StepDef[];
  done: Record<StudioStep, boolean>;
  onSelect: (key: StudioStep) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function StudioSidebar({
  activeTab,
  steps,
  done,
  onSelect,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const renderStepButton = (step: StepDef) => {
    const isActive = step.key === activeTab;
    const isDone = done[step.key];

    return (
      <button
        key={step.key}
        onClick={() => onSelect(step.key)}
        title={`${step.label}: ${step.hint}`}
        className="studio-step-btn"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : "0.5rem",
          width: "100%",
          textAlign: "left",
          padding: collapsed ? "0.45rem 0" : "0.38rem 0.55rem",
          borderRadius: "var(--radius)",
          fontSize: "0.8rem",
          fontWeight: isActive ? 600 : 500,
          background: isActive
            ? "var(--primary)"
            : isDone
            ? "rgba(46,204,113,0.12)"
            : "transparent",
          color: isActive ? "#fff" : isDone ? "var(--success)" : "var(--text)",
          border: `1px solid ${
            isActive ? "var(--primary)" : isDone ? "var(--success)" : "var(--border)"
          }`,
          cursor: "pointer",
          position: "relative",
        }}
      >
        <step.icon size={16} />

        {!collapsed && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.label}</span>}

        {!collapsed && isDone && !isActive && <Check size={13} color="var(--success)" />}
        {!collapsed && isActive && <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#fff",
          marginLeft: "0.2rem"
        }} />}

        {/* Collapsed dot badge indicator */}
        {collapsed && isDone && (
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--success)",
            }}
          />
        )}
      </button>
    );
  };

  const planningSteps = steps.filter(s => ["ideas", "script", "scenes", "images", "voice", "timeline"].includes(s.key));
  const productionSteps = steps.filter(s => ["video", "thumbnail", "seo"].includes(s.key));
  const exportSteps = steps.filter(s => ["export"].includes(s.key));

  return (
    <aside
      className={`studio-sidebar ${collapsed ? "is-collapsed" : ""}`}
      style={{
        width: collapsed ? "54px" : "100%",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        alignSelf: "stretch"
      }}
    >
      {/* Top Header with Collapse Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          marginBottom: "0.25rem",
          padding: "0 0.15rem",
        }}
      >
        {!collapsed && (
          <span
            style={{
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-muted)",
              fontWeight: 700,
            }}
          >
            Video Studio
          </span>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar (Full view)" : "Collapse sidebar (More space)"}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              borderRadius: "4px",
              padding: "0.2rem 0.35rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>

      {/* Grouped Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {!collapsed && <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", paddingLeft: "0.2rem" }}>Planning</span>}
        {planningSteps.map(renderStepButton)}

        {!collapsed && <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", paddingLeft: "0.2rem", marginTop: "0.5rem" }}>Production</span>}
        {productionSteps.map(renderStepButton)}

        {!collapsed && <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase", paddingLeft: "0.2rem", marginTop: "0.5rem" }}>Export</span>}
        {exportSteps.map(renderStepButton)}
      </div>

    </aside>
  );
}
