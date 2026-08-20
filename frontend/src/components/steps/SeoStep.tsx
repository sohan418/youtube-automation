import { useState, useEffect } from "react";
import { Sparkles, Download, Upload, X, Clock, ShieldAlert, FileText, Edit2, Check, RotateCcw } from "lucide-react";
import type { SEOCategory, SEOConstants, SEOMetadata, Scene, Script } from "../../types";
import { api } from "../../api/client";
import FreeAIGuide from "../editors/FreeAIGuide";

// ─── Helpers (all accept constants fetched from backend) ─────────────────────
function formatTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildTimestamps(scenes: Scene[], timestampsMarker: string): string {
  if (!scenes.length) return "";
  const lines = [timestampsMarker];
  let t = 0;
  for (const s of [...scenes].sort((a, b) => a.order_index - b.order_index)) {
    const label = (s.narration || `Scene ${s.order_index}`).split("\n")[0].slice(0, 60);
    lines.push(`${formatTimestamp(t)} – ${label}`);
    t += s.duration_seconds ?? 5;
  }
  return lines.join("\n");
}

function parseDescription(
  full: string | null,
  c: SEOConstants,
): { body: string; timestamps: string; disclaimer: string } {
  if (!full) return { body: "", timestamps: "", disclaimer: c.default_disclaimer };

  const disclaimerIdx = full.indexOf(`${c.section_sep}\n${c.disclaimer_marker}`);
  const tsIdx = full.indexOf(`\n\n${c.timestamps_marker}`);

  let body = full;
  let timestamps = "";
  let disclaimer = c.default_disclaimer;

  if (disclaimerIdx !== -1) {
    const block = full.slice(disclaimerIdx);
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const inner = block.match(
      new RegExp(`${esc(c.section_sep)}\\n${esc(c.disclaimer_marker)}\\n([\\s\\S]*?)\\n${esc(c.section_sep)}`)
    );
    disclaimer = inner ? inner[1].trim() : c.default_disclaimer;
    body = full.slice(0, disclaimerIdx).trimEnd();
  }

  if (tsIdx !== -1) {
    const tsEnd = disclaimerIdx !== -1 ? disclaimerIdx : body.length + tsIdx;
    const tsBlock = full.slice(tsIdx + 2, tsEnd !== body.length + tsIdx ? tsEnd : undefined).trim();
    body = full.slice(0, tsIdx).trimEnd();
    timestamps = tsBlock;
  }

  return { body, timestamps, disclaimer };
}

function combineDescription(body: string, timestamps: string, disclaimer: string, c: SEOConstants): string {
  let result = body.trimEnd();
  if (timestamps.trim()) result += `\n\n${timestamps.trim()}`;
  result += `\n\n${c.section_sep}\n${c.disclaimer_marker}\n${disclaimer.trim()}\n${c.section_sep}`;
  return result;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  seo: SEOMetadata | null;
  scenes: Scene[];
  categories: SEOCategory[];
  activeScript: Script | null;
  actionLoading: string;
  onGenerate: () => void;
  onCategoryChange: (categoryId: number) => void;
  onSave: (data: { title?: string; description?: string; tags?: string; hashtags?: string }) => Promise<void>;
  onFreeAIResponse?: (data: Partial<SEOMetadata>) => void;
  prompts?: { system: string; user: string };
}

