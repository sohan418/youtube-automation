import { ExternalLink, X } from "lucide-react";
import { mediaUrl } from "../../api/client";

interface Props {
  previewMedia: { path: string; kind: "image" | "video" } | null;
  onClose: () => void;
}

export default function MediaPreviewOverlay({ previewMedia, onClose }: Props) {
  if (!previewMedia) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.88)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "zoom-out",
      }}
    >
      {previewMedia.kind === "video" ? (
        <video
          src={mediaUrl(previewMedia.path)}
          controls
          autoPlay
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "90vw",
            maxHeight: "88vh",
            objectFit: "contain",
            borderRadius: "var(--radius)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.7)",
            background: "#000",
          }}
        />
      ) : (
        <img
          src={mediaUrl(previewMedia.path)}
          alt="Image preview"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "90vw",
            maxHeight: "88vh",
            objectFit: "contain",
            borderRadius: "var(--radius)",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.7)",
          }}
        />
      )}
      <button
        onClick={onClose}
        aria-label="Close preview"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          border: "none",
          borderRadius: "50%",
          cursor: "pointer",
          background: "var(--surface, rgba(255,255,255,0.15))",
          color: "#fff",
          fontSize: "1.1rem",
          lineHeight: 1,
        }}
      >
        <X size={20} />
      </button>
      <a
        href={mediaUrl(previewMedia.path)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          color: "#fff",
          textDecoration: "none",
          background: "rgba(255,255,255,0.15)",
          padding: "0.45rem 0.9rem",
          borderRadius: "var(--radius)",
          fontSize: "0.8rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
        }}
      >
        Open in new tab <ExternalLink size={13} />
      </a>
    </div>
  );
}
