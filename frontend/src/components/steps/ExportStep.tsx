import { Package } from "lucide-react";
import type { ExportResult } from "../../types";

interface Props {
  exportInfo: ExportResult | null;
  actionLoading: string;
  mediaUrl: (p: string) => string;
  onExport: () => void;
}

export default function ExportStep({ exportInfo, actionLoading: _actionLoading, mediaUrl, onExport: _onExport }: Props) {
  if (!exportInfo) return null;

  return (
    <div
      style={{
        padding: "0.85rem",
        background: "var(--bg)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Package size={16} color="var(--accent)" />
        <strong style={{ fontSize: "0.85rem", color: "var(--text)" }}>Package Export Status</strong>
      </div>

      <div style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius)", border: "1px solid var(--success)", background: "rgba(46, 204, 113, 0.05)" }}>
        <p style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.5rem", color: "var(--success)" }}>
          ✓ Project exported successfully!
        </p>
        {exportInfo.files.includes("video/final.mp4") ? (
          <a
            className="btn-secondary"
            href={mediaUrl(`${exportInfo.export_path}/video/final.mp4`)}
            download
            style={{ fontSize: "0.75rem", padding: "0.35rem 0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem", textDecoration: "none", fontWeight: 600 }}
          >
            📥 Download Packaged Video (.mp4)
          </a>
        ) : (
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
            Export folder generated, but final.mp4 was missing.
          </p>
        )}
      </div>

      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "0.5rem", marginTop: "0.2rem" }}>
        Export includes: final video, thumbnails, subtitles (.srt), SEO metadata (.json), and an upload guide.
      </div>
    </div>
  );
}
