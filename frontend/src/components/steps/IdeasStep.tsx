import { useState } from "react";
import { Sparkles, Download, Upload, X } from "lucide-react";
import type { Idea } from "../../types";
import FreeAIGuide from "../editors/FreeAIGuide";

interface Props {
  ideas: Idea[];
  actionLoading: string;
  ideaTopic: string;
  onTopicChange: (v: string) => void;
  onGenerate: () => void;
  onSelect: (id: number) => void;
  onFreeAIResponse?: (ideas: { title: string; description: string; category?: string }[]) => void;
  prompts?: { system: string; user: string };
}

function parseFreeAIResponse(text: string): { title: string; description: string; category?: string }[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          title: item.title || item.name || "",
          description: item.description || item.summary || "",
          category: item.category || item.topic || undefined,
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

export default function IdeasStep({ ideas, actionLoading, ideaTopic, onTopicChange, onGenerate, onSelect, onFreeAIResponse, prompts }: Props) {
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const freeAIPrompt = `SYSTEM PROMPT:
You are a YouTube trend analyst. Generate video ideas as JSON.

USER PROMPT:
Generate ${ideaTopic.trim() ? 5 : 5} trending YouTube video ideas${ideaTopic.trim() ? ` about: ${ideaTopic}` : ""}. Language: en. Return JSON: {"ideas": [{"title": "...", "description": "...", "category": "...", "trending_score": 0-100}]}`;

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

  const handleExportJSON = () => {
    const data = ideas.map((i) => ({ title: i.title, description: i.description, category: i.category }));
    downloadFile(JSON.stringify(data, null, 2), "ideas.json", "application/json");
  };

  const handleExportText = () => {
    const text = ideas.map((i, idx) => `${idx + 1}. ${i.title}\n${i.description}`).join("\n\n");
    downloadFile(text, "ideas.txt", "text/plain");
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

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3>Video Ideas</h3>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {ideas.length > 0 && (
            <>
              <button className="btn-secondary" onClick={handleExportJSON} title="Export as JSON">
                <Download size={13} />
              </button>
              <button className="btn-secondary" onClick={handleExportText} title="Export as text">
                <Download size={13} />
              </button>
            </>
          )}
          <button className="btn-secondary" onClick={() => setShowImport(!showImport)} title="Import ideas">
            <Upload size={13} />
          </button>
          <button
            className="btn-accent"
            onClick={() => setShowFreeAI(!showFreeAI)}
            style={{ padding: "0.35rem 0.7rem", fontSize: "0.78rem", background: showFreeAI ? "var(--primary)" : undefined, color: showFreeAI ? "white" : undefined }}
          >
            {showFreeAI ? "Hide Free AI" : "Generate with Free AI"}
          </button>
          <button className="btn-accent" disabled={!!actionLoading} onClick={onGenerate}>
            {actionLoading === "ideas" ? "Generating..." : <><Sparkles size={14} style={{ verticalAlign: "middle" }} /> Generate Ideas</>}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          value={ideaTopic}
          onChange={(e) => onTopicChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !actionLoading) {
              (e.target as HTMLInputElement).closest("div")?.querySelector<HTMLButtonElement>(".btn-accent")?.click();
            }
          }}
          placeholder="Enter a topic to generate ideas (e.g. 'AI tools', 'street food')"
          style={{ flex: 1 }}
        />
      </div>

      {showImport && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Paste AI Response / JSON</span>
            <button onClick={() => setShowImport(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste AI response here...\n\nAccepts JSON array or plain text list.'
            rows={5}
            style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "0.75rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />
          <button className="btn-primary" onClick={handleImport} disabled={!importText.trim()} style={{ marginTop: "0.4rem", width: "100%" }}>
            Import Ideas
          </button>
        </div>
      )}

      {showFreeAI && (
        <FreeAIGuide
          title="Generate Ideas with Free AI"
          prompt={prompts ? undefined : freeAIPrompt}
          promptPair={prompts}
          responsePlaceholder='Paste AI response here...\n\nAccepts JSON or plain text list.'
          onParseResponse={handleFreeAIResponse}
        />
      )}

      {ideas.length === 0 ? (
        <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>No ideas yet. Enter a topic and click Generate Ideas.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="card"
              style={{
                borderColor: idea.is_selected ? "var(--accent)" : "var(--border)",
                background: idea.is_selected ? "rgba(62,166,255,0.05)" : "var(--surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h4 style={{ marginBottom: "0.25rem" }}>{idea.title}</h4>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{idea.description}</p>
                  <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
                    Score: {idea.trending_score} · {idea.category}
                  </span>
                </div>
                <button
                  className={idea.is_selected ? "btn-accent" : "btn-secondary"}
                  disabled={!!actionLoading}
                  onClick={() => onSelect(idea.id)}
                >
                  {idea.is_selected ? "Selected" : "Select"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
