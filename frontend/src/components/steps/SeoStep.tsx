import { useState, useEffect } from "react";
import { Sparkles, Download, Upload, X, Clock, ShieldAlert, FileText, Edit2, Check, RotateCcw } from "lucide-react";
import type { SEOConstants, SEOMetadata, Scene, Script } from "../../types";
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
  projectId: number;
  projectLanguage?: string;
  seo: SEOMetadata | null;
  scenes: Scene[];
  activeScript: Script | null;
  actionLoading: string;
  projectCategory: string;
  onGenerate: () => void;
  onSave: (data: { title?: string; description?: string; tags?: string; hashtags?: string }) => Promise<void>;
  onFreeAIResponse?: (data: Partial<SEOMetadata>) => void;
}

// ─── Editable field (compact) ────────────────────────────────────────────────
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.2rem", minHeight: 18 }}>
        {label && (
          <strong style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label}
          </strong>
        )}
        {!editing ? (
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.15rem", fontSize: "0.65rem", padding: 0 }}>
            <Edit2 size={10} /> Edit
          </button>
        ) : (
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <button onClick={handleSave} disabled={saving} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.15rem", fontSize: "0.65rem", padding: 0 }}>
              <Check size={10} /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setDraft(value); setEditing(false); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.65rem", padding: 0 }}>
              Cancel
            </button>
          </div>
        )}
      </div>
      {editing ? (
        multiline ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={rows}
            style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "5px", border: "1px solid var(--primary)", background: "var(--bg)", color: "var(--text)", fontSize: "0.76rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
        ) : (
          <input value={draft} onChange={(e) => setDraft(e.target.value)}
            style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "5px", border: "1px solid var(--primary)", background: "var(--bg)", color: "var(--text)", fontSize: "0.76rem", boxSizing: "border-box" }} />
        )
      ) : (
        <p onClick={() => setEditing(true)} style={{ whiteSpace: "pre-wrap", fontSize: "0.78rem", margin: 0, lineHeight: 1.5, cursor: "text" }}>
          {value || <span style={{ color: "var(--text-muted)" }}>—</span>}
        </p>
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

const compactBtnStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  padding: "0.28rem 0.55rem",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
};

