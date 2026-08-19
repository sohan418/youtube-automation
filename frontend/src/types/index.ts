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
  ratio: string;
  thumbnail: string | null;
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

export interface SceneImage {
  id: number;
  scene_id: number;
  file_path: string;
  source: string;
  position: number;
  created_at: string;
}

export interface SceneVideo {
  id: number;
  scene_id: number;
  file_path: string;
  source: string;
  position: number;
  created_at: string;
}

export interface SceneMediaItem {
  type: "image" | "video";
  id: number;
}

export interface Scene {
  id: number;
  project_id: number;
  script_id: number;
  order_index: number;
  narration: string;
  image_prompt: string | null;
  video_prompt: string | null;
  image_path: string | null;
  video_path: string | null;
  audio_path: string | null;
  duration_seconds: number | null;
  motion_effect?: string;
  images: SceneImage[];
  videos: SceneVideo[];
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

export interface VoiceProvider {
  id: string;
  name: string;
  default: string;
  voices: string[];
  requires_key: boolean;
  key_configured: boolean;
  voice_labels?: Record<string, string>;
}

export interface VoiceCatalog {
  default_provider: string;
  providers: VoiceProvider[];
}

export interface VoiceConfig {
  gemini_key_configured: boolean;
  sarvam_key_configured: boolean;
  deepgram_key_configured: boolean;
  elevenlabs_key_configured: boolean;
  edgetts_key_configured: boolean;
}

export interface VideoRatio {
  id: string;
  label: string;
  width: number;
  height: number;
  resolution: string;
}

export interface VideoRatioCatalog {
  default: string;
  ratios: VideoRatio[];
}

export interface VideoClip {
  filename: string;
  name: string;
  file_path: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  size_bytes: number;
}

export interface VideoStatus {
  running: boolean;
  progress: number;
  stage: string;
  message: string;
  output: string | null;
  error: string | null;
  updated_at: string | null;
}

export interface TimelineClip {
  id: string;
  scene_id: number;
  track: "video" | "narration";
  start: number;
  duration: number;
  image_path: string | null;
  video_path: string | null;
  audio_path: string | null;
  audio_in: number | null;
  audio_out: number | null;
  volume: number;
  motion_effect?: string;
}

export interface TimelineData {
  version: number;
  duration: number;
  clips: TimelineClip[];
}

export interface TimelineResponse {
  project_id: number;
  data: TimelineData;
  version: number;
  updated_at: string | null;
}

export interface PromptTemplate {
  key: string;
  label: string;
  system: string;
  user: string;
}
