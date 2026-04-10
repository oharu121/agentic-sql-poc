"""Application configuration loaded from environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# backend/ is the Python root — data/ lives here after the monorepo restructure
_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    # "gemini" or "ollama"
    LLM_BACKEND: str = os.getenv("LLM_BACKEND", "gemini")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4:e4b")

    # Data directories — default relative to backend/, override via env
    RAW_DIR: Path = Path(os.getenv("RAW_DIR", str(_BACKEND_DIR / "data" / "raw")))
    PROCESSED_DIR: Path = Path(
        os.getenv("PROCESSED_DIR", str(_BACKEND_DIR / "data" / "processed"))
    )

    def validate(self) -> None:
        if self.LLM_BACKEND == "gemini" and not self.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY environment variable is required when LLM_BACKEND=gemini"
            )


settings = Settings()
