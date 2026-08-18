import { useState, useEffect } from "react";
import { api } from "../api/client";

interface PromptPair {
  system: string;
  user: string;
}

export function usePrompts(projectId: number, refreshKey?: string | number) {
  const [prompts, setPrompts] = useState<Record<string, PromptPair>>({});

  useEffect(() => {
    if (!projectId) return;
    api.getPrompts(projectId).then(setPrompts).catch(() => {});
  }, [projectId, refreshKey]);

  return prompts;
}
