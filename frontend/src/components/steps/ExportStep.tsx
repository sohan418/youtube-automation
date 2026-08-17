import type { ExportResult } from "../../types";

interface Props {
  exportInfo: ExportResult | null;
  actionLoading: string;
  mediaUrl: (p: string) => string;
  onExport: () => void;
}

export default function ExportStep({ exportInfo, actionLoading, mediaUrl, onExport }: Props) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h3>Export for YouTube Upload</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Packages video, thumbnails, subtitles, and SEO metadata into the exports folder
          </p>
        </div>
        <button className="btn-primary" disabled={!!actionLoading} onClick={onExport}>
          {actionLoading === "export" ? "Exporting..." : "Export Project"}
        </button>
      </div>
      {exportInfo && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", borderRadius: "var(--radius)", border: "1px solid var(--accent)", background: "var(--bg)" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Download final video:</p>
          {exportInfo.files.includes("video/final.mp4") ? (
            <a className="btn-primary" href={mediaUrl(`${exportInfo.export_path}/video/final.mp4`)} download>
              ⬇ Download Video (.mp4)
            </a>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              No video file found. Build scenes and generate the video first, then export again.
            </p>
          )}
        </div>
      )}
      <div style={{ background: "var(--bg)", padding: "1rem", borderRadius: "var(--radius)" }}>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Export includes: final video, thumbnails, subtitles (.srt), SEO metadata (.json), and an upload guide.
        </p>
      </div>
    </div>
  );
}
