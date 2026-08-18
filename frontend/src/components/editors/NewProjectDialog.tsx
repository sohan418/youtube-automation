import { useState } from "react";
import { X } from "lucide-react";
import type { SEOCategory } from "../../types";

interface Props {
  isOpen: boolean;
  categories: SEOCategory[];
  creating: boolean;
  onClose: () => void;
  onCreate: (form: { name: string; description: string; category: string; language: string; ratio: string }) => Promise<void>;
}

export default function NewProjectDialog({ isOpen, categories, creating, onClose, onCreate }: Props) {
  const [form, setForm] = useState({ name: "", description: "", category: "", language: "en", ratio: "16:9" });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onCreate(form);
    setForm({ name: "", description: "", category: "", language: "en", ratio: "16:9" });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          position: "relative",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.4)",
          border: "1px solid var(--border)",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>New Project</h3>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "0.2rem" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <label>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Project Name *</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My Awesome Video"
              required
              autoFocus
              style={{ width: "100%", padding: "0.45rem 0.65rem", marginTop: "2px" }}
            />
          </label>

          <label>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief project description"
              style={{ width: "100%", padding: "0.45rem 0.65rem", marginTop: "2px" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <label>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ width: "100%", padding: "0.45rem 0.65rem", marginTop: "2px" }}
              >
                <option value="">Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Language</span>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                style={{ width: "100%", padding: "0.45rem 0.65rem", marginTop: "2px" }}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </label>
          </div>

          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Aspect Ratio</span>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "6px" }}>
              {[
                { value: "16:9", label: "16:9", sub: "1920×1080", w: 56, h: 32 },
                { value: "9:16", label: "9:16", sub: "1080×1920", w: 32, h: 56 },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 8px",
                    borderRadius: "8px",
                    border: form.ratio === opt.value ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                    background: form.ratio === opt.value ? "rgba(var(--primary-rgb, 99,102,241), 0.08)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: opt.w,
                      height: opt.h,
                      border: `2px solid ${form.ratio === opt.value ? "var(--primary)" : "var(--text-muted)"}`,
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.55rem",
                      fontWeight: 700,
                      color: form.ratio === opt.value ? "var(--primary)" : "var(--text-muted)",
                    }}
                  >
                    {opt.label}
                  </div>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{opt.sub}</span>
                  <input type="radio" name="ratio" value={opt.value} checked={form.ratio === opt.value} onChange={() => setForm({ ...form, ratio: opt.value })} style={{ display: "none" }} />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={creating}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={creating || !form.name.trim()}>
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
