import { useState } from "react";
import { api } from "../api/client";
import type { Scene, SceneImage } from "../types";

interface Args {
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  loadAll: () => Promise<void>;
  setActionLoading: (v: string) => void;
  setError: (v: string) => void;
  setSuccess: (v: string) => void;
}

export interface SceneImagesState {
  imageUrlInputs: Record<number, string>;
  setImageUrlInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  generatingSceneId: number | null;
  clipboardImageId: number | null;
  setClipboardImageId: (v: number | null) => void;
  dragImage: { imageId: number; sourceSceneId: number } | null;
  draggingOverScene: number | null;
  previewImage: string | null;
  setPreviewImage: (v: string | null) => void;
  addSceneImageUrl: (sceneId: number) => Promise<void>;
  uploadSceneImage: (sceneId: number, file: File) => Promise<void>;
  generateSceneImage: (sceneId: number) => Promise<void>;
  removeSceneImage: (imageId: number) => Promise<void>;
  makePrimaryImage: (imageId: number) => Promise<void>;
  reorderSceneImages: (sceneId: number, imageIds: number[]) => Promise<void>;
  copySceneImageTo: (imageId: number, targetSceneId: number) => Promise<void>;
  handlePaste: (sceneId: number) => Promise<void>;
  handleTileDragStart: (img: SceneImage, scene: Scene) => void;
  handleTileDragOver: (e: React.DragEvent) => void;
  handleTileDrop: (e: React.DragEvent, scene: Scene, targetImg: SceneImage) => void;
  handleSceneDrop: (e: React.DragEvent, sceneId: number) => void;
  handleUploadTileDrop: (e: React.DragEvent, sceneId: number) => void;
}

export function useSceneImages({
  scenes,
  setScenes,
  loadAll,
  setActionLoading,
  setError,
  setSuccess,
}: Args): SceneImagesState {
  const [imageUrlInputs, setImageUrlInputs] = useState<Record<number, string>>({});
  const [generatingSceneId, setGeneratingSceneId] = useState<number | null>(null);
  const [clipboardImageId, setClipboardImageId] = useState<number | null>(null);
  const [dragImage, setDragImage] = useState<{ imageId: number; sourceSceneId: number } | null>(null);
  const [draggingOverScene] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

  const uploadSceneImage = async (sceneId: number, file: File) => {
    if (!file) return;
    try {
      setActionLoading(`upload-${sceneId}`);
      setError("");
      setSuccess("");
      await api.uploadSceneImage(sceneId, file);
      setSuccess(`Uploaded ${file.name}`);
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
      setError(err instanceof Error ? err.message : "Failed to set primary image");
    } finally {
      setActionLoading("");
    }
  };

  const reorderSceneImages = async (sceneId: number, imageIds: number[]) => {
    try {
      setActionLoading(`reorder-${sceneId}`);
      setError("");
      setSuccess("");
      await api.reorderSceneImages(sceneId, imageIds);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder images");
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

  const handlePaste = async (sceneId: number) => {
    if (clipboardImageId == null) return;
    const imageId = clipboardImageId;
    setClipboardImageId(null);
    await copySceneImageTo(imageId, sceneId);
  };

  const handleTileDragStart = (img: SceneImage, scene: Scene) => {
    setDragImage({ imageId: img.id, sourceSceneId: scene.id });
  };

  const handleTileDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleTileDrop = (e: React.DragEvent, scene: Scene, targetImg: SceneImage) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragImage || dragImage.sourceSceneId !== scene.id || dragImage.imageId === targetImg.id) return;
    const images = scene.images || [];
    const fromIdx = images.findIndex((i) => i.id === dragImage.imageId);
    const toIdx = images.findIndex((i) => i.id === targetImg.id);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const reordered = [...images];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setScenes((prev) => prev.map((sc) => (sc.id === scene.id ? { ...sc, images: reordered } : sc)));
    setDragImage(null);
    reorderSceneImages(scene.id, reordered.map((i) => i.id));
  };

  const handleSceneDrop = (e: React.DragEvent, sceneId: number) => {
    e.preventDefault();
    if (!dragImage || dragImage.sourceSceneId === sceneId) return;
    const imageId = dragImage.imageId;
    setDragImage(null);
    copySceneImageTo(imageId, sceneId);
  };

  const handleUploadTileDrop = (e: React.DragEvent, sceneId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadSceneImage(sceneId, files[0]);
      return;
    }
    if (!dragImage) return;
    if (dragImage.sourceSceneId !== sceneId) {
      const imageId = dragImage.imageId;
      setDragImage(null);
      copySceneImageTo(imageId, sceneId);
      return;
    }
    const sc = scenes.find((s) => s.id === sceneId);
    if (sc) {
      const images = sc.images || [];
      const fromIdx = images.findIndex((i) => i.id === dragImage.imageId);
      if (fromIdx === -1) return;
      const reordered = [...images];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.push(moved);
      setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, images: reordered } : s)));
      setDragImage(null);
      reorderSceneImages(sceneId, reordered.map((i) => i.id));
    }
  };

  return {
    imageUrlInputs,
    setImageUrlInputs,
    generatingSceneId,
    clipboardImageId,
    setClipboardImageId,
    dragImage,
    draggingOverScene,
    previewImage,
    setPreviewImage,
    addSceneImageUrl,
    uploadSceneImage,
    generateSceneImage,
    removeSceneImage,
    makePrimaryImage,
    reorderSceneImages,
    copySceneImageTo,
    handlePaste,
    handleTileDragStart,
    handleTileDragOver,
    handleTileDrop,
    handleSceneDrop,
    handleUploadTileDrop,
  };
}
