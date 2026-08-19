import { useState, useRef, useEffect } from "react";
import {
  Check,
  FileText,
  X,
  Pencil,
  Search,
  GripVertical,
  Film,
  Image,
  Video,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  MoreVertical,
  Save,
} from "lucide-react";
import type { Scene, Script } from "../../types";
import { mediaUrl } from "../../api/client";
import FreeAIGuide from "../editors/FreeAIGuide";

function parseImportedText(
  text: string,
): { narration: string; image_prompt?: string; video_prompt?: string }[] {
  text = text.trim();
  if (!text) return [];

  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.scenes || data.items || [];
    if (Array.isArray(list) && list.length > 0) {
      return list
        .map((item: any) => ({
          narration: String(
            item.narration || item.text || item.content || "",
          ).trim(),
          image_prompt:
            item.image_prompt || item.prompt
              ? String(item.image_prompt || item.prompt).trim()
              : undefined,
          video_prompt:
            item.video_prompt || item.videoPrompt
              ? String(item.video_prompt || item.videoPrompt).trim()
              : undefined,
        }))
        .filter((item) => item.narration.length > 0);
    }
  } catch (e) {
    // Not valid JSON, fallback to text parsing
  }

  const blocks = text
    .split(/(?:^|\n)(?=Scene\s+\d+[:\s]|---)/i)
    .filter((b) => b.trim().length > 0);
  if (blocks.length > 0) {
    const result: {
      narration: string;
      image_prompt?: string;
      video_prompt?: string;
    }[] = [];
    for (const block of blocks) {
      const narrationMatch = block.match(
        /(?:Narration|Text):\s*(.*?)(?=\n(?:Prompt|Video Prompt|Image Prompt):|$)/is,
      );
      const promptMatch = block.match(
        /(?:Prompt|Image Prompt):\s*(.*?)(?=\n(?:Video Prompt|Scene\s+\d+|Narration):|$)/is,
      );
      const videoPromptMatch = block.match(
        /Video Prompt:\s*(.*?)(?=\n(?:Prompt|Image Prompt|Scene\s+\d+|Narration):|$)/is,
      );
      const narration = narrationMatch
        ? narrationMatch[1].trim()
        : block.replace(/^Scene\s+\d+[:\s]*/i, "").trim();
      const image_prompt = promptMatch ? promptMatch[1].trim() : undefined;
      const video_prompt = videoPromptMatch
        ? videoPromptMatch[1].trim()
        : undefined;
      if (narration) {
        result.push({ narration, image_prompt, video_prompt });
      }
    }
    if (result.length > 0) return result;
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((line) => ({
    narration: line.replace(/^\d+[\.\)]\s*/, ""),
  }));
}

interface Props {
  scenes: Scene[];
  activeScript: Script | null;
  actionLoading: string;
  sceneCount: string;
  onSceneCountChange: (v: string) => void;
  onGenerate: () => void;
  onClearAll: () => void;
  addingScene: boolean;
  addSceneAt: number | null;
  newSceneNarration: string;
  onNewSceneNarration: (v: string) => void;
  onAddScene: () => void;
  onOpenAdd: (pos: number | null) => void;
  onCloseAdd: () => void;
  editingSceneId: number | null;
  sceneEditForm: {
    narration: string;
    image_prompt: string;
    video_prompt: string;
    motion_effect: string;
  };
  onEditFormChange: (
    patch: Partial<{
      narration: string;
      image_prompt: string;
      video_prompt: string;
      motion_effect: string;
    }>,
  ) => void;
  onStartEdit: (scene: Scene) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onRemove: (id: number) => void;
  onImportScenes?: (
    importedList: {
      narration: string;
      image_prompt?: string;
      video_prompt?: string;
    }[],
    replace: boolean,
  ) => void;
  projectName?: string;
  prompts?: { system: string; user: string };
}

