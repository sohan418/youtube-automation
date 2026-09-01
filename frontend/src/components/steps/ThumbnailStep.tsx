import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Check, Upload, Copy, Zap, Wand2, Trash2, FileText } from "lucide-react";
import type { Thumbnail } from "../../types";
import FreeAIGuide from "../editors/FreeAIGuide";
import "./ThumbnailStep.css";

interface Props {
  thumbnails: Thumbnail[];
  actionLoading: string;
  mediaUrl: (p: string) => string;
  videoTopic?: string;
  promptPair?: { system: string; user: string };
  onGenerate: (customPrompt?: string, topic?: string) => void;
  onSelect: (id: number) => void;
  onUpload: (file: File) => Promise<void>;
  onDelete?: (id: number) => void;
}

export default function ThumbnailStep({
  thumbnails,
  actionLoading,
  mediaUrl,
  videoTopic = "",
  promptPair,
  onGenerate,
  onSelect,
  onUpload,
  onDelete,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [topic, setTopic] = useState(videoTopic);
  const [showFreeAI, setShowFreeAI] = useState(false);

  useEffect(() => {
    if (videoTopic && !topic) {
      setTopic(videoTopic);
    }
  }, [videoTopic, topic]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || uploading) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) return;
      setUploading(true);
      try {
        await onUpload(file);
      } finally {
        setUploading(false);
      }
    },
    [onUpload, uploading],
  );

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="card thumb-card-padding">
      <div className="thumb-header">
        <h3 className="thumb-title">Thumbnails</h3>
        <div className="thumb-header-actions">
          <button
            className={`btn-secondary thumb-freeai-btn ${showFreeAI ? "active" : ""}`}
            onClick={() => setShowFreeAI(!showFreeAI)}
          >
            <Zap size={13} /> {showFreeAI ? "Hide Free AI" : "Free AI"}
          </button>
          <button
            className="btn-primary thumb-generate-btn"
            disabled={!!actionLoading}
            onClick={() => onGenerate(customPrompt, topic)}
          >
            {actionLoading === "thumbnails" ? (
              "Generating..."
            ) : (
              <>
                <Sparkles size={13} /> Generate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Video Context & Topic Input */}
      <div className="thumb-topic-box">
        <div className="thumb-topic-header">
          <label className="thumb-topic-label">
            <FileText size={12} style={{ color: "#38bdf8" }} /> Video Context / Topic (what is this thumbnail about?)
          </label>
        </div>
        <input
          type="text"
          className="thumb-topic-input"
          placeholder="e.g. 10 Hidden Cybersecurity Hacks You Must Know in 2026..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </div>

      {/* Free AI Guide Panel */}
      {showFreeAI && (
        <div style={{ marginBottom: "0.75rem" }}>
          <FreeAIGuide
            title="Generate Thumbnail Prompts with Free AI"
            promptPair={promptPair}
            responsePlaceholder="Paste AI-generated thumbnail prompt here..."
            onParseResponse={(text) => {
              setCustomPrompt(text.trim());
            }}
          />
        </div>
      )}

      {/* Custom Prompt Input Box */}
      <div className="thumb-prompt-box">
        <div className="thumb-prompt-header">
          <label className="thumb-prompt-label">
            <Wand2 size={12} style={{ color: "#00E5FF" }} /> Custom Thumbnail Prompt (optional)
          </label>
          {customPrompt && (
            <button
              className="thumb-prompt-clear"
              onClick={() => setCustomPrompt("")}
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          className="thumb-prompt-textarea"
          placeholder="Enter or paste custom AI thumbnail prompt (or use Free AI above to generate)..."
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={2}
        />
      </div>

      <div className="thumb-grid">
        {/* Thumbnail cards */}
        {thumbnails.map((thumb) => (
          <div key={thumb.id} className="thumb-card">
            <img
              src={mediaUrl(thumb.file_path)}
              alt="Thumbnail"
              loading="lazy"
              className="thumb-img"
            />
            {onDelete && (
              <button
                className="thumb-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(thumb.id);
                }}
                title="Delete thumbnail"
              >
                <Trash2 size={11} />
              </button>
            )}
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
              {thumb.is_selected ? (
                <>
                  <Check size={11} /> Selected
                </>
              ) : (
                "Use this"
              )}
            </button>
          </div>
        ))}

        {/* Drop card */}
        <div
          className="thumb-card thumb-drop-card"
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
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
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Upload
            size={16}
            style={{ color: dragOver ? "var(--accent)" : "var(--text-muted)" }}
          />
          <span className="thumb-drop-text">
            {uploading ? "Uploading..." : "Drop image"}
          </span>
        </div>
      </div>
    </div>
  );
}
