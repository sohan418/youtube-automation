import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Settings, Clapperboard, Download, BadgeCheck, Upload, SlidersHorizontal, PlaySquare, RefreshCw, XCircle, Key } from "lucide-react";
import { getProgressPercent, getCompletedCount, type StepStatusData, STUDIO_STEPS } from "./studioSteps";
import type { Project, VideoStatus, LogoConfig } from "../../types";
import { LLMKeysSettingsModal } from "../editors/LLMKeysSettingsModal";
import "./StudioHeader.css";

const RATIOS = [
  { value: "16:9", label: "16:9", sub: "Landscape" },
  { value: "9:16", label: "9:16", sub: "Shorts" },
];

interface Props {
  project: Project;
  statusData: StepStatusData;
  openSettings: () => void;
  selectedRatio: string;
  onRatioChange: (ratio: string) => void;
  actionLoading: string;
  videoStatus: VideoStatus | null;
  onBuildVideo: () => void;
  onCancelBuild?: () => void;
  onExportVideo: () => void;
  onImportVideo: (file: File) => void;
  logoOverlay: boolean;
  onLogoOverlayChange: (value: boolean) => void;
  logoConfig: LogoConfig;
  onLogoConfigChange: (patch: Partial<LogoConfig>) => void;
  onTogglePreview?: () => void;
  previewActive?: boolean;
  onRefreshLogo?: () => void;
  onUploadLogo?: (file: File) => void;
}

