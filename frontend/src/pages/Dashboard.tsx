import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Project, SEOCategory } from "../types";

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<SEOCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "", language: "en" });
  const [creating, setCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.listProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    api.listSEOCategories()
      .then(setCategories)
      .catch(() => {});
  }, [loadProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setCreating(true);
      setError("");
      await api.createProject({
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        language: form.language,
      });
      setForm({ name: "", description: "", category: "", language: "en" });
      setShowForm(false);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this project?")) return;
    try {
      await api.deleteProject(id);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Projects</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Manage your AI-powered video production pipeline
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Create New Project</h3>
          <div className="grid-2" style={{ marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Project Name *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Awesome Video"
                required
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Uncategorized</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2" style={{ marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Language
              </label>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Description
              </label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief project description"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? "Creating..." : "Create Project"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="loading"><span className="spinner" /> Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>No projects yet. Create your first one!</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Project</button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {projects.map((project) => (
            <div key={project.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
                  <Link to={`/projects/${project.id}`} style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)", textDecoration: "none" }}>
                    {project.name}
                  </Link>
                  <StatusBadge status={project.status} />
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  {project.category || "Uncategorized"} · {project.language.toUpperCase()} · Updated {new Date(project.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link to={`/projects/${project.id}`}>
                  <button className="btn-accent">Open</button>
                </Link>
                <button className="btn-secondary" onClick={() => handleDelete(project.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
