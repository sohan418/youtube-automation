import { useEffect, useRef, useState } from "react";
import type { TimelineClip, Scene, LogoConfig } from "../../types";
import { mediaUrl } from "../../api/client";

export interface TimelinePlaybackState {
  time: number;
  playing: boolean;
  activeVideo: TimelineClip | null;
  activeScene: Scene | null;
  activeCaption: string | null;
}

interface Props {
  playbackState: TimelinePlaybackState | null;
  activeSceneFallback: Scene | null;
  selectedRatio: string;
  enableSubtitles: boolean;
  subtitleStyle?: string;
  subtitlePosition?: string;
  subtitleCustomY?: number;
  subtitleColor?: string;
  subtitleOutlineColor?: string;
  subtitleOutline?: number;
  subtitleFontSize?: number | null;
  logoOverlay?: boolean;
  logoConfig?: LogoConfig;
  logoUrl?: string | null;
  onSubtitlePositionChange?: (position: string, customY?: number) => void;
}

function getSubtitleOverlayStyles(
  position: string = "bottom",
  styleName: string = "shorts",
  color: string = "",
  outlineColor: string = "#000000",
  outlineValue: number = 1,
  fontSize: number | null = null,
  ratio: string = "16:9",
  customY?: number,
) {
  let yVal = customY;
  if (yVal == null && position.startsWith("custom:")) {
    yVal = parseFloat(position.split(":")[1]);
  }

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    width: "92%",
    maxWidth: "92%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    zIndex: 30,
    userSelect: "none",
    boxSizing: "border-box",
  };

  if (position === "custom" || position.startsWith("custom:") || yVal != null) {
    const finalY = yVal ?? 80;
    containerStyle.top = `${finalY}%`;
    containerStyle.transform = "translate(-50%, -50%)";
  } else if (position === "top") {
    containerStyle.top = "12%";
    containerStyle.transform = "translate(-50%, -50%)";
  } else if (position === "center" || position === "middle") {
    containerStyle.top = "50%";
    containerStyle.transform = "translate(-50%, -50%)";
  } else {
    containerStyle.top = "80%";
    containerStyle.transform = "translate(-50%, -50%)";
  }

  // Text color determination
  let computedColor = color;
  if (!computedColor) {
    if (styleName === "shorts") computedColor = "#FFD700";
    else if (styleName === "word_by_word") computedColor = "#00E5FF";
    else if (styleName === "classic") computedColor = "#FFFFFF";
    else computedColor = "#FFFF00";
  }

  // Font family determination
  const isImpact = styleName === "shorts" || styleName === "word_by_word";
  const fontFamily = isImpact ? "Impact, 'Arial Black', sans-serif" : "Arial, 'Helvetica Neue', sans-serif";

  // Proportional font size calculation
  let computedFontSize = ratio === "9:16" ? "1.05rem" : "1.2rem";
  if (fontSize && fontSize > 0) {
    const scaleFactor = ratio === "9:16" ? 0.28 : 0.45;
    const scaled = Math.max(12, Math.round(fontSize * scaleFactor));
    computedFontSize = `${scaled}px`;
  }

  // Text shadow / outline
  const oColor = outlineColor || "#000000";
  const textShadow =
    outlineValue !== 0
      ? `2px 2px 0 ${oColor}, -2px -2px 0 ${oColor}, 2px -2px 0 ${oColor}, -2px 2px 0 ${oColor}, 0 2px 0 ${oColor}, 2px 0 0 ${oColor}, 0 -2px 0 ${oColor}, -2px 0 0 ${oColor}`
      : "none";

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontSize: computedFontSize,
    color: computedColor,
    textTransform: isImpact ? "uppercase" : "none",
    textShadow,
    letterSpacing: isImpact ? "0.5px" : "0.2px",
    lineHeight: 1.2,
    fontWeight: 800,
    display: "inline-block",
    padding: "2px 6px",
    background: styleName === "classic" ? "rgba(0, 0, 0, 0.5)" : "transparent",
    borderRadius: styleName === "classic" ? "4px" : "0",
    textAlign: "center",
  };

  return { containerStyle, textStyle };
}

