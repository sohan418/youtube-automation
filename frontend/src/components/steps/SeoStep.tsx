import { useState, useEffect } from "react";
import { Sparkles, Download, Upload, X, Clock, ShieldAlert, Edit2, Check, RotateCcw, Zap } from "lucide-react";
import type { SEOConstants, SEOMetadata, Scene, Script, TimelineData } from "../../types";
import { api } from "../../api/client";
import StepHeader from "../studio/StepHeader";
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

function buildTimestamps(scenes: Scene[], timestampsMarker: string, timeline?: TimelineData | null): string {
  if (!scenes.length) return "";
  const lines = [timestampsMarker];

  const sceneStartMap = new Map<number, number>();
  if (timeline && timeline.clips && timeline.clips.length > 0) {
    for (const c of timeline.clips) {
      if (c.scene_id != null && c.start != null) {
        if (!sceneStartMap.has(c.scene_id) || c.start < sceneStartMap.get(c.scene_id)!) {
          sceneStartMap.set(c.scene_id, c.start);
        }
      }
    }
  }

  const sorted = [...scenes].sort((a, b) => {
    const tA = sceneStartMap.has(a.id) ? sceneStartMap.get(a.id)! : Infinity;
    const tB = sceneStartMap.has(b.id) ? sceneStartMap.get(b.id)! : Infinity;
    if (tA !== Infinity || tB !== Infinity) {
      return tA - tB;
    }
    return a.order_index - b.order_index;
  });

  let accum = 0;
  for (const s of sorted) {
    const startTime = sceneStartMap.has(s.id) ? sceneStartMap.get(s.id)! : accum;
    const label = (s.narration || `Scene ${s.order_index}`).split("\n")[0].slice(0, 60);
    lines.push(`${formatTimestamp(startTime)} – ${label}`);
    accum = startTime + (s.duration_seconds ?? 5);
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
  if (tsIdx === -1) {
    tsIdx = full.indexOf(`\n${c.timestamps_marker}`);
    tsLeader = 1;
  }

  let body = full;
  let timestamps = "";
  let disclaimer = c.default_disclaimer;

  if (disclaimerIdx !== -1) {
    disclaimer = full.slice(disclaimerIdx + c.section_sep.length + 1 + c.disclaimer_marker.length).trim();
    body = full.slice(0, disclaimerIdx).trim();
  }

  if (tsIdx !== -1 && (disclaimerIdx === -1 || tsIdx < disclaimerIdx)) {
    const endIdx = disclaimerIdx !== -1 ? disclaimerIdx : full.length;
    timestamps = full.slice(tsIdx + tsLeader + c.timestamps_marker.length, endIdx).trim();
    body = full.slice(0, tsIdx).trim();
  }

  return { body, timestamps, disclaimer };
}

function combineDescription(
  body: string,
  timestamps: string,
  disclaimer: string,
  c: SEOConstants,
): string {
  let result = body.trim();
  if (timestamps.trim()) {
    result += `\n\n${c.timestamps_marker}\n${timestamps.trim()}`;
  }
  if (disclaimer.trim()) {
    result += `${c.section_sep}\n${c.disclaimer_marker}\n${disclaimer.trim()}`;
  }
  return result;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  projectId: number;
  projectLanguage?: string;
  seo: SEOMetadata | null;
  scenes: Scene[];
  timeline?: TimelineData | null;
  activeScript: Script | null;
  actionLoading: string;
  projectCategory: string;
  onGenerate: () => void;
  onSave: (data: { title?: string; description?: string; tags?: string; hashtags?: string; timestamps?: string }) => Promise<void>;
  onFreeAIResponse?: (data: Partial<SEOMetadata>) => void;
  onCollapse?: () => void;
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
function formatTimestampsValue(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "object" && item !== null) {
          const rec = item as Record<string, unknown>;
          const t = rec.time || rec.timestamp || rec.ts || rec.start || "";
          const l = rec.label || rec.title || rec.name || rec.description || "";
          if (t && l) return `${t} - ${l}`;
          if (t) return String(t);
          if (l) return String(l);
          return JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof val === "object" && val !== null) {
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k} - ${v}`)
      .join("\n");
  }
  return String(val);
}

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
            if (parsed.timestamps != null) result.timestamps = formatTimestampsValue(parsed.timestamps);
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
    const tsMatch = line.match(/^Timestamps?[:\s]+(.+)/i);
    if (titleMatch) result.title = titleMatch[1].trim();
    else if (descMatch) result.description = descMatch[1].trim();
    else if (tagsMatch) result.tags = tagsMatch[1].trim();
    else if (hashMatch) result.hashtags = hashMatch[1].trim();
    else if (tsMatch) result.timestamps = tsMatch[1].trim();
  }
  return result;
}

export default function SeoStep({
  projectId, projectLanguage, seo, scenes, timeline, activeScript, actionLoading, projectCategory,
  onGenerate, onSave, onFreeAIResponse, onCollapse,
}: Props) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [constants, setConstants] = useState<SEOConstants | null>(null);
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [dynamicPrompt, setDynamicPrompt] = useState<{ system: string; user: string } | null>(null);

  const tsContext = constants && scenes.length ? buildTimestamps(scenes, constants.timestamps_marker, timeline) : "";

  useEffect(() => {
    if (!showFreeAI) return;
    api.buildSEOPrompt(projectId, {
      script_title: activeScript?.title || undefined,
      script_body: activeScript?.body || undefined,
      language: projectLanguage || "en",
      timestamps: tsContext || undefined,
    }).then(setDynamicPrompt).catch(() => {});
  }, [showFreeAI, projectId, projectLanguage, activeScript, scenes, constants, tsContext]);

  // Fetch marker constants once from the backend — single source of truth
  useEffect(() => {
    api.getSEOConstants().then(setConstants).catch(() => {});
  }, []);

  // Don't parse until constants are loaded to avoid mismatched separators
  const parsed = constants
    ? parseDescription(seo?.description ?? null, constants)
    : { body: seo?.description ?? "", timestamps: "", disclaimer: "" };
  const { body, timestamps: extractedTs, disclaimer } = parsed;
  const timestamps = (seo?.timestamps && seo.timestamps.trim()) ? seo.timestamps : extractedTs;

  const freeAIPrompt = `SYSTEM PROMPT:\nYou are a YouTube SEO expert. Generate metadata as JSON.\n\nUSER PROMPT:\nGenerate SEO metadata for a YouTube video.\nTitle: ${activeScript?.title || "Your Video Title"}\nScript excerpt: ${(activeScript?.body || "").substring(0, 500)}\nLanguage: ${projectLanguage || "en"}${tsContext ? `\n\nTimestamps Context:\n${tsContext}` : ""}\n\nReturn JSON: {"title": "...", "description": "...", "tags": "...", "hashtags": "...", "timestamps": "..."}`;

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

  const [showExport, setShowExport] = useState(false);

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
    const newTs = buildTimestamps(scenes, constants.timestamps_marker, timeline);
    const full = combineDescription(body, newTs, disclaimer, constants);
    await onSave({ description: full });
  };

  return (
    <div className="card">
      <StepHeader title="SEO" subtitle="Optimize title, description, tags, and hashtags" onCollapse={onCollapse} />

      <div className="seo-header-actions">
        <button className="btn-primary seo-compact-btn" disabled={!!actionLoading || !activeScript} onClick={onGenerate}>
          {actionLoading === "seo" ? "Generating…" : <><Sparkles size={11} /> Generate</>}
        </button>
        <button className={`btn-secondary seo-compact-btn ${showFreeAI ? "active" : ""}`} onClick={() => setShowFreeAI(!showFreeAI)}>
          <Zap size={11} /> {showFreeAI ? "Hide Free AI" : "Free AI"}
        </button>
        <button className="btn-secondary seo-compact-btn" onClick={() => setShowImport(!showImport)} title="Import SEO">
          <Upload size={11} /> Import
        </button>
        {seo && (
          <div style={{ position: "relative" }}>
            <button className="btn-secondary seo-compact-btn" onClick={() => setShowExport(!showExport)} title="Export options">
              <Download size={11} /> Export
            </button>
            {showExport && (
              <div className="seo-export-menu">
                <button onClick={() => { handleExportJSON(); setShowExport(false); }}>
                  <Download size={11} /> Export JSON
                </button>
                <button onClick={() => { handleExportText(); setShowExport(false); }}>
                  <Download size={11} /> Export Text
                </button>
              </div>
            )}
          </div>
        )}
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

          {/* Tags + Hashtags side by side (right after Description) */}
          <div className="seo-tags-grid">
            <EditableField label="Tags" value={seo.tags ?? ""} multiline rows={2}
              onSave={(v) => onSave({ tags: v })} />
            <EditableField label="Hashtags" value={seo.hashtags ?? ""}
              onSave={(v) => onSave({ hashtags: v })} />
          </div>

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
              <EditableField
                label=""
                value={timestamps}
                multiline
                rows={4}
                onSave={(v) =>
                  constants
                    ? onSave({ description: combineDescription(body, v, disclaimer, constants), timestamps: v })
                    : Promise.resolve()
                }
              />
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

        </div>
      ) : (
        <p className="seo-empty-note">
          Generate SEO metadata for YouTube upload.
        </p>
      )}
    </div>
  );
}
