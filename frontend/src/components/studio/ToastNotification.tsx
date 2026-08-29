import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import "./ToastNotification.css";

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
    }, 16);

    return () => clearInterval(interval);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={16} color="var(--success)" />;
      case "error":
        return <AlertCircle size={16} color="var(--primary)" />;
      default:
        return <Info size={16} color="var(--accent)" />;
    }
  };

  return (
    <div className={`toast type-${type}`}>
      <div className="toast-icon">{getIcon()}</div>

      <span className="toast-message">{message}</span>

      <button onClick={onClose} className="toast-close">
        <X size={14} />
      </button>

      <div
        className={`toast-progress type-${type}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
