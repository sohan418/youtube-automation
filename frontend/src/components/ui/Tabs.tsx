import React from "react";
import "./Tabs.css";

export interface TabOption<T extends string = string> {
  label: string;
  value: T;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps<T extends string = string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "pills" | "buttons" | "underline";
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

export default function Tabs<T extends string = string>({
  options,
  value,
  onChange,
  variant = "pills",
  size = "sm",
  className = "",
  style,
}: TabsProps<T>) {
  return (
    <div className={`ui-tabs-container ui-tabs-${variant} ui-tabs-${size} ${className}`} style={style}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`ui-tab-item ${isActive ? "active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.icon && <span className="ui-tab-icon">{option.icon}</span>}
            <span className="ui-tab-label">{option.label}</span>
            {option.count !== undefined && (
              <span className={`ui-tab-count ${isActive ? "active" : ""}`}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