export default function StudioHeader({
  project,
  statusData,
  openSettings,
  selectedRatio,
  onRatioChange,
  actionLoading,
  videoStatus,
  onBuildVideo,
  onCancelBuild,
  onExportVideo,
  onImportVideo,
  logoOverlay,
  onLogoOverlayChange,
  logoConfig,
  onLogoConfigChange,
  onTogglePreview,
  previewActive,
  onRefreshLogo,
  onUploadLogo,
}: Props) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const pct = getProgressPercent(statusData);
  const completed = getCompletedCount(statusData);
  const total = STUDIO_STEPS.length;
  const building = actionLoading === "video" || videoStatus?.running;
  const importing = actionLoading === "video-import";
  const hasBuiltVideo = !!videoStatus?.output;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const configBtnRef = useRef<HTMLButtonElement | null>(null);
  const [logoConfigOpen, setLogoConfigOpen] = useState(false);
  const [llmKeysModalOpen, setLlmKeysModalOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);

  const toggleLogoConfig = () => {
    if (!logoConfigOpen) {
      const r = configBtnRef.current?.getBoundingClientRect();
      if (r) setPopoverPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setLogoConfigOpen((v) => !v);
  };

  const logoPositions: { value: LogoConfig["logo_position"]; label: string }[] = [
    { value: "top-left", label: "Top Left" },
    { value: "top-right", label: "Top Right" },
    { value: "bottom-left", label: "Bottom Left" },
    { value: "bottom-right", label: "Bottom Right" },
  ];

  return (
    <header className="studio-header">
      <Link to="/" className="studio-header-brand">
        <span className="studio-header-brand-icon">&#9654;</span>
        <span className="studio-header-brand-name">Content Studio</span>
      </Link>

      <span className="studio-header-divider">|</span>

      <div className="studio-header-project">
        <span className="studio-header-project-name" title={project.name}>
          {project.name}
        </span>
        <span className="badge studio-header-lang-badge">
          {project.language.toUpperCase()}
        </span>
      </div>

      <div className="studio-ratio-switcher">
        {RATIOS.map((r) => {
          const active = selectedRatio === r.value;
          let boxW: number, boxH: number;
          if (r.value === "16:9") { boxW = 20; boxH = 11; }
          else { boxW = 11; boxH = 20; }
          return (
            <button
              key={r.value}
              onClick={() => onRatioChange(r.value)}
              title={`${r.label} ${r.sub}`}
              className={`studio-ratio-btn${active ? " is-active" : ""}`}
            >
              <div
                className={`studio-ratio-box${active ? " is-active-box" : ""}`}
                style={{ width: boxW, height: boxH, border: `1.5px solid ${active ? "#fff" : "var(--text-muted)"}` }}
              />
            </button>
          );
        })}
      </div>

      <div className="progress-bar-container studio-progress">
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-bar-text">
          {completed}/{total}
        </span>
      </div>

      <div className="studio-header-actions">
        <div className="studio-logo-group">
          <button
            className={`studio-logo-toggle${logoOverlay ? " is-active" : ""}`}
            onClick={() => onLogoOverlayChange(!logoOverlay)}
            title={`Overlay the connected channel logo (${logoConfig.logo_position.replace("-", " ")} corner, ${logoConfig.logo_size}% height)`}
            disabled={!!actionLoading}
          >
            <BadgeCheck size={14} />
            <span>Logo</span>
          </button>
          <button
            ref={configBtnRef}
            className={`studio-logo-config${logoConfigOpen ? " is-open" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleLogoConfig();
            }}
            title="Adjust logo position, size, margin & opacity"
          >
            <SlidersHorizontal size={13} />
          </button>

          {logoConfigOpen && (
            <>
              <div className="studio-logo-config-backdrop" onClick={() => setLogoConfigOpen(false)} />
              <div
                className="studio-logo-config-popover"
                style={popoverPos ? { top: popoverPos.top, right: popoverPos.right } : undefined}
              >
                <div className="studio-logo-config-title">Logo Settings</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.3rem",
                  }}
                >
                  {logoPositions.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onLogoConfigChange({ logo_position: p.value })}
                      className={`studio-logo-pos-btn${logoConfig.logo_position === p.value ? " is-active" : ""}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <label className="studio-logo-field">
                  <span className="studio-logo-field-label">
                    Size <em>{logoConfig.logo_size}%</em>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    step={1}
                    value={logoConfig.logo_size}
                    onChange={(e) =>
                      onLogoConfigChange({ logo_size: Number(e.target.value) })
                    }
                  />
                </label>

                <label className="studio-logo-field">
                  <span className="studio-logo-field-label">
                    Margin <em>{logoConfig.logo_margin}px</em>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={5}
                    value={logoConfig.logo_margin}
                    onChange={(e) =>
                      onLogoConfigChange({ logo_margin: Number(e.target.value) })
                    }
                  />
                </label>

                <label className="studio-logo-field">
                  <span className="studio-logo-field-label">
                    Opacity <em>{Math.round(logoConfig.logo_opacity * 100)}%</em>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(logoConfig.logo_opacity * 100)}
                    onChange={(e) =>
                      onLogoConfigChange({
                        logo_opacity: Number(e.target.value) / 100,
                      })
                    }
                  />
                </label>

                <p className="studio-logo-config-note">
                  Settings are saved to this project and applied on the next video build.
                </p>

                {onUploadLogo && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--primary)",
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "#a5b4fc",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <Upload size={13} /> Upload Custom Logo
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onUploadLogo) onUploadLogo(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}

                {onRefreshLogo && (
                  <button
                    type="button"
                    onClick={onRefreshLogo}
                    style={{
                      width: "100%",
                      marginTop: "0.4rem",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                    }}
                  >
                    <RefreshCw size={13} /> Fetch from YouTube API
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {onTogglePreview && (
          <button
            className={`btn-secondary studio-header-action-btn${previewActive ? " is-active" : ""}`}
            onClick={onTogglePreview}
            title="Open / Toggle Final Video Preview Modal"
            style={previewActive ? { borderColor: "var(--primary)", color: "#fff", background: "rgba(124, 92, 255, 0.22)" } : undefined}
          >
            <PlaySquare size={13} /> Preview
          </button>
        )}
        {building ? (
          <>
            <button className="btn-primary studio-header-action-btn" disabled>
              Building ({videoStatus?.progress ?? 0}%)
            </button>
            {onCancelBuild && (
              <button
                className="btn-secondary studio-header-action-btn"
                onClick={onCancelBuild}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#ff6b78",
                  fontWeight: 600
                }}
                title="Cancel ongoing video build"
              >
                <XCircle size={13} /> Cancel
              </button>
            )}
          </>
        ) : (
          <button
            className="btn-secondary studio-header-action-btn"
            onClick={onBuildVideo}
            disabled={!!actionLoading}
          >
            <Clapperboard size={12} /> Build
          </button>
        )}

        <button
          className={`btn-primary studio-header-action-btn studio-export-btn${hasBuiltVideo ? " can-export" : ""}`}
          onClick={onExportVideo}
          disabled={!hasBuiltVideo || !!actionLoading}
        >
          <Download size={12} /> Export
        </button>



        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mkv,.avi"
          className="studio-header-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onImportVideo(f);
              e.target.value = "";
            }
          }}
        />
        <button
          className="btn-secondary studio-header-action-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={!!actionLoading || importing}
          title="Import an externally-edited video as the final video"
        >
          <Upload size={12} /> {importing ? "Importing..." : "Import"}
        </button>

        <span className="studio-header-gap">|</span>

        <button className="btn-ghost studio-ghost-btn" title="LLM API Keys & Providers" onClick={() => setLlmKeysModalOpen(true)}>
          <Key size={15} />
        </button>

        <button className="btn-ghost studio-ghost-btn" title="Settings" onClick={openSettings}>
          <Settings size={15} />
        </button>

        <LLMKeysSettingsModal isOpen={llmKeysModalOpen} onClose={() => setLlmKeysModalOpen(false)} />
      </div>
    </header>
  );
}
