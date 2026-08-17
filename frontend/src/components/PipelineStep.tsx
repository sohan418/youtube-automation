import { Check, ChevronRight } from "lucide-react";
import type { ProjectStatus } from "../types";

interface Props {
  currentStatus: ProjectStatus;
  steps: { key: ProjectStatus; label: string }[];
}

const STATUS_ORDER: ProjectStatus[] = [
  "draft", "idea", "script", "scenes", "images", "audio", "video", "thumbnail", "seo", "completed", "exported",
];

export default function PipelineStep({ currentStatus, steps }: Props) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div
      className="scrollable-x"
      style={{
        display: "flex",
        gap: "0.25rem",
        marginBottom: "0.6rem",
        padding: "0.2rem 0",
      }}
    >
      {steps.map((step, i) => {
        const stepIndex = STATUS_ORDER.indexOf(step.key);
        const isActive = step.key === currentStatus;
        const isDone = stepIndex < currentIndex;

        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <div
              style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "999px",
                fontSize: "0.68rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                background: isActive
                  ? "var(--primary)"
                  : isDone
                  ? "rgba(46,204,113,0.15)"
                  : "var(--surface)",
                color: isActive ? "white" : isDone ? "var(--success)" : "var(--text-muted)",
                border: `1px solid ${isActive ? "var(--primary)" : isDone ? "var(--success)" : "var(--border)"}`,
              }}
            >
              {isDone ? <Check size={12} style={{ verticalAlign: "-2px" }} /> : null}{step.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={14} style={{ color: "var(--border)", flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