function getLogoOverlayStyle(config?: LogoConfig) {
  const pos = config?.logo_position || "bottom-right";
  const sizePct = config?.logo_size || 12;
  const marginPx = config?.logo_margin || 30;
  const opacityVal = config?.logo_opacity !== undefined ? config.logo_opacity : 0.85;

  const scaledMargin = Math.max(8, Math.round(marginPx * 0.4));
  const logoHeight = `${sizePct}%`;

  const style: React.CSSProperties = {
    position: "absolute",
    height: logoHeight,
    width: "auto",
    aspectRatio: "1 / 1",
    opacity: opacityVal,
    zIndex: 15,
    pointerEvents: "none",
    objectFit: "contain",
    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
  };

  if (pos.includes("left")) {
    style.left = `${scaledMargin}px`;
  } else {
    style.right = `${scaledMargin}px`;
  }

  if (pos.includes("top")) {
    style.top = `${scaledMargin}px`;
  } else {
    style.bottom = `${scaledMargin}px`;
  }

  return style;
}

export default function TimelineVideoCanvas({
  playbackState,
  activeSceneFallback,
  selectedRatio,
  enableSubtitles,
  subtitleStyle = "shorts",
  subtitlePosition = "bottom",
  subtitleCustomY,
  subtitleColor = "",
  subtitleOutlineColor = "#000000",
  subtitleOutline = 1,
  subtitleFontSize = null,
  logoOverlay = false,
  logoConfig,
  logoUrl,
  onSubtitlePositionChange,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [isDraggingCaption, setIsDraggingCaption] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [localCustomY, setLocalCustomY] = useState<number | undefined>(subtitleCustomY);

  // Sync prop changes to local custom Y state
  useEffect(() => {
    setLocalCustomY(subtitleCustomY);
  }, [subtitleCustomY]);

  const activeVideo = playbackState?.activeVideo ?? null;
  const activeScene = playbackState?.activeScene ?? activeSceneFallback;
  const playing = playbackState?.playing ?? false;
  const time = playbackState?.time ?? 0;

  // Determine media source
  const videoPath = activeVideo?.video_path || activeScene?.video_path || null;
  const imagePath = activeVideo?.image_path || activeScene?.image_path || activeScene?.images?.[0]?.file_path || null;

  const videoSrc = videoPath ? mediaUrl(videoPath) : null;
  const imageSrc = imagePath ? mediaUrl(imagePath) : null;

  // Calculate position within current clip/scene
  const clipStart = activeVideo ? activeVideo.start : 0;
  const audioIn = activeVideo?.audio_in || 0;
  const clipTime = Math.max(0, time - clipStart + audioIn);

  // Play / Pause / Seek sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;

    if (Math.abs(v.currentTime - clipTime) > 0.3) {
      try {
        v.currentTime = clipTime;
      } catch {
        /* not loaded yet */
      }
    }

    if (playing) {
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    } else {
      v.pause();
    }
  }, [clipTime, playing, videoSrc]);

  // Drag and Drop Caption Position Handler
  const handleMouseDownCaption = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCaption(true);
  };

  useEffect(() => {
    if (!isDraggingCaption) return;

    const handleMouseMove = (e: MouseEvent) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (rect.height <= 0) return;
      const relativeY = e.clientY - rect.top;
      const yPct = Math.min(92, Math.max(5, (relativeY / rect.height) * 100));
      const roundedY = Math.round(yPct * 10) / 10;
      setLocalCustomY(roundedY);
      if (onSubtitlePositionChange) {
        onSubtitlePositionChange("custom", roundedY);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingCaption(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingCaption, onSubtitlePositionChange]);

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = clipTime;
    } catch {
      /* ignore */
    }
    if (playing) {
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    }
  };

  const captionText = playbackState?.activeCaption || activeScene?.narration || null;
  const motionEffect = activeVideo?.motion_effect || activeScene?.motion_effect || "none";

  const { containerStyle, textStyle } = getSubtitleOverlayStyles(
    subtitlePosition,
    subtitleStyle,
    subtitleColor,
    subtitleOutlineColor,
    subtitleOutline,
    subtitleFontSize,
    selectedRatio,
    localCustomY,
  );

  // Render Caption Content
  const renderCaptionContent = () => {
    if (!captionText) return null;

    if (subtitleStyle === "word_by_word" || subtitleStyle === "shorts") {
      const words = captionText.trim().split(/\s+/);
      if (words.length > 1) {
        const totalDuration = activeVideo?.duration || activeScene?.duration_seconds || 5;
        const progress = Math.min(1, Math.max(0, clipTime / totalDuration));
        const activeWordIdx = Math.min(words.length - 1, Math.floor(progress * words.length));

        const CHUNK_SIZE = 4;
        const chunkStart = Math.floor(activeWordIdx / CHUNK_SIZE) * CHUNK_SIZE;
        const chunkWords = words.slice(chunkStart, chunkStart + CHUNK_SIZE);

        return (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", alignItems: "center", width: "100%" }}>
            {chunkWords.map((word, i) => {
              const globalIdx = chunkStart + i;
              const isActive = globalIdx === activeWordIdx;
              return (
                <span
                  key={`${word}-${globalIdx}`}
                  style={{
                    ...textStyle,
                    color: isActive ? subtitleColor || "#00E5FF" : "#FFFFFF",
                    transform: isActive ? "scale(1.08)" : "scale(1)",
                    transition: "transform 0.1s ease, color 0.1s ease",
                    filter: isActive ? "drop-shadow(0 0 6px rgba(0, 229, 255, 0.8))" : "none",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        );
      }
    }

    return <span style={textStyle}>{captionText}</span>;
  };

  return (
    <div
      ref={frameRef}
      className="preview-frame"
      style={{
        maxWidth: selectedRatio === "9:16" ? "260px" : "580px",
        aspectRatio: selectedRatio === "9:16" ? "9 / 16" : "16 / 9",
        position: "relative",
        overflow: "hidden",
        background: "#000",
      }}
    >
      {videoSrc ? (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          onLoadedMetadata={handleLoadedMetadata}
          muted
          playsInline
          className="preview-frame-media"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : imageSrc ? (
        <img
          src={imageSrc}
          alt="Timeline Preview"
          className={`preview-frame-media ${motionEffect !== "none" ? `motion-${motionEffect}` : ""}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: playing ? "transform 5s ease-out" : "none",
            transform: playing && motionEffect === "zoom_in" ? "scale(1.12)" : "scale(1)",
          }}
        />
      ) : (
        <div className="preview-empty">No media selected for active scene</div>
      )}

      {/* Dynamic Subtitle Overlay - Interactive Drag to Position */}
      {enableSubtitles && captionText && (
        <div
          style={{
            ...containerStyle,
            cursor: isDraggingCaption ? "grabbing" : "grab",
            padding: "4px 8px",
            borderRadius: "6px",
            border: isDraggingCaption
              ? "2px dashed #00E5FF"
              : isHovered
                ? "1px dashed rgba(0, 229, 255, 0.6)"
                : "1px solid transparent",
            background: isDraggingCaption
              ? "rgba(0, 229, 255, 0.15)"
              : isHovered
                ? "rgba(0, 0, 0, 0.2)"
                : "transparent",
            transition: isDraggingCaption ? "none" : "all 0.15s ease",
            boxShadow: isDraggingCaption ? "0 0 12px rgba(0, 229, 255, 0.5)" : "none",
            pointerEvents: "auto",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseDown={handleMouseDownCaption}
          title="Click & Drag to position caption anywhere on the video"
        >
          {(isDraggingCaption || isHovered) && (
            <div
              style={{
                position: "absolute",
                top: "-22px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "#00E5FF",
                color: "#000",
                fontSize: "10px",
                fontWeight: 800,
                padding: "1px 6px",
                borderRadius: "4px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              Y: {localCustomY?.toFixed(0) ?? 80}%
            </div>
          )}
          {renderCaptionContent()}
        </div>
      )}

      {/* Dynamic Channel Logo Watermark Overlay */}
      {logoOverlay && logoUrl && (
        <img
          src={logoUrl}
          alt="Channel Logo Watermark"
          style={{
            ...getLogoOverlayStyle(logoConfig),
            borderRadius: logoUrl.startsWith("http") ? "50%" : "0",
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
}
