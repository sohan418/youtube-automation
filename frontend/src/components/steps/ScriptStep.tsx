import { useState, useRef } from "react";
import { Sparkles, Download, Upload, FileText, X, Pencil } from "lucide-react";
import type { Idea, Script } from "../../types";
import FreeAIGuide from "../editors/FreeAIGuide";

interface Props {
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
  prompts?: { system: string; user: string };
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

  const hookMatch = text.match(/^#+\s*Hook\s*[-–—:]?\s*\n(.*?)(?=\n\s*#+\s*Body|\n\s*##+\s*Body|\nBody:|\nBODY:)/is);
  const bodyMatch = text.match(/^#+\s*Body\s*[-–—:]?\s*\n(.*?)(?=\n\s*#+\s*Ending|\n\s*##+\s*Ending|\nEnding:|\nENDING:|$)/is);
  const endingMatch = text.match(/^#+\s*Ending\s*[-–—:]?\s*\n(.*)$/is);
  const titleMatch = text.match(/^#+\s*(.+?)\s*\n/is);

  const body = bodyMatch ? bodyMatch[1].trim() : text;
  if (!body) return null;
  return {
    title: titleMatch ? titleMatch[1].trim() : undefined,
    hook: hookMatch ? hookMatch[1].trim() : undefined,
    body,
    ending: endingMatch ? endingMatch[1].trim() : undefined,
  };
}

export default function ScriptStep({
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
  prompts,
}: Props) {
  const activeScript = scripts.find((s) => s.is_active) || null;
  const [showFreeAI, setShowFreeAI] = useState(false);
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

  const handleExportJson = () => {
    if (!activeScript) return;
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
    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(json, `script-${cleanName}.json`, "application/json");
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Script</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>Write or generate your script</p>
      </div>

      {/* Topic + Action buttons */}
      <div className="card" style={{ padding: "1rem" }}>
        <input
          value={scriptTopic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder={ideas.find((i) => i.is_selected)?.title || projectName || "Topic..."}
          style={{ width: "100%", marginBottom: "0.6rem" }}
          title="Change the topic before regenerating"
        />
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn-primary" disabled={!!actionLoading} onClick={onGenerate} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {actionLoading === "script" ? (
              "Generating..."
            ) : (
              <>
                <Sparkles size={14} /> {activeScript ? "Regenerate" : "Generate"}
              </>
            )}
          </button>
          {activeScript && !editing && (
            <button className="btn-secondary" disabled={!!actionLoading} onClick={onStartEdit} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Pencil size={13} /> Edit
            </button>
          )}
          {!activeScript && !creating && (
            <button className="btn-secondary" disabled={!!actionLoading} onClick={onStartCreate}>
              Paste Your Own
            </button>
          )}
          <button
            className="btn-secondary"
            onClick={() => setShowFreeAI(!showFreeAI)}
            style={showFreeAI ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" } : undefined}
          >
            Free AI
          </button>
          <button
            className="btn-secondary"
            disabled={!!actionLoading}
            onClick={() => setShowImportModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
            title="Import script from JSON or Text file"
          >
            <Upload size={13} /> Import
          </button>
        </div>
      </div>

      {/* Free AI panel */}
      {showFreeAI && (
        <FreeAIGuide
          title="Generate Script with Free AI"
          prompt={prompts ? undefined : `SYSTEM PROMPT:\nYou are an expert YouTube scriptwriter. Write engaging scripts as JSON.\n\nUSER PROMPT:\nWrite a 5-minute YouTube script about: ${scriptTopic || ideas.find((i) => i.is_selected)?.title || projectName || "General topic"}. Language: en. Include hook, body, and ending. Return JSON: {"title": "...", "hook": "...", "body": "...", "ending": "..."}`}
          promptPair={prompts}
          responsePlaceholder='Paste AI response here...\n\nAccepts JSON or plain text script.'
          onParseResponse={(text) => {
            if (!onImportScript) return;
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.body) {
                  onImportScript({
                    title: parsed.title,
                    hook: parsed.hook,
                    body: parsed.body,
                    ending: parsed.ending,
                  }, false);
                }
              }
            } catch {
              // Fallback: treat entire text as body
              if (text.trim().length > 50) {
                onImportScript({ body: text.trim() }, false);
              }
            }
          }}
        />
      )}

      {/* Editor form */}
      {(creating || (editing && activeScript)) && (
        <div className="card" style={{ padding: "1rem", display: "grid", gap: "0.75rem" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Title</span>
            <input
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder="Video title"
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Hook (optional)</span>
            <textarea
              value={form.hook}
              onChange={(e) => onFormChange({ hook: e.target.value })}
              rows={2}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Body</span>
            <textarea
              value={form.body}
              onChange={(e) => onFormChange({ body: e.target.value })}
              rows={8}
              placeholder="Paste or write the main script here..."
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Ending (optional)</span>
            <textarea
              value={form.ending}
              onChange={(e) => onFormChange({ ending: e.target.value })}
              rows={2}
              style={{ width: "100%" }}
            />
          </label>
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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

      {/* Script view: two-column */}
      {activeScript && !editing && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: "1rem", alignItems: "start" }}>
          {/* Left: script sections */}
          <div className="card" style={{ padding: "1rem" }}>
            <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem" }}>{activeScript.title}</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "0 0 1rem" }}>
              {activeScript.word_count} words · {activeScript.language.toUpperCase()}
            </p>
            {activeScript.hook && (
              <div style={{ marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--primary)" }}>HOOK</span>
                <p style={{ marginTop: "0.35rem", fontSize: "0.88rem" }}>{activeScript.hook}</p>
              </div>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)" }}>BODY</span>
              <p style={{ marginTop: "0.35rem", whiteSpace: "pre-wrap", fontSize: "0.88rem" }}>{activeScript.body}</p>
            </div>
            {activeScript.ending && (
              <div>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--success)" }}>ENDING</span>
                <p style={{ marginTop: "0.35rem", fontSize: "0.88rem" }}>{activeScript.ending}</p>
              </div>
            )}
          </div>

          {/* Right: sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="card" style={{ padding: "1rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)" }}>AI ACTIONS</span>
              <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.6rem" }}>
                <button className="btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                  Improve
                </button>
                <button className="btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                  Shorten
                </button>
                <button className="btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                  Expand
                </button>
              </div>
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", margin: "0.6rem 0 0" }}>Quick AI refinements coming soon</p>
            </div>

            <div className="card" style={{ padding: "1rem" }}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem", width: "100%" }}
              >
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)" }}>EXPORT</span>
                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{showExportMenu ? "▾" : "▸"}</span>
              </button>
              {showExportMenu && (
                <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.6rem" }}>
                  <button className="btn-secondary" onClick={handleExportJson} style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Download size={13} /> JSON (.json)
                  </button>
                  <button className="btn-secondary" onClick={handleExportTxt} style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <FileText size={13} /> Text (.txt)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!activeScript && !creating && (
        <div className="card" style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
          <FileText size={36} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
          <p style={{ color: "var(--text-muted)", marginTop: "0.75rem", marginBottom: 0, fontSize: "0.9rem" }}>
            No script yet. Select an idea and generate a script, or paste your own.
          </p>
        </div>
      )}

      {/* Import modal */}
      {showImportModal && (
        <div
          onClick={() => setShowImportModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 560, background: "var(--surface)", boxShadow: "var(--shadow)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "1.1rem" }}>Import Script</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: "transparent", color: "var(--text-muted)", fontSize: "1.1rem" }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Upload a <strong>JSON</strong> or <strong>Text</strong> file, or paste your script directly into the box below.
              Accepts JSON like <code>{"{\"title\": ..., \"hook\": ..., \"body\": ..., \"ending\": ...}"}</code> or a
              plain text script (it will be imported as the body).
            </p>

            <div style={{ marginBottom: "0.75rem" }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,.txt"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <button
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem", width: "100%", justifyContent: "center" }}
              >
                <FileText size={14} /> Upload Script File (.json / .txt)
              </button>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Paste script JSON or plain text here:\n\n{\n  "title": "My Video Title",\n  "hook": "Opening hook...",\n  "body": "Main script body...",\n  "ending": "Closing..."\n}`}
              rows={8}
              style={{ width: "100%", fontSize: "0.8rem", marginBottom: "0.75rem" }}
            />

            {importText.trim() && (
              <div style={{ fontSize: "0.8rem", color: "var(--success)", marginBottom: "0.75rem", fontWeight: 600 }}>
                ✓ Detected{parsedImport?.body ? ` "${(parsedImport.title || "Untitled").slice(0, 40)}"` : " nothing"} ready to import
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", fontSize: "0.8rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="scriptImportOption"
                  checked={importReplace}
                  onChange={() => setImportReplace(true)}
                />
                Replace current script
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="scriptImportOption"
                  checked={!importReplace}
                  onChange={() => setImportReplace(false)}
                />
                Keep as separate version
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
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
