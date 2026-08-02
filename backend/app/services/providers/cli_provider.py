import subprocess

from app.config import settings

from .base import TextProvider


class CLIProvider(TextProvider):
    """Runs an external CLI tool (gemini, claude, qwen, grok, ollama run, ...).

    Configure via AI_PROVIDER_CLI with a ``{prompt}`` placeholder, e.g.::

        AI_PROVIDER_CLI=claude -p "{prompt}"
        AI_PROVIDER_CLI=gemini -p "{prompt}"
        AI_PROVIDER_CLI=ollama run llama3.2 "{prompt}"
    """

    name = "cli"

    def __init__(self) -> None:
        self.template = settings.ai_provider_cli.strip()
        if not self.template:
            raise ValueError("AI_PROVIDER_CLI is not configured")

    def complete(self, system: str, user: str, json_mode: bool = False) -> str:
        prompt = f"{system}\n\n{user}"
        if json_mode:
            prompt += "\n\nRespond with ONLY valid JSON. Do not use markdown code fences."

        command = self.template.replace("{prompt}", prompt)
        try:
            proc = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=settings.cli_timeout_seconds,
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(
                f"CLI provider timed out after {settings.cli_timeout_seconds}s"
            ) from None

        if proc.returncode != 0:
            raise RuntimeError(
                f"CLI provider failed (exit {proc.returncode}): {proc.stderr.strip()}"
            )
        return proc.stdout.strip()
