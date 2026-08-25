import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface SelectProps {
  value: string | number | "";
  options: SelectOption[];
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  title?: string;
  style?: React.CSSProperties;
}

export default function Select({
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  size = "md",
  title,
  style,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const sm = size === "sm";

  return (
    <div
      ref={ref}
      style={{ position: "relative", ...style }}
    >
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.3rem",
          width: "100%",
          padding: sm ? "0.25rem 0.45rem" : "0.45rem 0.65rem",
          fontSize: sm ? "0.74rem" : "0.82rem",
          fontFamily: "inherit",
          background: disabled ? "var(--surface)" : "var(--bg)",
          color: selected ? "var(--text)" : "var(--text-muted)",
          border: `1px solid ${open ? "var(--primary)" : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "border-color var(--transition)",
          lineHeight: 1.3,
          textAlign: "left",
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.borderColor = "var(--primary)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.5, transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 3px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            maxHeight: 220,
            overflowY: "auto",
            padding: "3px 0",
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: "0.35rem 0.65rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
              No options
            </div>
          )}
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
                style={{
                  padding: sm ? "0.25rem 0.55rem" : "0.35rem 0.65rem",
                  fontSize: sm ? "0.74rem" : "0.82rem",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  color: opt.disabled ? "var(--text-muted)" : isActive ? "var(--primary)" : "var(--text)",
                  background: isActive ? "rgba(124,92,255,0.1)" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                  opacity: opt.disabled ? 0.4 : 1,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!opt.disabled) e.currentTarget.style.background = isActive ? "rgba(124,92,255,0.15)" : "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isActive ? "rgba(124,92,255,0.1)" : "transparent";
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
