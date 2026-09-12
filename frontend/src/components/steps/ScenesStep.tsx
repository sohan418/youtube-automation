import { useState, useRef, useEffect } from "react";
import {
  Check,
  FileText,
  X,
  Pencil,
  Film,
  Image,
  Video,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Upload,
  Download,
  Copy,
  Trash2,
  MoreHorizontal,
  Clock,
  LayoutGrid,
} from "lucide-react";
import type { Scene, Script } from "../../types";
import { api } from "../../api/client";
import StepHeader from "../studio/StepHeader";
import FreeAIGuide from "../editors/FreeAIGuide";
import "./ScenesStep.css";

function parseImportedText(
  text: string,
): { narration: string; image_prompt?: string; video_prompt?: string; sound_effect?: string; transition?: string }[] {
  text = text.trim();
  if (!text) return [];

  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.scenes || data.items || [];
    if (Array.isArray(list) && list.length > 0) {
      return list
        .map((item: any) => ({
          narration: String(item.narration || "").trim(),
          image_prompt: item.image_prompt ? String(item.image_prompt).trim() : undefined,
          video_prompt: item.video_prompt ? String(item.video_prompt).trim() : undefined,
          sound_effect: item.sound_effect ? String(item.sound_effect).trim() : undefined,
          transition: item.transition ? String(item.transition).trim() : undefined,
        }))
        .filter((item) => item.narration.length > 0);
    }
  } catch {}

  const hasSeparators = /(?:^|\n)\s*(?:Scene\s+\d+[:\s]|---)/i.test(text);
  if (hasSeparators) {
    const blocks = text.split(/(?:^|\n)(?=Scene\s+\d+[:\s]|---)/i).filter((b) => b.trim().length > 0);
    const result: { narration: string; image_prompt?: string; video_prompt?: string; sound_effect?: string; transition?: string }[] = [];
    for (const block of blocks) {
      const narrationMatch = block.match(/(?:Narration|Text):\s*(.*?)(?=\n(?:Prompt|Video Prompt|Image Prompt|Sound Effect|Transition):|$)/is);
      const promptMatch = block.match(/(?:Prompt|Image Prompt):\s*(.*?)(?=\n(?:Video Prompt|Sound Effect|Transition|Scene\s+\d+|Narration):|$)/is);
      const videoPromptMatch = block.match(/Video Prompt:\s*(.*?)(?=\n(?:Prompt|Image Prompt|Sound Effect|Transition|Scene\s+\d+|Narration):|$)/is);
      const soundEffectMatch = block.match(/Sound Effect:\s*(.*?)(?=\n(?:Prompt|Image Prompt|Video Prompt|Transition|Scene\s+\d+|Narration):|$)/is);
      const transitionMatch = block.match(/Transition:\s*(.*?)(?=\n(?:Prompt|Image Prompt|Video Prompt|Sound Effect|Scene\s+\d+|Narration):|$)/is);
      const narration = narrationMatch ? narrationMatch[1].trim() : block.replace(/^Scene\s+\d+[:\s]*/i, "").trim();
      const image_prompt = promptMatch ? promptMatch[1].trim() : undefined;
      const video_prompt = videoPromptMatch ? videoPromptMatch[1].trim() : undefined;
      const sound_effect = soundEffectMatch ? soundEffectMatch[1].trim() : undefined;
      const transition = transitionMatch ? transitionMatch[1].trim() : undefined;
      if (narration) result.push({ narration, image_prompt, video_prompt, sound_effect, transition });
    }
    if (result.length > 0) return result;
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => ({ narration: line.replace(/^\d+[\.\)]\s*/, "") }));
}

interface Props {
  projectId: number;
  projectLanguage?: string;
  projectRatio?: string;
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
  onAddBlank?: () => void;
  onCloseAdd: () => void;
  editingSceneId: number | null;
  sceneEditForm: { narration: string; image_prompt: string; video_prompt: string; sound_effect?: string; transition?: string; motion_effect: string; duration_seconds: number | null };
  onEditFormChange: (patch: Partial<{ narration: string; image_prompt: string; video_prompt: string; sound_effect?: string; transition?: string; motion_effect: string; duration_seconds: number | null }>) => void;
  onStartEdit: (scene: Scene) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onRemove: (id: number) => void;
  onImportScenes?: (importedList: { narration: string; image_prompt?: string; video_prompt?: string }[], replace: boolean) => void;
  projectName?: string;
  onCollapse?: () => void;
}

