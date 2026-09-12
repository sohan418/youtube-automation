import React, { useState, useEffect, useRef } from "react";
import { Bot, Send, X, Loader2, Minus, Trash2 } from "lucide-react";
import { api } from "../../api/client";
import "./StudioCopilotDrawer.css";

interface StudioCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onStateModified?: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "✨ Make hook punchy",
  "🎬 Add scene about tech trends",
  "🗣️ Suggest video ideas",
  "🎥 Render full video",
];

function formatMessageText(text: string) {
  if (!text) return "";
  
  let formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/###\s*(.*?)(?:\n|$)/g, "<h3>$1</h3>");
  formatted = formatted.replace(/##\s*(.*?)(?:\n|$)/g, "<h3>$1</h3>");
  formatted = formatted.replace(/^\s*[-*]\s+(.*?)$/gm, "• $1");

  return formatted;
}

export const StudioCopilotDrawer: React.FC<StudioCopilotDrawerProps> = ({
  isOpen,
  onClose,
  projectId,
  onStateModified,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      try {
        const res = await api.getProjectChatHistory(projectId);
        setMessages(res.history || []);
      } catch (err) {
        console.error("Failed to load chat history", err);
      }
    };

    fetchHistory();
  }, [isOpen, projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleClearHistory = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await api.clearProjectChatHistory(projectId);
      setMessages(res.history || []);
    } catch (err) {
      console.error("Failed to clear chat history", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const msg = textToSend || inputMsg;
    if (!msg.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMsg("");
    setLoading(true);

    try {
      const res = await api.sendProjectChatMessage(projectId, msg);
      setMessages(res.history || []);

      if (res.state_modified && onStateModified) {
        onStateModified();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message || "Failed to reach AI Agent"}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="copilot-drawer">
      {/* Header */}
      <div className="copilot-header">
        <div className="copilot-header-info">
          <div className="copilot-avatar">
            <Bot size={18} />
          </div>
          <div>
            <div className="copilot-title">
              AI Video Copilot
              <span className="copilot-status-dot" />
            </div>
            <div className="copilot-subtitle">Conversational Studio Assistant</div>
          </div>
        </div>
        <div className="copilot-header-actions">
          <button onClick={handleClearHistory} className="copilot-close-btn" title="Clear Chat History">
            <Trash2 size={15} />
          </button>
          <button onClick={onClose} className="copilot-close-btn" title="Minimize Drawer">
            <Minus size={16} />
          </button>
          <button onClick={onClose} className="copilot-close-btn" title="Close AI Assistant">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="copilot-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`copilot-msg-row ${msg.role}`}>
            <div
              className="copilot-bubble"
              dangerouslySetInnerHTML={{ __html: formatMessageText(msg.content) }}
            />
          </div>
        ))}

        {loading && (
          <div className="copilot-msg-row assistant">
            <div className="copilot-typing">
              <Loader2 size={14} className="spinner" style={{ margin: 0 }} />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="copilot-quick-prompts">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp}
            onClick={() => handleSend(qp.replace(/^[^\w\s]+/, "").trim())}
            disabled={loading}
            className="copilot-chip"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="copilot-input-area">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="copilot-input-form"
        >
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Ask agent or command ('Make hook punchier')..."
          />
          <button type="submit" disabled={!inputMsg.trim() || loading} className="copilot-send-btn">
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
