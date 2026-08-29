import { useEffect, useState } from "react";
import { Sparkles, Download, Upload, X, ArrowRight, Lightbulb, Play, ChevronDown, ChevronUp } from "lucide-react";
import type { Idea, YouTubeVideo } from "../../types";
import { api } from "../../api/client";
import FreeAIGuide from "../editors/FreeAIGuide";

interface Props {
  projectId: number;
  projectLanguage?: string;
  projectCategory?: string;
  ideas: Idea[];
  actionLoading: string;
  ideaTopic: string;
  onTopicChange: (v: string) => void;
  onGenerate: () => void;
  onSelect: (id: number) => void;
  onFreeAIResponse?: (ideas: { title: string; description: string; category?: string; trending_score?: number }[]) => void;
  recentVideos?: YouTubeVideo[];
}

function parseFreeAIResponse(text: string): { title: string; description: string; category?: string; trending_score?: number }[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          title: item.title || item.name || "",
          description: item.description || item.summary || "",
          category: item.category || item.topic || undefined,
          trending_score: (function() {
            const sc = item.trending_score !== undefined ? item.trending_score : item.score;
            if (sc === undefined) return undefined;
            const parsedSc = parseInt(sc, 10);
            return isNaN(parsedSc) ? undefined : parsedSc;
          })(),
        })).filter((i: any) => i.title);
      }
    }
  } catch {}

  const lines = text.split("\n").filter((l) => l.trim());
  const items: { title: string; description: string }[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, "").replace(/^[-•]\s*/, "").trim();
    if (cleaned.length > 5 && cleaned.length < 200) {
      if (items.length === 0 || items[items.length - 1].description) {
        items.push({ title: cleaned, description: "" });
      } else {
        items[items.length - 1].description = cleaned;
      }
    }
  }
  return items;
}

const CATEGORIES = ["Trending", "AI", "Education", "Comedy", "Facts", "Gaming", "Technology", "Science"];

