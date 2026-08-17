import { Sparkles } from "lucide-react";
import type { Idea } from "../../types";

interface Props {
  ideas: Idea[];
  actionLoading: string;
  ideaTopic: string;
  onTopicChange: (v: string) => void;
  onGenerate: () => void;
  onSelect: (id: number) => void;
}

export default function IdeasStep({ ideas, actionLoading, ideaTopic, onTopicChange, onGenerate, onSelect }: Props) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3>Video Ideas</h3>
        <button className="btn-accent" disabled={!!actionLoading} onClick={onGenerate}>
          {actionLoading === "ideas" ? "Generating..." : <><Sparkles size={14} style={{ verticalAlign: "middle" }} /> Generate Ideas</>}
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          value={ideaTopic}
          onChange={(e) => onTopicChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !actionLoading) {
              (e.target as HTMLInputElement).closest("div")?.querySelector<HTMLButtonElement>(".btn-accent")?.click();
            }
          }}
          placeholder="Enter a topic to generate ideas (e.g. 'AI tools', 'street food')"
          style={{ flex: 1 }}
        />
      </div>
      {ideas.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No ideas yet. Enter a topic and click Generate Ideas.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="card"
              style={{
                borderColor: idea.is_selected ? "var(--accent)" : "var(--border)",
                background: idea.is_selected ? "rgba(62,166,255,0.05)" : "var(--surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h4 style={{ marginBottom: "0.25rem" }}>{idea.title}</h4>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{idea.description}</p>
                  <span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>
                    Score: {idea.trending_score} · {idea.category}
                  </span>
                </div>
                <button
                  className={idea.is_selected ? "btn-accent" : "btn-secondary"}
                  disabled={!!actionLoading}
                  onClick={() => onSelect(idea.id)}
                >
                  {idea.is_selected ? "Selected" : "Select"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
