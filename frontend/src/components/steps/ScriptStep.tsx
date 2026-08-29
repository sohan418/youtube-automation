import { useEffect, useState, useRef } from "react";
import { Sparkles, Download, Upload, FileText, X, Pencil } from "lucide-react";
import type { Idea, Script } from "../../types";
import { api } from "../../api/client";
import FreeAIGuide from "../editors/FreeAIGuide";
import "./ScriptStep.css";

interface Props {
  projectId: number;
  projectLanguage?: string;
  ideas: Idea[];
  projectName: string;
  scripts: Script[];
  actionLoading: string;
  scriptTopic: string;
  onTopicChange: (v: string) => void;
  onGenerate: () => void;
  editing: boolean;
  creating: boolean;
  onStartEdit: () => void;
  onStartCreate: () => void;
  onCancelEditor: () => void;
  onSave: () => void;
  form: { title: string; hook: string; body: string; ending: string };
  onFormChange: (patch: Partial<{ title: string; hook: string; body: string; ending: string }>) => void;
  onImportScript?: (imported: { title?: string; hook?: string; body: string; ending?: string; language?: string }, replace: boolean) => Promise<void>;
}

interface ImportedScript {
  title?: string;
  hook?: string;
  body: string;
  ending?: string;
}

function parseImportedScript(text: string): ImportedScript | null {
  text = text.trim();
  if (!text) return null;

  try {
    const data = JSON.parse(text);
    if (data && typeof data === "object") {
      const body = String(data.body || data.script || data.content || data.text || "").trim();
      if (body) {
        return {
          title: data.title ? String(data.title).trim() : undefined,
          hook: data.hook ? String(data.hook).trim() : undefined,
          body,
          ending: data.ending ? String(data.ending).trim() : undefined,
        };
      }
    }
  } catch (e) {
    // Not valid JSON, fallback to text parsing
  }

  const sectionRe = /^#+\s*(Hook|Body|Ending)\b/i;
  const labelRe = /^(Hook|Body|Ending)\s*:\s*$/i;

  let title: string | undefined;
  const parts: { hook?: string[]; body?: string[]; ending?: string[] } = {};
  let current: "hook" | "body" | "ending" | null = null;

  for (let raw of text.split(/\r?\n/)) {
    if (title === undefined && current === null && /^\s*#/.test(raw) && !sectionRe.test(raw)) {
      const t = raw.replace(/^\s*#+\s*/, "").trim();
      if (t) {
        title = t;
        continue;
      }
    }
    const header = raw.match(sectionRe)?.[1].toLowerCase()
      ?? (labelRe.test(raw.trim()) ? raw.trim().replace(/[:\s]/g, "").toLowerCase() : null);
    if (header === "hook" || header === "body" || header === "ending") {
      current = header;
      parts[current] = [];
      continue;
    }
    if (current) parts[current]!.push(raw);
  }

  const body = (parts.body?.join("\n") ?? "").trim();
  if (!body) return null;
  return {
    title,
    hook: (parts.hook?.join("\n") ?? "").trim() || undefined,
    body,
    ending: (parts.ending?.join("\n") ?? "").trim() || undefined,
  };
}

export default function ScriptStep({
  projectId,
  projectLanguage,
  ideas,
  projectName,
  scripts,
  actionLoading,
  scriptTopic,
  onTopicChange,
  onGenerate,
  editing,
  creating,
  onStartEdit,
  onStartCreate,
  onCancelEditor,
  onSave,
  form,
  onFormChange,
  onImportScript,
}: Props) {
  const activeScript = scripts.find((s) => s.is_active) || null;
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [dynamicPrompt, setDynamicPrompt] = useState<{ system: string; user: string } | null>(null);

  useEffect(() => {
    if (!showFreeAI) return;
    api.buildScriptPrompt(projectId, {
      topic: scriptTopic || ideas.find((i) => i.is_selected)?.title || projectName || undefined,
      language: projectLanguage || "en",
      target_duration_minutes: 5,
    }).then(setDynamicPrompt).catch(() => {});
  }, [showFreeAI, projectId, projectLanguage, scriptTopic, ideas, projectName]);
  const [showExportMenu, setShowExportMenu] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importReplace, setImportReplace] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = async () => {
    if (!activeScript) return;
    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filename = `script-${cleanName}.json`;
    try {
      await api.exportScriptJson(activeScript.id, filename);
    } catch {
      const json = JSON.stringify(
        {
          title: activeScript.title,
          hook: activeScript.hook,
          body: activeScript.body,
          ending: activeScript.ending,
        },
        null,
        2
      );
      downloadFile(json, filename, "application/json");
    }
    setShowExportMenu(false);
  };

  const handleExportTxt = () => {
    if (!activeScript) return;
    const text = `# ${activeScript.title}\n\n## Hook\n${activeScript.hook ?? ""}\n\n## Body\n${activeScript.body}\n\n## Ending\n${activeScript.ending ?? ""}`;
    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(text, `script-${cleanName}.txt`, "text/plain");
    setShowExportMenu(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) setImportText(content);
    };
    reader.readAsText(file);
  };

  const parsedImport = parseImportedScript(importText);

  return (
    <div className="script-step">
      {/* Header */}
      <div>
        <h2 className="script-header-title">Script</h2>
        <p className="script-subtitle">Write or generate your script</p>
      </div>

      {/* Topic + Action buttons */}
      <div className="card script-topic-card">
        <input
          value={scriptTopic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder={ideas.find((i) => i.is_selected)?.title || projectName || "Topic..."}
          className="script-topic-input"
          title="Change the topic before regenerating"
        />
        <div className="script-action-row">
          <button className="btn-primary script-btn-generate" disabled={!!actionLoading} onClick={onGenerate}>
            {actionLoading === "script" ? (
              "Generating..."
            ) : (
              <>
                <Sparkles size={12} /> {activeScript ? "Regenerate" : "Generate"}
              </>
            )}
          </button>
          {activeScript && !editing && (
            <button className="btn-secondary script-btn-edit" disabled={!!actionLoading} onClick={onStartEdit}>
              <Pencil size={11} /> Edit
            </button>
          )}
          {!activeScript && !creating && (
            <button className="btn-secondary script-btn-md" disabled={!!actionLoading} onClick={onStartCreate}>
              Paste Your Own
            </button>
          )}
          <button
            className="btn-secondary script-btn-md"
            onClick={() => setShowFreeAI(!showFreeAI)}
            style={
              showFreeAI ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : {}
            }
          >
            Free AI
          </button>
          <button
            className="btn-secondary script-btn-import"
            disabled={!!actionLoading}
            onClick={() => setShowImportModal(true)}
            title="Import script from JSON or Text file"
          >
            <Upload size={12} /> Import
          </button>
        </div>
      </div>

      {/* Free AI panel */}
      {showFreeAI && (
        <FreeAIGuide
          title="Generate Script with Free AI"
          prompt={dynamicPrompt ? undefined : `SYSTEM PROMPT:\nYou are an expert YouTube scriptwriter. Write engaging scripts as JSON.\n\nUSER PROMPT:\nWrite a 5-minute YouTube script about: ${scriptTopic || ideas.find((i) => i.is_selected)?.title || projectName || "General topic"}. Language: ${projectLanguage || "en"}. Include hook, body, and ending. Return JSON: {"title": "...", "hook": "...", "body": "...", "ending": "..."}`}
          promptPair={dynamicPrompt || undefined}
          responsePlaceholder='Paste AI response here...\n\nAccepts JSON or plain text script.'
          onParseResponse={(text) => {
            if (!onImportScript) return;
            try {
              const objMatch = text.match(/\{/);
              if (objMatch) {
                const start = objMatch.index!;
                for (let i = text.length - 1; i > start; i--) {
                  if (text[i] !== "}") continue;
                  try {
                    const parsed = JSON.parse(text.slice(start, i + 1));
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.body) {
                      onImportScript({
                        title: parsed.title,
                        hook: parsed.hook,
                        body: parsed.body,
                        ending: parsed.ending,
                      }, false);
                      return;
                    }
                  } catch { /* keep scanning */ }
                }
              }
            } catch {
              // ignore, fall through to text fallback
            }
            // Fallback: treat entire text as body
            if (text.trim().length > 50) {
              onImportScript({ body: text.trim() }, false);
            }
          }}
        />
      )}

      {/* Editor form */}
      {(creating || (editing && activeScript)) && (
        <div className="card script-editor-card">
          <label className="script-field-label">
            <span className="script-field-text">Title</span>
            <input
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder="Video title"
              className="script-editor-input"
            />
          </label>
          <label className="script-field-label">
            <span className="script-field-text">Hook (optional)</span>
            <textarea
              value={form.hook}
              onChange={(e) => onFormChange({ hook: e.target.value })}
              rows={2}
              className="script-editor-input"
            />
          </label>
          <label className="script-field-label">
            <span className="script-field-text">Body</span>
            <textarea
              value={form.body}
              onChange={(e) => onFormChange({ body: e.target.value })}
              rows={8}
              placeholder="Paste or write the main script here..."
              className="script-editor-input"
            />
          </label>
          <label className="script-field-label">
            <span className="script-field-text">Ending (optional)</span>
            <textarea
              value={form.ending}
              onChange={(e) => onFormChange({ ending: e.target.value })}
              rows={2}
              className="script-editor-input"
            />
          </label>
          <div className="script-form-actions">
            <button className="btn-secondary" disabled={!!actionLoading} onClick={onCancelEditor}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!!actionLoading || !form.title.trim() || !form.body.trim()}
              onClick={onSave}
            >
              {actionLoading === (creating ? "script-create" : "script-save") ? "Saving..." : "Save Script"}
            </button>
          </div>
        </div>
      )}

      {/* Script view: single column stacked, secondary actions side-by-side */}
      {activeScript && !editing && (
        <div className="script-view">
          {/* Top: script sections (full-width) */}
          <div className="card script-main-card">
            <h3 className="script-preview-title">{activeScript.title}</h3>
            <p className="script-preview-meta">
              {activeScript.word_count} words · {activeScript.language.toUpperCase()}
            </p>
            {activeScript.hook && (
              <div className="script-section">
                <span className="script-section-label hook">HOOK</span>
                <p className="script-section-text">{activeScript.hook}</p>
              </div>
            )}
            <div className="script-section">
              <span className="script-section-label body">BODY</span>
              <p className="script-section-text body">{activeScript.body}</p>
            </div>
            {activeScript.ending && (
              <div>
                <span className="script-section-label ending">ENDING</span>
                <p className="script-section-text">{activeScript.ending}</p>
              </div>
            )}
          </div>

          {/* Bottom: AI Actions & Export Cards Side-by-Side */}
          <div className="script-actions-grid">
            <div className="card script-action-card">
              <span className="script-action-card-label">AI ACTIONS</span>
              <div className="script-buttons-col">
                <button className="btn-secondary script-ai-btn">
                  Improve
                </button>
                <button className="btn-secondary script-ai-btn">
                  Shorten
                </button>
                <button className="btn-secondary script-ai-btn">
                  Expand
                </button>
              </div>
            </div>

            <div className="card script-action-card">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="script-export-toggle"
              >
                <span className="script-action-card-label">EXPORT</span>
                <span className="script-export-chevron">{showExportMenu ? "▾" : "▸"}</span>
              </button>
              {showExportMenu && (
                <div className="script-buttons-col">
                  <button className="btn-secondary script-export-btn" onClick={handleExportJson}>
                    <Download size={11} /> JSON
                  </button>
                  <button className="btn-secondary script-export-btn" onClick={handleExportTxt}>
                    <FileText size={11} /> Text
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!activeScript && !creating && (
        <div className="card script-empty-card">
          <FileText size={36} className="script-empty-icon" />
          <p className="script-empty-text">
            No script yet. Select an idea and generate a script, or paste your own.
          </p>
        </div>
      )}

      {/* Import modal */}
      {showImportModal && (
        <div
          onClick={() => setShowImportModal(false)}
          className="script-modal-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card script-modal-card"
          >
            <div className="script-modal-header">
              <h3 className="script-modal-title">Import Script</h3>
              <button onClick={() => setShowImportModal(false)} className="script-modal-close">
                <X size={18} />
              </button>
            </div>

            <p className="script-modal-note">
              Upload a <strong>JSON</strong> or <strong>Text</strong> file, or paste your script directly into the box below.
              Accepts JSON like <code>{"{\"title\": ..., \"hook\": ..., \"body\": ..., \"ending\": ...}"}</code> or a
              plain text script (it will be imported as the body).
            </p>

            <div className="script-upload-row">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,.txt"
                onChange={handleFileUpload}
                hidden
              />
              <button
                className="btn-secondary script-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText size={14} /> Upload Script File (.json / .txt)
              </button>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Paste script JSON or plain text here:\n\n{\n  "title": "My Video Title",\n  "hook": "Opening hook...",\n  "body": "Main script body...",\n  "ending": "Closing..."\n}`}
              rows={8}
              className="script-import-textarea"
            />

            {importText.trim() && (
              <div className="script-import-status">
                ✓ Detected{parsedImport?.body ? ` "${(parsedImport.title || "Untitled").slice(0, 40)}"` : " nothing"} ready to import
              </div>
            )}

            <div className="script-import-options">
              <label className="script-import-option-label">
                <input
                  type="radio"
                  name="scriptImportOption"
                  checked={importReplace}
                  onChange={() => setImportReplace(true)}
                />
                Replace current script
              </label>
              <label className="script-import-option-label">
                <input
                  type="radio"
                  name="scriptImportOption"
                  checked={!importReplace}
                  onChange={() => setImportReplace(false)}
                />
                Keep as separate version
              </label>
            </div>

            <div className="script-import-actions">
              <button className="btn-secondary" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={!parsedImport?.body || !!actionLoading}
                onClick={async () => {
                  if (onImportScript && parsedImport) {
                    await onImportScript(parsedImport, importReplace);
                    setShowImportModal(false);
                    setImportText("");
                  }
                }}
              >
                {actionLoading === "import-script" ? "Importing..." : "Import Script"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
