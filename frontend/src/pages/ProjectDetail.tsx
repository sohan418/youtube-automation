import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUp, ExternalLink, X } from "lucide-react";
import { api, mediaUrl } from "../api/client";
import type {
  ExportResult,
  Idea,
  Project,
  Scene,
  Script,
  SEOCategory,
  SEOMetadata,
  Thumbnail,
  TimelineData,
  VideoStatus,
  VoiceConfig,
  VoiceProvider,
} from "../types";
import ImageCropDialog from "../components/editors/ImageCropDialog";
import VideoTrimDialog from "../components/editors/VideoTrimDialog";
import ProjectSettingsDialog from "../components/editors/ProjectSettingsDialog";
import { STUDIO_STEPS, getDoneMap } from "../components/studio/studioSteps";
import type { StudioStep } from "../components/studio/studioSteps";
import StudioSidebar from "../components/studio/StudioSidebar";
import ToastNotification from "../components/studio/ToastNotification";
import ScenesSidebar from "../components/studio/ScenesSidebar";

import IdeasStep from "../components/steps/IdeasStep";
import ScriptStep from "../components/steps/ScriptStep";
import ScenesStep from "../components/steps/ScenesStep";
import ImagesStep, { buildMediaStrip } from "../components/steps/ImagesStep";
import type { DragMedia, MediaTile } from "../components/steps/ImagesStep";
import VoiceStep from "../components/steps/VoiceStep";
import TimelineStep from "../components/steps/TimelineStep";
import VideoStep from "../components/steps/VideoStep";
import ThumbnailStep from "../components/steps/ThumbnailStep";
import SeoStep from "../components/steps/SeoStep";
import ExportStep from "../components/steps/ExportStep";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [scriptTopic, setScriptTopic] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [seo, setSeo] = useState<SEOMetadata | null>(null);
  const [categories, setCategories] = useState<SEOCategory[]>([]);
  const [activeTab, setActiveTab] = useState<StudioStep>("ideas");
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);

  useEffect(() => {
    setActiveSceneIdx(0);
  }, [activeTab]);

  useEffect(() => {
    if (scenes.length === 0) {
      setActiveSceneIdx(0);
    } else if (activeSceneIdx >= scenes.length) {
      setActiveSceneIdx(scenes.length - 1);
    }
  }, [scenes.length, activeSceneIdx]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [exportInfo, setExportInfo] = useState<ExportResult | null>(null);
  const [voiceProviders, setVoiceProviders] = useState<VoiceProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [selectedVoiceRate, setSelectedVoiceRate] = useState("+0%");
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig | null>(null);
  const [voiceProgress, setVoiceProgress] = useState("");
  const [selectedRatio, setSelectedRatio] = useState("16:9");
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const videoPollRef = useRef<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [imageUrlInputs, setImageUrlInputs] = useState<Record<number, string>>(
    {},
  );
  const [generatingSceneId, setGeneratingSceneId] = useState<number | null>(
    null,
  );
  const [clipboardImageId, setClipboardImageId] = useState<number | null>(null);
  const [dragMedia, setDragMedia] = useState<DragMedia | null>(null);
  const [draggingOverScene, setDraggingOverScene] = useState<number | null>(
    null,
  );
  const [previewMedia, setPreviewMedia] = useState<{
    path: string;
    kind: "image" | "video";
  } | null>(null);
  const [cropFile, setCropFile] = useState<{
    file: File;
    sceneId: number;
  } | null>(null);
  const [trimFile, setTrimFile] = useState<{
    file: File;
    sceneId: number;
  } | null>(null);
  const [addingScene, setAddingScene] = useState(false);
  const [newSceneNarration, setNewSceneNarration] = useState("");
  const [addSceneAt, setAddSceneAt] = useState<number | null>(null);
  const [sceneCount, setSceneCount] = useState("");
  const [ideaTopic, setIdeaTopic] = useState("");
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [sceneEditForm, setSceneEditForm] = useState({
    narration: "",
    image_prompt: "",
    video_prompt: "",
  });
  const [recordingSceneId, setRecordingSceneId] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [audioVersion, setAudioVersion] = useState<Record<number, number>>({});
  const recordingRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const recordingPeakRef = useRef(0);
  const meterActiveRef = useRef(false);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [editingScript, setEditingScript] = useState(false);
  const [creatingScript, setCreatingScript] = useState(false);
  const [scriptForm, setScriptForm] = useState({
    title: "",
    hook: "",
    body: "",
    ending: "",
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("studio_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("studio_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const activeScript: Script | null = scripts.find((s) => s.is_active) ?? null;

  const loadAll = useCallback(
    async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        setError("");
        const [
          proj,
          ideaList,
          scriptList,
          sceneList,
          thumbList,
          seoData,
          categoryList,
        ] = await Promise.all([
          api.getProject(projectId),
          api.listIdeas(projectId),
          api.listScripts(projectId),
          api.listScenes(projectId),
          api.listThumbnails(projectId),
          api.getSEO(projectId),
          api.listSEOCategories(),
        ]);
        Promise.all([
          api.listVoices(proj.language),
          api.getVoiceConfig().catch(() => null),
        ])
          .then(([cat, cfg]) => {
            setVoiceConfig(cfg);
            setVoiceProviders(cat.providers);
            const initial =
              cat.providers.find((p) => p.id === cat.default_provider) ||
              cat.providers[0];
            if (initial) {
              setSelectedProvider((prev) => prev || initial.id);
              setSelectedVoice((prev) =>
                initial.voices.includes(prev) ? prev : initial.default,
              );
            }
          })
          .catch(() => {});
        api
          .getTimeline(projectId)
          .then((t) => {
            setTimeline((prev) => prev ?? t.data);
          })
          .catch(() => {});
        setProject(proj);
        if (proj.ratio) setSelectedRatio(proj.ratio);
        setIdeas(ideaList);
        const selectedIdea = ideaList.find((i) => i.is_selected);
        setScriptTopic((prev) => prev || selectedIdea?.title || proj.name);
        setScripts(scriptList);
        setScenes(sceneList);
        setThumbnails(thumbList);
        setSeo(seoData);
        setCategories(categoryList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    loadAll(true);
  }, [loadAll]);

  useEffect(() => {
    return () => {
      if (videoPollRef.current !== null) {
        window.clearTimeout(videoPollRef.current);
      }
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
      }
      if (recordingRef.current && recordingRef.current.state !== "inactive") {
        recordingRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (!previewMedia) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewMedia(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewMedia]);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const runAction = async (label: string, action: () => Promise<void>) => {
    try {
      setActionLoading(label);
      setError("");
      setSuccess("");
      await action();
      await loadAll(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading("");
    }
  };

  const openSettings = () => {
    setEditingSettings(true);
  };

  const saveSettings = async (
    form: {
      name: string;
      description: string;
      category: string;
      language: string;
      ratio: string;
    },
    keys: {
      sarvam_api_key: string;
      deepgram_api_key: string;
      elevenlabs_api_key: string;
    },
  ) => {
    await runAction("settings", async () => {
      await api.updateProject(projectId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        language: form.language,
        ratio: form.ratio,
      });
      // Save voice API keys if any are typed
      if (
        keys.sarvam_api_key.trim() ||
        keys.deepgram_api_key.trim() ||
        keys.elevenlabs_api_key.trim()
      ) {
        await api.saveVoiceConfig(keys);
        const cfg = await api.getVoiceConfig();
        setVoiceConfig(cfg);
      }
      setEditingSettings(false);
      setSuccess("Project settings saved.");
    });
  };

  const generateIdeas = async () => {
    await runAction("ideas", async () => {
      await api.generateIdeas(projectId, {
        count: 5,
        language: project?.language ?? "en",
        category: project?.category || undefined,
        topic: ideaTopic.trim() || undefined,
      });
      setIdeaTopic("");
      setSuccess("Generated 5 video ideas based on your topic!");
    });
  };

  const selectIdea = async (ideaId: number) => {
    await runAction("select", async () => {
      await api.selectIdea(ideaId);
      setSuccess("Idea selected for script generation");
    });
  };

  const generateScript = async () => {
    await runAction("script", async () => {
      const selectedIdea = ideas.find((i) => i.is_selected);
      const topic =
        scriptTopic.trim() || selectedIdea?.title || project?.name || "";
      await api.generateScript(projectId, {
        idea_id: selectedIdea?.id,
        topic,
        language: project?.language ?? "en",
        target_duration_minutes: 5,
      });
      setSuccess(
        activeScript
          ? "Script regenerated with the new topic!"
          : "Script generated!",
      );
    });
  };

  const openScriptEdit = () => {
    if (!activeScript) return;
    setScriptForm({
      title: activeScript.title,
      hook: activeScript.hook ?? "",
      body: activeScript.body,
      ending: activeScript.ending ?? "",
    });
    setEditingScript(true);
  };

  const saveScript = async () => {
    if (!activeScript || !scriptForm.title.trim() || !scriptForm.body.trim())
      return;
    await runAction("script-save", async () => {
      await api.updateScript(activeScript.id, {
        title: scriptForm.title.trim(),
        hook: scriptForm.hook.trim() || null,
        body: scriptForm.body.trim(),
        ending: scriptForm.ending.trim() || null,
      });
      setEditingScript(false);
      setSuccess("Script updated.");
    });
  };

  const createScript = async () => {
    if (!scriptForm.title.trim() || !scriptForm.body.trim()) return;
    await runAction("script-create", async () => {
      await api.createScript(projectId, {
        title: scriptForm.title.trim(),
        hook: scriptForm.hook.trim() || undefined,
        body: scriptForm.body.trim(),
        ending: scriptForm.ending.trim() || undefined,
        language: project?.language ?? "en",
      });
      setCreatingScript(false);
      setScriptForm({ title: "", hook: "", body: "", ending: "" });
      setSuccess("Script created from your content.");
    });
  };

  const generateAllVoice = async () => {
    setActionLoading("voice");
    setError("");
    setSuccess("");
    setVoiceProgress("");
    try {
      if (scenes.length === 0) {
        throw new Error("No scenes found. Generate scenes first.");
      }
      const provider = voiceProviders.find((p) => p.id === selectedProvider);
      if (!provider) {
        throw new Error("Voice provider not loaded. Refresh the page.");
      }
      if (provider.requires_key && !provider.key_configured) {
        throw new Error(
          `${provider.name} API key is not configured. Add it below.`,
        );
      }
      setVoiceProgress(
        `Generating voice for ${scenes.length} scene(s) with ${provider.name} (${selectedVoice})...`,
      );
      await api.generateAllVoice(
        projectId,
        selectedVoice,
        selectedProvider,
        selectedVoiceRate,
      );
      setVoiceProgress("");
      setSuccess(
        `All voice audio generated with ${provider.name} (${selectedVoice})!`,
      );
      await loadAll();
      setAudioVersion((v) => {
        const next = { ...v };
        for (const scene of scenes) next[scene.id] = (next[scene.id] || 0) + 1;
        return next;
      });
    } catch (err) {
      setVoiceProgress("");
      setError(err instanceof Error ? err.message : "Voice generation failed");
    } finally {
      setActionLoading("");
    }
  };

  const generateSceneVoice = async (sceneId: number) => {
    await runAction(`gen-voice-${sceneId}`, async () => {
      const updated = await api.generateVoice(
        sceneId,
        selectedVoice,
        selectedProvider,
        selectedVoiceRate,
      );
      setScenes((prev) =>
        prev.map((s) =>
          s.id === updated.id
            ? {
                ...s,
                audio_path: updated.audio_path,
                duration_seconds: updated.duration_seconds,
              }
            : s,
        ),
      );
      bumpAudioVersion(updated.id);
      const scene = scenes.find((s) => s.id === sceneId);
      setSuccess(`AI voice generated for scene #${scene?.order_index ?? ""}.`);
    });
  };

  const addSceneImageUrl = async (sceneId: number) => {
    const url = (imageUrlInputs[sceneId] || "").trim();
    if (!url) return;
    try {
      setActionLoading(`url-${sceneId}`);
      setError("");
      setSuccess("");
      await api.addSceneImageUrl(sceneId, url);
      setImageUrlInputs((prev) => ({ ...prev, [sceneId]: "" }));
      setSuccess("Image added from URL.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add image");
    } finally {
      setActionLoading("");
    }
  };

  const handleImageFileSelected = (sceneId: number, file: File) => {
    if (!file) return;
    setCropFile({ file, sceneId });
  };

  const applyImageCrop = async (blob: Blob, name: string) => {
    const target = cropFile;
    setCropFile(null);
    if (!target) return;
    const file = new File([blob], name, { type: blob.type });
    try {
      setActionLoading(`upload-${target.sceneId}`);
      setError("");
      setSuccess("");
      await api.uploadSceneImage(target.sceneId, file);
      setSuccess("Image uploaded.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setActionLoading("");
    }
  };

  const generateSceneImage = async (sceneId: number) => {
    try {
      setGeneratingSceneId(sceneId);
      setError("");
      setSuccess("");
      await api.generateImage(sceneId);
      setSuccess("Image generated for scene.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const handleVideoFileSelected = (sceneId: number, file: File) => {
    if (!file) return;
    setTrimFile({ file, sceneId });
  };

  const applyVideoUpload = async (blob: Blob, name: string) => {
    const target = trimFile;
    setTrimFile(null);
    if (!target) return;
    const file = new File([blob], name, { type: blob.type });
    try {
      setActionLoading(`video-${target.sceneId}`);
      setError("");
      setSuccess("");
      await api.uploadSceneVideo(target.sceneId, file);
      setSuccess("Video clip added to scene.");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload video clip",
      );
    } finally {
      setActionLoading("");
    }
  };

  const removeSceneVideo = async (sceneId: number, videoId: number) => {
    try {
      setActionLoading(`video-del-${videoId}`);
      setError("");
      setSuccess("");
      await api.removeSceneVideo(sceneId, videoId);
      setSuccess("Scene video clip removed.");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove video clip",
      );
    } finally {
      setActionLoading("");
    }
  };

  const removeSceneImage = async (imageId: number) => {
    try {
      setActionLoading(`del-${imageId}`);
      setError("");
      setSuccess("");
      await api.deleteSceneImage(imageId);
      setSuccess("Image removed.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove image");
    } finally {
      setActionLoading("");
    }
  };

  const makePrimaryImage = async (imageId: number) => {
    try {
      setActionLoading(`primary-${imageId}`);
      setError("");
      setSuccess("");
      await api.setPrimarySceneImage(imageId);
      setSuccess("Primary image updated.");
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set primary image",
      );
    } finally {
      setActionLoading("");
    }
  };

  const reorderSceneMedia = async (
    sceneId: number,
    items: { type: "image" | "video"; id: number }[],
  ) => {
    try {
      setActionLoading(`reorder-${sceneId}`);
      setError("");
      setSuccess("");
      await api.reorderSceneMedia(sceneId, items);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder media");
      await loadAll();
    } finally {
      setActionLoading("");
    }
  };

  const copySceneImageTo = async (imageId: number, targetSceneId: number) => {
    try {
      setActionLoading(`copy-${imageId}`);
      setError("");
      setSuccess("");
      await api.copySceneImage(imageId, targetSceneId);
      setSuccess("Image copied to scene.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy image");
    } finally {
      setActionLoading("");
    }
  };

  const pollVideoStatus = useCallback(
    () =>
      new Promise<VideoStatus>((resolve) => {
        const tick = async () => {
          try {
            const st = await api.videoStatus(projectId);
            setVideoStatus(st);
            if (st.running) {
              videoPollRef.current = window.setTimeout(tick, 1000);
            } else {
              resolve(st);
            }
          } catch {
            videoPollRef.current = window.setTimeout(tick, 1000);
          }
        };
        void tick();
      }),
    [projectId],
  );

  const buildVideo = async (options?: {
    timeline?: TimelineData | null;
    ratio?: string;
  }) => {
    await runAction("video", async () => {
      setVideoStatus({
        running: true,
        progress: 0,
        stage: "starting",
        message: "Starting video build...",
        output: null,
        error: null,
        updated_at: null,
      });
      const result = await api.buildVideo(projectId, {
        ratio: options?.ratio ?? selectedRatio,
        timeline: options?.timeline,
      });
      setSuccess(result.message);
      const finalStatus = await pollVideoStatus();
      if (finalStatus.error) {
        throw new Error(finalStatus.error);
      }
      setVideoStatus(null);
      setSuccess(
        finalStatus.output
          ? `Video built successfully → ${finalStatus.output}`
          : "Video built successfully.",
      );
    });
  };

  const addScene = async () => {
    const narration = newSceneNarration.trim();
    if (!narration) return;
    await runAction("add-scene", async () => {
      await api.createScene(projectId, {
        narration,
        order_index: addSceneAt ?? undefined,
      });
      setNewSceneNarration("");
      setAddingScene(false);
      setAddSceneAt(null);
      setSuccess(
        addSceneAt == null
          ? "Scene added at the end."
          : `Scene inserted at position ${addSceneAt}.`,
      );
    });
  };

  const openAddScene = (position: number | null) => {
    setAddSceneAt(position);
    setNewSceneNarration("");
    setAddingScene(true);
  };

  const closeAddScene = () => {
    setAddingScene(false);
    setNewSceneNarration("");
    setAddSceneAt(null);
  };

  const generateScenes = async () => {
    await runAction("scenes", async () => {
      if (
        scenes.length > 0 &&
        !window.confirm(
          `Regenerating scenes will replace all ${scenes.length} existing scenes. Continue?`,
        )
      ) {
        return;
      }
      const count = sceneCount.trim()
        ? parseInt(sceneCount.trim(), 10)
        : undefined;
      await api.generateScenes(projectId, activeScript!.id, count);
      setSceneCount("");
      setSuccess(
        count
          ? `Generated ${count} scenes from script!`
          : "Scenes generated from script!",
      );
    });
  };

  const removeScene = async (sceneId: number) => {
    if (!window.confirm("Delete this scene and all of its images?")) return;
    await runAction(`del-scene-${sceneId}`, async () => {
      await api.deleteScene(sceneId);
      setSuccess("Scene removed.");
    });
  };

  const openSceneEdit = (scene: Scene) => {
    setSceneEditForm({
      narration: scene.narration,
      image_prompt: scene.image_prompt ?? "",
      video_prompt: scene.video_prompt ?? "",
    });
    setEditingSceneId(scene.id);
  };

  const cancelSceneEdit = () => {
    setEditingSceneId(null);
    setSceneEditForm({ narration: "", image_prompt: "", video_prompt: "" });
  };

  const saveSceneEdit = async (sceneId: number) => {
    if (!sceneEditForm.narration.trim()) return;
    await runAction(`edit-scene-${sceneId}`, async () => {
      await api.updateScene(sceneId, {
        narration: sceneEditForm.narration.trim(),
        image_prompt: sceneEditForm.image_prompt.trim() || null,
        video_prompt: sceneEditForm.video_prompt.trim() || null,
      });
      cancelSceneEdit();
      setSuccess("Scene updated.");
    });
  };

  const clearScenes = async () => {
    if (
      !window.confirm(
        `Delete ALL ${scenes.length} scenes and their images? This cannot be undone.`,
      )
    )
      return;
    await runAction("clear-scenes", async () => {
      await api.clearScenes(projectId);
      setSuccess("All scenes cleared.");
    });
  };

  const startRecording = async (sceneId: number) => {
    if (recordingSceneId !== null) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setError("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        stopMicMeter();
        const duration = (Date.now() - recordingStartRef.current) / 1000;
        const type = (mediaRecorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(recordingChunksRef.current, { type });
        if (recordingChunksRef.current.length === 0) {
          setError("No audio was captured. Check your microphone.");
          return;
        }
        void uploadRecording(sceneId, blob, duration);
      };
      startMicMeter(stream);
      recordingPeakRef.current = 0;
      meterActiveRef.current = false;
      recordingRef.current = mediaRecorder;
      recordingStartRef.current = Date.now();
      setRecordingSceneId(sceneId);
      setRecordingSeconds(0);
      setRecordingPaused(false);
      mediaRecorder.start();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      setError("");
    } catch {
      setError(
        "Could not access the microphone. Allow microphone permission in your browser.",
      );
    }
  };

  const toggleRecordingPause = () => {
    const recorder = recordingRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (recorder.state === "paused") {
      recorder.resume();
      setRecordingPaused(false);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      recorder.pause();
      setRecordingPaused(true);
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const stopMicMeter = () => {
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    analyserRef.current = null;
    try {
      void audioCtxRef.current?.close();
    } catch {
      /* noop */
    }
    audioCtxRef.current = null;
    setMicLevel(0);
  };

  const startMicMeter = (stream: MediaStream) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (ctx.state === "suspended") void ctx.resume();
        if (ctx.state === "running") meterActiveRef.current = true;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const level = Math.min(100, Math.round((avg / 255) * 100));
        setMicLevel(level);
        if (level > recordingPeakRef.current) recordingPeakRef.current = level;
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* meter is optional */
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingRef.current && recordingRef.current.state !== "inactive") {
      recordingRef.current.stop();
    }
    setRecordingSceneId(null);
    setRecordingSeconds(0);
    setRecordingPaused(false);
  };

  const bumpAudioVersion = (sceneId: number) =>
    setAudioVersion((v) => ({ ...v, [sceneId]: (v[sceneId] || 0) + 1 }));

  const uploadRecording = async (
    sceneId: number,
    blob: Blob,
    duration: number,
  ) => {
    const ext = blob.type.includes("ogg")
      ? "ogg"
      : blob.type.includes("mp4")
        ? "m4a"
        : "webm";
    const file = new File([blob], `recording_${Date.now()}.${ext}`, {
      type: blob.type,
    });
    try {
      setActionLoading("upload-audio");
      const scene = await api.uploadVoice(sceneId, file, duration);
      setScenes((prev) =>
        prev.map((s) =>
          s.id === scene.id
            ? {
                ...s,
                audio_path: scene.audio_path,
                duration_seconds: scene.duration_seconds,
              }
            : s,
        ),
      );
      bumpAudioVersion(scene.id);
      setSuccess("Your own voice recording was saved for this scene.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setActionLoading("");
    }
  };

  const handleAudioFileSelected = async (sceneId: number, file: File) => {
    if (!file) return;
    try {
      setActionLoading("upload-audio");
      const scene = await api.uploadVoice(sceneId, file, 0);
      setScenes((prev) =>
        prev.map((s) =>
          s.id === scene.id
            ? {
                ...s,
                audio_path: scene.audio_path,
                duration_seconds: scene.duration_seconds,
              }
            : s,
        ),
      );
      bumpAudioVersion(scene.id);
      setSuccess("Audio file saved for this scene.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setActionLoading("");
    }
  };

  const clearSceneAudio = async (sceneId: number) => {
    if (!window.confirm("Remove this scene's audio?")) return;
    await runAction(`clear-audio-${sceneId}`, async () => {
      await api.clearSceneAudio(sceneId);
      setScenes((prev) =>
        prev.map((s) =>
          s.id === sceneId
            ? { ...s, audio_path: null, duration_seconds: null }
            : s,
        ),
      );
      bumpAudioVersion(sceneId);
      setSuccess("Scene audio removed.");
    });
  };

  const formatRecordTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const handleTileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const applyMediaOrder = (scene: Scene, strip: MediaTile[]) => {
    setScenes((prev) =>
      prev.map((sc) => {
        if (sc.id !== scene.id) return sc;
        const images = (sc.images || []).map((img) => ({
          ...img,
          position: strip.findIndex(
            (t) => t.kind === "image" && t.id === img.id,
          ),
        }));
        const videos = (sc.videos || []).map((vid) => ({
          ...vid,
          position: strip.findIndex(
            (t) => t.kind === "video" && t.id === vid.id,
          ),
        }));
        return { ...sc, images, videos };
      }),
    );
  };

  const handleTileDrop = (
    e: React.DragEvent,
    scene: Scene,
    target: MediaTile,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragMedia || dragMedia.sourceSceneId !== scene.id) return;
    if (dragMedia.kind === target.kind && dragMedia.id === target.id) return;
    const strip = buildMediaStrip(scene);
    const fromIdx = strip.findIndex(
      (t) => t.kind === dragMedia.kind && t.id === dragMedia.id,
    );
    const toIdx = strip.findIndex(
      (t) => t.kind === target.kind && t.id === target.id,
    );
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const reordered = [...strip];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    applyMediaOrder(scene, reordered);
    setDragMedia(null);
    reorderSceneMedia(
      scene.id,
      reordered.map((t) => ({ type: t.kind, id: t.id })),
    );
  };

  const handleSceneDrop = (e: React.DragEvent, sceneId: number) => {
    e.preventDefault();
    if (!dragMedia || dragMedia.sourceSceneId === sceneId) return;
    if (dragMedia.kind !== "image") return;
    const imageId = dragMedia.id;
    setDragMedia(null);
    copySceneImageTo(imageId, sceneId);
  };

  const handleUploadTileDrop = (e: React.DragEvent, sceneId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("video/")) {
        handleVideoFileSelected(sceneId, file);
      } else {
        handleImageFileSelected(sceneId, file);
      }
      return;
    }
    if (!dragMedia) return;
    if (dragMedia.sourceSceneId !== sceneId) {
      if (dragMedia.kind !== "image") return;
      const imageId = dragMedia.id;
      setDragMedia(null);
      copySceneImageTo(imageId, sceneId);
      return;
    }
    const sc = scenes.find((s) => s.id === sceneId);
    if (sc) {
      const strip = buildMediaStrip(sc);
      const fromIdx = strip.findIndex(
        (t) => t.kind === dragMedia.kind && t.id === dragMedia.id,
      );
      if (fromIdx === -1) return;
      const reordered = [...strip];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.push(moved);
      applyMediaOrder(sc, reordered);
      setDragMedia(null);
      reorderSceneMedia(
        sceneId,
        reordered.map((t) => ({ type: t.kind, id: t.id })),
      );
    }
  };

  const handlePaste = async (sceneId: number) => {
    if (clipboardImageId == null) return;
    const imageId = clipboardImageId;
    setClipboardImageId(null);
    await copySceneImageTo(imageId, sceneId);
  };

  if (loading)
    return (
      <div className="loading">
        <span className="spinner" /> Loading project...
      </div>
    );
  if (!project) return <div className="error">Project not found</div>;

  const doneMap = getDoneMap({
    ideas,
    activeScript,
    scenes,
    thumbnails,
    seo,
    exportInfo,
    videoStatus,
    timeline,
  });

  return (
    <div
      style={{
        
        maxWidth: "1560px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Premium Header Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.6rem 1.25rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          flexWrap: "wrap",
          gap: "0.65rem",
        }}
      >
        {/* Left Side Branding & Project Details */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                background: "var(--primary)",
                width: 28,
                height: 28,
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 800,
                fontSize: "1rem",
              }}
            >
              ▶
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.1,
              }}
            >
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                YouTube
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                }}
              >
                Content Studio
              </span>
            </div>
          </Link>

          <span style={{ color: "var(--border)", fontSize: "0.85rem" }}>|</span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "var(--text)",
                maxWidth: "160px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={project.name}
            >
              {project.name}
            </span>
            <span
              className={`badge badge-${project.status}`}
              style={{ fontSize: "0.55rem", padding: "1px 4px" }}
            >
              {project.status.toUpperCase()}
            </span>
            <span
              className="badge"
              style={{
                fontSize: "0.55rem",
                padding: "1px 4px",
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-muted)",
              }}
            >
              {project.language.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Center Progress flow */}
        {(() => {
          const currentStepIndex =
            STUDIO_STEPS.findIndex((s) => s.key === activeTab) + 1;
          const currentStep =
            STUDIO_STEPS[currentStepIndex - 1] || STUDIO_STEPS[0];
          return (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                flexWrap: "wrap",
              }}
            >
              <span
                className="badge"
                style={{
                  background: "rgba(255,0,60,0.12)",
                  color: "var(--primary)",
                  fontSize: "0.72rem",
                  border: "1px solid rgba(255,0,60,0.25)",
                }}
              >
                {currentStep.label}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Step {currentStepIndex} of {STUDIO_STEPS.length}
              </span>
              <div style={{ display: "flex", gap: "3px" }}>
                {STUDIO_STEPS.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 14,
                      height: 3,
                      background:
                        i < currentStepIndex
                          ? "var(--primary)"
                          : "rgba(255,255,255,0.12)",
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Right Side Actions & Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link
            to="/"
            style={{
              color: "var(--text-muted)",
              fontSize: "0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.2rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)",
              padding: "0.3rem 0.6rem",
              borderRadius: "var(--radius)",
            }}
          >
            ← Home
          </Link>
          <button
            className="btn-secondary"
            style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
            onClick={() =>
              alert(
                "Welcome to YouTube Content Studio! This local AI production suite helps you brainstorm ideas, generate scripts, voiceovers, images, and package the final video for upload.",
              )
            }
          >
            ❓ Help
          </button>

          <button
            className="btn-secondary"
            style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
            onClick={openSettings}
          >
            ⚙️ Settings
          </button>

          {/* Profile indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              borderLeft: "1px solid var(--border)",
              paddingLeft: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                lineHeight: 1.1,
              }}
            >
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                Local MVP
              </span>
              <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                Creator
              </span>
            </div>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, var(--primary) 0%, #e91e63 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "white",
              }}
            >
              C
            </div>
          </div>
        </div>
      </header>

      {/* Project settings modal dialog */}
      {project && (
        <ProjectSettingsDialog
          isOpen={editingSettings}
          project={project}
          categories={categories}
          voiceConfig={voiceConfig}
          actionLoading={actionLoading}
          onClose={() => setEditingSettings(false)}
          onSave={saveSettings}
        />
      )}

      {error && (
        <ToastNotification
          message={error}
          type="error"
          onClose={() => setError("")}
          duration={6000}
        />
      )}
      {success && (
        <ToastNotification
          message={success}
          type="success"
          onClose={() => setSuccess("")}
          duration={4000}
        />
      )}

      <div
        className={`studio-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${
          activeTab === "images" || activeTab === "voice" ? "has-right-sidebar" : ""
        }`}
      >
        <StudioSidebar
          activeTab={activeTab}
          steps={STUDIO_STEPS}
          done={doneMap}
          onSelect={setActiveTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />

        <div className="studio-main-content">

          {activeTab === "ideas" && (
            <IdeasStep
              ideas={ideas}
              actionLoading={actionLoading}
              ideaTopic={ideaTopic}
              onTopicChange={setIdeaTopic}
              onGenerate={generateIdeas}
              onSelect={selectIdea}
            />
          )}

          {activeTab === "script" && (
            <ScriptStep
              ideas={ideas}
              projectName={project.name}
              scripts={scripts}
              actionLoading={actionLoading}
              scriptTopic={scriptTopic}
              onTopicChange={setScriptTopic}
              onGenerate={generateScript}
              editing={editingScript}
              creating={creatingScript}
              onStartEdit={openScriptEdit}
              onStartCreate={() => setCreatingScript(true)}
              onCancelEditor={() => {
                setEditingScript(false);
                setCreatingScript(false);
              }}
              onSave={creatingScript ? createScript : saveScript}
              form={scriptForm}
              onFormChange={(patch) =>
                setScriptForm((f) => ({ ...f, ...patch }))
              }
              onImportScript={async (imported, replace) => {
                await runAction("import-script", async () => {
                  await api.importScript(projectId, {
                    title: imported.title,
                    hook: imported.hook,
                    body: imported.body,
                    ending: imported.ending,
                    language: project?.language ?? "en",
                    replace,
                  });
                  setSuccess(
                    replace
                      ? "Script imported and made active!"
                      : "Script imported as a new version.",
                  );
                });
              }}
            />
          )}

          {activeTab === "scenes" && (
            <ScenesStep
              scenes={scenes}
              activeScript={activeScript}
              actionLoading={actionLoading}
              sceneCount={sceneCount}
              onSceneCountChange={setSceneCount}
              onGenerate={generateScenes}
              onClearAll={clearScenes}
              addingScene={addingScene}
              addSceneAt={addSceneAt}
              newSceneNarration={newSceneNarration}
              onNewSceneNarration={setNewSceneNarration}
              onAddScene={addScene}
              onOpenAdd={openAddScene}
              onCloseAdd={closeAddScene}
              editingSceneId={editingSceneId}
              sceneEditForm={sceneEditForm}
              onEditFormChange={(patch) =>
                setSceneEditForm((f) => ({ ...f, ...patch }))
              }
              onStartEdit={openSceneEdit}
              onCancelEdit={cancelSceneEdit}
              onSaveEdit={saveSceneEdit}
              onRemove={removeScene}
              onImportScenes={async (importedList, replace) => {
                await runAction("import-scenes", async () => {
                  await api.importScenes(projectId, {
                    scenes: importedList,
                    replace,
                  });
                  setSuccess(
                    `Imported ${importedList.length} scenes successfully!`,
                  );
                });
              }}
              projectName={project.name}
            />
          )}

          {activeTab === "images" && (
            <ImagesStep
              scenes={scenes}
              activeIdx={activeSceneIdx}
              setActiveIdx={setActiveSceneIdx}
              actionLoading={actionLoading}
              generatingSceneId={generatingSceneId}
              clipboardImageId={clipboardImageId}
              imageUrlInputs={imageUrlInputs}
              dragMedia={dragMedia}
              draggingOverScene={draggingOverScene}
              mediaUrl={mediaUrl}
              onGenerateAll={() =>
                runAction("images", async () => {
                  await api.generateAllImages(projectId);
                  setSuccess("All scene images generated!");
                })
              }
              onGenerateScene={generateSceneImage}
              onUrlChange={(sceneId, value) =>
                setImageUrlInputs((prev) => ({ ...prev, [sceneId]: value }))
              }
              onAddUrl={addSceneImageUrl}
              onUpload={handleImageFileSelected}
              onUploadVideo={handleVideoFileSelected}
              onRemoveVideo={removeSceneVideo}
              onCopy={setClipboardImageId}
              onMakePrimary={makePrimaryImage}
              onRemove={removeSceneImage}
              onPreview={(path, kind) => setPreviewMedia({ path, kind })}
              onPaste={handlePaste}
              setDragMedia={setDragMedia}
              setDraggingOverScene={setDraggingOverScene}
              handleTileDragOver={handleTileDragOver}
              handleTileDrop={handleTileDrop}
              handleSceneDrop={handleSceneDrop}
              handleUploadTileDrop={handleUploadTileDrop}
            />
          )}

          {activeTab === "voice" && (
            <VoiceStep
              scenes={scenes}
              activeIdx={activeSceneIdx}
              setActiveIdx={setActiveSceneIdx}
              actionLoading={actionLoading}
              voiceProviders={voiceProviders}
              selectedProvider={selectedProvider}
              onProviderChange={(providerId) => {
                const provider = voiceProviders.find(
                  (p) => p.id === providerId,
                );
                setSelectedProvider(providerId);
                if (provider) setSelectedVoice(provider.default);
              }}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              selectedVoiceRate={selectedVoiceRate}
              onVoiceRateChange={setSelectedVoiceRate}
              voiceProgress={voiceProgress}
              onGenerateAll={generateAllVoice}
              onGenerateScene={generateSceneVoice}
              recordingSceneId={recordingSceneId}
              recordingSeconds={recordingSeconds}
              recordingPaused={recordingPaused}
              micLevel={micLevel}
              onToggleRecordingPause={toggleRecordingPause}
              onStopRecording={stopRecording}
              onStartRecording={startRecording}
              audioInputRef={audioInputRef}
              onFileSelected={handleAudioFileSelected}
              onClearAudio={clearSceneAudio}
              mediaUrl={mediaUrl}
              audioVersion={audioVersion}
              formatRecordTime={formatRecordTime}
            />
          )}

          {activeTab === "timeline" && (
            <TimelineStep
              projectId={projectId}
              scenes={scenes}
              actionLoading={actionLoading}
              videoStatus={videoStatus}
              ratio={selectedRatio}
              mediaUrl={mediaUrl}
              timeline={timeline}
              onTimelineChange={setTimeline}
            />
          )}

          {activeTab === "video" && (
            <VideoStep
              projectId={projectId}
              scenes={scenes}
              actionLoading={actionLoading}
              ratio={selectedRatio}
              videoStatus={videoStatus}
              onBuild={buildVideo}
              mediaUrl={mediaUrl}
            />
          )}

          {activeTab === "thumbnail" && (
            <ThumbnailStep
              thumbnails={thumbnails}
              actionLoading={actionLoading}
              mediaUrl={mediaUrl}
              onGenerate={() =>
                runAction("thumbnails", async () => {
                  await api.generateThumbnails(projectId, 3);
                  setSuccess("Generated 3 thumbnail options!");
                })
              }
              onSelect={(thumbId) =>
                runAction("select-thumb", async () => {
                  await api.selectThumbnail(thumbId);
                  setSuccess("Thumbnail selected");
                })
              }
            />
          )}

          {activeTab === "seo" && (
            <SeoStep
              seo={seo}
              categories={categories}
              activeScript={activeScript}
              actionLoading={actionLoading}
              onGenerate={() =>
                runAction("seo", async () => {
                  await api.generateSEO(projectId, project.language);
                  setSuccess("SEO metadata generated!");
                })
              }
              onCategoryChange={(categoryId) =>
                runAction("seo-category", async () => {
                  await api.updateSEOCategory(projectId, categoryId);
                  setSuccess("YouTube category saved");
                })
              }
            />
          )}

          {activeTab === "export" && (
            <ExportStep
              exportInfo={exportInfo}
              actionLoading={actionLoading}
              mediaUrl={mediaUrl}
              onExport={() =>
                runAction("export", async () => {
                  const result = await api.exportProject(projectId);
                  setExportInfo(result);
                  setSuccess(
                    `${result.message} (${result.files.length} files)`,
                  );
                })
              }
            />
          )}
        </div>

        {(activeTab === "images" || activeTab === "voice") && (
          <ScenesSidebar
            scenes={scenes}
            activeIdx={activeSceneIdx}
            onSelectScene={setActiveSceneIdx}
            stepKind={activeTab === "voice" ? "voice" : "images"}
          />
        )}
      </div>

      {cropFile && (
        <ImageCropDialog
          file={cropFile.file}
          onCancel={() => setCropFile(null)}
          onConfirm={applyImageCrop}
        />
      )}

      {trimFile && (
        <VideoTrimDialog
          file={trimFile.file}
          onCancel={() => setTrimFile(null)}
          onConfirm={applyVideoUpload}
        />
      )}

      {previewMedia && (
        <div
          onClick={() => setPreviewMedia(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.88)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          {previewMedia.kind === "video" ? (
            <video
              src={mediaUrl(previewMedia.path)}
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "88vh",
                objectFit: "contain",
                borderRadius: "var(--radius)",
                boxShadow: "0 12px 48px rgba(0, 0, 0, 0.7)",
                background: "#000",
              }}
            />
          ) : (
            <img
              src={mediaUrl(previewMedia.path)}
              alt="Image preview"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "88vh",
                objectFit: "contain",
                borderRadius: "var(--radius)",
                boxShadow: "0 12px 48px rgba(0, 0, 0, 0.7)",
              }}
            />
          )}
          <button
            onClick={() => setPreviewMedia(null)}
            aria-label="Close preview"
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              background: "var(--surface, rgba(255,255,255,0.15))",
              color: "#fff",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
          >
            <X size={20} />
          </button>
          <a
            href={mediaUrl(previewMedia.path)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              bottom: 20,
              right: 20,
              color: "#fff",
              textDecoration: "none",
              background: "rgba(255,255,255,0.15)",
              padding: "0.45rem 0.9rem",
              borderRadius: "var(--radius)",
              fontSize: "0.8rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            Open in new tab <ExternalLink size={13} />
          </a>
        </div>
      )}

      {showScrollTop && (
        <button
          className="scroll-to-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="Scroll to Top"
        >
          <ArrowUp size={14} style={{ verticalAlign: "-2px" }} /> Top
        </button>
      )}
    </div>
  );
}
