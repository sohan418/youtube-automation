import { useState } from "react";
import { Copy, Check, ExternalLink, Sparkles, ClipboardPaste } from "lucide-react";

interface FreeAITool {
  name: string;
  url: string;
  color: string;
}

const FREE_TOOLS: FreeAITool[] = [
  { name: "ChatGPT", url: "https://chat.openai.com", color: "#10a37f" },
  { name: "Claude", url: "https://claude.ai", color: "#d4a574" },
  { name: "Gemini", url: "https://gemini.google.com", color: "#4285f4" },
  { name: "Grok", url: "https://grok.com", color: "#1d9bf0" },
];

interface Props {
  title: string;
  prompt?: string;
  promptPair?: { system: string; user: string };
  responsePlaceholder: string;
  tools?: FreeAITool[];
  onParseResponse: (text: string) => void;
}

export default function FreeAIGuide({ title, prompt, promptPair, responsePlaceholder, tools = FREE_TOOLS, onParseResponse }: Props) {
  const displayPrompt = promptPair
    ? `SYSTEM PROMPT:\n${promptPair.system}\n\nUSER PROMPT:\n${promptPair.user}`
    : prompt || "";
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasted(text);
      setShowPaste(true);
    } catch {
      setShowPaste(true);
    }
  };

  const handleSubmit = () => {
    if (!pasted.trim()) return;
    onParseResponse(pasted);
    setPasted("");
    setShowPaste(false);
  };

  return (
    <div
      style={{
        border: "1.5px dashed var(--primary)",
        borderRadius: "10px",
        padding: "1rem",
        background: "rgba(var(--primary-rgb, 99,102,241), 0.04)",
        marginTop: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem" }}>
        <Sparkles size={15} color="var(--primary)" />
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--primary)" }}>{title}</span>
        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginLeft: "auto" }}>Free to use</span>
      </div>

      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: "0 0 0.5rem" }}>
        Copy this prompt, paste it in any free AI tool, then paste the response below.
      </p>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        {tools.map((tool) => (
          <a
            key={tool.name}
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: `1px solid ${tool.color}30`,
              background: `${tool.color}10`,
              color: tool.color,
              fontSize: "0.7rem",
              fontWeight: 600,
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            {tool.name} <ExternalLink size={10} />
          </a>
        ))}
      </div>

      <div style={{ position: "relative", marginBottom: "0.5rem" }}>
        <pre
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "0.6rem 2.2rem 0.6rem 0.6rem",
            fontSize: "0.7rem",
            lineHeight: 1.5,
            color: "var(--text)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
            maxHeight: "120px",
            overflowY: "auto",
          }}
        >
          {displayPrompt}
        </pre>
        <button
          onClick={handleCopy}
          title="Copy prompt"
          style={{
            position: "absolute",
            top: "6px",
            right: "6px",
            background: copied ? "var(--success)" : "var(--primary)",
            border: "none",
            borderRadius: "4px",
            padding: "4px",
            cursor: "pointer",
            color: "white",
            display: "flex",
            transition: "all 0.2s",
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button
          className="btn-secondary"
          onClick={handlePaste}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "0.75rem" }}
        >
          <ClipboardPaste size={13} /> Paste AI Response
        </button>
        {showPaste && (
          <button
            className="btn-secondary"
            onClick={() => { setShowPaste(false); setPasted(""); }}
            style={{ fontSize: "0.75rem" }}
          >
            Cancel
          </button>
        )}
      </div>

      {showPaste && (
        <div style={{ marginTop: "0.5rem" }}>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={responsePlaceholder}
            rows={5}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: "0.75rem",
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!pasted.trim()}
            style={{ marginTop: "0.4rem", width: "100%", fontSize: "0.8rem" }}
          >
            Use This Response
          </button>
        </div>
      )}
    </div>
  );
}
