import { useState, useRef, useEffect } from "react";
import {
  Check,
  FileText,
  X,
  Pencil,
  Search,
  Film,
  Image,
  Video,
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
} from "lucide-react";
import type { Scene, Script } from "../../types";
import { api, mediaUrl } from "../../api/client";
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
          narration: String(item.narration || item.text || item.content || "").trim(),
          image_prompt: item.image_prompt || item.prompt ? String(item.image_prompt || item.prompt).trim() : undefined,
          video_prompt: item.video_prompt || item.videoPrompt ? String(item.video_prompt || item.videoPrompt).trim() : undefined,
        }))
        .filter((item) => item.narration.length > 0);
    }
  } catch {}

  const blocks = text.split(/(?:^|\n)(?=Scene\s+\d+[:\s]|---)/i).filter((b) => b.trim().length > 0);
  if (blocks.length > 0) {
    const result: { narration: string; image_prompt?: string; video_prompt?: string }[] = [];
    for (const block of blocks) {
      const narrationMatch = block.match(/(?:Narration|Text):\s*(.*?)(?=\n(?:Prompt|Video Prompt|Image Prompt):|$)/is);
      const promptMatch = block.match(/(?:Prompt|Image Prompt):\s*(.*?)(?=\n(?:Video Prompt|Scene\s+\d+|Narration):|$)/is);
      const videoPromptMatch = block.match(/Video Prompt:\s*(.*?)(?=\n(?:Prompt|Image Prompt|Scene\s+\d+|Narration):|$)/is);
      const narration = narrationMatch ? narrationMatch[1].trim() : block.replace(/^Scene\s+\d+[:\s]*/i, "").trim();
      const image_prompt = promptMatch ? promptMatch[1].trim() : undefined;
      const video_prompt = videoPromptMatch ? videoPromptMatch[1].trim() : undefined;
      if (narration) result.push({ narration, image_prompt, video_prompt });
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
  sceneEditForm: { narration: string; image_prompt: string; video_prompt: string; motion_effect: string; duration_seconds: number | null };
  onEditFormChange: (patch: Partial<{ narration: string; image_prompt: string; video_prompt: string; motion_effect: string; duration_seconds: number | null }>) => void;
  onStartEdit: (scene: Scene) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onRemove: (id: number) => void;
  onImportScenes?: (importedList: { narration: string; image_prompt?: string; video_prompt?: string }[], replace: boolean) => void;
  projectName?: string;
}

export default function ScenesStep({
  projectId, projectLanguage, projectRatio,
  scenes, activeScript, actionLoading, sceneCount, onSceneCountChange,
  onGenerate, onClearAll, addingScene, addSceneAt, newSceneNarration,
  onNewSceneNarration, onAddScene, onOpenAdd, onAddBlank, onCloseAdd, editingSceneId,
  sceneEditForm, onEditFormChange, onStartEdit, onCancelEdit, onSaveEdit,
  onRemove, onImportScenes, projectName = "project",
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
  const [searchQuery, setSearchQuery] = useState("");
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
  const filteredScenes = scenes.filter((s) => s.narration.toLowerCase().includes(searchQuery.toLowerCase()));
  const getDuration = (scene: Scene) => scene.duration_seconds;
  const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  const currentEffect = activeScene
    ? editingSceneId === activeScene.id ? sceneEditForm.motion_effect : (activeScene.motion_effect || "none")
    : "none";
  const animationStyle =
    currentEffect === "zoom_in" ? "scene-zoom-in 10s ease-in-out infinite alternate"
    : currentEffect === "zoom_out" ? "scene-zoom-out 10s ease-in-out infinite alternate"
    : currentEffect === "pan_right" ? "scene-pan-right 12s ease-in-out infinite alternate"
    : currentEffect === "pan_left" ? "scene-pan-left 12s ease-in-out infinite alternate"
    : currentEffect === "pan_up" ? "scene-pan-up 12s ease-in-out infinite alternate"
    : currentEffect === "pan_down" ? "scene-pan-down 12s ease-in-out infinite alternate"
    : "none";

  const sceneForm = (position: number | null) => {
    if (!addingScene || addSceneAt !== position) return null;
    const label = addSceneAt == null ? "Add scene at end" : addSceneAt === 1 ? "Insert at top" : `Insert after scene #${addSceneAt - 1}`;
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.6rem", display: "grid", gap: "0.35rem", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
        <textarea value={newSceneNarration} onChange={(e) => onNewSceneNarration(e.target.value)} placeholder="Narration text..." rows={2} style={{ width: "100%", fontSize: "0.78rem" }} />
        <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onCloseAdd} style={{ padding: "0.2rem 0.5rem", fontSize: "0.72rem" }}>Cancel</button>
          <button className="btn-primary" disabled={!newSceneNarration.trim() || !!actionLoading} onClick={onAddScene} style={{ padding: "0.2rem 0.6rem", fontSize: "0.72rem" }}>
            {actionLoading === "add-scene" ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", height: "100%", overflow: "hidden" }}>
      <style>{`
        @keyframes scene-zoom-in { 0% { transform: scale(1); } 100% { transform: scale(1.2); } }
        @keyframes scene-zoom-out { 0% { transform: scale(1.2); } 100% { transform: scale(1); } }
        @keyframes scene-pan-right { 0% { transform: scale(1.2) translateX(-4%); } 100% { transform: scale(1.2) translateX(4%); } }
        @keyframes scene-pan-left { 0% { transform: scale(1.2) translateX(4%); } 100% { transform: scale(1.2) translateX(-4%); } }
        @keyframes scene-pan-up { 0% { transform: scale(1.2) translateY(4%); } 100% { transform: scale(1.2) translateY(-4%); } }
        @keyframes scene-pan-down { 0% { transform: scale(1.2) translateY(-4%); } 100% { transform: scale(1.2) translateY(4%); } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Scenes ({scenes.length})</h2>
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn-primary" disabled={!!actionLoading || !activeScript} onClick={onGenerate} style={{ padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}>
            {actionLoading === "scenes" ? "Generating..." : <><Sparkles size={12} /> Generate</>}
          </button>
          <input type="number" min={1} max={30} value={sceneCount} onChange={(e) => onSceneCountChange(e.target.value)} placeholder="Auto" title="Scene count" style={{ width: "3rem", textAlign: "center", padding: "0.28rem 0.25rem", fontSize: "0.75rem" }} />
          <button className="btn-accent" disabled={!!actionLoading} onClick={() => onOpenAdd(null)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>
            <Plus size={12} /> Add
          </button>
          <button className="btn-secondary" disabled={!!actionLoading} onClick={() => onAddBlank?.()} title="Add a blank scene (fill in later)" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>
            <Plus size={12} /> Blank
          </button>
          <button className="btn-secondary" onClick={() => setShowFreeAI(!showFreeAI)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>
            {showFreeAI ? "Hide Free AI" : "Free AI"}
          </button>
          <button className="btn-secondary" onClick={() => setShowImportModal(true)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.2rem" }}>
            <Upload size={12} /> Import
          </button>

          <div ref={menuRef} style={{ position: "relative" }}>
            <button className="btn-secondary" disabled={scenes.length === 0} onClick={() => setShowMenu(!showMenu)} style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}>
              <MoreHorizontal size={14} />
            </button>
            {showMenu && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: "4px", zIndex: 100, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", width: 200, padding: "0.25rem", display: "grid", gap: "2px" }}>
                <button onClick={() => { navigator.clipboard.writeText(scenes.map((s, i) => `${i + 1}. ${s.image_prompt || s.narration}`).join("\n\n")); setCopiedAllType("prompts"); setShowMenu(false); setTimeout(() => setCopiedAllType(null), 2000); }} style={{ textAlign: "left", background: "transparent", padding: "0.35rem 0.5rem", fontSize: "0.72rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.35rem", borderRadius: "4px" }}>
                  <Copy size={12} /> {copiedAllType === "prompts" ? "Copied!" : "Copy All Prompts"}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(scenes.map((s) => `Scene ${s.order_index}:\nNarration: ${s.narration}${s.image_prompt ? `\nPrompt: ${s.image_prompt}` : ""}${s.video_prompt ? `\nVideo: ${s.video_prompt}` : ""}`).join("\n\n---\n\n")); setCopiedAllType("full"); setShowMenu(false); setTimeout(() => setCopiedAllType(null), 2000); }} style={{ textAlign: "left", background: "transparent", padding: "0.35rem 0.5rem", fontSize: "0.72rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.35rem", borderRadius: "4px" }}>
                  <Copy size={12} /> {copiedAllType === "full" ? "Copied!" : "Copy All Text"}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(scenes.map((s) => ({ order_index: s.order_index, narration: s.narration, image_prompt: s.image_prompt, video_prompt: s.video_prompt })), null, 2)); setCopiedAllType("json"); setShowMenu(false); setTimeout(() => setCopiedAllType(null), 2000); }} style={{ textAlign: "left", background: "transparent", padding: "0.35rem 0.5rem", fontSize: "0.72rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.35rem", borderRadius: "4px" }}>
                  <Copy size={12} /> {copiedAllType === "json" ? "Copied!" : "Copy All JSON"}
                </button>
                <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
                <button onClick={() => { const j = JSON.stringify(scenes.map((s) => ({ order_index: s.order_index, narration: s.narration, image_prompt: s.image_prompt, video_prompt: s.video_prompt })), null, 2); downloadFile(j, `scenes-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`, "application/json"); setShowMenu(false); }} style={{ textAlign: "left", background: "transparent", padding: "0.35rem 0.5rem", fontSize: "0.72rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.35rem", borderRadius: "4px" }}>
                  <Download size={12} /> Export JSON
                </button>
                <button onClick={() => { const t = scenes.map((s) => `Scene ${s.order_index}:\nNarration: ${s.narration}${s.image_prompt ? `\nPrompt: ${s.image_prompt}` : ""}${s.video_prompt ? `\nVideo: ${s.video_prompt}` : ""}`).join("\n\n---\n\n"); downloadFile(t, `scenes-${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`, "text/plain"); setShowMenu(false); }} style={{ textAlign: "left", background: "transparent", padding: "0.35rem 0.5rem", fontSize: "0.72rem", color: "var(--text)", display: "flex", alignItems: "center", gap: "0.35rem", borderRadius: "4px" }}>
                  <Download size={12} /> Export Text
                </button>

                <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
                <button disabled={!!actionLoading} onClick={() => { onClearAll(); setShowMenu(false); }} style={{ textAlign: "left", background: "transparent", padding: "0.35rem 0.5rem", fontSize: "0.72rem", color: "var(--danger)", display: "flex", alignItems: "center", gap: "0.35rem", borderRadius: "4px" }}>
                  <Trash2 size={12} /> Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showFreeAI && (
        <FreeAIGuide
          title="Generate Scenes with Free AI"
          prompt={dynamicPrompt ? undefined : `SYSTEM PROMPT:\nYou are a video director. Break scripts into scenes as JSON.\nEach scene has a "narration", an "image_prompt", and a "video_prompt".\n\nUSER PROMPT:\nBreak this script into scenes. Each scene needs narration, image prompt, and video prompt.\nReturn JSON: {"scenes": [{"narration": "...", "image_prompt": "...", "video_prompt": "..."}]}`}
          promptPair={dynamicPrompt || undefined}
          responsePlaceholder='Paste AI response here...'
          onParseResponse={(text) => {
            if (!onImportScenes) return;
            try {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const sceneList = parsed.scenes || parsed;
                if (Array.isArray(sceneList)) {
                  const sc = sceneList.map((s: any) => ({ narration: s.narration || "", image_prompt: s.image_prompt || "", video_prompt: s.video_prompt || "" })).filter((s: any) => s.narration);
                  if (sc.length > 0) onImportScenes(sc, false);
                }
              }
            } catch {}
          }}
        />
      )}

      {scenes.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", borderRadius: "8px", padding: "1.5rem" }}>
          <Film size={28} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "0.5rem" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", margin: "0 0 0.6rem" }}>No scenes yet. Generate from your script or add manually.</p>
          <button className="btn-primary" disabled={!!actionLoading || !activeScript} onClick={onGenerate} style={{ padding: "0.35rem 0.8rem", fontSize: "0.78rem" }}>
            <Sparkles size={13} /> Generate from Script
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", minHeight: 0, overflow: "hidden" }}>
          {/* ── Left: Sidebar ── */}
          <div style={{ width: "100%", height: "180px", minHeight: "180px", flexShrink: 0, border: "1px solid var(--border)", borderRadius: "6px", display: "flex", flexDirection: "column", background: "var(--surface)", overflow: "hidden" }}>
            <div style={{ padding: "0.4rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Search size={12} color="var(--text-muted)" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ border: "none", background: "transparent", outline: "none", fontSize: "0.72rem", color: "var(--text)", width: "100%", padding: 0 }} />
              {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}><X size={11} color="var(--text-muted)" /></button>}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredScenes.map((scene) => {
                const idx = scenes.findIndex((s) => s.id === scene.id);
                const active = idx === activeIdx;
                return (
                  <button key={scene.id} onClick={() => setActiveIdx(idx)} style={{
                    display: "flex", alignItems: "center", gap: "0.4rem", width: "100%",
                    background: active ? "rgba(62, 166, 255, 0.08)" : "transparent",
                    border: "none", borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                    padding: "0.4rem 0.5rem", textAlign: "left", cursor: "pointer", transition: "all 0.1s",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0,
                      background: active ? "var(--accent)" : "rgba(255,255,255,0.06)", color: active ? "#000" : "var(--text-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "0.72rem", margin: 0, color: "var(--text)", fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {scene.narration}
                      </p>
                    </div>
                    <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", flexShrink: 0 }}>{getDuration(scene) != null ? fmtDuration(getDuration(scene)!) : "—"}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => onOpenAdd(null)} disabled={!!actionLoading} style={{ width: "100%", background: "transparent", border: "none", borderTop: "1px solid var(--border)", color: "var(--text-muted)", padding: "0.4rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
              <Plus size={12} /> Add Scene
            </button>
          </div>

          {/* ── Right: Editor ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: 0, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Scene {activeIdx + 1} / {scenes.length}</span>
              
              {/* Toolbar Actions */}
              {activeScene && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  {editingSceneId === activeScene.id ? (
                    <>
                      <button
                        className="btn-primary"
                        disabled={!!actionLoading || !sceneEditForm.narration.trim()}
                        onClick={() => onSaveEdit(activeScene.id)}
                        style={{ padding: "0.2rem 0.45rem", fontSize: "0.68rem", display: "flex", alignItems: "center", gap: "0.2rem" }}
                      >
                        <Check size={11} /> Save
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={onCancelEdit}
                        style={{ padding: "0.2rem 0.45rem", fontSize: "0.68rem", display: "flex", alignItems: "center", gap: "0.2rem" }}
                      >
                        <X size={11} /> Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-secondary"
                        onClick={() => onStartEdit(activeScene)}
                        disabled={!!actionLoading}
                        style={{ padding: "0.2rem 0.45rem", fontSize: "0.68rem", display: "flex", alignItems: "center", gap: "0.2rem" }}
                      >
                        <Pencil size={11} /> Edit
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => { if (window.confirm(`Delete Scene #${activeIdx + 1}?`)) onRemove(activeScene.id); }}
                        disabled={!!actionLoading}
                        style={{ padding: "0.2rem 0.45rem", fontSize: "0.68rem", color: "var(--danger)", borderColor: "rgba(255,0,0,0.15)", display: "flex", alignItems: "center", gap: "0.2rem" }}
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </>
                  )}

                  <span style={{ color: "var(--border)", fontSize: "0.75rem", margin: "0 0.15rem" }}>|</span>
                  
                  <div style={{ display: "flex", gap: "0.15rem" }}>
                    <button className="btn-secondary" disabled={activeIdx <= 0} onClick={() => setActiveIdx(activeIdx - 1)} style={{ padding: "0.1rem 0.3rem" }}><ChevronLeft size={12} /></button>
                    <button className="btn-secondary" disabled={activeIdx >= scenes.length - 1} onClick={() => setActiveIdx(activeIdx + 1)} style={{ padding: "0.1rem 0.3rem" }}><ChevronRight size={12} /></button>
                  </div>
                </div>
              )}
            </div>

            {sceneForm(null)}

            {activeScene && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", flex: 1, minHeight: 0 }}>
                {/* Left: Content */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {/* Narration */}
                  <div style={{ padding: "0.5rem 0.65rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Narration</span>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button onClick={() => copy(activeScene.id, activeScene.narration, setCopiedId)} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.1rem 0.35rem", fontSize: "0.65rem", color: copiedId === activeScene.id ? "var(--success)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.15rem" }}>
                          <Copy size={10} /> {copiedId === activeScene.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                    {editingSceneId === activeScene.id ? (
                      <textarea value={sceneEditForm.narration} onChange={(e) => onEditFormChange({ narration: e.target.value })} rows={3} style={{ width: "100%", fontSize: "0.8rem", lineHeight: 1.45 }} />
                    ) : (
                      <p style={{ fontSize: "0.82rem", lineHeight: 1.45, margin: 0, color: "var(--text)" }}>{activeScene.narration}</p>
                    )}
                  </div>

                  {/* Image Prompt */}
                  <div style={{ padding: "0.45rem 0.65rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.15rem" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.2rem" }}><Image size={11} /> Image Prompt</span>
                      <button onClick={() => copy(activeScene.id, activeScene.image_prompt || "", setCopiedImageId)} disabled={!activeScene.image_prompt} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.1rem 0.35rem", fontSize: "0.65rem", color: copiedImageId === activeScene.id ? "var(--success)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <Copy size={10} /> {copiedImageId === activeScene.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                    {editingSceneId === activeScene.id ? (
                      <textarea value={sceneEditForm.image_prompt} onChange={(e) => onEditFormChange({ image_prompt: e.target.value })} rows={2} placeholder="Image prompt..." style={{ width: "100%", fontSize: "0.75rem", fontStyle: "italic" }} />
                    ) : (
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic", lineHeight: 1.4 }}>{activeScene.image_prompt || "—"}</p>
                    )}
                  </div>

                  {/* Video Prompt */}
                  <div style={{ padding: "0.45rem 0.65rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.15rem" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.2rem" }}><Video size={11} /> Video Prompt</span>
                      <button onClick={() => copy(activeScene.id, activeScene.video_prompt || "", setCopiedVideoId)} disabled={!activeScene.video_prompt} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: "3px", padding: "0.1rem 0.35rem", fontSize: "0.65rem", color: copiedVideoId === activeScene.id ? "var(--success)" : "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.15rem" }}>
                        <Copy size={10} /> {copiedVideoId === activeScene.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                    {editingSceneId === activeScene.id ? (
                      <textarea value={sceneEditForm.video_prompt} onChange={(e) => onEditFormChange({ video_prompt: e.target.value })} rows={2} placeholder="Video motion prompt..." style={{ width: "100%", fontSize: "0.75rem", fontStyle: "italic" }} />
                    ) : (
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0, fontStyle: "italic", lineHeight: 1.4 }}>{activeScene.video_prompt || "—"}</p>
                    )}
                  </div>
                </div>

                {/* Right: Preview & Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {/* Preview */}
                  <div style={{ position: "relative", aspectRatio: "16/9", width: "100%", background: "rgba(0,0,0,0.2)", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {activeScene.image_path ? (
                      <img src={mediaUrl(activeScene.image_path)} alt={`Scene ${activeIdx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", animation: animationStyle, transformOrigin: "center" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", color: "var(--text-muted)" }}>
                        <Image size={20} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: "0.65rem" }}>No media yet</span>
                      </div>
                    )}
                  </div>

                  {/* Duration badge — editable */}
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <label
                      title="Scene duration in seconds — you control this; the renderer fades voice out if narration is longer"
                      style={{ fontSize: "0.62rem", padding: "0.12rem 0.4rem", borderRadius: "10px", background: "rgba(62, 166, 255, 0.08)", color: "var(--accent)", border: "1px solid rgba(62, 166, 255, 0.15)", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem", cursor: "text" }}
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
                        style={{ width: 44, background: "transparent", border: "none", outline: "none", color: "inherit", font: "inherit", fontWeight: 600, padding: 0, textAlign: "center" }}
                      />
                      s
                    </label>
                  </div>


                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div onClick={() => setShowImportModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 500, background: "var(--surface)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <h3 style={{ fontSize: "0.95rem" }}>Import Scenes</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "0 0 0.5rem" }}>Upload a JSON/TXT file or paste directly below.</p>
            <input type="file" ref={fileInputRef} accept=".json,.txt,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setImportText(ev.target?.result as string); r.readAsText(f); }} style={{ display: "none" }} />
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} style={{ fontSize: "0.75rem", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", marginBottom: "0.5rem" }}>
              <FileText size={13} /> Upload File
            </button>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='[{"narration": "...", "image_prompt": "..."}]' rows={5} style={{ width: "100%", fontSize: "0.75rem", marginBottom: "0.5rem" }} />
            {importText.trim() && (
              <div style={{ fontSize: "0.75rem", color: "var(--accent)", marginBottom: "0.5rem", fontWeight: 600 }}>
                <Check size={12} /> {parseImportedText(importText).length} scene(s) detected
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.6rem", fontSize: "0.75rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                <input type="radio" name="importOption" checked={importReplace} onChange={() => setImportReplace(true)} /> Replace
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                <input type="radio" name="importOption" checked={!importReplace} onChange={() => setImportReplace(false)} /> Append
              </label>
            </div>
            <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setShowImportModal(false)} style={{ fontSize: "0.75rem" }}>Cancel</button>
              <button className="btn-primary" disabled={parseImportedText(importText).length === 0 || !!actionLoading} onClick={async () => { if (onImportScenes) { await onImportScenes(parseImportedText(importText), importReplace); setShowImportModal(false); setImportText(""); } }} style={{ fontSize: "0.75rem" }}>
                {actionLoading === "import-scenes" ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
