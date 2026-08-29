import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

const SECTIONS = [
  { key: "ideas", title: "Ideas", shorts: "ideas_shorts" },
  { key: "script", title: "Script", shorts: "script_shorts" },
  { key: "scenes", title: "Scenes", shorts: "scenes_shorts" },
  { key: "seo", title: "SEO", shorts: "seo_shorts" },
  { key: "thumbnail", title: "Thumbnail", shorts: "thumbnail_shorts" },
  { key: "image", title: "Image Generation", shorts: "image_shorts" },
];

export default function AdminPrompts() {
  const [drafts, setDrafts] = useState<Record<string, { system: string; user: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(SECTIONS[0]?.key ?? null);
  const [showShorts, setShowShorts] = useState(false);

  useEffect(() => {
    api.listAdminPrompts().then((data) => {
      const d: Record<string, { system: string; user: string }> = {};
      data.forEach((p) => { d[p.key] = { system: p.system, user: p.user }; });
      setDrafts(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateDraft = (key: string, field: "system" | "user", value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setSaved(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await api.bulkUpdateAdminPrompts(drafts);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm("Reset all prompts to defaults? This cannot be undone.")) return;
    await api.resetAdminPrompts();
    const data = await api.listAdminPrompts();
    const d: Record<string, { system: string; user: string }> = {};
    data.forEach((p) => { d[p.key] = { system: p.system, user: p.user }; });
    setDrafts(d);
    setSaved(false);
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        Loading prompts...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link to="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            <ArrowLeft size={18} />
          </Link>
          <h1 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Prompt Manager</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-secondary" onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <button
            className="btn-primary"
            onClick={handleSaveAll}
            disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            {saved ? <><Check size={14} /> Saved!</> : saving ? "Saving..." : <><Save size={14} /> Save All</>}
          </button>
        </div>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginBottom: "1.25rem" }}>
        Edit prompts used by the "Generate with Free AI" feature. {" "}
        <strong>{"{language}"}</strong>, <strong>{"{topic}"}</strong>, <strong>{"{ratio}"}</strong>, <strong>{"{hook}"}</strong>, <strong>{"{body}"}</strong>, <strong>{"{ending}"}</strong>, <strong>{"{title}"}</strong>, <strong>{"{script_excerpt}"}</strong> are replaced at runtime.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          className={!showShorts ? "btn-primary" : "btn-secondary"}
          onClick={() => setShowShorts(false)}
          style={{ fontSize: "0.82rem" }}
        >
          Long-form (16:9)
        </button>
        <button
          className={showShorts ? "btn-primary" : "btn-secondary"}
          onClick={() => setShowShorts(true)}
          style={{ fontSize: "0.82rem" }}
        >
          Shorts (9:16)
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {SECTIONS.map((section) => {
          const key = showShorts ? section.shorts : section.key;
          const draft = drafts[key];
          if (!draft) return null;
          const isExpanded = expandedSection === section.key;

          return (
            <div key={section.key} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.key)}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.75rem 1rem", background: "var(--surface)", border: "none", cursor: "pointer",
                  color: "var(--text)", fontWeight: 600, fontSize: "0.9rem", textAlign: "left",
                }}
              >
                <span>{section.title} {showShorts ? "(Shorts)" : ""}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && (
                <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-muted)" }}>
                      System Prompt
                    </label>
                    <textarea
                      value={draft.system}
                      onChange={(e) => updateDraft(key, "system", e.target.value)}
                      rows={4}
                      style={{
                        width: "100%", padding: "0.6rem", borderRadius: "6px",
                        border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)",
                        fontSize: "0.78rem", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-muted)" }}>
                      User Prompt
                    </label>
                    <textarea
                      value={draft.user}
                      onChange={(e) => updateDraft(key, "user", e.target.value)}
                      rows={6}
                      style={{
                        width: "100%", padding: "0.6rem", borderRadius: "6px",
                        border: "1px solid var(--border)", background: "var(--background)", color: "var(--text)",
                        fontSize: "0.78rem", fontFamily: "monospace", resize: "vertical", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
