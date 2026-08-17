import { Sparkles } from "lucide-react";
import type { SEOCategory, SEOMetadata, Script } from "../../types";

interface Props {
  seo: SEOMetadata | null;
  categories: SEOCategory[];
  activeScript: Script | null;
  actionLoading: string;
  onGenerate: () => void;
  onCategoryChange: (categoryId: number) => void;
}

export default function SeoStep({ seo, categories, activeScript, actionLoading, onGenerate, onCategoryChange }: Props) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>SEO Metadata</h3>
        <button className="btn-accent" disabled={!!actionLoading || !activeScript} onClick={onGenerate}>
          {actionLoading === "seo" ? "Generating..." : <><Sparkles size={14} style={{ verticalAlign: "middle" }} /> Generate SEO</>}
        </button>
      </div>
      {seo ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
              YOUTUBE CATEGORY
            </label>
            <select
              value={seo.category_id ?? ""}
              disabled={!!actionLoading}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v) onCategoryChange(v);
              }}
              style={{ width: "100%", maxWidth: 360 }}
            >
              <option value="" disabled>Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>TITLE</strong>
            <p>{seo.title}</p>
          </div>
          <div>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>DESCRIPTION</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{seo.description}</p>
          </div>
          <div>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>TAGS</strong>
            <p>{seo.tags}</p>
          </div>
          <div>
            <strong style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>HASHTAGS</strong>
            <p>{seo.hashtags}</p>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>Generate SEO metadata for YouTube upload.</p>
      )}
    </div>
  );
}
