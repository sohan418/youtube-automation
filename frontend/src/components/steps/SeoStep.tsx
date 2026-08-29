import { useState, useEffect } from "react";
import { Sparkles, Download, Upload, X, Clock, ShieldAlert, FileText, Edit2, Check, RotateCcw } from "lucide-react";
import type { SEOConstants, SEOMetadata, Scene, Script } from "../../types";
import { api } from "../../api/client";
import FreeAIGuide from "../editors/FreeAIGuide";
import "./SeoStep.css";

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
  let tsIdx = full.indexOf(`\n\n${c.timestamps_marker}`);
  let tsLeader = 2;
  if (tsIdx === -1 && full.startsWith(c.timestamps_marker)) {
    tsIdx = 0;
    tsLeader = 0;
  }

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
    const tsEnd = disclaimerIdx !== -1 ? disclaimerIdx : undefined;
    timestamps = full.slice(tsIdx + tsLeader, tsEnd).trim();
    body = full.slice(0, tsIdx).trimEnd();
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
      <div className="seo-ed-field-header">
        {label && (
          <strong className="seo-ed-label">
            {label}
          </strong>
        )}
        {!editing ? (
          <button onClick={() => setEditing(true)} className="seo-ed-btn">
            <Edit2 size={10} /> Edit
          </button>
        ) : (
          <div className="seo-ed-actions">
            <button onClick={handleSave} disabled={saving} className="seo-ed-save-btn">
              <Check size={10} /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setDraft(value); setEditing(false); }} className="seo-ed-cancel-btn">
              Cancel
            </button>
          </div>
        )}
      </div>
      {editing ? (
        multiline ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={rows} className="seo-ed-textarea" />
        ) : (
          <input value={draft} onChange={(e) => setDraft(e.target.value)} className="seo-ed-input" />
        )
      ) : (
        <p onClick={() => setEditing(true)} className="seo-ed-preview">
          {value || <span className="seo-ed-placeholder">—</span>}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function parseFreeAIResponse(text: string): Partial<SEOMetadata> {
  const result: Partial<SEOMetadata> = {};
  try {
    const objMatch = text.match(/\{/);
    if (objMatch) {
      const start = objMatch.index!;
      for (let i = text.length - 1; i > start; i--) {
        if (text[i] !== "}") continue;
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            if (parsed.title) result.title = parsed.title;
            if (parsed.description) result.description = parsed.description;
            if (parsed.tags) result.tags = Array.isArray(parsed.tags) ? parsed.tags.join(", ") : parsed.tags;
            if (parsed.hashtags) result.hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.join(" ") : parsed.hashtags;
            if (result.title) return result;
          }
        } catch { /* keep scanning */ }
      }
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
      <div className="seo-header">
        <h3 className="seo-title">
          <span className="seo-title-dot" />
          SEO
        </h3>
        <div className="seo-header-actions">
          {seo && (
            <>
              <button className="btn-secondary seo-compact-btn" onClick={handleExportJSON} title="Export JSON">
                <Download size={11} /> JSON
              </button>
              <button className="btn-secondary seo-compact-btn" onClick={handleExportText} title="Export text">
                <Download size={11} /> TXT
              </button>
            </>
          )}
          <button className="btn-secondary seo-compact-btn" onClick={() => setShowImport(!showImport)} title="Import SEO">
            <Upload size={11} /> Import
          </button>
          <button className="btn-primary seo-compact-btn" disabled={!!actionLoading || !activeScript} onClick={onGenerate}>
            {actionLoading === "seo" ? "Generating…" : <><Sparkles size={11} /> Generate</>}
          </button>
        </div>
      </div>

      {/* Import panel (collapsible) */}
      {showImport && (
        <div className="seo-import-panel">
          <div className="seo-import-header">
            <span className="seo-import-label">
              Paste AI Response
            </span>
            <button onClick={() => setShowImport(false)} className="seo-icon-btn"><X size={12} /></button>
          </div>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
            placeholder={'Paste AI response here...\n\nAccepts JSON or "Title: ... Description: ..." format.'}
            rows={4} className="seo-import-textarea" />
          <button className="btn-primary seo-compact-btn seo-import-btn" onClick={handleImport} disabled={!importText.trim()}>
            Import SEO Data
          </button>
        </div>
      )}

      <button className="btn-secondary seo-freeai-btn" onClick={() => setShowFreeAI(!showFreeAI)}>
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
        <div className="seo-grid">

          {/* Category */}
          <div className="seo-field">
            <label className="seo-label">
              Category
            </label>
            <span className="seo-value">
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
          <div className="seo-panel">
            <div className="seo-panel-header seo-panel-header-spread">
              <div className="seo-panel-header-left">
                <Clock size={11} color="var(--primary)" />
                <strong className="seo-panel-title">Timestamps</strong>
                <span className="seo-status" style={{ color: timestamps ? "var(--success)" : "var(--warning)" }}>
                  {timestamps ? "✓ ready" : "empty"}
                </span>
              </div>
              <button
                onClick={handleRegenerateTimestamps}
                disabled={!!actionLoading || scenes.length === 0}
                className="seo-icon-btn-primary"
                title="Rebuild timestamps from current scene durations"
              >
                <RotateCcw size={10} /> Rebuild
              </button>
            </div>
            <div className="seo-panel-body">
              {timestamps ? (
                <pre className="seo-pre">
                  {timestamps}
                </pre>
              ) : (
                <p className="seo-timestamps-empty">
                  No timestamps yet. {scenes.length > 0 ? "Click Rebuild to generate from scenes." : "Add scenes with voice audio first."}
                </p>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="seo-panel">
            <div className="seo-panel-header">
              <ShieldAlert size={11} color="var(--warning)" />
              <strong className="seo-panel-title">YouTube Policy Disclaimer</strong>
            </div>
            <div className="seo-panel-body">
              <EditableField label="" value={disclaimer} multiline rows={3}
                onSave={(v) => constants ? onSave({ description: combineDescription(body, timestamps, v, constants) }) : Promise.resolve()} />
            </div>
          </div>

          {/* Tags + Hashtags side by side */}
          <div className="seo-tags-grid">
            <EditableField label="Tags" value={seo.tags ?? ""} multiline rows={2}
              onSave={(v) => onSave({ tags: v })} />
            <EditableField label="Hashtags" value={seo.hashtags ?? ""}
              onSave={(v) => onSave({ hashtags: v })} />
          </div>

          {/* Full description preview */}
          <details className="seo-details">
            <summary>
              <FileText size={11} /> Preview full YouTube description
            </summary>
            <pre className="seo-details-pre">
              {seo.description}
            </pre>
          </details>

        </div>
      ) : (
        <p className="seo-empty-note">
          Generate SEO metadata for YouTube upload.
        </p>
      )}
    </div>
  );
}