export default function IdeasStep({ projectId, projectLanguage, projectCategory, ideas, actionLoading, ideaTopic, onTopicChange, onGenerate, onSelect, onFreeAIResponse, recentVideos }: Props) {
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [previewIdea, setPreviewIdea] = useState<Idea | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showRecentVideos, setShowRecentVideos] = useState(false);
  const [dynamicPrompt, setDynamicPrompt] = useState<{ system: string; user: string } | null>(null);

  useEffect(() => {
    if (!showFreeAI) return;
    api.buildIdeaPrompt(projectId, {
      count: 5,
      language: projectLanguage || "en",
      category: projectCategory || undefined,
      topic: ideaTopic.trim() || undefined,
      recentVideos: recentVideos?.map((v) => ({ title: v.title, description: v.description })),
    }).then(setDynamicPrompt).catch(() => {});
  }, [showFreeAI, projectId, projectLanguage, projectCategory, ideaTopic, recentVideos]);

  const freeAIPrompt = `SYSTEM PROMPT:\nYou are a YouTube trend analyst. Generate video ideas as JSON.\n\nUSER PROMPT:\nGenerate 5 trending YouTube video ideas${ideaTopic.trim() ? ` about: ${ideaTopic}` : ""}. Language: en. Return JSON: {"ideas": [{"title": "...", "description": "...", "category": "...", "trending_score": 0-100}]}`;

  const handleFreeAIResponse = (text: string) => {
    if (!onFreeAIResponse) return;
    const parsed = parseFreeAIResponse(text);
    if (parsed.length > 0) onFreeAIResponse(parsed);
  };

  const handleImport = () => {
    if (!onFreeAIResponse || !importText.trim()) return;
    const parsed = parseFreeAIResponse(importText);
    if (parsed.length > 0) {
      onFreeAIResponse(parsed);
      setImportText("");
      setShowImport(false);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = activeCategory
    ? ideas.filter((i) => i.category?.toLowerCase().includes(activeCategory.toLowerCase()))
    : ideas;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Video Ideas</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>Find your next video idea</p>
      </div>

      {/* Input row */}
      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={ideaTopic}
            onChange={(e) => onTopicChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !actionLoading && onGenerate()}
            placeholder="What do you want to make?"
            style={{ flex: 1, fontSize: "0.9rem", padding: "0.6rem 0.85rem" }}
          />
          <button className="btn-primary" disabled={!!actionLoading} onClick={onGenerate} style={{ padding: "0.6rem 1.2rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}>
            {actionLoading === "ideas" ? "Generating..." : <><Sparkles size={15} /> Generate with AI</>}
          </button>
        </div>

        {/* Action buttons row */}
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => setShowFreeAI(!showFreeAI)} style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}>
            {showFreeAI ? "Hide Free AI" : "Free AI"}
          </button>
          <button className="btn-secondary" onClick={() => setShowImport(!showImport)} style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Upload size={11} /> Import
          </button>
          {ideas.length > 0 && (
            <>
              <button className="btn-secondary" onClick={() => downloadFile(JSON.stringify(ideas.map((i) => ({ title: i.title, description: i.description, category: i.category })), null, 2), "ideas.json", "application/json")} style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Download size={11} /> JSON
              </button>
              <button className="btn-secondary" onClick={() => downloadFile(ideas.map((i, idx) => `${idx + 1}. ${i.title}\n${i.description}`).join("\n\n"), "ideas.txt", "text/plain")} style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Download size={11} /> Text
              </button>
            </>
          )}
        </div>
      </div>

      {/* Free AI panel */}
      {showFreeAI && (
        <FreeAIGuide
          title="Generate Ideas with Free AI"
          prompt={dynamicPrompt ? undefined : freeAIPrompt}
          promptPair={dynamicPrompt || undefined}
          responsePlaceholder="Paste AI response here..."
          onParseResponse={handleFreeAIResponse}
        />
      )}

      {/* Recent Videos from YouTube */}
      {recentVideos && recentVideos.length > 0 && (
        <div className="card" style={{ padding: "0.75rem" }}>
          <button
            onClick={() => setShowRecentVideos(!showRecentVideos)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              width: "100%",
              textAlign: "left",
            }}
          >
            <Play size={16} color="#ff0000" />
            <span style={{ fontSize: "0.8rem", fontWeight: 600, flex: 1,color: "var(--text-muted)" }}>
              Your Recent Videos ({recentVideos.length})
            </span>
            {showRecentVideos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showRecentVideos && (
            <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {recentVideos.map((v, i) => (
                <div
                  key={v.video_id || i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    padding: "0.4rem 0.5rem",
                    borderRadius: "6px",
                    background: "var(--bg)",
                    fontSize: "0.75rem",
                  }}
                >
                  <span style={{ color: "var(--text-muted)", minWidth: "1.2rem", fontWeight: 600 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.title}
                    </div>
                    {v.description && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.68rem", marginTop: "0.15rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {v.description.slice(0, 120)}
                      </div>
                    )}
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.65rem", whiteSpace: "nowrap" }}>
                    {v.published_at ? new Date(v.published_at).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
              <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", margin: "0.25rem 0 0", fontStyle: "italic" }}>
                AI uses these as context to generate new, different ideas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Import panel */}
      {showImport && (
        <div className="card" style={{ padding: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Paste AI Response / JSON</span>
            <button onClick={() => setShowImport(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
          </div>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste AI response here..." rows={4} style={{ fontSize: "0.8rem" }} />
          <button className="btn-primary" onClick={handleImport} disabled={!importText.trim()} style={{ marginTop: "0.4rem", width: "100%", fontSize: "0.8rem" }}>
            Import Ideas
          </button>
        </div>
      )}

      {/* Category chips */}
      {ideas.length > 0 && (
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              padding: "0.25rem 0.65rem",
              borderRadius: "999px",
              fontSize: "0.72rem",
              fontWeight: 600,
              background: !activeCategory ? "var(--primary)" : "var(--surface)",
              color: !activeCategory ? "#fff" : "var(--text-muted)",
              border: `1px solid ${!activeCategory ? "var(--primary)" : "var(--border)"}`,
              cursor: "pointer",
            }}
          >
            All ({ideas.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = ideas.filter((i) => i.category?.toLowerCase().includes(cat.toLowerCase())).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                style={{
                  padding: "0.25rem 0.65rem",
                  borderRadius: "999px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  background: activeCategory === cat ? "var(--primary)" : "var(--surface)",
                  color: activeCategory === cat ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${activeCategory === cat ? "var(--primary)" : "var(--border)"}`,
                  cursor: "pointer",
                }}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Ideas grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Lightbulb size={40} strokeWidth={1.5} style={{ opacity: 0.3 }} />
          <div className="empty-state-title">No ideas yet</div>
          <div className="empty-state-desc">Enter a topic above and click Generate with AI to brainstorm video ideas.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.75rem" }}>
          {filtered.map((idea) => (
            <div
              key={idea.id}
              className="card"
              style={{
                borderColor: idea.is_selected ? "var(--primary)" : "var(--border)",
                background: idea.is_selected ? "rgba(124,92,255,0.08)" : "var(--card-bg)",
                padding: "0.85rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                cursor: "pointer",
                transition: "border-color var(--transition)",
              }}
              onClick={() => setPreviewIdea(idea)}
            >
              {/* Category badge */}
              {idea.category && (
                <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--primary)" }}>
                  {idea.category}
                </span>
              )}

              {/* Title */}
              <h4 style={{ fontSize: "0.92rem", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{idea.title}</h4>

              {/* Description */}
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4, flex: 1 }}>
                {idea.description && idea.description.length > 120 ? idea.description.slice(0, 120) + "..." : idea.description || ""}
              </p>

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {idea.trending_score != null && (
                    <span style={{ fontSize: "0.7rem", color: "var(--accent)" }}>
                      &#9733; {idea.trending_score}
                    </span>
                  )}
                </div>
                <button
                  className={idea.is_selected ? "btn-primary" : "btn-secondary"}
                  disabled={!!actionLoading}
                  onClick={(e) => { e.stopPropagation(); onSelect(idea.id); }}
                  style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                >
                  {idea.is_selected ? "Selected" : <>Use Idea <ArrowRight size={11} /></>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewIdea && (
        <div
          onClick={() => setPreviewIdea(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ maxWidth: 480, width: "100%", background: "var(--surface)", padding: "1.25rem" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
              <div>
                {previewIdea.category && (
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--primary)" }}>
                    {previewIdea.category}
                  </span>
                )}
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.25rem 0 0" }}>{previewIdea.title}</h3>
              </div>
              <button onClick={() => setPreviewIdea(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1rem" }}>{previewIdea.description}</p>
            <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              {previewIdea.trending_score != null && <span>&#9733; Score: {previewIdea.trending_score}</span>}
              <span>Format: YouTube Video</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setPreviewIdea(null)}>Close</button>
              <button
                className="btn-primary"
                onClick={() => { onSelect(previewIdea.id); setPreviewIdea(null); }}
                disabled={!!actionLoading}
                style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                Use This Idea <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
