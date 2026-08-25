import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clapperboard, Trash2 } from "lucide-react";
import { api, mediaUrl } from "../api/client";
import type { Project, SEOCategory } from "../types";
import ToastNotification from "../components/studio/ToastNotification";
import NewProjectDialog from "../components/editors/NewProjectDialog";

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<SEOCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDialog, setShowDialog] = useState(false);
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

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleCreate = async (form: { name: string; description: string; category: string; language: string; ratio: string }) => {
    if (!form.name.trim()) return;
    try {
      setCreating(true);
      setError("");
      const created = await api.createProject({
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        language: form.language,
        ratio: form.ratio,
      });
      setShowDialog(false);
        navigate(`/projects/${created.id}`);
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
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {/* Simple Header Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.6rem 1.25rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          marginBottom: "0.25rem"
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
          <div style={{
            background: "var(--primary)",
            width: 30,
            height: 30,
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 800,
            fontSize: "1.1rem"
          }}>
            ▶
          </div>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)" }}>YouTube Content Studio</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Local MVP</span>
          <Link
            to="/admin/prompts"
            style={{
              color: "var(--text-muted)", fontSize: "0.75rem", textDecoration: "none",
              padding: "0.3rem 0.6rem", border: "1px solid var(--border)", borderRadius: "var(--radius)",
            }}
          >
            Prompt Manager
          </Link>
        </div>
      </header>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "0.15rem" }}>Projects</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
            Manage your AI-powered video production pipeline
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowDialog(true)}>
          + New Project
        </button>
      </div>

      {error && (
        <ToastNotification
          message={error}
          type="error"
          onClose={() => setError("")}
          duration={6000}
        />
      )}

      <NewProjectDialog
        isOpen={showDialog}
        categories={categories}
        creating={creating}
        onClose={() => setShowDialog(false)}
        onCreate={handleCreate}
      />

      {loading ? (
        <div className="loading"><span className="spinner" /> Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>No projects yet. Create your first one!</p>
          <button className="btn-primary" onClick={() => setShowDialog(true)}>+ New Project</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gridAutoRows: "1fr", gap: "1rem" }}>
          {projects.map((project) => (
            <div key={project.id} style={{ position: "relative", display: "flex", flexDirection: "column" }}>
              <Link to={`/projects/${project.id}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", flex: 1 }}>
                <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: 0, cursor: "pointer", flex: 1 }}>
                  <div
                    style={{
                      aspectRatio: "16 / 9",
                      background: "linear-gradient(135deg, #1a1a24, #2a2a3a)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--text-muted)", position: "relative", overflow: "hidden",
                    }}
                  >
                    {project.thumbnail ? (
                      <img src={mediaUrl(project.thumbnail)} alt={project.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <Clapperboard size={40} style={{ opacity: 0.4 }} />
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.9rem", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", lineHeight: 1.25 }}>
                        {project.name}
                      </span>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.description && (
                      <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {project.description}
                      </p>
                    )}
                    <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "auto" }}>
                      {project.category || "Uncategorized"} · {project.language.toUpperCase()} · Updated {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                title="Delete project"
                style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
