import { useEffect, useRef } from "react";
import { THEME } from "./constants";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const el = ref.current;
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    el?.closest(".vtl-scroll")?.addEventListener("scroll", onClose);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
      el?.closest(".vtl-scroll")?.removeEventListener("scroll", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 100,
        minWidth: 190,
        background: "#26262d",
        border: `1px solid ${THEME.separator}`,
        borderRadius: 9,
        padding: 5,
        boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
        userSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => (
        <div key={i}>
          {it.separatorBefore && (
            <div
              style={{
                height: 1,
                background: THEME.separator,
                margin: "5px 4px",
              }}
            />
          )}
          <button
            disabled={it.disabled}
            onClick={() => {
              it.onSelect();
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 9px",
              borderRadius: 6,
              background: "transparent",
              border: "none",
              color: it.disabled
                ? "#55555e"
                : it.danger
                  ? "#ff6b78"
                  : THEME.text,
              fontSize: 12,
              fontWeight: 500,
              textAlign: "left",
              cursor: it.disabled ? "default" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!it.disabled) e.currentTarget.style.background = "#33333c";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ display: "inline-flex", width: 15, justifyContent: "center" }}>
              {it.icon}
            </span>
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.shortcut && (
              <span
                style={{
                  fontSize: 10,
                  color: "#6f6f7a",
                  fontFamily:
                    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                {it.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
