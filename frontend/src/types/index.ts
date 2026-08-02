export type ProjectStatus =
  | "draft"
  | "idea"
  | "script"
  | "scenes"
  | "images"
  | "audio"
  | "video"
  | "thumbnail"
  | "seo"
  | "completed"
  | "exported";

export interface Project {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  language: string;
  status: ProjectStatus;
  folder_path: string;
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: number;
  project_id: number | null;
  title: string;
  description: string | null;
  category: string | null;
  trending_score: number;
  is_selected: boolean;
  created_at: string;
}

export interface Script {
  id: number;
  project_id: number;
  title: string;
  hook: string | null;
  body: string;
  ending: string | null;
  language: string;
  word_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Scene {
  id: number;
  project_id: number;
  script_id: number;
  order_index: number;
  narration: string;
  image_prompt: string | null;
  image_path: string | null;
  audio_path: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface Thumbnail {
  id: number;
  project_id: number;
  file_path: string;
  prompt: string | null;
  is_selected: boolean;
  created_at: string;
}

export interface SEOCategory {
  id: number;
  name: string;
}

export interface SEOMetadata {
  id: number;
  project_id: number;
  title: string | null;
  description: string | null;
  tags: string | null;
  hashtags: string | null;
  category: string | null;
  category_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExportResult {
  export_path: string;
  files: string[];
  message: string;
}

export const PIPELINE_STEPS: { key: ProjectStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "idea", label: "Ideas" },
  { key: "script", label: "Script" },
  { key: "scenes", label: "Scenes" },
  { key: "images", label: "Images" },
  { key: "audio", label: "Voice" },
  { key: "video", label: "Video" },
  { key: "thumbnail", label: "Thumbnail" },
  { key: "seo", label: "SEO" },
  { key: "exported", label: "Exported" },
];
