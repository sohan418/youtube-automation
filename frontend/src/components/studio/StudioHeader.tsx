import { Link } from "react-router-dom";
import { Home, HelpCircle, Settings, Clapperboard, Download, BadgeCheck } from "lucide-react";
import { getProgressPercent, getCompletedCount, type StepStatusData, STUDIO_STEPS } from "./studioSteps";
import type { Project, VideoStatus } from "../../types";
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
  onExportVideo: () => void;
  logoOverlay: boolean;
  onLogoOverlayChange: (value: boolean) => void;
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
  onExportVideo,
  logoOverlay,
  onLogoOverlayChange,
}: Props) {
  const pct = getProgressPercent(statusData);
  const completed = getCompletedCount(statusData);
  const total = STUDIO_STEPS.length;
  const building = actionLoading === "video" || videoStatus?.running;
  const hasBuiltVideo = !!videoStatus?.output;

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
        <button
          className={`studio-logo-toggle${logoOverlay ? " is-active" : ""}`}
          onClick={() => onLogoOverlayChange(!logoOverlay)}
          title="Overlay the connected channel logo in the top-right corner of the built video"
          disabled={!!actionLoading}
        >
          <BadgeCheck size={14} />
          <span>Logo</span>
        </button>
        {building ? (
          <button className="btn-primary studio-header-action-btn" disabled>
            Building ({videoStatus?.progress ?? 0}%)
          </button>
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

        <span className="studio-header-gap">|</span>

        <Link to="/" className="btn-ghost studio-export-link">
          <Home size={14} />
        </Link>
        <button className="btn-ghost studio-ghost-btn" title="Help">
          <HelpCircle size={15} />
        </button>
        <button className="btn-ghost studio-ghost-btn" title="Settings" onClick={openSettings}>
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
