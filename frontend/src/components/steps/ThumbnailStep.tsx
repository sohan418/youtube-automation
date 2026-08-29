import { useState, useRef, useCallback } from "react";
import { Sparkles, Check, Upload, Copy } from "lucide-react";
import type { Thumbnail } from "../../types";
import "./ThumbnailStep.css";

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

  return (
    <div className="card thumb-card-padding">
      <div className="thumb-header">
        <h3 className="thumb-title">Thumbnails</h3>
        <button className="btn-primary thumb-generate-btn" disabled={!!actionLoading} onClick={onGenerate}>
          {actionLoading === "thumbnails" ? "Generating..." : <><Sparkles size={13} /> Generate</>}
        </button>
      </div>

      <div className="thumb-grid">
        {/* Thumbnail cards */}
        {thumbnails.map((thumb) => (
          <div key={thumb.id} className="thumb-card">
            <img src={mediaUrl(thumb.file_path)} alt="Thumbnail" loading="lazy" className="thumb-img" />
            {thumb.is_selected && (
              <span className="thumb-badge">
                <Check size={10} /> Selected
              </span>
            )}
            {thumb.prompt && (
              <button
                onClick={() => handleCopy(thumb.id, thumb.prompt!)}
                title="Copy prompt"
                className="thumb-copy-btn"
                style={{
                  right: thumb.is_selected ? 78 : 5,
                  color: copiedId === thumb.id ? "var(--success)" : "#fff",
                  fontWeight: copiedId === thumb.id ? 700 : 500,
                }}
              >
                <Copy size={9} /> {copiedId === thumb.id ? "Copied!" : "Prompt"}
              </button>
            )}
            <button
              className={`${thumb.is_selected ? "btn-primary" : "btn-secondary"} thumb-select-btn`}
              disabled={!!actionLoading}
              onClick={() => onSelect(thumb.id)}
            >
              {thumb.is_selected ? <><Check size={11} /> Selected</> : "Use this"}
            </button>
          </div>
        ))}

        {/* Drop card */}
        <div
          className="thumb-card thumb-drop-card"
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            borderColor: dragOver ? "var(--accent)" : "var(--border)",
            background: dragOver ? "rgba(139, 92, 246, 0.08)" : "transparent",
            opacity: uploading ? 0.5 : 1,
            pointerEvents: uploading ? "none" : "auto",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          />
          <Upload size={16} style={{ color: dragOver ? "var(--accent)" : "var(--text-muted)" }} />
          <span className="thumb-drop-text">
            {uploading ? "Uploading..." : "Drop image"}
          </span>
        </div>
      </div>
    </div>
  );
}
