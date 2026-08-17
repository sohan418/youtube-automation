import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

interface Props {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

export default function ToastNotification({
  message,
  type,
  onClose,
  duration = 4000,
}: Props) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onClose();
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [duration, onClose]);

  const getTheme = () => {
    switch (type) {
      case "success":
        return {
          icon: <CheckCircle2 size={16} color="var(--success)" />,
          borderColor: "rgba(46, 204, 113, 0.25)",
          progressColor: "var(--success)",
          glowColor: "rgba(46, 204, 113, 0.15)",
        };
      case "error":
        return {
          icon: <AlertCircle size={16} color="var(--primary)" />,
          borderColor: "rgba(255, 0, 60, 0.25)",
          progressColor: "var(--primary)",
          glowColor: "rgba(255, 0, 60, 0.15)",
        };
      default:
        return {
          icon: <Info size={16} color="var(--accent)" />,
          borderColor: "rgba(0, 184, 212, 0.25)",
          progressColor: "var(--accent)",
          glowColor: "rgba(0, 184, 212, 0.15)",
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      style={{
        position: "fixed",
        top: "1.25rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "var(--surface)",
        border: `1px solid ${theme.borderColor}`,
        borderRadius: "8px",
        boxShadow: `0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 15px ${theme.glowColor}`,
        padding: "0.65rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.65rem",
        maxWidth: "420px",
        width: "max-content",
        animation: "toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes toastSlideIn {
          from {
            transform: translate(-50%, -20px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Left Icon */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        {theme.icon}
      </div>

      {/* Message Text */}
      <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text)", lineHeight: 1.35 }}>
        {message}
      </span>

      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: "0.15rem",
          display: "flex",
          alignItems: "center",
          marginLeft: "0.3rem",
          opacity: 0.7,
          transition: "opacity 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
      >
        <X size={14} />
      </button>

      {/* Timer Progress Bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: "2px",
          width: `${progress}%`,
          background: theme.progressColor,
          transition: "width 16ms linear",
        }}
      />
    </div>
  );
}