export default function ScenesStep({
  scenes,
  activeScript,
  actionLoading,
  sceneCount,
  onSceneCountChange,
  onGenerate,
  onClearAll,
  addingScene,
  addSceneAt,
  newSceneNarration,
  onNewSceneNarration,
  onAddScene,
  onOpenAdd,
  onCloseAdd,
  editingSceneId,
  sceneEditForm,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
  onImportScenes,
  projectName = "project",
  prompts,
}: Props) {
  const [copiedPromptId, setCopiedPromptId] = useState<number | null>(null);
  const [copiedImagePromptId, setCopiedImagePromptId] = useState<number | null>(null);
  const [copiedVideoPromptId, setCopiedVideoPromptId] = useState<number | null>(null);
  const [copiedAllType, setCopiedAllType] = useState<"prompts" | "full" | "json" | null>(null);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importReplace, setImportReplace] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (scenes.length === 0) setActiveIdx(0);
    else if (activeIdx >= scenes.length) setActiveIdx(scenes.length - 1);
  }, [scenes.length, activeIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;
      if (e.key === "ArrowLeft") setActiveIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setActiveIdx((i) => Math.min(scenes.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenes.length]);

  const handleCopyPrompt = (scene: Scene) => {
    const textToCopy = scene.narration;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedPromptId(scene.id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const handleCopyImagePrompt = (scene: Scene) => {
    const text = scene.image_prompt || "";
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedImagePromptId(scene.id);
    setTimeout(() => setCopiedImagePromptId(null), 2000);
  };

  const handleCopyVideoPrompt = (scene: Scene) => {
    const text = scene.video_prompt || "";
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedVideoPromptId(scene.id);
    setTimeout(() => setCopiedVideoPromptId(null), 2000);
  };

  const handleCopyAllPrompts = () => {
    const prompts = scenes
      .map((s, idx) => `${idx + 1}. ${s.image_prompt || s.narration}`)
      .join("\n\n");
    navigator.clipboard.writeText(prompts);
    setCopiedAllType("prompts");
    setShowCopyMenu(false);
    setTimeout(() => setCopiedAllType(null), 2500);
  };

  const handleCopyAllFull = () => {
    const text = scenes
      .map(
        (s) =>
          `Scene ${s.order_index}:\nNarration: ${s.narration}${
            s.image_prompt ? `\nPrompt: ${s.image_prompt}` : ""
          }${s.video_prompt ? `\nVideo Prompt: ${s.video_prompt}` : ""}`,
      )
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    setCopiedAllType("full");
    setShowCopyMenu(false);
    setTimeout(() => setCopiedAllType(null), 2500);
  };

  const handleCopyAllJson = () => {
    const json = JSON.stringify(
      scenes.map((s) => ({
        order_index: s.order_index,
        narration: s.narration,
        image_prompt: s.image_prompt,
        video_prompt: s.video_prompt,
      })),
      null,
      2,
    );
    navigator.clipboard.writeText(json);
    setCopiedAllType("json");
    setShowCopyMenu(false);
    setTimeout(() => setCopiedAllType(null), 2500);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const json = JSON.stringify(
      scenes.map((s) => ({
        order_index: s.order_index,
        narration: s.narration,
        image_prompt: s.image_prompt,
        video_prompt: s.video_prompt,
      })),
      null,
      2,
    );
    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(json, `scenes-${cleanName}.json`, "application/json");
    setShowExportMenu(false);
  };

  const handleExportTxt = () => {
    const text = scenes
      .map(
        (s) =>
          `Scene ${s.order_index}:\nNarration: ${s.narration}${
            s.image_prompt ? `\nPrompt: ${s.image_prompt}` : ""
          }${s.video_prompt ? `\nVideo Prompt: ${s.video_prompt}` : ""}`,
      )
      .join("\n\n---\n\n");
    const cleanName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadFile(text, `scenes-${cleanName}.txt`, "text/plain");
    setShowExportMenu(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  };

  const parsedImportScenes = parseImportedText(importText);

  // Add scene popover card
  const sceneForm = (position: number | null) => {
    if (!addingScene || addSceneAt !== position) return null;
    const label =
      addSceneAt == null
        ? "Adding new scene at the end"
        : addSceneAt === 1
          ? "Inserting new scene at the top"
          : `Inserting new scene after scene #${addSceneAt - 1}`;
    return (
      <div className="card" style={{ background: "rgba(255, 255, 255, 0.015)", border: "1px solid var(--border)", padding: "1rem", display: "grid", gap: "0.5rem" }}>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>
          {label}
        </p>
        <textarea
          value={newSceneNarration}
          onChange={(e) => onNewSceneNarration(e.target.value)}
          placeholder="Enter the narration (voice-over text) for this scene..."
          rows={3}
          style={{ width: "100%", fontSize: "0.82rem" }}
        />
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onCloseAdd} style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!newSceneNarration.trim() || !!actionLoading}
            onClick={onAddScene}
            style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem", background: "var(--primary)" }}
          >
            {actionLoading === "add-scene" ? "Adding..." : "Add Scene"}
          </button>
        </div>
      </div>
    );
  };

  const activeScene = scenes[activeIdx];
  const filteredScenes = scenes.filter((scene) =>
    scene.narration.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateDuration = (narration: string) => {
    return Math.max(3, Math.round(narration.length * 0.15));
  };

  const formatDurationText = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const currentEffect = activeScene
    ? editingSceneId === activeScene.id
      ? sceneEditForm.motion_effect
      : (activeScene.motion_effect || "none")
    : "none";

  const animationStyle = currentEffect === "zoom_in"
    ? "scene-zoom-in 10s ease-in-out infinite alternate"
    : currentEffect === "zoom_out"
    ? "scene-zoom-out 10s ease-in-out infinite alternate"
    : currentEffect === "pan_right"
    ? "scene-pan-right 12s ease-in-out infinite alternate"
    : currentEffect === "pan_left"
    ? "scene-pan-left 12s ease-in-out infinite alternate"
    : currentEffect === "pan_up"
    ? "scene-pan-up 12s ease-in-out infinite alternate"
    : currentEffect === "pan_down"
    ? "scene-pan-down 12s ease-in-out infinite alternate"
    : "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", height: "100%", overflow: "hidden" }}>
      <style>{`
        @keyframes scene-zoom-in {
          0% { transform: scale(1); }
          100% { transform: scale(1.2); }
        }
        @keyframes scene-zoom-out {
          0% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes scene-pan-right {
          0% { transform: scale(1.2) translateX(-4%); }
          100% { transform: scale(1.2) translateX(4%); }
        }
        @keyframes scene-pan-left {
          0% { transform: scale(1.2) translateX(4%); }
          100% { transform: scale(1.2) translateX(-4%); }
        }
        @keyframes scene-pan-up {
          0% { transform: scale(1.2) translateY(4%); }
          100% { transform: scale(1.2) translateY(-4%); }
        }
        @keyframes scene-pan-down {
          0% { transform: scale(1.2) translateY(-4%); }
          100% { transform: scale(1.2) translateY(4%); }
        }
      `}</style>
      {/* 1. Header Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Scenes ({scenes.length})</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "2px 0 0 0" }}>
            Organize, review and refine each part of your video
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", position: "relative" }}>
          <button
            className="btn-primary"
            disabled={!!actionLoading || !activeScript}
            onClick={onGenerate}
            style={{ padding: "0.4rem 0.95rem", fontSize: "0.78rem", background: "var(--primary)", color: "white", fontWeight: 600 }}
          >
            {actionLoading === "scenes" ? "Generating..." : "Generate Scenes"}
          </button>

          <button
            className="btn-secondary"
            onClick={() => setShowFreeAI(!showFreeAI)}
            style={{
              padding: "0.4rem 0.85rem",
              fontSize: "0.78rem",
              borderColor: showFreeAI ? "var(--primary)" : "var(--border)",
              color: showFreeAI ? "var(--primary)" : "var(--text-muted)",
              background: showFreeAI ? "rgba(255, 0, 60, 0.05)" : "transparent",
              fontWeight: 600,
            }}
          >
            Free AI
          </button>

          <input
            type="number"
            min={1}
            max={30}
            value={sceneCount}
            onChange={(e) => onSceneCountChange(e.target.value)}
            placeholder="Auto"
            title="Number of scenes to generate (leave empty for auto)"
            style={{
              width: "3.8rem",
              textAlign: "center",
              padding: "0.38rem 0.35rem",
              fontSize: "0.78rem",
            }}
          />

          <button
            className="btn-accent"
            disabled={!!actionLoading}
            onClick={() => onOpenAdd(null)}
            style={{ padding: "0.4rem 0.85rem", fontSize: "0.78rem" }}
          >
            + Add Scene
          </button>

          {/* Copy All Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              className="btn-secondary"
              disabled={scenes.length === 0}
              onClick={() => {
                setShowCopyMenu(!showCopyMenu);
                setShowExportMenu(false);
              }}
              style={{
                padding: "0.4rem 0.8rem",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                borderColor: copiedAllType ? "var(--success)" : undefined,
                color: copiedAllType ? "var(--success)" : undefined,
              }}
            >
              {copiedAllType ? "Copied!" : "Copy All ▾"}
            </button>

            {showCopyMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "4px",
                  zIndex: 100,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  width: 210,
                  padding: "0.3rem",
                  display: "grid",
                  gap: "0.25rem",
                }}
              >
                <button
                  onClick={handleCopyAllPrompts}
                  style={{ textAlign: "left", background: "transparent", padding: "0.4rem 0.6rem", fontSize: "0.75rem", color: "var(--text)" }}
                >
                  Copy All Image Prompts
                </button>
                <button
                  onClick={handleCopyAllFull}
                  style={{ textAlign: "left", background: "transparent", padding: "0.4rem 0.6rem", fontSize: "0.75rem", color: "var(--text)" }}
                >
                  Copy All Scenes & Text
                </button>
                <button
                  onClick={handleCopyAllJson}
                  style={{ textAlign: "left", background: "transparent", padding: "0.4rem 0.6rem", fontSize: "0.75rem", color: "var(--text)" }}
                >
                  Copy All JSON
                </button>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div style={{ position: "relative" }}>
            <button
              className="btn-secondary"
              disabled={scenes.length === 0}
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowCopyMenu(false);
              }}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem" }}
            >
              Export ▾
            </button>

            {showExportMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "4px",
                  zIndex: 100,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  width: 140,
                  padding: "0.3rem",
                  display: "grid",
                  gap: "0.25rem",
                }}
              >
                <button
                  onClick={handleExportJson}
                  style={{ textAlign: "left", background: "transparent", padding: "0.4rem 0.6rem", fontSize: "0.75rem", color: "var(--text)" }}
                >
                  Export JSON
                </button>
                <button
                  onClick={handleExportTxt}
                  style={{ textAlign: "left", background: "transparent", padding: "0.4rem 0.6rem", fontSize: "0.75rem", color: "var(--text)" }}
                >
                  Export Text (.txt)
                </button>
              </div>
            )}
          </div>

          <button
            className="btn-secondary"
            onClick={() => setShowImportModal(true)}
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem" }}
          >
            Import
          </button>

          <button
            className="btn-accent"
            onClick={() => setShowFreeAI(!showFreeAI)}
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem", background: showFreeAI ? "var(--primary)" : undefined, color: showFreeAI ? "white" : undefined }}
          >
            {showFreeAI ? "Hide Free AI" : "Generate with Free AI"}
          </button>

          <button
            className="btn-secondary"
            disabled={scenes.length === 0 || !!actionLoading}
            onClick={onClearAll}
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem", color: "var(--danger)", borderColor: "rgba(255,0,0,0.15)" }}
          >
            Clear
          </button>
        </div>
      </div>

      {showFreeAI && (
        <FreeAIGuide
          title="Generate Scenes with Free AI"
          prompt={prompts ? undefined : `SYSTEM PROMPT:\nYou are a video director. Break scripts into scenes as JSON.\nEach scene has a "narration", an "image_prompt", and a "video_prompt".\n\nUSER PROMPT:\nBreak this script into scenes. Each scene needs narration, image prompt, and video prompt.\nReturn JSON: {"scenes": [{"narration": "...", "image_prompt": "...", "video_prompt": "..."}]}`}
          promptPair={prompts}
          responsePlaceholder='Paste AI response here...\n\nAccepts JSON or plain text scenes.'
          onParseResponse={(text) => {
            if (!onImportScenes) return;
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const sceneList = parsed.scenes || parsed;
                if (Array.isArray(sceneList)) {
                  const scenes = sceneList.map((s: any) => ({
                    narration: s.narration || "",
                    image_prompt: s.image_prompt || "",
                    video_prompt: s.video_prompt || "",
                  })).filter((s: any) => s.narration);
                  if (scenes.length > 0) {
                    onImportScenes(scenes, false);
                  }
                }
              }
            } catch {
              // Fallback: treat as plain text
            }
          }}
        />
      )}

      {scenes.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: "2rem" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.85rem" }}>
            No scenes have been generated yet. Use script content or import tools to build your scene deck.
          </p>
          <button
            className="btn-primary"
            disabled={!!actionLoading || !activeScript}
            onClick={onGenerate}
            style={{ padding: "0.45rem 1rem", fontSize: "0.8rem", background: "var(--primary)" }}
          >
            Generate Scenes from Script
          </button>
        </div>
      ) : (
        /* 2. Main Workspace Split (Left sidebar list + Right canvas details) */
        <div style={{ flex: 1, display: "flex", gap: "0.85rem", minHeight: 0, overflow: "hidden" }}>
          
          {/* Left Column: Scene Navigation Sidebar */}
          <div
            style={{
              width: 250,
              flexShrink: 0,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              display: "flex",
              flexDirection: "column",
              background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            {/* Search Input */}
            <div style={{ padding: "0.55rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.35rem", background: "rgba(0,0,0,0.08)" }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search scenes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: "0.75rem",
                  color: "var(--text)",
                  width: "100%",
                  padding: 0,
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} style={{ background: "transparent", border: "none", padding: 0 }}>
                  <X size={12} color="var(--text-muted)" style={{ cursor: "pointer" }} />
                </button>
              )}
            </div>

            {/* List scroll wrapper */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)" }}>
              {filteredScenes.map((scene) => {
                const idx = scenes.findIndex((s) => s.id === scene.id);
                const active = idx === activeIdx;
                const durationVal = calculateDuration(scene.narration);
                const durationStr = formatDurationText(durationVal);

                return (
                  <button
                    key={scene.id}
                    onClick={() => setActiveIdx(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.55rem",
                      width: "100%",
                      background: active ? "rgba(255, 0, 60, 0.05)" : "var(--surface)",
                      border: "none",
                      borderLeft: active ? "3px solid var(--primary)" : "3px solid transparent",
                      padding: "0.55rem 0.65rem",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.12s ease",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {/* Circle badge */}
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: active ? "var(--primary)" : "rgba(255, 255, 255, 0.08)",
                        color: active ? "white" : "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>

                    {/* Layout icon */}
                    <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <Film size={12} />
                    </div>

                    {/* Meta info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: active ? 700 : 600, color: "var(--text)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span>Scene {idx + 1}</span>
                      </div>
                      <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", margin: "1px 0 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {scene.narration}
                      </p>
                    </div>

                    {/* Time & Grip */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", flexShrink: 0 }}>
                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500 }}>{durationStr}</span>
                      <GripVertical size={11} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Stretched add button */}
            <button
              onClick={() => onOpenAdd(null)}
              disabled={!!actionLoading}
              style={{
                width: "100%",
                background: "rgba(255, 255, 255, 0.015)",
                border: "none",
                borderTop: "1px solid var(--border)",
                color: "var(--text-muted)",
                padding: "0.65rem",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 600,
                textAlign: "center",
                transition: "all 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.025)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.015)")}
            >
              + Add Scene
            </button>
          </div>

          {/* Right Column: Canvas Workspace */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.65rem", minWidth: 0, overflowY: "auto" }}>
            
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>
                  Scene {activeIdx + 1} of {scenes.length}
                </span>
                <div style={{ display: "flex", gap: "0.15rem" }}>
                  <button
                    className="btn-secondary"
                    disabled={activeIdx <= 0}
                    onClick={() => setActiveIdx(activeIdx - 1)}
                    style={{ padding: "0.15rem 0.35rem" }}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={activeIdx >= scenes.length - 1}
                    onClick={() => setActiveIdx(activeIdx + 1)}
                    style={{ padding: "0.15rem 0.35rem" }}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                Use ← / → keys to switch scenes
              </span>
            </div>

            {/* Popover form for inserting scene */}
            {sceneForm(null)}

            {/* Main two-column editor */}
            {activeScene && (
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.85rem", flex: 1, minHeight: 0 }}>
                
                {/* Left side: Prompts & Narration */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  
                  {/* Card 1: Narration */}
                  <div className="card" style={{ padding: "0.75rem 0.85rem", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>
                        Scene Title / Prompt
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <button
                          className="btn-secondary"
                          onClick={() => handleCopyPrompt(activeScene)}
                          style={{ padding: "0.2rem 0.5rem", fontSize: "0.68rem" }}
                        >
                          {copiedPromptId === activeScene.id ? "Copied" : "Copy Prompt"}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            if (editingSceneId === activeScene.id) {
                              onCancelEdit();
                            } else {
                              onStartEdit(activeScene);
                            }
                          }}
                          style={{ padding: "0.2rem 0.5rem", fontSize: "0.68rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                        >
                          <Pencil size={11} />
                          {editingSceneId === activeScene.id ? "Cancel" : "Edit"}
                        </button>
                        <MoreVertical size={14} color="var(--text-muted)" style={{ cursor: "pointer" }} />
                      </div>
                    </div>

                    {editingSceneId === activeScene.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        <textarea
                          value={sceneEditForm.narration}
                          onChange={(e) => onEditFormChange({ narration: e.target.value })}
                          rows={3}
                          placeholder="Scene narration"
                          style={{ width: "100%", fontSize: "0.85rem", lineHeight: 1.5 }}
                        />
                        <span style={{ alignSelf: "flex-end", fontSize: "0.65rem", color: "var(--text-muted)" }}>
                          {sceneEditForm.narration.length}/200
                        </span>
                      </div>
                    ) : (
                      <p style={{ fontSize: "0.88rem", lineHeight: 1.5, margin: 0, color: "var(--text)", fontWeight: 500 }}>
                        {activeScene.narration}
                      </p>
                    )}
                  </div>

                  {/* Card 2: Image Prompt */}
                  <div className="card" style={{ padding: "0.75rem 0.85rem", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Image size={13} />
                        Image Prompt
                      </span>
                      <button
                        className="btn-secondary"
                        onClick={() => handleCopyImagePrompt(activeScene)}
                        disabled={!activeScene.image_prompt}
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.68rem" }}
                      >
                        {copiedImagePromptId === activeScene.id ? "Copied" : "Copy"}
                      </button>
                    </div>

                    {editingSceneId === activeScene.id ? (
                      <textarea
                        value={sceneEditForm.image_prompt}
                        onChange={(e) => onEditFormChange({ image_prompt: e.target.value })}
                        rows={2}
                        placeholder="Image prompt description"
                        style={{ width: "100%", fontSize: "0.8rem", fontStyle: "italic" }}
                      />
                    ) : (
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic", lineHeight: 1.45 }}>
                        {activeScene.image_prompt || "No image prompt defined."}
                      </p>
                    )}
                  </div>

                  {/* Card 3: Video Prompt */}
                  <div className="card" style={{ padding: "0.75rem 0.85rem", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Video size={13} />
                        Video Prompt
                      </span>
                      <button
                        className="btn-secondary"
                        onClick={() => handleCopyVideoPrompt(activeScene)}
                        disabled={!activeScene.video_prompt}
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.68rem" }}
                      >
                        {copiedVideoPromptId === activeScene.id ? "Copied" : "Copy"}
                      </button>
                    </div>

                    {editingSceneId === activeScene.id ? (
                      <textarea
                        value={sceneEditForm.video_prompt}
                        onChange={(e) => onEditFormChange({ video_prompt: e.target.value })}
                        rows={2}
                        placeholder="Video movement motion prompt"
                        style={{ width: "100%", fontSize: "0.8rem", fontStyle: "italic" }}
                      />
                    ) : (
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic", lineHeight: 1.45 }}>
                        {activeScene.video_prompt || "No video prompt defined."}
                      </p>
                    )}
                  </div>

                </div>

                {/* Right side: Preview & Style badging & save action */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  
                  {/* Scene Preview */}
                  <div className="card" style={{ padding: "0.75rem 0.85rem", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                      Scene Preview
                    </span>

                    {/* Image Box */}
                    <div
                      style={{
                        position: "relative",
                        aspectRatio: "16/9",
                        width: "100%",
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: "6px",
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {activeScene.image_path ? (
                        <img
                          src={`${mediaUrl(activeScene.image_path)}`}
                          alt={`Scene ${activeIdx + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            animation: animationStyle,
                            transformOrigin: "center",
                          }}
                        />
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem", color: "var(--text-muted)" }}>
                          <Image size={24} style={{ opacity: 0.4 }} />
                          <span style={{ fontSize: "0.68rem" }}>Generate media in the next step</span>
                        </div>
                      )}
                    </div>

                    {/* Badges footer */}
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                      <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "12px", background: "rgba(0, 184, 212, 0.1)", color: "var(--accent)", border: "1px solid rgba(0, 184, 212, 0.2)", fontWeight: 600 }}>
                        Visual Style: Futuristic
                      </span>
                      <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.5rem", borderRadius: "12px", background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)", fontWeight: 600 }}>
                        Duration: ~{formatDurationText(calculateDuration(activeScene.narration))} sec
                      </span>
                    </div>

                    {/* Motion Graphic Selector */}
                    <div style={{ marginTop: "0.6rem", borderTop: "1px solid var(--border)", paddingTop: "0.6rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)" }}>
                        Motion Animation (FX)
                      </span>
                      {editingSceneId === activeScene.id ? (
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {[
                             { value: "none", label: "Static 📷" },
                             { value: "zoom_in", label: "Zoom In 🎬" },
                             { value: "zoom_out", label: "Zoom Out 🎬" },
                             { value: "pan_right", label: "Pan Right 🎬" },
                             { value: "pan_left", label: "Pan Left 🎬" },
                             { value: "pan_up", label: "Pan Up 🎬" },
                             { value: "pan_down", label: "Pan Down 🎬" }
                           ].map((opt) => {
                            const active = (sceneEditForm.motion_effect || "none") === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => onEditFormChange({ motion_effect: opt.value })}
                                style={{
                                  flex: 1,
                                  padding: "0.38rem 0.5rem",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  borderRadius: "4px",
                                  border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                                  background: active ? "rgba(255, 0, 60, 0.08)" : "transparent",
                                  color: active ? "var(--primary)" : "var(--text-muted)",
                                  cursor: "pointer",
                                  transition: "all 0.1s ease",
                                }}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.75rem", color: "var(--text)", fontWeight: 600, textTransform: "capitalize", padding: "0.2rem 0" }}>
                          {activeScene.motion_effect === "zoom_in"
                            ? "Slow Zoom In 🎬"
                            : activeScene.motion_effect === "zoom_out"
                            ? "Slow Zoom Out 🎬"
                            : activeScene.motion_effect === "pan_right"
                            ? "Slow Pan Right 🎬"
                            : activeScene.motion_effect === "pan_left"
                            ? "Slow Pan Left 🎬"
                            : activeScene.motion_effect === "pan_up"
                            ? "Slow Pan Up 🎬"
                            : activeScene.motion_effect === "pan_down"
                            ? "Slow Pan Down 🎬"
                            : "Static (No Motion) 📷"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tip banner */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.45rem",
                      alignItems: "start",
                      background: "rgba(0, 184, 212, 0.03)",
                      border: "1px solid rgba(0, 184, 212, 0.15)",
                      borderRadius: "6px",
                      padding: "0.6rem 0.75rem",
                    }}
                  >
                    <Lightbulb size={13} color="var(--accent)" style={{ marginTop: "2px", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      <strong>Tip:</strong> Add more details to your prompts for better AI-generated results.
                    </span>
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "auto" }}>
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete Scene #${activeIdx + 1}?`)) {
                          onRemove(activeScene.id);
                        }
                      }}
                      disabled={!!actionLoading}
                      style={{
                        padding: "0.45rem 1rem",
                        fontSize: "0.78rem",
                        color: "var(--danger)",
                        background: "transparent",
                        border: "1px solid rgba(255, 0, 60, 0.25)",
                        borderRadius: "var(--radius)",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Delete Scene
                    </button>

                    <button
                      className="btn-primary"
                      disabled={
                        !!actionLoading ||
                        (editingSceneId === activeScene.id && !sceneEditForm.narration.trim())
                      }
                      onClick={() => {
                        if (editingSceneId === activeScene.id) {
                          onSaveEdit(activeScene.id);
                        } else {
                          onStartEdit(activeScene);
                        }
                      }}
                      style={{
                        padding: "0.45rem 1.1rem",
                        fontSize: "0.78rem",
                        background: "var(--primary)",
                        color: "white",
                        fontWeight: 600,
                        boxShadow: "0 0 10px rgba(255, 0, 60, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      {editingSceneId === activeScene.id && (actionLoading === `edit-scene-${activeScene.id}` || actionLoading === "edit-scene") ? (
                        "Saving..."
                      ) : (
                        <>
                          <Save size={13} />
                          {editingSceneId === activeScene.id ? "Save Changes" : "Edit Scene"}
                        </>
                      )}
                    </button>
                  </div>

                </div>

              </div>
            )}
          </div>

        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div
          onClick={() => setShowImportModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: "100%",
              maxWidth: 560,
              background: "var(--surface)",
              boxShadow: "var(--shadow)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "1.1rem" }}>Import Scenes</h3>
              <button
                onClick={() => setShowImportModal(false)}
                style={{ background: "transparent", color: "var(--text-muted)", fontSize: "1.1rem" }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Upload a <strong>JSON</strong> or <strong>Text</strong> file, or
              paste your scenes text/JSON directly into the box below.
            </p>

            <div style={{ marginBottom: "0.75rem" }}>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,.txt,.csv"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
              <button
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.4rem", width: "100%", justifyContent: "center" }}
              >
                <FileText size={14} /> Upload Scenes File (.json / .txt)
              </button>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Paste scenes JSON or text list here:\n\n[{"narration": "First scene narration", "image_prompt": "Prompt for image", "video_prompt": "Prompt for video"}]\n\nOR\n\n1. Scene narration one\n2. Scene narration two`}
              rows={6}
              style={{ width: "100%", fontSize: "0.8rem", marginBottom: "0.75rem" }}
            />

            {importText.trim() && (
              <div style={{ fontSize: "0.8rem", color: "var(--accent)", marginBottom: "0.75rem", fontWeight: 600 }}>
                <Check size={13} style={{ verticalAlign: "-2px" }} /> Detected {parsedImportScenes.length} scene
                {parsedImportScenes.length !== 1 ? "s" : ""} ready to import
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem", fontSize: "0.8rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="importOption"
                  checked={importReplace}
                  onChange={() => setImportReplace(true)}
                />
                Replace existing scenes
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="importOption"
                  checked={!importReplace}
                  onChange={() => setImportReplace(false)}
                />
                Append to scenes
              </label>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setShowImportModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={parsedImportScenes.length === 0 || !!actionLoading}
                onClick={async () => {
                  if (onImportScenes && parsedImportScenes.length > 0) {
                    await onImportScenes(parsedImportScenes, importReplace);
                    setShowImportModal(false);
                    setImportText("");
                  }
                }}
              >
                {actionLoading === "import-scenes" ? "Importing..." : `Import ${parsedImportScenes.length} Scenes`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