export default function SeoStep({
  projectId, projectLanguage, seo, scenes, activeScript, actionLoading, projectCategory,
  onGenerate, onSave, onFreeAIResponse,
}: Props) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [constants, setConstants] = useState<SEOConstants | null>(null);
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [dynamicPrompt, setDynamicPrompt] = useState<{ system: string; user: string } | null>(null);

  useEffect(() => {
    if (!showFreeAI) return;
    api.buildSEOPrompt(projectId, {
      script_title: activeScript?.title || undefined,
      script_body: activeScript?.body || undefined,
      language: projectLanguage || "en",
    }).then(setDynamicPrompt).catch(() => {});
  }, [showFreeAI, projectId, projectLanguage, activeScript]);

  // Fetch marker constants once from the backend — single source of truth
  useEffect(() => {
    api.getSEOConstants().then(setConstants).catch(() => {});
  }, []);

  // Don't parse until constants are loaded to avoid mismatched separators
  const parsed = constants
    ? parseDescription(seo?.description ?? null, constants)
    : { body: seo?.description ?? "", timestamps: "", disclaimer: "" };
  const { body, timestamps, disclaimer } = parsed;

  const freeAIPrompt = `SYSTEM PROMPT:\nYou are a YouTube SEO expert. Generate metadata as JSON.\n\nUSER PROMPT:\nGenerate SEO metadata for a YouTube video.\nTitle: ${activeScript?.title || "Your Video Title"}\nScript excerpt: ${(activeScript?.body || "").substring(0, 500)}\nLanguage: ${projectLanguage || "en"}\nReturn JSON: {"title": "...", "description": "...", "tags": "...", "hashtags": "..."}`;

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
      {/* Compact header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", display: "inline-block" }} />
          SEO
        </h3>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {seo && (
            <>
              <button className="btn-secondary" style={compactBtnStyle} onClick={handleExportJSON} title="Export JSON">
                <Download size={11} /> JSON
              </button>
              <button className="btn-secondary" style={compactBtnStyle} onClick={handleExportText} title="Export text">
                <Download size={11} /> TXT
              </button>
            </>
          )}
          <button className="btn-secondary" style={compactBtnStyle} onClick={() => setShowImport(!showImport)} title="Import SEO">
            <Upload size={11} /> Import
          </button>
          <button className="btn-primary" style={compactBtnStyle} disabled={!!actionLoading || !activeScript} onClick={onGenerate}>
            {actionLoading === "seo" ? "Generating…" : <><Sparkles size={11} /> Generate</>}
          </button>
        </div>
      </div>

      {/* Import panel (collapsible) */}
      {showImport && (
        <div style={{
          marginTop: "0.6rem",
          padding: "0.6rem",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          background: "var(--surface)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Paste AI Response
            </span>
            <button onClick={() => setShowImport(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} /></button>
          </div>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
            placeholder={'Paste AI response here...\n\nAccepts JSON or "Title: ... Description: ..." format.'}
            rows={4} style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "5px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: "0.72rem", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
          <button className="btn-primary" onClick={handleImport} disabled={!importText.trim()} style={{ ...compactBtnStyle, marginTop: "0.4rem", width: "100%", justifyContent: "center" }}>
            Import SEO Data
          </button>
        </div>
      )}

      <button className="btn-secondary" onClick={() => setShowFreeAI(!showFreeAI)} style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", alignSelf: "flex-start" }}>
        {showFreeAI ? "Hide Free AI" : "Free AI"}
      </button>
      {showFreeAI && (
        <FreeAIGuide
          title="Generate SEO with Free AI"
          prompt={dynamicPrompt ? undefined : freeAIPrompt}
          promptPair={dynamicPrompt || undefined}
          responsePlaceholder={'Paste AI response here...\n\nAccepts JSON or "Title: ..." format.'}
          onParseResponse={handleFreeAIResponse}
        />
      )}

      {seo ? (
        <div style={{ display: "grid", gap: "0.7rem", marginTop: "0.75rem" }}>

          {/* Category */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <label style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Category
            </label>
            <span style={{ fontSize: "0.78rem", color: "var(--text)", fontWeight: 500 }}>
              {seo.category || projectCategory || "Uncategorized"}
            </span>
          </div>

          {/* Title */}
          <EditableField label="Title" value={seo.title ?? ""}
            onSave={(v) => onSave({ title: v })} />

          {/* Description (body only) */}
          <EditableField label="Description" value={body} multiline rows={4}
            onSave={(v) => constants ? onSave({ description: combineDescription(v, timestamps, disclaimer, constants) }) : Promise.resolve()} />

          {/* Timestamps */}
          <div style={{ borderRadius: "6px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.35rem 0.6rem", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Clock size={11} color="var(--primary)" />
                <strong style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>Timestamps</strong>
                <span style={{ fontSize: "0.62rem", color: timestamps ? "var(--success)" : "var(--warning)" }}>
                  {timestamps ? "✓ ready" : "empty"}
                </span>
              </div>
              <button
                onClick={handleRegenerateTimestamps}
                disabled={!!actionLoading || scenes.length === 0}
                style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.65rem", padding: 0 }}
                title="Rebuild timestamps from current scene durations"
              >
                <RotateCcw size={10} /> Rebuild
              </button>
            </div>
            <div style={{ padding: "0.45rem 0.6rem", background: "var(--bg)" }}>
              {timestamps ? (
                <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "0.7rem", color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.55, maxHeight: 140, overflowY: "auto" }}>
                  {timestamps}
                </pre>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.7rem", margin: 0 }}>
                  No timestamps yet. {scenes.length > 0 ? "Click Rebuild to generate from scenes." : "Add scenes with voice audio first."}
                </p>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ borderRadius: "6px", border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.6rem", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <ShieldAlert size={11} color="var(--warning)" />
              <strong style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>YouTube Policy Disclaimer</strong>
            </div>
            <div style={{ padding: "0.45rem 0.6rem", background: "var(--bg)" }}>
              <EditableField label="" value={disclaimer} multiline rows={3}
                onSave={(v) => constants ? onSave({ description: combineDescription(body, timestamps, v, constants) }) : Promise.resolve()} />
            </div>
          </div>

          {/* Tags + Hashtags side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.7rem" }}>
            <EditableField label="Tags" value={seo.tags ?? ""} multiline rows={2}
              onSave={(v) => onSave({ tags: v })} />
            <EditableField label="Hashtags" value={seo.hashtags ?? ""}
              onSave={(v) => onSave({ hashtags: v })} />
          </div>

          {/* Full description preview */}
          <details style={{ borderRadius: "6px", border: "1px solid var(--border)", overflow: "hidden", background: "var(--surface)" }}>
            <summary style={{ padding: "0.35rem 0.6rem", cursor: "pointer", fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem", userSelect: "none" }}>
              <FileText size={11} /> Preview full YouTube description
            </summary>
            <pre style={{ margin: 0, padding: "0.45rem 0.6rem", borderTop: "1px solid var(--border)", background: "var(--bg)", fontFamily: "monospace", fontSize: "0.7rem", whiteSpace: "pre-wrap", lineHeight: 1.55, color: "var(--text)", maxHeight: 220, overflowY: "auto" }}>
              {seo.description}
            </pre>
          </details>

        </div>
      ) : (
        <p style={{ color: "var(--text-muted)", marginTop: "0.75rem", fontSize: "0.78rem" }}>
          Generate SEO metadata for YouTube upload.
        </p>
      )}
    </div>
  );
}
