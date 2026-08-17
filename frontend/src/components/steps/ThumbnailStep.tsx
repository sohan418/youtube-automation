import { useState } from "react";
import { Sparkles, Copy, Check, Eye } from "lucide-react";
import type { Thumbnail } from "../../types";

interface Props {
  thumbnails: Thumbnail[];
  actionLoading: string;
  mediaUrl: (p: string) => string;
  onGenerate: () => void;
  onSelect: (id: number) => void;
}

function cleanPromptText(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = raw.replace(/```[a-z]*/gi, "").replace(/```/g, "");
  text = text.replace(/^\s*[#*•📌:-]+\s*/gm, "");
  text = text.replace(/\*{1,3}(.*?)\*{1,3}/g, "$1");
  text = text.replace(/#{1,6}\s*/g, "");
  text = text.replace(/^(?:YouTube\s+)?Thumbnail\s+Prompt(?:\s*\([^)]*\))?\s*[-–:]*\s*/gi, "");
  text = text.replace(/^Prompt\s*[-–:]*\s*/gi, "");
  return text.replace(/\s+/g, " ").trim();
}

export default function ThumbnailStep({ thumbnails, actionLoading, mediaUrl, onGenerate, onSelect }: Props) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="card" style={{ padding: "0.85rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 style={{ fontSize: "1.1rem" }}>Thumbnails</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Generate 3 AI thumbnail options and select the best one for your video.
          </p>
        </div>
        <button className="btn-accent" disabled={!!actionLoading} onClick={onGenerate} style={{ padding: "0.35rem 0.8rem", fontSize: "0.8rem" }}>
          {actionLoading === "thumbnails" ? "Generating..." : <><Sparkles size={13} style={{ verticalAlign: "middle" }} /> Generate Thumbnails</>}
        </button>
      </div>

      {thumbnails.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "1rem 0" }}>No thumbnails yet. Click "Generate Thumbnails" to create options.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.85rem" }}>
          {thumbnails.map((thumb) => {
            const cleanedPrompt = cleanPromptText(thumb.prompt);
            const isExpanded = expandedId === thumb.id;
            const filename = thumb.file_path.split(/[\\/]/).pop();

            return (
              <div
                key={thumb.id}
                className="card"
                style={{
                  borderColor: thumb.is_selected ? "var(--accent)" : "var(--border)",
                  borderWidth: thumb.is_selected ? "2px" : "1px",
                  background: thumb.is_selected ? "rgba(62, 166, 255, 0.05)" : "var(--bg)",
                  display: "flex",
                  flexDirection: "column",
                  padding: "0.6rem",
                  position: "relative",
                }}
              >
                {thumb.file_path && (
                  <div style={{ position: "relative", marginBottom: "0.5rem", borderRadius: "var(--radius)", overflow: "hidden" }}>
                    <img
                      src={mediaUrl(thumb.file_path)}
                      alt="Thumbnail Option"
                      loading="lazy"
                      style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
                    />
                    {thumb.is_selected && (
                      <span
                        style={{
                          position: "absolute", top: 6, right: 6, background: "var(--accent)", color: "#000",
                          fontSize: "0.65rem", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "999px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                        }}
                      >
                        <Check size={12} style={{ verticalAlign: "-2px" }} /> SELECTED
                      </span>
                    )}
                  </div>
                )}

                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.4rem", fontWeight: 600 }}>
                  {filename}
                </div>

                {cleanedPrompt && (
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text)",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "0.5rem 0.6rem",
                      marginBottom: "0.6rem",
                      lineHeight: 1.4,
                      flex: 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Prompt
                      </span>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <button
                          onClick={() => handleCopy(thumb.id, cleanedPrompt)}
                          title="Copy prompt text"
                          style={{
                            background: "transparent", color: copiedId === thumb.id ? "var(--success)" : "var(--text-muted)",
                            padding: "0.15rem 0.35rem", fontSize: "0.7rem", cursor: "pointer", border: "1px solid var(--border)",
                            borderRadius: "4px", display: "flex", alignItems: "center", gap: "0.2rem",
                          }}
                        >
                          {copiedId === thumb.id ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                        </button>
                        {cleanedPrompt.length > 90 && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : thumb.id)}
                            title={isExpanded ? "Collapse prompt" : "Expand prompt"}
                            style={{
                              background: "transparent", color: "var(--accent)",
                              padding: "0.15rem 0.35rem", fontSize: "0.7rem", cursor: "pointer", border: "1px solid var(--border)",
                              borderRadius: "4px", display: "flex", alignItems: "center", gap: "0.2rem",
                            }}
                          >
                            <Eye size={11} /> {isExpanded ? "Less" : "More"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: isExpanded ? "unset" : 3,
                        WebkitBoxOrient: "vertical",
                        overflow: isExpanded ? "visible" : "hidden",
                        wordBreak: "break-word",
                      }}
                    >
                      {cleanedPrompt}
                    </div>
                  </div>
                )}

                <button
                  className={thumb.is_selected ? "btn-accent" : "btn-secondary"}
                  disabled={!!actionLoading}
                  onClick={() => onSelect(thumb.id)}
                  style={{ width: "100%", padding: "0.4rem", fontSize: "0.8rem", fontWeight: 600 }}
                >
                  {thumb.is_selected ? <><Check size={13} style={{ verticalAlign: "-2px" }} /> Primary Thumbnail</> : "Select Thumbnail"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
