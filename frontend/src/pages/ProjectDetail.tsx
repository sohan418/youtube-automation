import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, mediaUrl } from "../api/client";
import type { ExportResult, Idea, Project, Scene, Script, SEOCategory, SEOMetadata, Thumbnail } from "../types";
import { PIPELINE_STEPS } from "../types";
import PipelineStep from "../components/PipelineStep";

type Tab = "ideas" | "script" | "scenes" | "media" | "thumbnail" | "seo" | "export";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [seo, setSeo] = useState<SEOMetadata | null>(null);
  const [categories, setCategories] = useState<SEOCategory[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("ideas");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [exportInfo, setExportInfo] = useState<ExportResult | null>(null);

  const activeScript = scripts.find((s) => s.is_active);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [proj, ideaList, scriptList, sceneList, thumbList, seoData, categoryList] = await Promise.all([
        api.getProject(projectId),
        api.listIdeas(projectId),
        api.listScripts(projectId),
        api.listScenes(projectId),
        api.listThumbnails(projectId),
        api.getSEO(projectId),
        api.listSEOCategories(),
      ]);
      setProject(proj);
      setIdeas(ideaList);
      setScripts(scriptList);
      setScenes(sceneList);
      setThumbnails(thumbList);
      setSeo(seoData);
      setCategories(categoryList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runAction = async (label: string, action: () => Promise<void>) => {
    try {
      setActionLoading(label);
      setError("");
      setSuccess("");
      await action();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading("");
    }
  };

  if (loading) return <div className="loading"><span className="spinner" /> Loading project...</div>;
  if (!project) return <div className="error">Project not found</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: "ideas", label: "1. Ideas" },
    { key: "script", label: "2. Script" },
    { key: "scenes", label: "3. Scenes" },
    { key: "media", label: "4. Media" },
    { key: "thumbnail", label: "5. Thumbnail" },
    { key: "seo", label: "6. SEO" },
    { key: "export", label: "7. Export" },
  ];

  return (
    <div>
      <Link to="/" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>← Back to Projects</Link>

      <div style={{ margin: "1rem 0 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h2 style={{ fontSize: "1.5rem" }}>{project.name}</h2>
          <span className={`badge badge-${project.status}`}>{project.status}</span>
        </div>
        {project.description && <p style={{ color: "var(--text-muted)" }}>{project.description}</p>}
      </div>

      <PipelineStep currentStatus={project.status} steps={PIPELINE_STEPS} />

      {error && <div className="error">{error}</div>}
      {success && <div className="success-msg">{success}</div>}

      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={activeTab === tab.key ? "btn-primary" : "btn-secondary"}
            onClick={() => setActiveTab(tab.key)}
            style={{ fontSize: "0.8rem" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "ideas" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>Video Ideas</h3>
            <button
              className="btn-accent"
              disabled={!!actionLoading}
              onClick={() => runAction("ideas", async () => {
                await api.generateIdeas(projectId, {
                  count: 5,
                  language: project.language,
                  category: project.category || undefined,
                });
                setSuccess(`Generated 5 video ideas${project.category ? ` in "${project.category}"` : ""}!`);
              })}
            >
              {actionLoading === "ideas" ? "Generating..." : "Generate Ideas"}
            </button>
          </div>
          {ideas.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No ideas yet. Click Generate Ideas to start.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {ideas.map((idea) => (
                <div
                  key={idea.id}
                  className="card"
                  style={{
                    borderColor: idea.is_selected ? "var(--accent)" : "var(--border)",
                    background: idea.is_selected ? "rgba(62,166,255,0.05)" : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <h4 style={{ marginBottom: "0.25rem" }}>{idea.title}</h4>
                      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{idea.description}</p>
                      <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
                        Score: {idea.trending_score} · {idea.category}
                      </span>
                    </div>
                    <button
                      className={idea.is_selected ? "btn-accent" : "btn-secondary"}
                      disabled={!!actionLoading}
                      onClick={() => runAction("select", async () => {
                        await api.selectIdea(idea.id);
                        setSuccess("Idea selected for script generation");
                      })}
                    >
                      {idea.is_selected ? "Selected" : "Select"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "script" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>Script</h3>
            <button
              className="btn-accent"
              disabled={!!actionLoading}
              onClick={() => runAction("script", async () => {
                const selectedIdea = ideas.find((i) => i.is_selected);
                await api.generateScript(projectId, {
                  idea_id: selectedIdea?.id,
                  topic: selectedIdea?.title || project.name,
                  language: project.language,
                  target_duration_minutes: 5,
                });
                setSuccess("Script generated!");
              })}
            >
              {actionLoading === "script" ? "Generating..." : "Generate Script"}
            </button>
          </div>
          {activeScript ? (
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
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No script yet. Select an idea and generate a script.</p>
          )}
        </div>
      )}

      {activeTab === "scenes" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>Scenes</h3>
            <button
              className="btn-accent"
              disabled={!!actionLoading || !activeScript}
              onClick={() => runAction("scenes", async () => {
                await api.generateScenes(projectId, activeScript!.id);
                setSuccess("Scenes generated from script!");
              })}
            >
              {actionLoading === "scenes" ? "Generating..." : "Generate Scenes"}
            </button>
          </div>
          {scenes.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Generate a script first, then break it into scenes.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {scenes.map((scene) => (
                <div key={scene.id} className="card" style={{ background: "var(--bg)" }}>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "start" }}>
                    <span style={{
                      background: "var(--primary)", color: "white", borderRadius: "50%",
                      width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem", fontWeight: 700, flexShrink: 0,
                    }}>
                      {scene.order_index}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ marginBottom: "0.5rem" }}>{scene.narration}</p>
                      {scene.image_prompt && (
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                          Image: {scene.image_prompt}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "media" && (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3>Images & Voice</h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn-secondary"
                  disabled={!!actionLoading || scenes.length === 0}
                  onClick={() => runAction("images", async () => {
                    await api.generateAllImages(projectId);
                    setSuccess("All scene images generated!");
                  })}
                >
                  {actionLoading === "images" ? "..." : "Generate All Images"}
                </button>
                <button
                  className="btn-secondary"
                  disabled={!!actionLoading || scenes.length === 0}
                  onClick={() => runAction("voice", async () => {
                    await api.generateAllVoice(projectId);
                    setSuccess("All voice audio generated!");
                  })}
                >
                  {actionLoading === "voice" ? "..." : "Generate All Voice"}
                </button>
              </div>
            </div>
            {scenes.map((scene) => (
              <div key={scene.id} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", padding: "0.75rem 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ width: 30, fontWeight: 600, flexShrink: 0, paddingTop: "0.2rem" }}>#{scene.order_index}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>{scene.narration}</p>
                  {scene.image_path && (
                    <img
                      src={mediaUrl(scene.image_path)}
                      alt={`Scene ${scene.order_index}`}
                      loading="lazy"
                      style={{ maxWidth: 220, maxHeight: 130, objectFit: "cover", borderRadius: "var(--radius)", display: "block", marginBottom: "0.35rem", border: "1px solid var(--border)" }}
                    />
                  )}
                  {scene.audio_path && (
                    <audio controls preload="none" src={mediaUrl(scene.audio_path)} style={{ width: "100%", maxWidth: 340, display: "block" }} />
                  )}
                </div>
                <span style={{ fontSize: "0.75rem", flexShrink: 0, paddingTop: "0.2rem" }}>
                  {scene.image_path ? "✅ Image" : "⬜ Image"}
                  {" · "}
                  {scene.audio_path ? "✅ Audio" : "⬜ Audio"}
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3>Video Builder</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Combines images, audio, and subtitles using FFmpeg (1080p)
                </p>
              </div>
              <button
                className="btn-primary"
                disabled={!!actionLoading || scenes.length === 0}
                onClick={() => runAction("video", async () => {
                  const result = await api.buildVideo(projectId, { resolution: "1920x1080" });
                  setSuccess(result.message + " → " + result.detail);
                })}
              >
                {actionLoading === "video" ? "Building..." : "Build Video"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "thumbnail" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>Thumbnails</h3>
            <button
              className="btn-accent"
              disabled={!!actionLoading}
              onClick={() => runAction("thumbnails", async () => {
                await api.generateThumbnails(projectId, 3);
                setSuccess("Generated 3 thumbnail options!");
              })}
            >
              {actionLoading === "thumbnails" ? "Generating..." : "Generate Thumbnails"}
            </button>
          </div>
          {thumbnails.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No thumbnails yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
              {thumbnails.map((thumb) => (
                <div
                  key={thumb.id}
                  className="card"
                  style={{
                    borderColor: thumb.is_selected ? "var(--accent)" : "var(--border)",
                    textAlign: "center",
                  }}
                >
                  {thumb.file_path && (
                    <img
                      src={mediaUrl(thumb.file_path)}
                      alt="Thumbnail"
                      loading="lazy"
                      style={{ width: "100%", borderRadius: "var(--radius)", marginBottom: "0.5rem", display: "block" }}
                    />
                  )}
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    {thumb.file_path.split(/[\\/]/).pop()}
                  </p>
                  <button
                    className={thumb.is_selected ? "btn-accent" : "btn-secondary"}
                    disabled={!!actionLoading}
                    onClick={() => runAction("select-thumb", async () => {
                      await api.selectThumbnail(thumb.id);
                      setSuccess("Thumbnail selected");
                    })}
                  >
                    {thumb.is_selected ? "Selected" : "Select"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "seo" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>SEO Metadata</h3>
            <button
              className="btn-accent"
              disabled={!!actionLoading || !activeScript}
              onClick={() => runAction("seo", async () => {
                await api.generateSEO(projectId, project.language);
                setSuccess("SEO metadata generated!");
              })}
            >
              {actionLoading === "seo" ? "Generating..." : "Generate SEO"}
            </button>
          </div>
          {seo ? (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                  YOUTUBE CATEGORY
                </label>
                <select
                  value={seo.category_id ?? ""}
                  disabled={!!actionLoading}
                  onChange={(e) => runAction("seo-category", async () => {
                    await api.updateSEOCategory(projectId, Number(e.target.value));
                    setSuccess("YouTube category saved");
                  })}
                  style={{ width: "100%", maxWidth: 360 }}
                >
                  <option value="" disabled>Select a category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>TITLE</strong>
                <p>{seo.title}</p>
              </div>
              <div>
                <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>DESCRIPTION</strong>
                <p style={{ whiteSpace: "pre-wrap" }}>{seo.description}</p>
              </div>
              <div>
                <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>TAGS</strong>
                <p>{seo.tags}</p>
              </div>
              <div>
                <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>HASHTAGS</strong>
                <p>{seo.hashtags}</p>
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Generate SEO metadata for YouTube upload.</p>
          )}
        </div>
      )}

      {activeTab === "export" && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3>Export for YouTube Upload</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Packages video, thumbnails, subtitles, and SEO metadata into the exports folder
              </p>
            </div>
            <button
              className="btn-primary"
              disabled={!!actionLoading}
              onClick={() => runAction("export", async () => {
                const result = await api.exportProject(projectId);
                setExportInfo(result);
                setSuccess(`${result.message} (${result.files.length} files)`);
              })}
            >
              {actionLoading === "export" ? "Exporting..." : "Export Project"}
            </button>
          </div>
          {exportInfo && (
            <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "var(--radius)", border: "1px solid var(--accent)", background: "var(--bg)" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Download final video:</p>
              {exportInfo.files.includes("video/final.mp4") ? (
                <a className="btn-primary" href={mediaUrl(`${exportInfo.export_path}/video/final.mp4`)} download>
                  ⬇ Download Video (.mp4)
                </a>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  No video file found. Build scenes and generate the video first, then export again.
                </p>
              )}
            </div>
          )}
          <div style={{ background: "var(--bg)", padding: "1rem", borderRadius: "var(--radius)" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Export includes: final video, thumbnails, subtitles (.srt), SEO metadata (.json), and an upload guide.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
