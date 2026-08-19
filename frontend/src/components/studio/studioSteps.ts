import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Mic,
  Search,
  Subtitles,
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
  | "export";

export interface StepDef {
  key: StudioStep;
  label: string;
  icon: LucideIcon;
  hint: string;
}

export const STUDIO_STEPS: StepDef[] = [
  { key: "ideas", label: "Ideas", icon: Lightbulb, hint: "Brainstorm video topics" },
  { key: "script", label: "Script", icon: FileText, hint: "Generate or write the script" },
  { key: "scenes", label: "Scenes", icon: Clapperboard, hint: "Split the script into scenes" },
  { key: "voice", label: "Voice", icon: Mic, hint: "Add narration (AI or recorded)" },
  { key: "images", label: "Media", icon: ImageIcon, hint: "Create visuals for each scene" },
  { key: "captions", label: "Captions", icon: Subtitles, hint: "Subtitle and caption settings" },
  { key: "video", label: "Video & Export", icon: Video, hint: "Render and package final video" },
  { key: "thumbnail", label: "Thumbnail", icon: Camera, hint: "Pick a cover image" },
  { key: "seo", label: "SEO", icon: Search, hint: "Title, tags and description" },
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
}

export function getDoneMap(d: StepStatusData): Record<StudioStep, boolean> {
  const scenesReady = d.scenes.length > 0;
  return {
    ideas: d.ideas.length > 0,
    script: !!d.activeScript,
    scenes: scenesReady,
    images: scenesReady && d.scenes.every((s) => !!s.image_path),
    voice: scenesReady && d.scenes.every((s) => !!s.audio_path),
    captions: true,
    timeline: true,
    video:
      !!d.videoStatus && !d.videoStatus.running && !d.videoStatus.error && !!d.videoStatus.output,
    thumbnail: d.thumbnails.length > 0,
    seo: !!d.seo,
    export: true,
  };
}
