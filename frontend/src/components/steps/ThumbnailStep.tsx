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
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    aspectRatio: "16/9",
    objectFit: "cover",
    display: "block",
  };

  return (
    <div className="card" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3>Thumbnail</h3>
        <button className="btn-accent" disabled={!!actionLoading} onClick={onGenerate}>
          {actionLoading === "thumbnails" ? "Generating..." : <><Sparkles size={14} /> Generate</>}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
        {/* Thumbnail cards */}
        {thumbnails.map((thumb) => (
          <div key={thumb.id} style={cardStyle}>
            <img src={mediaUrl(thumb.file_path)} alt="Thumbnail" loading="lazy" style={imgStyle} />
            {thumb.is_selected && (
              <span style={{
                position: "absolute", top: 6, right: 6, background: "var(--accent)", color: "#000",
                fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.4rem", borderRadius: "999px",
              }}>
                <Check size={11} /> Selected
              </span>
            )}
            {thumb.prompt && (
              <button
                onClick={() => handleCopy(thumb.id, thumb.prompt!)}
                title="Copy prompt"
                style={{
                  position: "absolute", bottom: 36, right: 6, background: "rgba(0,0,0,0.6)", color: copiedId === thumb.id ? "var(--success)" : "#fff",
                  fontSize: "0.65rem", padding: "0.2rem 0.4rem", borderRadius: "4px", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "0.2rem",
                }}
              >
                <Copy size={10} /> {copiedId === thumb.id ? "Copied" : "Prompt"}
              </button>
            )}
            <button
              className={thumb.is_selected ? "btn-accent" : "btn-secondary"}
              disabled={!!actionLoading}
              onClick={() => onSelect(thumb.id)}
              style={{ width: "100%", border: "none", borderRadius: 0, fontSize: "0.78rem" }}
            >
              {thumb.is_selected ? "Selected" : "Use this"}
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
            background: dragOver ? "rgba(62, 166, 255, 0.05)" : "transparent",
            cursor: "pointer",
            transition: "all 0.15s",
            opacity: uploading ? 0.5 : 1,
            pointerEvents: uploading ? "none" : "auto",
            minHeight: "120px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "0.3rem",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <Upload size={18} style={{ color: dragOver ? "var(--accent)" : "var(--text-muted)" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {uploading ? "Uploading..." : "Drop image"}
          </span>
        </div>
      </div>
    </div>
  );
}
