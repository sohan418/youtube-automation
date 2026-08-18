import { useState } from "react";
import { Sparkles, Download, Upload, X } from "lucide-react";
import type { SEOCategory, SEOMetadata, Script } from "../../types";
import FreeAIGuide from "../editors/FreeAIGuide";

interface Props {
  seo: SEOMetadata | null;
  categories: SEOCategory[];
  activeScript: Script | null;
  actionLoading: string;
  onGenerate: () => void;
  onCategoryChange: (categoryId: number) => void;
  onFreeAIResponse?: (data: Partial<SEOMetadata>) => void;
  prompts?: { system: string; user: string };
}

function parseFreeAIResponse(text: string): Partial<SEOMetadata> {
  const result: Partial<SEOMetadata> = {};

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title) result.title = parsed.title;
      if (parsed.description) result.description = parsed.description;
      if (parsed.tags) result.tags = Array.isArray(parsed.tags) ? parsed.tags.join(", ") : parsed.tags;
      if (parsed.hashtags) result.hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.join(" ") : parsed.hashtags;
      if (result.title) return result;
    }
  } catch {}

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const titleMatch = line.match(/^Title[:\s]+(.+)/i);
    const descMatch = line.match(/^Description[:\s]+(.+)/i);
    const tagsMatch = line.match(/^Tags[:\s]+(.+)/i);
    const hashMatch = line.match(/^Hashtags?[:\s]+(.+)/i);
    if (titleMatch) result.title = titleMatch[1].trim();
    else if (descMatch) result.description = descMatch[1].trim();
    else if (tagsMatch) result.tags = tagsMatch[1].trim();
    else if (hashMatch) result.hashtags = hashMatch[1].trim();
  }

  return result;
}

export default function SeoStep({ seo, categories, activeScript, actionLoading, onGenerate, onCategoryChange, onFreeAIResponse, prompts }: Props) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const freeAIPrompt = `SYSTEM PROMPT:
You are a YouTube SEO expert. Generate metadata as JSON.

USER PROMPT:
Generate SEO metadata for a YouTube video.
Title: ${activeScript?.title || "Your Video Title"}
Script excerpt: ${(activeScript?.body || "").substring(0, 500)}
Language: en
Return JSON: {"title": "...", "description": "...", "tags": "...", "hashtags": "..."}`;

  const handleFreeAIResponse = (text: string) => {
    if (!onFreeAIResponse) return;
    const parsed = parseFreeAIResponse(text);
    if (parsed.title) onFreeAIResponse(parsed);
  };

  const handleImport = () => {
    if (!onFreeAIResponse || !importText.trim()) return;
    const parsed = parseFreeAIResponse(importText);
    if (parsed.title) {
      onFreeAIResponse(parsed);
      setImportText("");
      setShowImport(false);
    }
  };

  const handleExportJSON = () => {
    if (!seo) return;
    const data = { title: seo.title, description: seo.description, tags: seo.tags, hashtags: seo.hashtags };
    downloadFile(JSON.stringify(data, null, 2), "seo-metadata.json", "application/json");
  };

  const handleExportText = () => {
    if (!seo) return;
    const text = `Title: ${seo.title}\n\nDescription:\n${seo.description}\n\nTags: ${seo.tags}\n\nHashtags: ${seo.hashtags}`;
    downloadFile(text, "seo-metadata.txt", "text/plain");
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>SEO Metadata</h3>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {seo && (
            <>
              <button className="btn-secondary" onClick={handleExportJSON} title="Export JSON">
                <Download size={13} />
              </button>
              <button className="btn-secondary" onClick={handleExportText} title="Export text">
                <Download size={13} />
              </button>
            </>
          )}
          <button className="btn-secondary" onClick={() => setShowImport(!showImport)} title="Import SEO">
            <Upload size={13} />
          </button>
          <button className="btn-accent" disabled={!!actionLoading || !activeScript} onClick={onGenerate}>
            {actionLoading === "seo" ? "Generating..." : <><Sparkles size={14} style={{ verticalAlign: "middle" }} /> Generate SEO</>}
          </button>
        </div>
      </div>

      {showImport && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Paste AI Response</span>
            <button onClick={() => setShowImport(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste AI response here...\n\nAccepts JSON or "Title: ... Description: ... Tags: ..." format.'
            rows={5}
            style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "0.75rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />
          <button className="btn-primary" onClick={handleImport} disabled={!importText.trim()} style={{ marginTop: "0.4rem", width: "100%" }}>
            Import SEO Data
          </button>
        </div>
      )}

      <FreeAIGuide
        title="Generate SEO with Free AI"
        prompt={prompts ? undefined : freeAIPrompt}
        promptPair={prompts}
        responsePlaceholder='Paste AI response here...\n\nAccepts JSON or "Title: ..." format.'
        onParseResponse={handleFreeAIResponse}
      />

      {seo ? (
        <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
              YOUTUBE CATEGORY
            </label>
            <select
              value={seo.category_id ?? ""}
              disabled={!!actionLoading}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v) onCategoryChange(v);
              }}
              style={{ width: "100%", maxWidth: 360 }}
            >
              <option value="" disabled>Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>TITLE</strong>
            <p>{seo.title}</p>
          </div>
          <div>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>DESCRIPTION</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{seo.description}</p>
          </div>
          <div>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>TAGS</strong>
            <p>{seo.tags}</p>
          </div>
          <div>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>HASHTAGS</strong>
            <p>{seo.hashtags}</p>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>Generate SEO metadata for YouTube upload.</p>
      )}
    </div>
  );
}
