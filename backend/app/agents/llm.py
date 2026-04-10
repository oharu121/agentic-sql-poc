"""LLM abstraction: Gemini (production) or Ollama (local dev).

Switch via LLM_BACKEND env var: "gemini" (default) or "ollama".
"""

import asyncio
import logging

from app.config import settings

logger = logging.getLogger(__name__)


async def call_llm(system_prompt: str, messages: list[dict]) -> str:
    """
    Call the configured LLM and return the full response text.

    Args:
        system_prompt: The system instruction for the model.
        messages: Conversation turns as [{"role": "user"/"assistant", "content": str}, ...]
                  The last message must be role "user".

    Returns:
        The model's response text (expected to be a SQL query).
    """
    if settings.LLM_BACKEND == "ollama":
        return await _call_ollama(system_prompt, messages)
    return await _call_gemini(system_prompt, messages)


async def _call_gemini(system_prompt: str, messages: list[dict]) -> str:
    """Call Gemini API (non-streaming) for SQL generation."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    # Map conversation history to Gemini's Content format
    # "assistant" role maps to "model" in Gemini's API
    contents: list[types.Content] = []
    for msg in messages:
        gemini_role = "model" if msg["role"] == "assistant" else "user"
        contents.append(
            types.Content(
                role=gemini_role,
                parts=[types.Part.from_text(text=msg["content"])],
            )
        )

    gen_config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0,
        max_output_tokens=512,
    )

    logger.info(f"Calling Gemini ({settings.GEMINI_MODEL}) with {len(contents)} message(s)")

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=settings.GEMINI_MODEL,
        contents=contents,
        config=gen_config,
    )

    return response.text or ""


async def _call_ollama(system_prompt: str, messages: list[dict]) -> str:
    """Call local Ollama (non-streaming) for SQL generation."""
    import ollama

    ollama_messages = [{"role": "system", "content": system_prompt}] + messages

    logger.info(f"Calling Ollama ({settings.OLLAMA_MODEL}) with {len(messages)} message(s)")

    response = await asyncio.to_thread(
        ollama.chat,
        model=settings.OLLAMA_MODEL,
        messages=ollama_messages,
    )

    return response.message.content or ""
