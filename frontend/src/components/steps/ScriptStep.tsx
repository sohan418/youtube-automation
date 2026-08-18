import { useState, useRef } from "react";
import { Sparkles, Download, Upload, FileText, X, Pencil, Check } from "lucide-react";
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
  const [showExportMenu, setShowExportMenu] = useState(false);
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
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3>Script</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={scriptTopic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder={ideas.find((i) => i.is_selected)?.title || projectName || "Topic..."}
            style={{ minWidth: 220, flex: "1 1 220px" }}
            title="Change the topic before regenerating"
          />
          <button className="btn-accent" disabled={!!actionLoading} onClick={onGenerate}>
            {actionLoading === "script" ? "Generating..." : <><Sparkles size={14} style={{ verticalAlign: "middle" }} /> {activeScript ? "Regenerate Script" : "Generate Script"}</>}
          </button>
          {activeScript && !editing && (
            <button className="btn-secondary" disabled={!!actionLoading} onClick={onStartEdit}>
              <Pencil size={14} style={{ verticalAlign: "-2px" }} /> Edit
            </button>
          )}
          {!activeScript && !creating && (
            <button className="btn-secondary" disabled={!!actionLoading} onClick={onStartCreate}>
              Paste Your Own Script
            </button>
          )}
          <button
            className="btn-accent"
            onClick={() => setShowFreeAI(!showFreeAI)}
            style={{ padding: "0.35rem 0.7rem", fontSize: "0.78rem", background: showFreeAI ? "var(--primary)" : undefined, color: showFreeAI ? "white" : undefined }}
          >
            {showFreeAI ? "Hide Free AI" : "Generate with Free AI"}
          </button>

          {activeScript && (
            <div style={{ position: "relative" }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowExportMenu(!showExportMenu);
                }}
                style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                <Download size={12} /> Export ▾
              </button>
              {showExportMenu && (
                <div
                  style={{
                    position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 100,
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)", width: 170, padding: "0.3rem", display: "grid", gap: "0.25rem",
                  }}
                >
                  <button
                    onClick={handleExportJson}
                    style={{ textAlign: "left", background: "transparent", padding: "0.4rem 0.6rem", fontSize: "0.75rem", color: "var(--text)" }}
                  >
                    📁 Export JSON (.json)
                  </button>
                  <button
                    onClick={handleExportTxt}
                    style={{ textAlign: "left", background: "transparent", padding: "0.4rem 0.6rem", fontSize: "0.75rem", color: "var(--text)" }}
                  >
                    <FileText size={14} style={{ verticalAlign: "-2px" }} /> Export Text (.txt)
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            className="btn-secondary"
            disabled={!!actionLoading}
            onClick={() => setShowImportModal(true)}
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
            title="Import script from JSON or Text file"
          >
            <Upload size={12} /> Import
          </button>
        </div>
      </div>

      {(creating || (editing && activeScript)) && (
        <div style={{ marginBottom: "1rem", display: "grid", gap: "0.6rem" }}>
          <label>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Title</span>
            <input
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder="Video title"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Hook (optional)</span>
            <textarea
              value={form.hook}
              onChange={(e) => onFormChange({ hook: e.target.value })}
              rows={2}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Body</span>
            <textarea
              value={form.body}
              onChange={(e) => onFormChange({ body: e.target.value })}
              rows={8}
              placeholder="Paste or write the main script here..."
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Ending (optional)</span>
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

      {activeScript && !editing && (
        <div>
          <h4 style={{ marginBottom: "0.75rem", color: "var(--accent)" }}>{activeScript.title}</h4>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
            {activeScript.word_count} words · {activeScript.language.toUpperCase()}
          </p>
          {activeScript.hook && (
            <div style={{ marginBottom: "1rem" }}>
              <strong style={{ fontSize: "0.8rem", color: "var(--primary)" }}>HOOK</strong>
              <p style={{ marginTop: "0.25rem" }}>{activeScript.hook}</p>
            </div>
          )}
          <div style={{ marginBottom: "1rem" }}>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>BODY</strong>
            <p style={{ marginTop: "0.25rem", whiteSpace: "pre-wrap" }}>{activeScript.body}</p>
          </div>
          {activeScript.ending && (
            <div>
              <strong style={{ fontSize: "0.8rem", color: "var(--success)" }}>ENDING</strong>
              <p style={{ marginTop: "0.25rem" }}>{activeScript.ending}</p>
            </div>
          )}
        </div>
      )}

      {!activeScript && !creating && (
        <div>
          <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>No script yet. Select an idea and generate a script, or paste your own.</p>
        </div>
      )}

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
              <div style={{ fontSize: "0.8rem", color: "var(--accent)", marginBottom: "0.75rem", fontWeight: 600 }}>
                <Check size={13} style={{ verticalAlign: "-2px" }} /> Detected{parsedImport?.body ? ` "${(parsedImport.title || "Untitled").slice(0, 40)}"` : " nothing"} ready to import
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