export default function ScenesStep({
  projectId, projectLanguage, projectRatio,
  scenes, activeScript, actionLoading, sceneCount, onSceneCountChange,
  onGenerate, onClearAll, addingScene, addSceneAt, newSceneNarration,
  onNewSceneNarration, onAddScene, onOpenAdd, onAddBlank, onCloseAdd, editingSceneId,
  sceneEditForm, onEditFormChange, onStartEdit, onCancelEdit, onSaveEdit,
  onRemove, onImportScenes, projectName = "project", onCollapse,
}: Props) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedImageId, setCopiedImageId] = useState<number | null>(null);
  const [copiedVideoId, setCopiedVideoId] = useState<number | null>(null);
  const [copiedAllType, setCopiedAllType] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showFreeAI, setShowFreeAI] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importReplace, setImportReplace] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"single" | "grid">("single");
  const menuRef = useRef<HTMLDivElement>(null);
  const [dynamicPrompt, setDynamicPrompt] = useState<{ system: string; user: string } | null>(null);

  useEffect(() => {
    if (!showFreeAI) return;
    api.buildScenesPrompt(projectId, {
      script_body: activeScript?.body || undefined,
      hook: activeScript?.hook || undefined,
      ending: activeScript?.ending || undefined,
      language: projectLanguage || "en",
      ratio: projectRatio || "16:9",
    }).then(setDynamicPrompt).catch(() => {});
  }, [showFreeAI, projectId, projectLanguage, projectRatio, activeScript]);

  useEffect(() => {
    if (scenes.length === 0) setActiveIdx(0);
    else if (activeIdx >= scenes.length) setActiveIdx(scenes.length - 1);
  }, [scenes.length, activeIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft") setActiveIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActiveIdx((i) => Math.min(scenes.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenes.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const copy = (id: number, text: string, setter: (id: number | null) => void) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setter(id);
    setTimeout(() => setter(null), 2000);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const activeScene = scenes[activeIdx];
  const getDuration = (scene: Scene) => scene.duration_seconds;

  const sceneForm = (position: number | null) => {
    if (!addingScene || addSceneAt !== position) return null;
    const label = addSceneAt == null ? "Add scene at end" : addSceneAt === 1 ? "Insert at top" : `Insert after scene #${addSceneAt - 1}`;
    return (
      <div className="scenes-form">
        <span className="scenes-form-label">{label}</span>
        <textarea className="scenes-form-textarea" value={newSceneNarration} onChange={(e) => onNewSceneNarration(e.target.value)} placeholder="Narration text..." rows={2} />
        <div className="scenes-form-actions">
          <button className="btn-secondary scenes-form-btn" onClick={onCloseAdd}>Cancel</button>
          <button className="btn-primary scenes-form-primary-btn" disabled={!newSceneNarration.trim() || !!actionLoading} onClick={onAddScene}>
            {actionLoading === "add-scene" ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="scenes-root">
      <StepHeader title="Scenes" count={scenes.length} onCollapse={onCollapse} />

      <div className="scenes-header-actions">
        {/* View Mode Toggle: Single Scene Focus vs All Scenes Grid */}
        <div style={{ display: "flex", gap: "2px", background: "var(--surface-light, rgba(255,255,255,0.05))", padding: "2px", borderRadius: "6px", border: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setViewMode("single")}
            title="Single Scene Focus View"
            style={{
              padding: "3px 7px",
              borderRadius: "4px",
              border: "none",
              background: viewMode === "single" ? "var(--primary)" : "transparent",
              color: viewMode === "single" ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.7rem",
              fontWeight: viewMode === "single" ? 600 : 400,
            }}
          >
            <Film size={12} /> Single
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            title="All Scenes Grid View"
            style={{
              padding: "3px 7px",
              borderRadius: "4px",
              border: "none",
              background: viewMode === "grid" ? "var(--primary)" : "transparent",
              color: viewMode === "grid" ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.7rem",
              fontWeight: viewMode === "grid" ? 600 : 400,
            }}
          >
            <LayoutGrid size={12} /> All Grid
          </button>
        </div>

        <button className="btn-primary scenes-generate-btn" disabled={!!actionLoading || !activeScript} onClick={onGenerate}>
          {actionLoading === "scenes" ? "Generating..." : <><Sparkles size={12} /> Generate</>}
        </button>
        <input type="number" min={1} max={30} value={sceneCount} onChange={(e) => onSceneCountChange(e.target.value)} placeholder="Auto" title="Scene count" className="scenes-count-input" />
        <button className="btn-accent scenes-add-btn" disabled={!!actionLoading} onClick={() => onOpenAdd(null)}>
          <Plus size={12} /> Add
        </button>
        <button className="btn-secondary scenes-add-btn" disabled={!!actionLoading} onClick={() => onAddBlank?.()} title="Add a blank scene (fill in later)">
          <Plus size={12} /> Blank
        </button>
        <button className="btn-secondary scenes-add-btn" onClick={() => setShowFreeAI(!showFreeAI)}>
          {showFreeAI ? "Hide Free AI" : "Free AI"}
        </button>
        <button className="btn-secondary scenes-add-btn scenes-import-btn" onClick={() => setShowImportModal(true)}>
          <Upload size={12} /> Import
        </button>

        <div ref={menuRef} className="scenes-menu-wrap">
          <button className="btn-secondary scenes-menu-btn" disabled={scenes.length === 0} onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <div className="scenes-menu">
              <button onClick={() => { navigator.clipboard.writeText(scenes.map((s, i) => `${i + 1}. ${s.image_prompt || s.narration}`).join("\n\n")); setCopiedAllType("prompts"); setShowMenu(false); setTimeout(() => setCopiedAllType(null), 2000); }} className="scenes-menu-item">
                <Copy size={12} /> {copiedAllType === "prompts" ? "Copied!" : "Copy All Prompts"}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(scenes.map((s) => `Scene ${s.order_index}:\nNarration: ${s.narration}${s.image_prompt ? `\nPrompt: ${s.image_prompt}` : ""}${s.video_prompt ? `\nVideo: ${s.video_prompt}` : ""}${s.sound_effect ? `\nSound Effect: ${s.sound_effect}` : ""}${s.transition ? `\nTransition: ${s.transition}` : ""}`).join("\n\n---\n\n")); setCopiedAllType("full"); setShowMenu(false); setTimeout(() => setCopiedAllType(null), 2000); }} className="scenes-menu-item">
                <Copy size={12} /> {copiedAllType === "full" ? "Copied!" : "Copy All Text"}
              </button>
              <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(scenes.map((s) => ({ order_index: s.order_index, narration: s.narration, image_prompt: s.image_prompt, video_prompt: s.video_prompt, sound_effect: s.sound_effect, transition: s.transition })), null, 2)); setCopiedAllType("json"); setShowMenu(false); setTimeout(() => setCopiedAllType(null), 2000); }} className="scenes-menu-item">
                <Copy size={12} /> {copiedAllType === "json" ? "Copied!" : "Copy All JSON"}
              </button>
              <div className="scenes-menu-divider" />
              <button onClick={() => { const j = JSON.stringify(scenes.map((s) => ({ order_index: s.order_index, narration: s.narration, image_prompt: s.image_prompt, video_prompt: s.video_prompt, sound_effect: s.sound_effect, transition: s.transition })), null, 2); downloadFile(j, `scenes-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`, "application/json"); setShowMenu(false); }} className="scenes-menu-item">
                <Download size={12} /> Export JSON
              </button>
              <button onClick={() => { const t = scenes.map((s) => `Scene ${s.order_index}:\nNarration: ${s.narration}${s.image_prompt ? `\nPrompt: ${s.image_prompt}` : ""}${s.video_prompt ? `\nVideo: ${s.video_prompt}` : ""}${s.sound_effect ? `\nSound Effect: ${s.sound_effect}` : ""}${s.transition ? `\nTransition: ${s.transition}` : ""}`).join("\n\n---\n\n"); downloadFile(t, `scenes-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`, "text/plain"); setShowMenu(false); }} className="scenes-menu-item">
                <Download size={12} /> Export Text
              </button>

              <div className="scenes-menu-divider" />
              <button disabled={!!actionLoading} onClick={() => { onClearAll(); setShowMenu(false); }} className="scenes-menu-item scenes-menu-item-danger">
                <Trash2 size={12} /> Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {showFreeAI && (
        <FreeAIGuide
          title="Generate Scenes with Free AI"
          prompt={dynamicPrompt ? undefined : `SYSTEM PROMPT:\nYou are a video director. Break scripts into scenes as JSON.\nEach scene has a "narration", an "image_prompt", a "video_prompt", a "sound_effect", and a "transition".\n\nUSER PROMPT:\nBreak this script into scenes. Each scene needs narration, image_prompt, video_prompt, sound_effect, and transition.\nReturn JSON: {"scenes": [{"narration": "...", "image_prompt": "...", "video_prompt": "...", "sound_effect": "...", "transition": "..."}]}`}
          promptPair={dynamicPrompt || undefined}
          responsePlaceholder='Paste AI response here...'
          onParseResponse={(text) => {
            if (!onImportScenes) return;
            try {
              const sc = parseImportedText(text);
              if (sc.length > 0) onImportScenes(sc, false);
            } catch {}
          }}
        />
      )}

      {scenes.length === 0 ? (
        <div className="scenes-empty">
          <Film size={28} className="scenes-empty-icon" />
          <p className="scenes-empty-text">No scenes yet. Generate from your script or add manually.</p>
          <button className="btn-primary scenes-generate-from-script-btn" disabled={!!actionLoading || !activeScript} onClick={onGenerate}>
            <Sparkles size={13} /> Generate from Script
          </button>
        </div>
      ) : (
        <div className="scenes-main">
          {viewMode === "grid" ? (
            <div className="scenes-grid-container" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", overflowY: "auto", flex: 1, paddingRight: "2px" }}>
              {scenes.map((scene, idx) => (
                <div key={scene.id} className="card scenes-grid-card" style={{ padding: "0.85rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "0.35rem", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--primary)" }}>
                      Scene #{scene.order_index ?? idx + 1}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        ⏱ {scene.duration_seconds ? `${scene.duration_seconds.toFixed(1)}s` : "—"}
                      </span>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: "0.7rem", padding: "0.2rem 0.45rem", display: "flex", alignItems: "center", gap: "3px" }}
                        onClick={() => { setActiveIdx(idx); onStartEdit(scene); setViewMode("single"); }}
                      >
                        <Pencil size={11} /> Edit
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: "0.7rem", padding: "0.2rem 0.45rem", color: "var(--danger)" }}
                        onClick={() => { if (window.confirm(`Delete Scene #${idx + 1}?`)) onRemove(scene.id); }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Narration */}
                  <p style={{ fontSize: "0.8rem", color: "var(--text)", margin: 0, lineHeight: 1.45, fontWeight: 500 }}>
                    {scene.narration}
                  </p>

                  {/* Prompts summary if available */}
                  {(scene.image_prompt || scene.video_prompt || scene.sound_effect || scene.transition) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.74rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.03)", padding: "0.4rem 0.6rem", borderRadius: "5px" }}>
                      {scene.image_prompt && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                          <span style={{ color: "#a5b4fc", fontWeight: 600, flexShrink: 0 }}>📷 Image:</span>
                          <span style={{ fontStyle: "italic" }}>{scene.image_prompt}</span>
                        </div>
                      )}
                      {scene.video_prompt && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                          <span style={{ color: "#818cf8", fontWeight: 600, flexShrink: 0 }}>🎬 Video:</span>
                          <span style={{ fontStyle: "italic" }}>{scene.video_prompt}</span>
                        </div>
                      )}
                      {(scene.sound_effect || scene.transition) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.2rem" }}>
                          {scene.sound_effect && (
                            <span style={{ fontSize: "0.7rem", color: "#f472b6", background: "rgba(244,114,182,0.12)", border: "1px solid rgba(244,114,182,0.3)", padding: "0.1rem 0.4rem", borderRadius: "10px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              🎵 {scene.sound_effect}
                            </span>
                          )}
                          {scene.transition && (
                            <span style={{ fontSize: "0.7rem", color: "#38bdf8", background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", padding: "0.1rem 0.4rem", borderRadius: "10px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              🎬 {scene.transition}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenAdd(null)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "2px dashed var(--border)",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} /> Add New Scene
              </button>
            </div>
          ) : (
            /* Single Focus View */
            <div className="scenes-editor">
              <div className="scenes-editor-toolbar">
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={activeIdx <= 0}
                    onClick={() => setActiveIdx(activeIdx - 1)}
                    style={{ padding: "0.25rem 0.45rem", fontSize: "0.72rem" }}
                    title="Previous scene"
                  >
                    <ChevronLeft size={13} />
                  </button>

                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text)" }}>
                    Scene {activeIdx + 1} of {scenes.length}
                  </span>

                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={activeIdx >= scenes.length - 1}
                    onClick={() => setActiveIdx(activeIdx + 1)}
                    style={{ padding: "0.25rem 0.45rem", fontSize: "0.72rem" }}
                    title="Next scene"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
                
                {/* Toolbar Actions */}
                {activeScene && (
                  <div className="scenes-toolbar-actions">
                    {editingSceneId === activeScene.id ? (
                      <>
                        <button
                          className="btn-primary scenes-toolbar-btn"
                          disabled={!!actionLoading || !sceneEditForm.narration.trim()}
                          onClick={() => onSaveEdit(activeScene.id)}
                        >
                          <Check size={11} /> Save
                        </button>
                        <button
                          className="btn-secondary scenes-toolbar-btn"
                          onClick={onCancelEdit}
                        >
                          <X size={11} /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn-secondary scenes-toolbar-btn"
                          onClick={() => onStartEdit(activeScene)}
                          disabled={!!actionLoading}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          className="btn-secondary scenes-toolbar-btn scenes-toolbar-delete-btn"
                          onClick={() => { if (window.confirm(`Delete Scene #${activeIdx + 1}?`)) onRemove(activeScene.id); }}
                          disabled={!!actionLoading}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {sceneForm(null)}

              {activeScene && (
                <div className="scenes-active-body">
                  {/* Left: Content */}
                  <div className="scenes-content">
                    {/* Narration */}
                    <div className="scenes-box">
                      <div className="scenes-box-header">
                        <span className="scenes-box-label">Narration</span>
                        <div className="scenes-box-actions">
                          <button onClick={() => copy(activeScene.id, activeScene.narration, setCopiedId)} className="scenes-copy-btn" style={{ color: copiedId === activeScene.id ? "var(--success)" : "var(--text-muted)" }}>
                            <Copy size={10} /> {copiedId === activeScene.id ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                      {editingSceneId === activeScene.id ? (
                        <textarea className="scenes-narration-textarea" value={sceneEditForm.narration} onChange={(e) => onEditFormChange({ narration: e.target.value })} rows={3} />
                      ) : (
                        <p className="scenes-narration-text">{activeScene.narration}</p>
                      )}
                    </div>

                    {/* Image Prompt */}
                    <div className="scenes-prompt-box">
                      <div className="scenes-prompt-header">
                        <span className="scenes-prompt-label"><Image size={11} /> Image Prompt</span>
                        <button onClick={() => copy(activeScene.id, activeScene.image_prompt || "", setCopiedImageId)} disabled={!activeScene.image_prompt} className="scenes-copy-btn" style={{ color: copiedImageId === activeScene.id ? "var(--success)" : "var(--text-muted)" }}>
                          <Copy size={10} /> {copiedImageId === activeScene.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                      {editingSceneId === activeScene.id ? (
                        <textarea className="scenes-prompt-textarea" value={sceneEditForm.image_prompt} onChange={(e) => onEditFormChange({ image_prompt: e.target.value })} rows={2} placeholder="Image prompt..." />
                      ) : (
                        <p className="scenes-prompt-text">{activeScene.image_prompt || "—"}</p>
                      )}
                    </div>

                    {/* Video Prompt */}
                    <div className="scenes-prompt-box">
                      <div className="scenes-prompt-header">
                        <span className="scenes-prompt-label"><Video size={11} /> Video Prompt</span>
                        <button onClick={() => copy(activeScene.id, activeScene.video_prompt || "", setCopiedVideoId)} disabled={!activeScene.video_prompt} className="scenes-copy-btn" style={{ color: copiedVideoId === activeScene.id ? "var(--success)" : "var(--text-muted)" }}>
                          <Copy size={10} /> {copiedVideoId === activeScene.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                      {editingSceneId === activeScene.id ? (
                        <textarea className="scenes-prompt-textarea" value={sceneEditForm.video_prompt} onChange={(e) => onEditFormChange({ video_prompt: e.target.value })} rows={2} placeholder="Video motion prompt..." />
                      ) : (
                        <p className="scenes-prompt-text">{activeScene.video_prompt || "—"}</p>
                      )}
                    </div>

                    {/* Sound Effect Keywords */}
                    <div className="scenes-prompt-box">
                      <div className="scenes-prompt-header">
                        <span className="scenes-prompt-label"><Volume2 size={11} /> Sound Effect Keywords</span>
                      </div>
                      {editingSceneId === activeScene.id ? (
                        <input className="scenes-prompt-textarea" value={sceneEditForm.sound_effect || ""} onChange={(e) => onEditFormChange({ sound_effect: e.target.value })} placeholder="e.g. whoosh, cash register ping, server beep..." style={{ minHeight: "34px", height: "34px", padding: "0.3rem 0.5rem" }} />
                      ) : (
                        <p className="scenes-prompt-text">{activeScene.sound_effect || "—"}</p>
                      )}
                    </div>

                    {/* Transition Suggestion */}
                    <div className="scenes-prompt-box">
                      <div className="scenes-prompt-header">
                        <span className="scenes-prompt-label"><Sparkles size={11} /> Transition Suggestion</span>
                      </div>
                      {editingSceneId === activeScene.id ? (
                        <select className="scenes-prompt-textarea" value={sceneEditForm.transition || "crossfade"} onChange={(e) => onEditFormChange({ transition: e.target.value })} style={{ minHeight: "34px", height: "34px", padding: "0.3rem 0.5rem", background: "rgba(0,0,0,0.3)", color: "var(--text)" }}>
                          <option value="crossfade">Crossfade (Default)</option>
                          <option value="whip pan">Whip Pan</option>
                          <option value="zoom in">Zoom In</option>
                          <option value="glitch">Glitch</option>
                          <option value="fade black">Fade Black</option>
                          <option value="cut">Direct Cut</option>
                        </select>
                      ) : (
                        <p className="scenes-prompt-text">{activeScene.transition || "crossfade"}</p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="scenes-preview-col" style={{ width: "auto" }}>
                    {/* Duration badge — editable */}
                    <div className="scenes-duration-wrap">
                      <label
                        title="Scene duration in seconds — you control this; the renderer fades voice out if narration is longer"
                        className="scenes-duration-label"
                      >
                        <Clock size={10} />
                        <input
                          type="number"
                          min={0.5}
                          step={0.1}
                          value={
                            editingSceneId === activeScene.id
                              ? sceneEditForm.duration_seconds ?? ""
                              : getDuration(activeScene) ?? ""
                          }
                          placeholder="—"
                          onChange={(e) => {
                            const raw = e.target.value;
                            const v = raw === "" ? null : Number(raw);
                            if (editingSceneId !== activeScene.id) onStartEdit(activeScene);
                            onEditFormChange({ duration_seconds: v });
                          }}
                          onBlur={() => {
                            if (editingSceneId === activeScene.id && sceneEditForm.duration_seconds != null)
                              onSaveEdit(activeScene.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="scenes-duration-input"
                        />
                        s
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div onClick={() => setShowImportModal(false)} className="scenes-modal-overlay">
          <div onClick={(e) => e.stopPropagation()} className="card scenes-modal-card">
            <div className="scenes-modal-header">
              <h3 className="scenes-modal-title">Import Scenes</h3>
              <button onClick={() => setShowImportModal(false)} className="scenes-modal-close"><X size={16} /></button>
            </div>
            <p className="scenes-modal-desc">Upload a JSON/TXT file or paste directly below.</p>
            <input type="file" ref={fileInputRef} accept=".json,.txt,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setImportText(ev.target?.result as string); r.readAsText(f); }} hidden />
            <button className="btn-secondary scenes-upload-btn" onClick={() => fileInputRef.current?.click()}>
              <FileText size={13} /> Upload File
            </button>
            <textarea className="scenes-import-textarea" value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='[{"narration": "...", "image_prompt": "..."}]' rows={5} />
            {importText.trim() && (
              <div className="scenes-detected">
                <Check size={12} /> {parseImportedText(importText).length} scene(s) detected
              </div>
            )}
            <div className="scenes-radio-row">
              <label className="scenes-radio-label">
                <input type="radio" name="importOption" checked={importReplace} onChange={() => setImportReplace(true)} /> Replace
              </label>
              <label className="scenes-radio-label">
                <input type="radio" name="importOption" checked={!importReplace} onChange={() => setImportReplace(false)} /> Append
              </label>
            </div>
            <div className="scenes-modal-actions">
              <button className="btn-secondary scenes-modal-action-btn" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button className="btn-primary scenes-modal-action-btn" disabled={parseImportedText(importText).length === 0 || !!actionLoading} onClick={async () => { if (onImportScenes) { await onImportScenes(parseImportedText(importText), importReplace); setShowImportModal(false); setImportText(""); } }}>
                {actionLoading === "import-scenes" ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
