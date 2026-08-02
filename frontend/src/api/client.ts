const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  return `${API_BASE}/media/${path.replace(/\\/g, "/")}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  listProjects: () => request<import("../types").Project[]>("/projects"),
  createProject: (data: { name: string; description?: string; category?: string; language?: string }) =>
    request<import("../types").Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  getProject: (id: number) => request<import("../types").Project>(`/projects/${id}`),
  updateProject: (id: number, data: Partial<import("../types").Project>) =>
    request<import("../types").Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProject: (id: number) => request<void>(`/projects/${id}`, { method: "DELETE" }),

  listIdeas: (projectId: number) => request<import("../types").Idea[]>(`/ideas/project/${projectId}`),
  generateIdeas: (projectId: number, data: { category?: string; count?: number; language?: string }) =>
    request<import("../types").Idea[]>(`/ideas/project/${projectId}/generate`, { method: "POST", body: JSON.stringify(data) }),
  selectIdea: (ideaId: number) => request<import("../types").Idea>(`/ideas/${ideaId}/select`, { method: "POST" }),

  listScripts: (projectId: number) => request<import("../types").Script[]>(`/scripts/project/${projectId}`),
  generateScript: (projectId: number, data: { idea_id?: number; topic?: string; language?: string; target_duration_minutes?: number }) =>
    request<import("../types").Script>(`/scripts/project/${projectId}/generate`, { method: "POST", body: JSON.stringify(data) }),
  updateScript: (scriptId: number, data: Partial<import("../types").Script>) =>
    request<import("../types").Script>(`/scripts/${scriptId}`, { method: "PATCH", body: JSON.stringify(data) }),

  listScenes: (projectId: number) => request<import("../types").Scene[]>(`/scenes/project/${projectId}`),
  generateScenes: (projectId: number, scriptId: number) =>
    request<import("../types").Scene[]>(`/scenes/project/${projectId}/generate`, { method: "POST", body: JSON.stringify({ script_id: scriptId }) }),
  updateScene: (sceneId: number, data: Partial<import("../types").Scene>) =>
    request<import("../types").Scene>(`/scenes/${sceneId}`, { method: "PATCH", body: JSON.stringify(data) }),

  generateImage: (sceneId: number, style?: string) =>
    request<import("../types").Scene>("/images/generate", { method: "POST", body: JSON.stringify({ scene_id: sceneId, style }) }),
  generateAllImages: (projectId: number, style?: string) =>
    request<import("../types").Scene[]>(`/images/project/${projectId}/generate-all?style=${style || ""}`, { method: "POST" }),

  generateVoice: (sceneId: number, voice?: string) =>
    request<import("../types").Scene>("/voice/generate", { method: "POST", body: JSON.stringify({ scene_id: sceneId, voice: voice || "alloy" }) }),
  generateAllVoice: (projectId: number, voice?: string) =>
    request<import("../types").Scene[]>(`/voice/project/${projectId}/generate-all?voice=${voice || "alloy"}`, { method: "POST" }),

  buildVideo: (projectId: number, data?: { background_music?: string; resolution?: string }) =>
    request<{ message: string; detail: string }>(`/video/project/${projectId}/build`, { method: "POST", body: JSON.stringify(data || {}) }),

  listThumbnails: (projectId: number) => request<import("../types").Thumbnail[]>(`/thumbnails/project/${projectId}`),
  generateThumbnails: (projectId: number, count?: number) =>
    request<import("../types").Thumbnail[]>(`/thumbnails/project/${projectId}/generate`, { method: "POST", body: JSON.stringify({ count: count || 3 }) }),
  selectThumbnail: (thumbnailId: number) =>
    request<import("../types").Thumbnail>(`/thumbnails/${thumbnailId}/select`, { method: "POST" }),

  getSEO: (projectId: number) => request<import("../types").SEOMetadata | null>(`/seo/project/${projectId}`),
  generateSEO: (projectId: number, language?: string) =>
    request<import("../types").SEOMetadata>(`/seo/project/${projectId}/generate`, { method: "POST", body: JSON.stringify({ language: language || "en" }) }),
  listSEOCategories: () => request<import("../types").SEOCategory[]>("/seo/categories"),
  updateSEOCategory: (projectId: number, categoryId: number) =>
    request<import("../types").SEOMetadata>(`/seo/project/${projectId}/category`, { method: "PATCH", body: JSON.stringify({ category_id: categoryId }) }),

  exportProject: (projectId: number) =>
    request<import("../types").ExportResult>(`/export/project/${projectId}`, { method: "POST" }),
};
