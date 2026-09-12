import React, { useState, useEffect } from "react";
import { Bot, CheckCircle2, Loader2, AlertCircle, Sparkles, X, Play, RefreshCw } from "lucide-react";
import { api } from "../../api/client";

interface AutoProducerProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  initialTopic?: string;
  onComplete?: () => void;
}

const STAGES = [
  "Script Generation",
  "Scene Decomposition",
  "Voiceover Generation",
  "Visual Generation",
  "Timeline Assembly",
  "Video Rendering",
  "Completed",
];

export const AutoProducerProgressModal: React.FC<AutoProducerProgressModalProps> = ({
  isOpen,
  onClose,
  projectId,
  initialTopic = "",
  onComplete,
}) => {
  const [topic, setTopic] = useState(initialTopic);
  const [category, setCategory] = useState("Technology");
  const [language, setLanguage] = useState("en");
  const [duration, setDuration] = useState(3);
  const [hitlMode, setHitlMode] = useState(true);

  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "waiting_script_approval" | "waiting_visuals_approval" | "completed" | "failed">("idle");
  const [stage, setStage] = useState("Not Started");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [approvalStage, setApprovalStage] = useState<string | null>(null);

  // Poll status when running or waiting for approval
  useEffect(() => {
    if (!isOpen) return;

    const checkStatus = async () => {
      try {
        const res = await api.getAutoProduceStatus(projectId);
        setStatus(res.status);
        setStage(res.stage);
        setProgress(res.progress);
        setLogs(res.logs || []);
        setError(res.error);
        setVideoUrl(res.video_url);
        setWaitingApproval(!!res.waiting_approval);
        setApprovalStage(res.approval_stage || null);

        if (res.status === "running") {
          setIsRunning(true);
        } else if (res.status === "waiting_script_approval" || res.status === "waiting_visuals_approval") {
          setIsRunning(false);
        } else if (res.status === "completed") {
          setIsRunning(false);
          if (onComplete) onComplete();
        } else if (res.status === "failed") {
          setIsRunning(false);
        }
      } catch (err) {
        console.error("Failed to fetch auto produce status", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [isOpen, projectId, onComplete]);

  if (!isOpen) return null;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    try {
      setIsRunning(true);
      setStatus("running");
      setProgress(5);
      setStage("Initializing LangChain Agent...");
      setError(null);
      setLogs(["Initializing agent pipeline..."]);

      await api.startAutoProduce(projectId, {
        topic,
        category,
        language,
        duration_minutes: duration,
        hitl_mode: hitlMode,
      });
    } catch (err: any) {
      setIsRunning(false);
      setStatus("failed");
      setError(err.message || "Failed to start agent");
    }
  };

  const handleApproveStep = async () => {
    try {
      setIsRunning(true);
      const stageToApprove = approvalStage || "script";
      await api.approveAutoProduceStep(projectId, stageToApprove);
      setWaitingApproval(false);
      setApprovalStage(null);
    } catch (err: any) {
      console.error("Failed to approve step", err);
    }
  };

  const getStageIndex = (stageName: string) => {
    return STAGES.findIndex((s) => stageName.toLowerCase().includes(s.toLowerCase()));
  };

  const currentStageIndex = getStageIndex(stage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                LangChain AI Video Producer
                <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/20">
                  LangGraph
                </span>
              </h2>
              <p className="text-xs text-slate-400">Autonomous Video Creation Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6 space-y-6">
          {/* Form input if idle */}
          {status === "idle" && (
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Video Topic or Idea
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Top 5 AI Discoveries in 2026"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Education">Education</option>
                    <option value="Finance">Finance</option>
                    <option value="Entertainment">Entertainment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="hinglish">Hinglish</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 3)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* HITL Checkpoint Toggle */}
              <div className="flex items-center space-x-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
                <input
                  type="checkbox"
                  id="hitl-toggle"
                  checked={hitlMode}
                  onChange={(e) => setHitlMode(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="hitl-toggle" className="text-xs font-medium text-purple-200 cursor-pointer">
                  🎯 Enable Human-in-the-Loop Step Checkpoints
                  <span className="block text-[11px] text-slate-400 font-normal">
                    Pauses pipeline at Script & Visuals generation for human approval & AI Copilot revisions.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:from-purple-500 hover:to-indigo-500"
              >
                <Sparkles className="h-4 w-4" /> Start Autonomous LangChain Production
              </button>
            </form>
          )}

          {/* Active progress tracking */}
          {status !== "idle" && (
            <div className="space-y-6">
              {/* HITL Approval Banner */}
              {waitingApproval && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 shadow-lg shadow-amber-500/10">
                  <div className="flex items-start space-x-3">
                    <Sparkles className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-200">
                        {approvalStage === "script"
                          ? "🎯 Checkpoint 1: Script Ready for Approval"
                          : "🎯 Checkpoint 2: Visuals & Voiceover Ready for Approval"}
                      </h4>
                      <p className="text-xs text-amber-300/80 mt-1">
                        {approvalStage === "script"
                          ? "Review or edit your video script, or ask the AI Assistant for changes. Click below when ready to proceed."
                          : "Review scenes, audio, and visual prompts in the studio timeline. Click below to compile & render final MP4."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleApproveStep}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:from-amber-400 hover:to-amber-500 transition"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {approvalStage === "script" ? "Approve Script & Generate Visuals" : "Approve Visuals & Render Video"}
                    </button>
                  </div>
                </div>
              )}
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                    {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {stage}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Pipeline Stage List */}
              <div className="grid grid-cols-2 gap-2">
                {STAGES.slice(0, 6).map((stg, idx) => {
                  const isDone = currentStageIndex > idx || status === "completed";
                  const isCurrent = currentStageIndex === idx && status === "running";

                  return (
                    <div
                      key={stg}
                      className={`flex items-center space-x-2.5 rounded-xl border p-3 text-xs transition ${
                        isDone
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : isCurrent
                          ? "border-purple-500/50 bg-purple-500/10 text-purple-200"
                          : "border-slate-800 bg-slate-950/50 text-slate-500"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="h-4 w-4 text-purple-400 animate-spin shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] shrink-0">
                          {idx + 1}
                        </div>
                      )}
                      <span className="font-medium truncate">{stg}</span>
                    </div>
                  );
                })}
              </div>

              {/* Logs Box */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-slate-300 max-h-36 overflow-y-auto space-y-1">
                {logs.map((lg, i) => (
                  <div key={i} className="leading-relaxed">
                    {lg}
                  </div>
                ))}
              </div>

              {/* Failure State */}
              {status === "failed" && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-semibold">Production Error</p>
                    <p className="text-red-400/90">{error || "An unexpected error occurred during creation."}</p>
                    <button
                      onClick={() => setStatus("idle")}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/30"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Completion State */}
              {status === "completed" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Full Video Production Complete!</h3>
                    <p className="text-xs text-emerald-300/80">
                      Script, Voiceover, Media, and Timeline compiled into final MP4.
                    </p>
                  </div>
                  {videoUrl && (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500"
                    >
                      <Play className="h-4 w-4" /> Watch Final Video
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
