import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clapperboard, Trash2 } from "lucide-react";
import { api, mediaUrl } from "../api/client";
import type { Project, SEOCategory } from "../types";
import ToastNotification from "../components/studio/ToastNotification";
import NewProjectDialog from "../components/editors/NewProjectDialog";
import "./Dashboard.css";

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
    <div className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="dashboard-brand">
          <div className="dashboard-logo">▶</div>
          <span className="dashboard-brand-name">YouTube Content Studio</span>
        </Link>
        <div className="dashboard-header-right">
          <span className="dashboard-muted-sm">Local MVP</span>
          <Link to="/admin/prompts" className="dashboard-prompt-link">
            Prompt Manager
          </Link>
        </div>
      </header>

      <div className="dashboard-title-row">
        <div>
          <h2 className="dashboard-title">Projects</h2>
          <p className="dashboard-subtitle">
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
          <p className="dashboard-empty">No projects yet. Create your first one!</p>
          <button className="btn-primary" onClick={() => setShowDialog(true)}>+ New Project</button>
        </div>
      ) : (
        <div className="dashboard-grid">
          {projects.map((project) => (
            <div key={project.id} className="dashboard-card-wrap">
              <Link to={`/projects/${project.id}`} className="dashboard-card-link">
                <div className="card dashboard-card">
                  <div className="dashboard-thumb">
                    {project.thumbnail ? (
                      <img src={mediaUrl(project.thumbnail)} alt={project.name} className="dashboard-thumb-img" />
                    ) : (
                      <Clapperboard size={40} className="dashboard-thumb-icon" />
                    )}
                  </div>
                  <div className="dashboard-card-body">
                    <div className="dashboard-card-top">
                      <span className="dashboard-card-name">
                        {project.name}
                      </span>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.description && (
                      <p className="dashboard-card-desc">
                        {project.description}
                      </p>
                    )}
                    <p className="dashboard-card-meta">
                      {project.category || "Uncategorized"} · {project.language.toUpperCase()} · Updated {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                title="Delete project"
                className="dashboard-delete-btn"
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
