import { useState, useRef, useCallback } from "react";
import { Sparkles, Check, Upload, Copy } from "lucide-react";
import type { Thumbnail } from "../../types";

interface Props {
  thumbnails: Thumbnail[];
  actionLoading: string;
  mediaUrl: (p: string) => string;
  onGenerate: () => void;
  onSelect: (id: number) => void;
  onUpload: (file: File) => Promise<void>;
}

export default function ThumbnailStep({ thumbnails, actionLoading, mediaUrl, onGenerate, onSelect, onUpload }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || uploading) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }, [onUpload, uploading]);

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: "8px",
    border: "1px solid var(--border)",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-secondary, transparent)",
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    aspectRatio: "16/9",
    objectFit: "cover",
    display: "block",
  };

  const badgeStyle: React.CSSProperties = {
    position: "absolute", top: 5, right: 5,
    background: "var(--primary)", color: "#fff",
    fontSize: "0.6rem", fontWeight: 700, padding: "0.12rem 0.35rem", borderRadius: "999px",
    display: "flex", alignItems: "center", gap: "0.15rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
  };

  return (
    <div className="card" style={{ padding: "0.6rem 0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Thumbnails</h3>
        <button className="btn-primary" disabled={!!actionLoading} onClick={onGenerate} style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}>
          {actionLoading === "thumbnails" ? "Generating..." : <><Sparkles size={13} /> Generate</>}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" }}>
        {/* Thumbnail cards */}
        {thumbnails.map((thumb) => (
          <div key={thumb.id} style={cardStyle}>
            <img src={mediaUrl(thumb.file_path)} alt="Thumbnail" loading="lazy" style={imgStyle} />
            {thumb.is_selected && (
              <span style={badgeStyle}>
                <Check size={10} /> Selected
              </span>
            )}
            {thumb.prompt && (
              <button
                onClick={() => handleCopy(thumb.id, thumb.prompt!)}
                title="Copy prompt"
                style={{
                  position: "absolute", top: 5, right: thumb.is_selected ? 78 : 5,
                  background: "rgba(0,0,0,0.55)", color: copiedId === thumb.id ? "var(--success)" : "#fff",
                  fontSize: "0.6rem", fontWeight: copiedId === thumb.id ? 700 : 500, padding: "0.12rem 0.3rem",
                  borderRadius: "4px", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.15rem", transition: "color 0.15s",
                }}
              >
                <Copy size={9} /> {copiedId === thumb.id ? "Copied!" : "Prompt"}
              </button>
            )}
            <button
              className={thumb.is_selected ? "btn-primary" : "btn-secondary"}
              disabled={!!actionLoading}
              onClick={() => onSelect(thumb.id)}
              style={{ width: "100%", border: "none", borderRadius: 0, fontSize: "0.72rem", padding: "0.28rem 0.4rem" }}
            >
              {thumb.is_selected ? <><Check size={11} /> Selected</> : "Use this"}
            </button>
          </div>
        ))}

        {/* Drop card */}
        <div
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...cardStyle,
            borderStyle: "dashed",
            borderColor: dragOver ? "var(--accent)" : "var(--border)",
            background: dragOver ? "rgba(139, 92, 246, 0.08)" : "transparent",
            cursor: "pointer",
            transition: "all 0.15s",
            opacity: uploading ? 0.5 : 1,
            pointerEvents: uploading ? "none" : "auto",
            minHeight: "110px",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <Upload size={16} style={{ color: dragOver ? "var(--accent)" : "var(--text-muted)" }} />
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {uploading ? "Uploading..." : "Drop image"}
          </span>
        </div>
      </div>
    </div>
  );
}
