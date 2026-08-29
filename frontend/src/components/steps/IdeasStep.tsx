import { useEffect, useState } from "react";
import { Sparkles, Download, Upload, X, ArrowRight, Lightbulb, Play, ChevronDown, ChevronUp } from "lucide-react";
import type { Idea, YouTubeVideo } from "../../types";
import { api } from "../../api/client";
import FreeAIGuide from "../editors/FreeAIGuide";
import "./IdeasStep.css";

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

function extractJsonArray(text: string): any[] | null {
  const startMatch = text.match(/\[/);
  if (!startMatch) return null;
  const start = startMatch.index!;
  for (let i = text.length - 1; i > start; i--) {
    if (text[i] !== "]") continue;
    try {
      const parsed = JSON.parse(text.slice(start, i + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch { /* keep scanning */ }
  }
  return null;
}

function parseFreeAIResponse(text: string): { title: string; description: string; category?: string; trending_score?: number }[] {
  try {
    const parsed = extractJsonArray(text);
    if (parsed) {
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
    <div className="ideas-step">
      {/* Header */}
      <div className="ideas-header">
        <h2>Video Ideas</h2>
        <p>Find your next video idea</p>
      </div>

      {/* Input row */}
      <div className="card ideas-input-card">
        <div className="ideas-input-row">
          <input
            value={ideaTopic}
            onChange={(e) => onTopicChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !actionLoading && onGenerate()}
            placeholder="What do you want to make?"
            className="ideas-topic-input"
          />
          <button className="btn-primary ideas-generate-btn" disabled={!!actionLoading} onClick={onGenerate}>
            {actionLoading === "ideas" ? "Generating..." : <><Sparkles size={15} /> Generate with AI</>}
          </button>
        </div>

        {/* Action buttons row */}
        <div className="ideas-action-row">
          <button className="btn-secondary ideas-action-btn" onClick={() => setShowFreeAI(!showFreeAI)}>
            {showFreeAI ? "Hide Free AI" : "Free AI"}
          </button>
          <button className="btn-secondary ideas-action-btn-flex" onClick={() => setShowImport(!showImport)}>
            <Upload size={11} /> Import
          </button>
          {ideas.length > 0 && (
            <>
              <button className="btn-secondary ideas-action-btn-flex" onClick={() => downloadFile(JSON.stringify(ideas.map((i) => ({ title: i.title, description: i.description, category: i.category })), null, 2), "ideas.json", "application/json")}>
                <Download size={11} /> JSON
              </button>
              <button className="btn-secondary ideas-action-btn-flex" onClick={() => downloadFile(ideas.map((i, idx) => `${idx + 1}. ${i.title}\n${i.description}`).join("\n\n"), "ideas.txt", "text/plain")}>
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
        <div className="card ideas-recent-card">
          <button
            className="ideas-recent-toggle"
            onClick={() => setShowRecentVideos(!showRecentVideos)}
          >
            <Play size={16} color="#ff0000" />
            <span className="ideas-recent-title">
              Your Recent Videos ({recentVideos.length})
            </span>
            {showRecentVideos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showRecentVideos && (
            <div className="ideas-recent-list">
              {recentVideos.map((v, i) => (
                <div
                  key={v.video_id || i}
                  className="ideas-recent-item"
                >
                  <span className="ideas-recent-index">#{i + 1}</span>
                  <div className="ideas-recent-body">
                    <div className="ideas-recent-title-text">
                      {v.title}
                    </div>
                    {v.description && (
                      <div className="ideas-recent-desc">
                        {v.description.slice(0, 120)}
                      </div>
                    )}
                  </div>
                  <span className="ideas-recent-date">
                    {v.published_at ? new Date(v.published_at).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
              <p className="ideas-recent-note">
                AI uses these as context to generate new, different ideas.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Import panel */}
      {showImport && (
        <div className="card ideas-import-card">
          <div className="ideas-import-header">
            <span className="ideas-import-title">Paste AI Response / JSON</span>
            <button className="ideas-close-btn" onClick={() => setShowImport(false)}><X size={14} /></button>
          </div>
          <textarea className="ideas-import-textarea" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste AI response here..." rows={4} />
          <button className="btn-primary ideas-import-submit" onClick={handleImport} disabled={!importText.trim()}>
            Import Ideas
          </button>
        </div>
      )}

      {/* Category chips */}
      {ideas.length > 0 && (
        <div className="ideas-category-row">
          <button
            className="ideas-chip"
            onClick={() => setActiveCategory(null)}
            style={{
              background: !activeCategory ? "var(--primary)" : "var(--surface)",
              color: !activeCategory ? "#fff" : "var(--text-muted)",
              border: `1px solid ${!activeCategory ? "var(--primary)" : "var(--border)"}`,
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
                className="ideas-chip"
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                style={{
                  background: activeCategory === cat ? "var(--primary)" : "var(--surface)",
                  color: activeCategory === cat ? "#fff" : "var(--text-muted)",
                  border: `1px solid ${activeCategory === cat ? "var(--primary)" : "var(--border)"}`,
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
          <Lightbulb size={40} strokeWidth={1.5} className="ideas-empty-icon" />
          <div className="empty-state-title">No ideas yet</div>
          <div className="empty-state-desc">Enter a topic above and click Generate with AI to brainstorm video ideas.</div>
        </div>
      ) : (
        <div className="ideas-grid">
          {filtered.map((idea) => (
            <div
              key={idea.id}
              className="card ideas-idea-card"
              style={{
                borderColor: idea.is_selected ? "var(--primary)" : "var(--border)",
                background: idea.is_selected ? "rgba(124,92,255,0.08)" : "var(--card-bg)",
              }}
              onClick={() => setPreviewIdea(idea)}
            >
              {/* Category badge */}
              {idea.category && (
                <span className="ideas-category-badge">
                  {idea.category}
                </span>
              )}

              {/* Title */}
              <h4 className="ideas-idea-title">{idea.title}</h4>

              {/* Description */}
              <p className="ideas-idea-desc">
                {idea.description && idea.description.length > 120 ? idea.description.slice(0, 120) + "..." : idea.description || ""}
              </p>

              {/* Footer */}
              <div className="ideas-idea-footer">
                <div className="ideas-idea-score">
                  {idea.trending_score != null && (
                    <span className="ideas-idea-score-text">
                      &#9733; {idea.trending_score}
                    </span>
                  )}
                </div>
                <button
                  className={`${idea.is_selected ? "btn-primary" : "btn-secondary"} ideas-idea-use-btn`}
                  disabled={!!actionLoading}
                  onClick={(e) => { e.stopPropagation(); onSelect(idea.id); }}
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
          className="ideas-preview-overlay"
          onClick={() => setPreviewIdea(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card ideas-preview-card"
          >
            <div className="ideas-preview-header">
              <div>
                {previewIdea.category && (
                  <span className="ideas-category-badge">
                    {previewIdea.category}
                  </span>
                )}
                <h3 className="ideas-preview-title">{previewIdea.title}</h3>
              </div>
              <button className="ideas-close-btn" onClick={() => setPreviewIdea(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="ideas-preview-desc">{previewIdea.description}</p>
            <div className="ideas-preview-meta">
              {previewIdea.trending_score != null && <span>&#9733; Score: {previewIdea.trending_score}</span>}
              <span>Format: YouTube Video</span>
            </div>
            <div className="ideas-preview-actions">
              <button className="btn-secondary" onClick={() => setPreviewIdea(null)}>Close</button>
              <button
                className="btn-primary ideas-preview-use-btn"
                onClick={() => { onSelect(previewIdea.id); setPreviewIdea(null); }}
                disabled={!!actionLoading}
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
