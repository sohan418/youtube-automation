import type { ReactNode } from "react";
import { PanelLeftClose } from "lucide-react";
import "./StepHeader.css";

interface StepHeaderProps {
  title: string | ReactNode;
  subtitle?: string;
  count?: number;
  children?: ReactNode;
  onCollapse?: () => void;
  className?: string;
}

export default function StepHeader({
  title,
  subtitle: _subtitle,
  count,
  children,
  onCollapse,
  className = "",
}: StepHeaderProps) {
  return (
    <div className={`step-header-root ${className}`}>
      <div className="step-header-left">
        <h2 className="step-header-title">
          {title}
          {count != null && <span className="step-header-count"> ({count})</span>}
        </h2>
      </div>

      <div className="step-header-right">
        {children}
        {onCollapse && (
          <button
            type="button"
            className="step-header-collapse-btn"
            onClick={onCollapse}
            title="Collapse Tool Panel (Give 100% width to Video & Timeline)"
          >
            <PanelLeftClose size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
