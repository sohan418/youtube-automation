import { useState, useEffect } from "react";
import { X, Key, Play } from "lucide-react";
import type { Project, SEOCategory, VoiceConfig } from "../../types";
import Select from "../ui/Select";

interface Props {
  isOpen: boolean;
  project: Project;
  categories: SEOCategory[];
  voiceConfig: VoiceConfig | null;
  youtubeConfig: { youtube_api_key_configured: boolean; youtube_playlist_id: string; youtube_client_id_configured: boolean; youtube_connected: boolean } | null;
  actionLoading: string;
  onClose: () => void;
  onSave: (
    settings: {
      name: string;
      description: string;
      category: string;
      language: string;
      ratio: string;
    },
    apiKeys: {
      sarvam_api_key: string;
      deepgram_api_key: string;
      elevenlabs_api_key: string;
    },
    youtubeKeys: {
      youtube_api_key: string;
      youtube_playlist_id: string;
      youtube_client_id: string;
      youtube_client_secret: string;
    },
  ) => Promise<void>;
}

export default function ProjectSettingsDialog({
  isOpen,
  project,
  categories,
  voiceConfig,
  youtubeConfig,
  actionLoading,
  onClose,
  onSave,
}: Props) {
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    category: "",
    language: "en",
    ratio: "16:9",
  });

  const [voiceKeys, setVoiceKeys] = useState({
    sarvam_api_key: "",
    deepgram_api_key: "",
    elevenlabs_api_key: "",
  });

  const [youtubeKeys, setYoutubeKeys] = useState({
    youtube_api_key: "",
    youtube_playlist_id: "",
    youtube_client_id: "",
    youtube_client_secret: "",
  });

  const [youtubeVerify, setYoutubeVerify] = useState<{ connected: boolean; needs_reconnect: boolean; reason: string } | null>(null);

  const startYoutubeAuth = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    try {
      const res = await fetch("/api/youtube/auth/url");
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } catch {}
  };

  useEffect(() => {
    if (isOpen && youtubeConfig?.youtube_connected) {
      (async () => {
        try {
          const res = await fetch("/api/youtube/verify");
          setYoutubeVerify(await res.json());
        } catch {
          setYoutubeVerify(null);
        }
      })();
    } else {
      setYoutubeVerify(null);
    }
  }, [isOpen, youtubeConfig]);

  useEffect(() => {
    if (isOpen) {
      setSettingsForm({
        name: project.name,
        description: project.description ?? "",
        category: project.category ?? "",
        language: project.language,
        ratio: project.ratio ?? "16:9",
      });
      setVoiceKeys({
        sarvam_api_key: "",
        deepgram_api_key: "",
        elevenlabs_api_key: "",
      });
      setYoutubeKeys({
        youtube_api_key: "",
        youtube_playlist_id: "",
        youtube_client_id: "",
        youtube_client_secret: "",
      });
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm.name.trim()) return;
    await onSave(settingsForm, voiceKeys, youtubeKeys);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSave}
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "680px",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow:
            "0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.4)",
          border: "1px solid var(--border)",
          padding: "1.25rem",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "0.5rem",
          }}
        >
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
            Project Settings
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "0.2rem",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Settings Fields */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
        >
          <label>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              Project Name *
            </span>
            <input
              value={settingsForm.name}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. My Amazing AI Video"
              required
              style={{
                width: "100%",
                padding: "0.45rem 0.65rem",
                marginTop: "2px",
              }}
            />
          </label>

          <label>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              Description
            </span>
            <textarea
              value={settingsForm.description}
              onChange={(e) =>
                setSettingsForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Brief description of your video..."
              rows={2}
              style={{
                width: "100%",
                padding: "0.45rem 0.65rem",
                marginTop: "2px",
              }}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
            }}
          >
            <label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Category
              </span>
              <Select
                value={settingsForm.category}
                onChange={(v) =>
                  setSettingsForm((f) => ({ ...f, category: String(v) }))
                }
                placeholder="Uncategorized"
                options={[
                  ...(settingsForm.category &&
                    !categories.some((c) => c.name === settingsForm.category)
                      ? [{ label: settingsForm.category, value: settingsForm.category }]
                      : []),
                  ...categories.map((cat) => ({ label: cat.name, value: cat.name })),
                ]}
                style={{ marginTop: "2px" }}
              />
            </label>

            <label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                Language
              </span>
              <Select
                value={settingsForm.language}
                onChange={(v) =>
                  setSettingsForm((f) => ({ ...f, language: String(v) }))
                }
                options={[
                  { label: "English", value: "en" },
                  { label: "Hindi", value: "hi" },
                  { label: "Hinglish", value: "hinglish" },
                ]}
                style={{ marginTop: "2px" }}
              />
            </label>
          </div>

          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Aspect Ratio</span>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "6px" }}>
              {[
                { value: "16:9", label: "16:9", sub: "1920×1080", w: 56, h: 32 },
                { value: "9:16", label: "9:16", sub: "1080×1920", w: 32, h: 56 },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    padding: "10px 8px",
                    borderRadius: "8px",
                    border: settingsForm.ratio === opt.value ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                    background: settingsForm.ratio === opt.value ? "rgba(var(--primary-rgb, 99,102,241), 0.08)" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: opt.w,
                      height: opt.h,
                      border: `2px solid ${settingsForm.ratio === opt.value ? "var(--primary)" : "var(--text-muted)"}`,
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.55rem",
                      fontWeight: 700,
                      color: settingsForm.ratio === opt.value ? "var(--primary)" : "var(--text-muted)",
                    }}
                  >
                    {opt.label}
                  </div>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{opt.sub}</span>
                  <input type="radio" name="ratio-settings" value={opt.value} checked={settingsForm.ratio === opt.value} onChange={() => setSettingsForm((f) => ({ ...f, ratio: opt.value }))} style={{ display: "none" }} />
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Voice API Keys Config */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: "0.4rem",
            paddingTop: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <h4
            style={{
              fontSize: "0.85rem",
              margin: 0,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Key size={14} color="var(--primary)" /> Voice API Keys
          </h4>
          <p
            style={{
              fontSize: "0.68rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            Keys are stored securely in <code>backend/.env</code> on this
            machine.
          </p>

          <div style={{ display: "grid", gap: "0.55rem" }}>
            <label>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Sarvam AI API Key</span>
                {voiceConfig?.sarvam_key_configured && (
                  <span
                    style={{ color: "var(--success)", fontSize: "0.65rem" }}
                  >
                    ✓ Configured
                  </span>
                )}
              </span>
              <input
                type="password"
                placeholder={
                  voiceConfig?.sarvam_key_configured
                    ? "••••••••••••••••"
                    : "Paste Sarvam AI key"
                }
                value={voiceKeys.sarvam_api_key}
                onChange={(e) =>
                  setVoiceKeys((prev) => ({
                    ...prev,
                    sarvam_api_key: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "0.38rem 0.6rem",
                  marginTop: "2px",
                }}
              />
            </label>

            <label>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Deepgram API Key</span>
                {voiceConfig?.deepgram_key_configured && (
                  <span
                    style={{ color: "var(--success)", fontSize: "0.65rem" }}
                  >
                    ✓ Configured
                  </span>
                )}
              </span>
              <input
                type="password"
                placeholder={
                  voiceConfig?.deepgram_key_configured
                    ? "••••••••••••••••"
                    : "Paste Deepgram key"
                }
                value={voiceKeys.deepgram_api_key}
                onChange={(e) =>
                  setVoiceKeys((prev) => ({
                    ...prev,
                    deepgram_api_key: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "0.38rem 0.6rem",
                  marginTop: "2px",
                }}
              />
            </label>

            <label>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>ElevenLabs API Key</span>
                {voiceConfig?.elevenlabs_key_configured && (
                  <span
                    style={{ color: "var(--success)", fontSize: "0.65rem" }}
                  >
                    ✓ Configured
                  </span>
                )}
              </span>
              <input
                type="password"
                placeholder={
                  voiceConfig?.elevenlabs_key_configured
                    ? "••••••••••••••••"
                    : "Paste ElevenLabs key"
                }
                value={voiceKeys.elevenlabs_api_key}
                onChange={(e) =>
                  setVoiceKeys((prev) => ({
                    ...prev,
                    elevenlabs_api_key: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "0.38rem 0.6rem",
                  marginTop: "2px",
                }}
              />
            </label>
          </div>
        </div>

        {/* YouTube API Config */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: "0.4rem",
            paddingTop: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <h4
            style={{
              fontSize: "0.85rem",
              margin: 0,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Play size={14} color="#ff0000" /> YouTube Integration
          </h4>
          <p
            style={{
              fontSize: "0.68rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            Connect your YouTube channel for AI suggestions and direct uploads.
          </p>

          <div style={{ display: "grid", gap: "0.55rem" }}>
            <label>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>YouTube API Key (Data API)</span>
                {youtubeConfig?.youtube_api_key_configured && (
                  <span style={{ color: "var(--success)", fontSize: "0.65rem" }}>✓ Configured</span>
                )}
              </span>
              <input
                type="password"
                placeholder={youtubeConfig?.youtube_api_key_configured ? "••••••••••••••••" : "Paste YouTube Data API key"}
                value={youtubeKeys.youtube_api_key}
                onChange={(e) => setYoutubeKeys((prev) => ({ ...prev, youtube_api_key: e.target.value }))}
                style={{ width: "100%", padding: "0.38rem 0.6rem", marginTop: "2px" }}
              />
            </label>

            <label>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                <span>Channel Uploads Playlist ID</span>
              </span>
              <input
                type="text"
                placeholder="e.g. UU-Tj0urQxuwGt-B3kXMcMTg"
                value={youtubeKeys.youtube_playlist_id || youtubeConfig?.youtube_playlist_id || ""}
                onChange={(e) => setYoutubeKeys((prev) => ({ ...prev, youtube_playlist_id: e.target.value }))}
                style={{ width: "100%", padding: "0.38rem 0.6rem", marginTop: "2px" }}
              />
            </label>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "0.35rem" }}>
                OAuth (for Upload)
              </span>
            </div>

            <label>
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Client ID</span>
                {youtubeConfig?.youtube_client_id_configured && (
                  <span style={{ color: "var(--success)", fontSize: "0.65rem" }}>✓ Configured</span>
                )}
              </span>
              <input
                type="password"
                placeholder={youtubeConfig?.youtube_client_id_configured ? "••••••••••••••••" : "Google OAuth Client ID"}
                value={youtubeKeys.youtube_client_id}
                onChange={(e) => setYoutubeKeys((prev) => ({ ...prev, youtube_client_id: e.target.value }))}
                style={{ width: "100%", padding: "0.38rem 0.6rem", marginTop: "2px" }}
              />
            </label>

            <label>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Client Secret</span>
              <input
                type="password"
                placeholder="Google OAuth Client Secret"
                value={youtubeKeys.youtube_client_secret}
                onChange={(e) => setYoutubeKeys((prev) => ({ ...prev, youtube_client_secret: e.target.value }))}
                style={{ width: "100%", padding: "0.38rem 0.6rem", marginTop: "2px" }}
              />
            </label>

            {youtubeConfig?.youtube_connected ? (
              youtubeVerify && !youtubeVerify.connected && youtubeVerify.needs_reconnect ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.55rem 0.65rem", borderRadius: "6px", background: "rgba(239,68,68,0.12)", border: "1px solid var(--danger)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ color: "var(--danger)", fontWeight: 600, fontSize: "0.78rem" }}>YouTube connection expired</span>
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    Your access token expired or was revoked. Reconnect to resume uploads.
                  </span>
                  <a
                    href="#"
                    onClick={startYoutubeAuth}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", padding: "0.45rem", fontSize: "0.78rem", textDecoration: "none", background: "#ff0000", border: "none" }}
                  >
                    <Play size={14} /> Reconnect YouTube Account
                  </a>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem", padding: "0.5rem 0.65rem", borderRadius: "6px", background: "rgba(34,197,94,0.1)", border: "1px solid var(--success)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ color: "var(--success)", fontWeight: 600, fontSize: "0.78rem" }}>✓ YouTube Connected</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>— Ready to upload</span>
                  </div>
                  <a
                    href="#"
                    onClick={startYoutubeAuth}
                    style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "underline" }}
                    title="Re-authorize the connected YouTube account"
                  >
                    Reconnect
                  </a>
                </div>
              )
            ) : youtubeConfig?.youtube_client_id_configured ? (
              <a
                href="#"
                onClick={startYoutubeAuth}
                className="btn-primary"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", padding: "0.5rem", fontSize: "0.8rem", textDecoration: "none", background: "#ff0000", border: "none" }}
              >
                <Play size={14} /> Connect YouTube Account
              </a>
            ) : (
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                Enter Client ID and Secret above, save, then click Connect
              </div>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            justifyContent: "flex-end",
            marginTop: "0.5rem",
            borderTop: "1px solid var(--border)",
            paddingTop: "0.75rem",
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={actionLoading === "settings"}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={actionLoading === "settings" || !settingsForm.name.trim()}
          >
            {actionLoading === "settings" ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
