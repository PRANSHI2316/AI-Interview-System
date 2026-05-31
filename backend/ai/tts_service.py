"""Text-to-speech via Microsoft Edge neural voices (reliable Hindi/Hinglish)."""
import asyncio
from typing import Optional

# Natural Indian voices — Swara/Madhur handle Hindi + Hinglish well
LANGUAGE_VOICES = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "hinglish": "hi-IN-SwaraNeural",
}


async def _synthesize_async(text: str, language: str) -> bytes:
    import edge_tts

    voice = LANGUAGE_VOICES.get(language, LANGUAGE_VOICES["hi"])
    communicate = edge_tts.Communicate(text.strip(), voice)
    chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


def synthesize_speech(text: str, language: str = "en") -> bytes:
    """Return MP3 audio bytes for the given text and language key (en|hi|hinglish)."""
    if not (text or "").strip():
        return b""
    lang = language if language in LANGUAGE_VOICES else "hi"
    return asyncio.run(_synthesize_async(text, lang))


def is_tts_available() -> bool:
    try:
        import edge_tts  # noqa: F401

        return True
    except ImportError:
        return False


def get_voice_name(language: str) -> Optional[str]:
    return LANGUAGE_VOICES.get(language)
