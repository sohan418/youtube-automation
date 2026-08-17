import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Download,
  Upload,
  FileText,
  X,
  Clipboard,
  Braces,
  Pencil,
} from "lucide-react";
import type { Scene, Script } from "../../types";

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
  };
  onEditFormChange: (
    patch: Partial<{
      narration: string;
      image_prompt: string;
      video_prompt: string;
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
  ) => Promise<void>;
  projectName?: string;
}

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
}: Props) {
  const [copiedPromptId, setCopiedPromptId] = useState<number | null>(null);
  const [copiedAllType, setCopiedAllType] = useState<
    "prompts" | "full" | "json" | null
  >(null);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importReplace, setImportReplace] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

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
    const textToCopy = scene.image_prompt || scene.narration;
    if (!textToCopy) return;
    const prefix = scene.image_prompt ? "Generate an image: " : "";
    navigator.clipboard.writeText(prefix + textToCopy);
    setCopiedPromptId(scene.id);
    setTimeout(() => setCopiedPromptId(null), 2000);
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
  const sceneForm = (position: number | null) => {
    if (!addingScene || addSceneAt !== position) return null;
    const label =
      addSceneAt == null
        ? "Adding new scene at the end"
        : addSceneAt === 1
          ? "Inserting new scene at the top"
          : `Inserting new scene after scene #${addSceneAt - 1}`;
    return (
      <div className="card" style={{ background: "var(--bg)" }}>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginBottom: "0.4rem",
          }}
        >
          {label}
        </p>
        <textarea
          value={newSceneNarration}
          onChange={(e) => onNewSceneNarration(e.target.value)}
          placeholder="Enter the narration (voice-over text) for this scene..."
          rows={3}
          style={{ width: "100%", marginBottom: "0.5rem" }}
        />
        <div
          style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}
        >
          <button className="btn-secondary" onClick={onCloseAdd}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!newSceneNarration.trim() || !!actionLoading}
            onClick={onAddScene}
          >
            {actionLoading === "add-scene" ? "Adding..." : "Add Scene"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.6rem",
          flexWrap: "wrap",
          gap: "0.4rem",
        }}
      >
        <h3 style={{ fontSize: "1.05rem" }}>Scenes ({scenes.length})</h3>
        <div
          style={{
            display: "flex",
            gap: "0.35rem",
            alignItems: "center",
            flexWrap: "wrap",
            position: "relative",
          }}
        >
          <button
            className="btn-accent"
            disabled={!!actionLoading || !activeScript}
            onClick={onGenerate}
            style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem" }}
          >
            {actionLoading === "scenes" ? (
              "Generating..."
            ) : (
              <>
                <Sparkles size={13} style={{ verticalAlign: "middle" }} />{" "}
                Generate Scenes
              </>
            )}
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
              padding: "0.3rem 0.35rem",
              fontSize: "0.78rem",
            }}
          />

          <button
            className="btn-primary"
            disabled={!!actionLoading}
            onClick={() => onOpenAdd(null)}
            style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem" }}
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
                padding: "0.3rem 0.6rem",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                borderColor: copiedAllType ? "var(--success)" : undefined,
                color: copiedAllType ? "var(--success)" : undefined,
              }}
            >
              {copiedAllType ? (
                <>
                  <Check size={12} /> Copied All!
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy All ▾
                </>
              )}
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
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.75rem",
                    color: "var(--text)",
                  }}
                >
                  <Clipboard size={14} style={{ verticalAlign: "-2px" }} />{" "}
                  <strong>Copy All Image Prompts</strong> (for
                  Midjourney/DALL-E)
                </button>
                <button
                  onClick={handleCopyAllFull}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.75rem",
                    color: "var(--text)",
                  }}
                >
                  <FileText size={14} style={{ verticalAlign: "-2px" }} />{" "}
                  <strong>Copy All Scenes & Text</strong>
                </button>
                <button
                  onClick={handleCopyAllJson}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.75rem",
                    color: "var(--text)",
                  }}
                >
                  <Braces size={13} style={{ verticalAlign: "-2px" }} />{" "}
                  <strong>Copy Raw JSON</strong>
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
              style={{
                padding: "0.3rem 0.6rem",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <Download size={12} /> Export ▾
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
                  width: 170,
                  padding: "0.3rem",
                  display: "grid",
                  gap: "0.25rem",
                }}
              >
                <button
                  onClick={handleExportJson}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.75rem",
                    color: "var(--text)",
                  }}
                >
                  📁 Export JSON (.json)
                </button>
                <button
                  onClick={handleExportTxt}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.75rem",
                    color: "var(--text)",
                  }}
                >
                  <FileText size={14} style={{ verticalAlign: "-2px" }} />{" "}
                  <strong>Export Text (.txt)</strong>
                </button>
              </div>
            )}
          </div>

          {/* Import Button */}
          <button
            className="btn-secondary"
            disabled={!!actionLoading}
            onClick={() => setShowImportModal(true)}
            style={{
              padding: "0.3rem 0.6rem",
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
            title="Import scenes from JSON or Text file"
          >
            <Upload size={12} /> Import
          </button>

          <button
            className="btn-secondary"
            disabled={!!actionLoading || scenes.length === 0}
            onClick={onClearAll}
            style={{
              color: "var(--danger)",
              padding: "0.3rem 0.6rem",
              fontSize: "0.78rem",
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {scenes.length === 0 ? (
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Generate a script first, then break it into scenes, or click{" "}
            <strong>Import</strong> to load scenes from a file.
          </p>
          {sceneForm(null)}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", minHeight: 320 }}>
          {/* Scene Sidebar */}
          <div
            style={{
              width: 200,
              flexShrink: 0,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              overflowY: "auto",
              background: "var(--bg)",
            }}
          >
            {scenes.map((scene, idx) => (
              <div
                key={scene.id}
                onClick={() => setActiveIdx(idx)}
                style={{
                  padding: "0.5rem 0.6rem",
                  cursor: "pointer",
                  background:
                    idx === activeIdx ? "var(--primary-dim, rgba(100,100,255,0.12))" : "transparent",
                  borderLeft:
                    idx === activeIdx
                      ? "3px solid var(--primary)"
                      : "3px solid transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (idx !== activeIdx)
                    e.currentTarget.style.background = "var(--surface)";
                }}
                onMouseLeave={(e) => {
                  if (idx !== activeIdx)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  <span
                    style={{
                      background:
                        idx === activeIdx ? "var(--primary)" : "var(--border)",
                      color: "#fff",
                      borderRadius: "50%",
                      width: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {scene.order_index}
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: idx === activeIdx ? 600 : 400,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Scene {scene.order_index}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {(scene.narration || "").slice(0, 40)}
                  {(scene.narration || "").length > 40 ? "..." : ""}
                </p>
              </div>
            ))}
            <button
              onClick={() => onOpenAdd(null)}
              disabled={!!actionLoading}
              style={{
                width: "100%",
                border: "none",
                borderTop: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-muted)",
                padding: "0.35rem 0.5rem",
                cursor: "pointer",
                fontSize: "0.72rem",
              }}
            >
              + Add Scene
            </button>
          </div>

          {/* Active Scene Detail */}
          <div style={{ flex: 1, display: "grid", gap: "0.35rem", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                Scene {scenes[activeIdx]?.order_index ?? activeIdx + 1} of{" "}
                {scenes.length}
              </span>
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.72rem",
                  marginLeft: "auto",
                }}
              >
                Use ← / → keys to switch scenes
              </span>
            </div>

            {sceneForm(null)}
            {scenes.map((scene, idx) => {
              if (idx !== activeIdx) return null;
              return (
                <div key={scene.id} style={{ display: "grid", gap: "0.35rem" }}>
                  <div
                    className="card"
                    style={{ background: "var(--bg)", padding: "0.5rem 0.75rem" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.6rem",
                        alignItems: "start",
                      }}
                    >
                      <span
                        style={{
                          background: "var(--primary)",
                          color: "white",
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        {scene.order_index}
                      </span>
                      {editingSceneId === scene.id ? (
                        <div style={{ flex: 1, display: "grid", gap: "0.5rem" }}>
                          <textarea
                            value={sceneEditForm.narration}
                            onChange={(e) =>
                              onEditFormChange({ narration: e.target.value })
                            }
                            rows={3}
                            placeholder="Scene narration"
                            style={{ width: "100%" }}
                          />
                          <textarea
                            value={sceneEditForm.image_prompt}
                            onChange={(e) =>
                              onEditFormChange({ image_prompt: e.target.value })
                            }
                            rows={2}
                            placeholder="Image prompt"
                            style={{ width: "100%", fontStyle: "italic" }}
                          />
                          <textarea
                            value={sceneEditForm.video_prompt}
                            onChange={(e) =>
                              onEditFormChange({ video_prompt: e.target.value })
                            }
                            rows={2}
                            placeholder="Video prompt"
                            style={{ width: "100%", fontStyle: "italic" }}
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              className="btn-secondary"
                              disabled={!!actionLoading}
                              onClick={onCancelEdit}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn-primary"
                              disabled={
                                !!actionLoading || !sceneEditForm.narration.trim()
                              }
                              onClick={() => onSaveEdit(scene.id)}
                            >
                              {actionLoading === `edit-scene-${scene.id}`
                                ? "Saving..."
                                : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ flex: 1 }}>
                            <p
                              onClick={() => onStartEdit(scene)}
                              style={{
                                marginBottom: "0.4rem",
                                cursor: "text",
                                borderRadius: "4px",
                                fontSize: "0.85rem",
                              }}
                              title="Click to edit this scene's text"
                            >
                              {scene.narration}
                            </p>
                            {scene.image_prompt && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <p
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-muted)",
                                    fontStyle: "italic",
                                    flex: 1,
                                  }}
                                >
                                  <strong>Image Prompt:</strong>{" "}
                                  {scene.image_prompt}
                                </p>
                              </div>
                            )}
                            {scene.video_prompt && (
                              <p
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-muted)",
                                  fontStyle: "italic",
                                  marginTop: "0.25rem",
                                }}
                              >
                                <strong>Video Prompt:</strong>{" "}
                                {scene.video_prompt}
                              </p>
                            )}
                          </div>
                          <button
                            className="btn-secondary"
                            onClick={() => handleCopyPrompt(scene)}
                            title="Copy image prompt to generate on Midjourney, Leonardo AI, DALL-E, etc."
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.25rem 0.5rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              color:
                                copiedPromptId === scene.id
                                  ? "var(--success)"
                                  : "var(--text)",
                              borderColor:
                                copiedPromptId === scene.id
                                  ? "var(--success)"
                                  : "var(--border)",
                            }}
                          >
                            {copiedPromptId === scene.id ? (
                              <>
                                <Check size={12} /> Copied
                              </>
                            ) : (
                              <>
                                <Copy size={12} /> Copy Prompt
                              </>
                            )}
                          </button>
                          <button
                            className="btn-secondary"
                            disabled={!!actionLoading}
                            onClick={() => onStartEdit(scene)}
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.25rem 0.5rem",
                            }}
                          >
                            <Pencil size={12} style={{ verticalAlign: "-2px" }} />{" "}
                            Edit
                          </button>
                        </>
                      )}
                      <button
                        title="Remove scene"
                        disabled={!!actionLoading}
                        onClick={() => onRemove(scene.id)}
                        style={{
                          border: "none",
                          background: "var(--surface2, var(--bg))",
                          cursor: "pointer",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          padding: "0.2rem 0.45rem",
                          color: "var(--danger)",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  {sceneForm(scene.order_index + 1)}
                  <button
                    onClick={() => onOpenAdd(scene.order_index + 1)}
                    disabled={!!actionLoading}
                    style={{
                      border: "1px dashed var(--border)",
                      background: "var(--surface)",
                      color: "var(--text-muted)",
                      borderRadius: "var(--radius)",
                      padding: "0.25rem 0.5rem",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                    }}
                  >
                    + Insert scene after #{scene.order_index}
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => onOpenAdd(null)}
              disabled={!!actionLoading}
              style={{
                border: "1px dashed var(--border)",
                background: "var(--surface)",
                color: "var(--text-muted)",
                borderRadius: "var(--radius)",
                padding: "0.25rem 0.5rem",
                cursor: "pointer",
                fontSize: "0.75rem",
              }}
            >
              + Add scene at the end
            </button>
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <h3 style={{ fontSize: "1.1rem" }}>Import Scenes</h3>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: "1.1rem",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: "0.75rem",
              }}
            >
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
                style={{
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <FileText size={14} /> Upload Scenes File (.json / .txt)
              </button>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Paste scenes JSON or text list here:\n\n[{"narration": "First scene narration", "image_prompt": "Prompt for image", "video_prompt": "Prompt for video"}]\n\nOR\n\n1. Scene narration one\n2. Scene narration two`}
              rows={6}
              style={{
                width: "100%",
                fontSize: "0.8rem",
                marginBottom: "0.75rem",
              }}
            />

            {importText.trim() && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--accent)",
                  marginBottom: "0.75rem",
                  fontWeight: 600,
                }}
              >
                <Check size={13} style={{ verticalAlign: "-2px" }} /> Detected{" "}
                {parsedImportScenes.length} scene
                {parsedImportScenes.length !== 1 ? "s" : ""} ready to import
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
                fontSize: "0.8rem",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="importOption"
                  checked={importReplace}
                  onChange={() => setImportReplace(true)}
                />
                Replace existing scenes
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="importOption"
                  checked={!importReplace}
                  onChange={() => setImportReplace(false)}
                />
                Append to scenes
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn-secondary"
                onClick={() => setShowImportModal(false)}
              >
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
                {actionLoading === "import-scenes"
                  ? "Importing..."
                  : `Import ${parsedImportScenes.length} Scenes`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
