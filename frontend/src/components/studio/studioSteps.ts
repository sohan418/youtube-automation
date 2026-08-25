import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Mic,
  Scissors,
  Search,
  Subtitles,
  Upload,
  Video,
} from "lucide-react";
import type { ExportResult, Scene, Script, SEOMetadata, Thumbnail, TimelineData, VideoStatus } from "../../types";

export type StudioStep =
  | "ideas"
  | "script"
  | "scenes"
  | "images"
  | "voice"
  | "captions"
  | "timeline"
  | "video"
  | "thumbnail"
  | "seo"
  | "upload"
  | "export";

export type StepGroup = "plan" | "create" | "publish";

export interface StepDef {
  key: StudioStep;
  label: string;
  icon: LucideIcon;
  hint: string;
  group: StepGroup;
}

export const STUDIO_STEPS: StepDef[] = [
  { key: "ideas", label: "Ideas", icon: Lightbulb, hint: "Brainstorm video topics", group: "plan" },
  { key: "script", label: "Script", icon: FileText, hint: "Generate or write the script", group: "plan" },
  { key: "scenes", label: "Scenes", icon: Clapperboard, hint: "Split the script into scenes", group: "plan" },
  { key: "images", label: "Media", icon: ImageIcon, hint: "Create visuals for each scene", group: "create" },
  { key: "voice", label: "Voice", icon: Mic, hint: "Add narration (AI or recorded)", group: "create" },
  { key: "captions", label: "Captions", icon: Subtitles, hint: "Subtitle and caption settings", group: "create" },
  { key: "timeline", label: "Timeline", icon: Scissors, hint: "Arrange, trim and edit clips", group: "create" },
  { key: "video", label: "Editor", icon: Video, hint: "Build and preview final video", group: "create" },
  { key: "thumbnail", label: "Thumbnail", icon: Camera, hint: "Design a cover image", group: "publish" },
  { key: "seo", label: "SEO", icon: Search, hint: "Title, tags and description", group: "publish" },
  { key: "upload", label: "Upload", icon: Upload, hint: "Publish to YouTube", group: "publish" },
];

export const STEP_GROUPS: { key: StepGroup; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "create", label: "Create" },
  { key: "publish", label: "Publish" },
];

export interface StepStatusData {
  ideas: unknown[];
  activeScript: Script | null;
  scenes: Scene[];
  thumbnails: Thumbnail[];
  seo: SEOMetadata | null;
  exportInfo: ExportResult | null;
  videoStatus: VideoStatus | null;
  timeline: TimelineData | null;
  youtubeUploaded: boolean;
}

export function getDoneMap(d: StepStatusData): Record<StudioStep, boolean> {
  const scenesReady = d.scenes.length > 0;
  return {
    ideas: d.ideas.length > 0,
    script: !!d.activeScript,
    scenes: scenesReady,
    images: scenesReady && d.scenes.every((s) => !!s.image_path || ((s.images?.length ?? 0) > 0) || ((s.videos?.length ?? 0) > 0)),
    voice: scenesReady && d.scenes.every((s) => !!s.audio_path),
    captions: true,
    timeline: !!d.timeline,
    video:
      !!d.videoStatus && !d.videoStatus.running && !d.videoStatus.error && !!d.videoStatus.output,
    thumbnail: d.thumbnails.length > 0,
    seo: !!d.seo,
    upload: d.youtubeUploaded,
    export: true,
  };
}

export function getProgressPercent(d: StepStatusData): number {
  const done = getDoneMap(d);
  const keys: StudioStep[] = ["ideas", "script", "scenes", "images", "voice", "captions", "timeline", "video", "thumbnail", "seo"];
  const completed = keys.filter((k) => done[k]).length;
  return Math.round((completed / keys.length) * 100);
}

export function getCompletedCount(d: StepStatusData): number {
  const done = getDoneMap(d);
  const keys: StudioStep[] = ["ideas", "script", "scenes", "images", "voice", "captions", "timeline", "video", "thumbnail", "seo"];
  return keys.filter((k) => done[k]).length;
}
