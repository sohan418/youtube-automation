import React, { useState, useEffect } from "react";
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, X, Sparkles, RefreshCw, Cpu } from "lucide-react";
import { api } from "../../api/client";
import "./LLMKeysSettingsModal.css";

interface LLMKeysSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface KeyState {
  ai_provider: string;
  openai_api_key: string;
  gemini_api_key: string;
  openrouter_api_key: string;
  groq_api_key: string;
  anthropic_api_key: string;
  ollama_base_url: string;
  ollama_model: string;
}

export const LLMKeysSettingsModal: React.FC<LLMKeysSettingsModalProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<KeyState>({
    ai_provider: "auto",
    openai_api_key: "",
    gemini_api_key: "",
    openrouter_api_key: "",
    groq_api_key: "",
    anthropic_api_key: "",
    ollama_base_url: "http://localhost:11434",
    ollama_model: "llama3.2",
  });

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, { status: "testing" | "success" | "failed"; msg?: string }>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    api.getLLMKeys()
      .then((res) => {
        setKeys({
          ai_provider: res.ai_provider || "auto",
          openai_api_key: res.openai_api_key || "",
          gemini_api_key: res.gemini_api_key || "",
          openrouter_api_key: res.openrouter_api_key || "",
          groq_api_key: res.groq_api_key || "",
          anthropic_api_key: res.anthropic_api_key || "",
          ollama_base_url: res.ollama_base_url || "http://localhost:11434",
          ollama_model: res.ollama_model || "llama3.2",
        });
      })
      .catch((err) => console.error("Failed to load LLM keys", err));
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleShowKey = (field: string) => {
    setShowKeys((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleTestKey = async (provider: string, keyValue: string) => {
    setTestStatus((prev) => ({ ...prev, [provider]: { status: "testing" } }));

    try {
      const res = await api.testLLMKey(provider, keyValue);
      setTestStatus((prev) => ({
        ...prev,
        [provider]: { status: "success", msg: res.response || "Connection successful" },
      }));
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [provider]: { status: "failed", msg: err.message || "Connection failed" },
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);

    try {
      await api.updateLLMKeys(keys);
      setSuccessMsg("API Keys and LLM settings saved successfully!");
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(`Failed to save LLM settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const PROVIDERS_CONFIG = [
    { id: "openai", name: "OpenAI", field: "openai_api_key", placeholder: "sk-proj-...", badge: "GPT-4o / DALL-E" },
    { id: "gemini", name: "Google Gemini", field: "gemini_api_key", placeholder: "AIzaSy...", badge: "Gemini 2.5 Flash / Pro" },
    { id: "openrouter", name: "OpenRouter", field: "openrouter_api_key", placeholder: "sk-or-v1-...", badge: "DeepSeek / Llama 3.3" },
    { id: "groq", name: "Groq", field: "groq_api_key", placeholder: "gsk_...", badge: "Ultra-fast Llama 3.3" },
    { id: "anthropic", name: "Anthropic Claude", field: "anthropic_api_key", placeholder: "sk-ant-...", badge: "Claude 3.5 Sonnet" },
  ];

  return (
    <div className="llm-modal-overlay" onClick={onClose}>
      <div className="llm-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="llm-modal-header">
          <div className="llm-modal-header-left">
            <div className="llm-modal-icon">
              <Key size={20} />
            </div>
            <div>
              <div className="llm-modal-title">LLM Models & API Keys</div>
              <div className="llm-modal-subtitle">Configure AI Providers & API Credentials</div>
            </div>
          </div>
          <button onClick={onClose} className="llm-modal-close" title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="llm-modal-body">
            {/* Active Provider Selector */}
            <div className="llm-provider-card">
              <div className="llm-provider-label">
                <Cpu size={14} /> Active LLM Provider
              </div>
              <select
                value={keys.ai_provider}
                onChange={(e) => setKeys({ ...keys, ai_provider: e.target.value })}
                className="llm-provider-select"
              >
                <option value="auto">Auto (Recommended - Uses configured key)</option>
                <option value="openai">OpenAI (GPT-4o-mini)</option>
                <option value="gemini">Google Gemini (Gemini 2.5 Flash)</option>
                <option value="openrouter">OpenRouter (DeepSeek R1 / Llama 3.3)</option>
                <option value="groq">Groq (Llama 3.3 70B - Ultra Fast)</option>
                <option value="anthropic">Anthropic Claude (Claude 3.5 Sonnet)</option>
                <option value="ollama">Ollama (Local LLM)</option>
                <option value="mock">Mock / Offline Mode</option>
              </select>
            </div>

            {/* Provider API Key Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="llm-section-title">API Provider Credentials</div>

              {PROVIDERS_CONFIG.map((prov) => {
                const val = (keys as any)[prov.field] || "";
                const test = testStatus[prov.id];
                const isVisible = showKeys[prov.field];

                return (
                  <div key={prov.id} className="llm-key-item">
                    <div className="llm-key-top">
                      <div className="llm-key-name">
                        {prov.name}
                        <span className="llm-key-badge">{prov.badge}</span>
                      </div>
                      {val.trim() && (
                        <button
                          type="button"
                          onClick={() => handleTestKey(prov.id, val)}
                          disabled={test?.status === "testing"}
                          className="llm-test-btn"
                        >
                          {test?.status === "testing" ? <Loader2 size={12} className="spinner" style={{ margin: 0 }} /> : <RefreshCw size={12} />}
                          Test Key
                        </button>
                      )}
                    </div>

                    <div className="llm-key-input-wrapper">
                      <input
                        type={isVisible ? "text" : "password"}
                        value={val}
                        onChange={(e) => setKeys({ ...keys, [prov.field]: e.target.value })}
                        placeholder={prov.placeholder}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(prov.field)}
                        className="llm-eye-btn"
                      >
                        {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {test && (
                      <div className={`llm-test-result ${test.status}`}>
                        {test.status === "success" && <><CheckCircle2 size={13} /> {test.msg}</>}
                        {test.status === "failed" && <><AlertCircle size={13} /> {test.msg}</>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Local Ollama Settings */}
            <div className="llm-key-item">
              <div className="llm-section-title" style={{ color: "#a5b4fc" }}>🦙 Local Ollama Configuration</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Base URL</label>
                  <input
                    type="text"
                    value={keys.ollama_base_url}
                    onChange={(e) => setKeys({ ...keys, ollama_base_url: e.target.value })}
                    style={{ background: "#0d0f17" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Model Name</label>
                  <input
                    type="text"
                    value={keys.ollama_model}
                    onChange={(e) => setKeys({ ...keys, ollama_model: e.target.value })}
                    style={{ background: "#0d0f17" }}
                  />
                </div>
              </div>
            </div>

            {successMsg && (
              <div className="success-msg" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="llm-modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              {saving ? <Loader2 size={14} className="spinner" style={{ margin: 0 }} /> : <Sparkles size={14} />} Save LLM Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
