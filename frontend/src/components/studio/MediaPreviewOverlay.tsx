import { useEffect } from "react";
import { ExternalLink, X } from "lucide-react";
import { mediaUrl } from "../../api/client";
import "./MediaPreviewOverlay.css";

interface Props {
  previewMedia: { path: string; kind: "image" | "video" } | null;
  onClose: () => void;
}

export default function MediaPreviewOverlay({ previewMedia, onClose }: Props) {
  useEffect(() => {
    if (!previewMedia) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewMedia, onClose]);

  if (!previewMedia) return null;

  return (
    <div className="media-preview-overlay" onClick={onClose}>
      {previewMedia.kind === "video" ? (
        <video
          src={mediaUrl(previewMedia.path)}
          controls
          autoPlay
          onClick={(e) => e.stopPropagation()}
          className="media-preview-media"
        />
      ) : (
        <img
          src={mediaUrl(previewMedia.path)}
          alt="Image preview"
          onClick={(e) => e.stopPropagation()}
          className="media-preview-media"
        />
      )}

      <button onClick={onClose} aria-label="Close preview" className="media-preview-close">
        <X size={20} />
      </button>

      <span className="media-preview-hint">
        Press ESC or click outside to close
      </span>

      <a
        href={mediaUrl(previewMedia.path)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="media-preview-newtab"
      >
        Open in new tab <ExternalLink size={13} />
      </a>
    </div>
  );
}