// ─── Editable field ───────────────────────────────────────────────────────────
function EditableField({
  label, value, multiline = false, rows = 3,
  onSave,
}: {
  label: string; value: string; multiline?: boolean; rows?: number;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.3rem" }}>
        <strong style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </strong>
        {!editing ? (
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.72rem" }}>
            <Edit2 size={11} /> Edit
          </button>
        ) : (
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button onClick={handleSave} disabled={saving} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.72rem" }}>
              <Check size={11} /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setDraft(value); setEditing(false); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.72rem" }}>
              Cancel
            </button>
          </div>
        )}
      </div>
      {editing ? (
        multiline ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={rows}
            style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--primary)", background: "var(--surface)", color: "var(--text)", fontSize: "0.82rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
        ) : (
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
            style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--primary)", background: "var(--surface)", color: "var(--text)", fontSize: "0.82rem", boxSizing: "border-box" }} />
        )
      ) : (
        <p style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem", margin: 0, lineHeight: 1.6 }}>{value || <span style={{ color: "var(--text-muted)" }}>—</span>}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
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

export default function SeoStep({
  seo, scenes, categories, activeScript, actionLoading,
  onGenerate, onCategoryChange, onSave, onFreeAIResponse, prompts,
}: Props) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [constants, setConstants] = useState<SEOConstants | null>(null);

  // Fetch marker constants once from the backend — single source of truth
  useEffect(() => {
    api.getSEOConstants().then(setConstants).catch(() => {});
  }, []);

  // Don't parse until constants are loaded to avoid mismatched separators
  const parsed = constants
    ? parseDescription(seo?.description ?? null, constants)
    : { body: seo?.description ?? "", timestamps: "", disclaimer: "" };
  const { body, timestamps, disclaimer } = parsed;

  const freeAIPrompt = `SYSTEM PROMPT:\nYou are a YouTube SEO expert. Generate metadata as JSON.\n\nUSER PROMPT:\nGenerate SEO metadata for a YouTube video.\nTitle: ${activeScript?.title || "Your Video Title"}\nScript excerpt: ${(activeScript?.body || "").substring(0, 500)}\nLanguage: en\nReturn JSON: {"title": "...", "description": "...", "tags": "...", "hashtags": "..."}`;

  const handleFreeAIResponse = (text: string) => {
    if (!onFreeAIResponse) return;
    const parsed = parseFreeAIResponse(text);
    if (parsed.title) onFreeAIResponse(parsed);
  };

  const handleImport = () => {
    if (!onFreeAIResponse || !importText.trim()) return;
    const parsed = parseFreeAIResponse(importText);
    if (parsed.title) { onFreeAIResponse(parsed); setImportText(""); setShowImport(false); }
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
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // Rebuild timestamps from current scenes and save
  const handleRegenerateTimestamps = async () => {
    if (!seo || !constants) return;
    const newTs = buildTimestamps(scenes, constants.timestamps_marker);
    const full = combineDescription(body, newTs, disclaimer, constants);
    await onSave({ description: full });
  };

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>SEO Metadata</h3>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {seo && (
            <>
              <button className="btn-secondary" onClick={handleExportJSON} title="Export JSON"><Download size={13} /></button>
              <button className="btn-secondary" onClick={handleExportText} title="Export text"><Download size={13} /></button>
            </>
          )}
          <button className="btn-secondary" onClick={() => setShowImport(!showImport)} title="Import SEO"><Upload size={13} /></button>
          <button className="btn-accent" disabled={!!actionLoading || !activeScript} onClick={onGenerate}>
            {actionLoading === "seo" ? "Generating..." : <><Sparkles size={14} style={{ verticalAlign: "middle" }} /> Generate SEO</>}
          </button>
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Paste AI Response</span>
            <button onClick={() => setShowImport(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
          </div>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
            placeholder={'Paste AI response here...\n\nAccepts JSON or "Title: ... Description: ..." format.'}
            rows={5} style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "0.75rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          <button className="btn-primary" onClick={handleImport} disabled={!importText.trim()} style={{ marginTop: "0.4rem", width: "100%" }}>
            Import SEO Data
          </button>
        </div>
      )}

      <FreeAIGuide
        title="Generate SEO with Free AI"
        prompt={prompts ? undefined : freeAIPrompt}
        promptPair={prompts}
        responsePlaceholder={'Paste AI response here...\n\nAccepts JSON or "Title: ..." format.'}
        onParseResponse={handleFreeAIResponse}
      />

      {seo ? (
        <div style={{ display: "grid", gap: "1.25rem", marginTop: "1rem" }}>

          {/* Category */}
          <div>
            <label style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "0.3rem" }}>
              YouTube Category
            </label>
            <select value={seo.category_id ?? ""} disabled={!!actionLoading}
              onChange={(e) => { const v = Number(e.target.value); if (v) onCategoryChange(v); }}
              style={{ width: "100%", maxWidth: 360 }}>
              <option value="" disabled>Select a category...</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <EditableField label="Title" value={seo.title ?? ""}
            onSave={(v) => onSave({ title: v })} />

          {/* Description (body only) */}
          <EditableField label="Description" value={body} multiline rows={5}
            onSave={(v) => constants ? onSave({ description: combineDescription(v, timestamps, disclaimer, constants) }) : Promise.resolve()} />

          {/* Timestamps */}
          <div style={{ borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.85rem", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Clock size={14} color="var(--primary)" />
                <strong style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Timestamps</strong>
              </div>
              <button
                onClick={handleRegenerateTimestamps}
                disabled={!!actionLoading || scenes.length === 0}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem" }}
                title="Rebuild timestamps from current scene durations"
              >
                <RotateCcw size={11} /> Rebuild
              </button>
            </div>
            <div style={{ padding: "0.75rem 0.85rem" }}>
              {timestamps ? (
                <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                  {timestamps}
                </pre>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: 0 }}>
                  No timestamps yet. {scenes.length > 0 ? "Click Rebuild to generate from scenes." : "Add scenes with voice audio first."}
                </p>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 0.85rem", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <ShieldAlert size={14} color="var(--warning, #f59e0b)" />
              <strong style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>YouTube Policy Disclaimer</strong>
            </div>
            <div style={{ padding: "0.75rem 0.85rem" }}>
              <EditableField label="" value={disclaimer} multiline rows={4}
                onSave={(v) => constants ? onSave({ description: combineDescription(body, timestamps, v, constants) }) : Promise.resolve()} />
            </div>
          </div>

          {/* Tags */}
          <EditableField label="Tags" value={seo.tags ?? ""} multiline rows={2}
            onSave={(v) => onSave({ tags: v })} />

          {/* Hashtags */}
          <EditableField label="Hashtags" value={seo.hashtags ?? ""}
            onSave={(v) => onSave({ hashtags: v })} />

          {/* Full description preview */}
          <details style={{ borderRadius: "6px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <summary style={{ padding: "0.5rem 0.85rem", cursor: "pointer", fontSize: "0.78rem", color: "var(--text-muted)", background: "var(--surface)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <FileText size={13} /> Preview full YouTube description
            </summary>
            <pre style={{ margin: 0, padding: "0.75rem 0.85rem", fontFamily: "inherit", fontSize: "0.78rem", whiteSpace: "pre-wrap", lineHeight: 1.7, color: "var(--text)" }}>
              {seo.description}
            </pre>
          </details>

        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>Generate SEO metadata for YouTube upload.</p>
      )}
    </div>
  );
}
