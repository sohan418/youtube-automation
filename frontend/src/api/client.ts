export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  return `${API_BASE}/media/${path.replace(/\\/g, "/")}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isForm = options?.body instanceof FormData;
  const headers = isForm
    ? options?.headers
    : { "Content-Type": "application/json", ...options?.headers };
  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  listProjects: () => request<import("../types").Project[]>("/projects"),
  createProject: (data: {
    name: string;
    description?: string;
    category?: string;
    language?: string;
    ratio?: string;
  }) =>
    request<import("../types").Project>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getProject: (id: number) =>
    request<import("../types").Project>(`/projects/${id}`),
  updateProject: (id: number, data: Partial<import("../types").Project>) =>
    request<import("../types").Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),

  listIdeas: (projectId: number) =>
    request<import("../types").Idea[]>(`/ideas/project/${projectId}`),
  generateIdeas: (
    projectId: number,
    data: {
      category?: string;
      count?: number;
      language?: string;
      topic?: string;
    },
  ) =>
    request<import("../types").Idea[]>(`/ideas/project/${projectId}/generate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  selectIdea: (ideaId: number) =>
    request<import("../types").Idea>(`/ideas/${ideaId}/select`, {
      method: "POST",
    }),
  importIdeas: (
    projectId: number,
    ideas: { title: string; description?: string; category?: string }[],
  ) =>
    request<import("../types").Idea[]>(`/ideas/project/${projectId}/import`, {
      method: "POST",
      body: JSON.stringify({ ideas }),
    }),

  listScripts: (projectId: number) =>
    request<import("../types").Script[]>(`/scripts/project/${projectId}`),

  // YouTube
  getYoutubeConfig: () =>
    request<{ youtube_api_key_configured: boolean; youtube_playlist_id: string; youtube_client_id_configured: boolean; youtube_connected: boolean }>("/youtube/config"),
  saveYoutubeConfig: (data: { youtube_api_key?: string; youtube_playlist_id?: string; youtube_client_id?: string; youtube_client_secret?: string }) =>
    request<{ youtube_api_key_configured: boolean; youtube_playlist_id: string; youtube_client_id_configured: boolean; youtube_connected: boolean }>("/youtube/config", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getRecentVideos: (maxResults?: number) =>
    request<{ title: string; description: string; published_at: string; video_id: string; channel_title: string }[]>(
      `/youtube/recent${maxResults ? `?max_results=${maxResults}` : ""}`,
    ),
  getYoutubeAuthUrl: () =>
    request<{ url: string }>("/youtube/auth/url"),
  getYoutubeChannel: () =>
    request<{ connected: boolean; channel_id?: string; title?: string; description?: string; avatar?: string; subscribers?: string; videos?: string }>("/youtube/channel"),
  uploadToYouTube: (projectId: number, privacyStatus: string) =>
    request<{ message: string; slug: string }>(`/youtube/upload/${projectId}`, {
      method: "POST",
      body: JSON.stringify({ privacy_status: privacyStatus }),
    }),
  getYoutubeUploadStatus: (projectId: number) =>
    request<{ running: boolean; progress: number; stage: string; message: string; video_id: string | null; video_url: string | null; error: string | null }>(`/youtube/upload/${projectId}/status`),

  generateScript: (
    projectId: number,
    data: {
      idea_id?: number;
      topic?: string;
      language?: string;
      target_duration_minutes?: number;
    },
  ) =>
    request<import("../types").Script>(
      `/scripts/project/${projectId}/generate`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  createScript: (
    projectId: number,
    data: {
      title: string;
      hook?: string;
      body: string;
      ending?: string;
      language?: string;
    },
  ) =>
    request<import("../types").Script>(`/scripts/project/${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  importScript: (
    projectId: number,
    data: {
      title?: string;
      hook?: string;
      body: string;
      ending?: string;
      language?: string;
      replace?: boolean;
    },
  ) =>
    request<import("../types").Script>(`/scripts/project/${projectId}/import`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateScript: (scriptId: number, data: Partial<import("../types").Script>) =>
    request<import("../types").Script>(`/scripts/${scriptId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  exportScriptJson: async (scriptId: number, filename: string) => {
    const response = await fetch(`${API_BASE}/scripts/${scriptId}/export`);
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || "Request failed");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  listScenes: (projectId: number) =>
    request<import("../types").Scene[]>(`/scenes/project/${projectId}`),
  createScene: (
    projectId: number,
    data: {
      narration: string;
      image_prompt?: string;
      video_prompt?: string;
      script_id?: number;
      order_index?: number;
    },
  ) =>
    request<import("../types").Scene>(`/scenes/project/${projectId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteScene: (sceneId: number) =>
    request<void>(`/scenes/${sceneId}`, { method: "DELETE" }),
  clearScenes: (projectId: number) =>
    request<void>(`/scenes/project/${projectId}`, { method: "DELETE" }),
  generateScenes: (projectId: number, scriptId: number, count?: number) =>
    request<import("../types").Scene[]>(
      `/scenes/project/${projectId}/generate`,
      { method: "POST", body: JSON.stringify({ script_id: scriptId, count }) },
    ),
  updateScene: (sceneId: number, data: Partial<import("../types").Scene>) =>
    request<import("../types").Scene>(`/scenes/${sceneId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  importScenes: (
    projectId: number,
    data: {
      scenes: {
        narration: string;
        image_prompt?: string;
        video_prompt?: string;
      }[];
      replace?: boolean;
    },
  ) =>
    request<import("../types").Scene[]>(`/scenes/project/${projectId}/import`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generateImage: (sceneId: number, style?: string) =>
    request<import("../types").Scene>("/images/generate", {
      method: "POST",
      body: JSON.stringify({ scene_id: sceneId, style }),
    }),
  generateAllImages: (projectId: number, style?: string) =>
    request<import("../types").Scene[]>(
      `/images/project/${projectId}/generate-all?style=${style || ""}`,
      { method: "POST" },
    ),
  uploadSceneImage: (sceneId: number, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return request<import("../types").Scene>(
      `/images/scene/${sceneId}/upload`,
      { method: "POST", body: form },
    );
  },
  addSceneImageUrl: (sceneId: number, url: string) =>
    request<import("../types").Scene>(`/images/scene/${sceneId}/link`, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  setPrimarySceneImage: (imageId: number) =>
    request<import("../types").Scene>(`/images/${imageId}/set-primary`, {
      method: "POST",
    }),
  deleteSceneImage: (imageId: number) =>
    request<import("../types").Scene>(`/images/${imageId}`, {
      method: "DELETE",
    }),
  reorderSceneImages: (sceneId: number, imageIds: number[]) =>
    request<import("../types").Scene>(`/images/scene/${sceneId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ image_ids: imageIds }),
    }),
  copySceneImage: (imageId: number, sceneId: number) =>
    request<import("../types").Scene>(`/images/${imageId}/copy`, {
      method: "POST",
      body: JSON.stringify({ scene_id: sceneId }),
    }),

  uploadSceneVideo: (sceneId: number, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return request<import("../types").Scene>(
      `/scenes/${sceneId}/video/upload`,
      { method: "POST", body: form },
    );
  },
  removeSceneVideo: (sceneId: number, videoId: number) =>
    request<import("../types").Scene>(`/scenes/${sceneId}/video/${videoId}`, {
      method: "DELETE",
    }),
  reorderSceneMedia: (
    sceneId: number,
    items: import("../types").SceneMediaItem[],
  ) =>
    request<import("../types").Scene>(`/scenes/${sceneId}/media/reorder`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  generateVoice: (
    sceneId: number,
    voice?: string,
    provider?: string,
    rate = "+0%",
  ) =>
    request<import("../types").Scene>("/voice/generate", {
      method: "POST",
      body: JSON.stringify({
        scene_id: sceneId,
        voice,
        provider: provider || "gemini",
        rate,
      }),
    }),
  generateAllVoice: (
    projectId: number,
    voice?: string,
    provider?: string,
    rate = "+0%",
  ) =>
    request<import("../types").Scene[]>(
      `/voice/project/${projectId}/generate-all?voice=${encodeURIComponent(voice || "Kore")}&provider=${encodeURIComponent(provider || "gemini")}&rate=${encodeURIComponent(rate)}`,
      { method: "POST" },
    ),
  listVoices: (lang?: string) =>
    request<import("../types").VoiceCatalog>(
      "/voice/voices" + (lang ? `?lang=${encodeURIComponent(lang)}` : "")
    ),
  getVoiceConfig: () =>
    request<import("../types").VoiceConfig>("/voice/config"),
  saveVoiceConfig: (data: {
    sarvam_api_key?: string;
    deepgram_api_key?: string;
    elevenlabs_api_key?: string;
  }) =>
    request<import("../types").VoiceConfig>("/voice/config", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  uploadVoice: (
    sceneId: number,
    file: File,
    duration: number,
    voice?: string,
  ) => {
    const form = new FormData();
    form.append("scene_id", String(sceneId));
    form.append("voice", voice || "Kore");
    form.append("duration", String(duration));
    form.append("file", file, file.name);
    return request<import("../types").Scene>("/voice/upload", {
      method: "POST",
      body: form,
    });
  },
  clearSceneAudio: (sceneId: number) =>
    request<void>(`/voice/scene/${sceneId}`, { method: "DELETE" }),
  combineAudioPreview: (projectId: number) =>
    request<{ message: string; preview_path: string }>(
      `/voice/project/${projectId}/preview`,
      { method: "POST" },
    ),
  downloadCombinedAudio: (previewPath: string) => {
    const url = mediaUrl(previewPath);
    const a = document.createElement("a");
    a.href = url;
    a.download = "combined_audio.mp3";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  listVideoRatios: () =>
    request<import("../types").VideoRatioCatalog>("/video/ratios"),
  getTimeline: (projectId: number) =>
    request<import("../types").TimelineResponse>(
      `/timeline/project/${projectId}`,
    ),
  saveTimeline: (projectId: number, data: import("../types").TimelineData) =>
    request<import("../types").TimelineResponse>(
      `/timeline/project/${projectId}`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  uploadTimelineMedia: (projectId: number, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return request<{
      file_path: string;
      kind: "video" | "audio" | "image";
      duration_seconds: number | null;
      width: number | null;
      height: number | null;
      size_bytes: number;
    }>(`/media/upload/${projectId}`, { method: "POST", body: form });
  },
  listGlobalClips: () =>
    request<import("../types").VideoClip[]>("/video/clips/library"),
  uploadGlobalClip: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return request<import("../types").VideoClip>("/video/clips/upload", {
      method: "POST",
      body: form,
    });
  },
  deleteGlobalClip: (filename: string) =>
    request<{ message: string }>(
      `/video/clips/${encodeURIComponent(filename)}`,
      { method: "DELETE" },
    ),
  buildVideo: (
    projectId: number,
    data?: {
      resolution?: string;
      ratio?: string;
      timeline?: import("../types").TimelineData | null;
      subtitles?: boolean;
      subtitle_style?: string;
      subtitle_position?: string;
      subtitle_color?: string;
      subtitle_outline_color?: string;
      subtitle_outline?: number;
      subtitle_font_size?: number | null;
      force_rebuild?: boolean;
    },
  ) =>
    request<{ message: string; detail: string }>(
      `/video/project/${projectId}/build`,
      { method: "POST", body: JSON.stringify(data || {}) },
    ),
  videoStatus: (projectId: number) =>
    request<import("../types").VideoStatus>(
      `/video/project/${projectId}/status`,
    ),

  listThumbnails: (projectId: number) =>
    request<import("../types").Thumbnail[]>(`/thumbnails/project/${projectId}`),
  generateThumbnails: (projectId: number, count?: number) =>
    request<import("../types").Thumbnail[]>(
      `/thumbnails/project/${projectId}/generate`,
      { method: "POST", body: JSON.stringify({ count: count || 3 }) },
    ),
  selectThumbnail: (thumbnailId: number) =>
    request<import("../types").Thumbnail>(`/thumbnails/${thumbnailId}/select`, {
      method: "POST",
    }),
  uploadThumbnail: (projectId: number, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return request<import("../types").Thumbnail>(
      `/thumbnails/project/${projectId}/upload`,
      { method: "POST", body: form },
    );
  },

  getSEO: (projectId: number) =>
    request<import("../types").SEOMetadata | null>(`/seo/project/${projectId}`),
  getSEOConstants: () =>
    request<import("../types").SEOConstants>("/seo/constants"),
  generateSEO: (projectId: number, language?: string) =>
    request<import("../types").SEOMetadata>(
      `/seo/project/${projectId}/generate`,
      { method: "POST", body: JSON.stringify({ language: language || "en" }) },
    ),
  listSEOCategories: () =>
    request<import("../types").SEOCategory[]>("/seo/categories"),
  updateSEOCategory: (projectId: number, categoryId: number) =>
    request<import("../types").SEOMetadata>(
      `/seo/project/${projectId}/category`,
      { method: "PATCH", body: JSON.stringify({ category_id: categoryId }) },
    ),
  updateSEO: (projectId: number, data: { title?: string; description?: string; tags?: string; hashtags?: string }) =>
    request<import("../types").SEOMetadata>(`/seo/project/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  exportProject: (projectId: number) =>
    request<import("../types").ExportResult>(`/export/project/${projectId}`, {
      method: "POST",
    }),

  getPrompts: (projectId: number) =>
    request<Record<string, { system: string; user: string }>>(`/prompts/project/${projectId}`),

  listAdminPrompts: () =>
    request<import("../types").PromptTemplate[]>("/admin/prompts"),
  updateAdminPrompt: (key: string, data: { system: string; user: string }) =>
    request<import("../types").PromptTemplate>(`/admin/prompts/${key}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  bulkUpdateAdminPrompts: (prompts: Record<string, { system: string; user: string }>) =>
    request<{ updated: string[] }>("/admin/prompts", {
      method: "PUT",
      body: JSON.stringify({ prompts }),
    }),
  resetAdminPrompts: () =>
    request<{ status: string; reset: number }>("/admin/prompts/reset", {
      method: "POST",
    }),
};
