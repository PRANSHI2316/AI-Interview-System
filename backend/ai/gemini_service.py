import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


class GeminiAnalysisError(Exception):
    """Raised when Gemini cannot produce valid analysis (no fake fallbacks)."""

    def __init__(self, message: str, detail: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.detail = detail


class GeminiInterviewService:
    MAX_RETRIES = 3
    RETRY_DELAY_SEC = 1.5

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def test_connectivity(self) -> bool:
        """Lightweight API ping before analysis."""
        if not self.is_configured():
            print("[Gemini] connectivity test failed: GEMINI_API_KEY not configured")
            return False
        try:
            text = self._call_gemini_raw(
                'Reply with JSON only: {"status":"ok"}',
                max_output_tokens=32,
            )
            print(f"[Gemini] connectivity test response length={len(text)}")
            return bool(text.strip())
        except GeminiAnalysisError as exc:
            print(f"[Gemini] connectivity test failed: {exc.message}")
            if exc.detail:
                print(f"[Gemini] connectivity detail: {exc.detail}")
            return False

    def _call_gemini(self, prompt: str, max_output_tokens: int = 700) -> str:
        return self._call_gemini_raw(prompt, max_output_tokens)

    def call_gemini_chat(
        self,
        system_instruction: str,
        messages: list,
        max_output_tokens: int = 1200,
    ) -> str:
        if not self.api_key:
            raise GeminiAnalysisError(
                "AI analysis unavailable",
                "GEMINI_API_KEY not configured",
            )

        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            if role == "assistant":
                role = "model"
            text = msg.get("content", "")
            if text:
                contents.append({"role": role, "parts": [{"text": text}]})

        if not contents:
            raise GeminiAnalysisError("AI analysis unavailable", "No messages for Gemini chat")

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": "application/json",
            },
        }
        return self._post_gemini(url, payload)

    def _call_gemini_raw(self, prompt: str, max_output_tokens: int = 700) -> str:
        if not self.api_key:
            raise GeminiAnalysisError(
                "AI analysis unavailable",
                "GEMINI_API_KEY not configured",
            )

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.75,
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": "application/json",
            },
        }
        return self._post_gemini(url, payload)

    def _post_gemini(self, url: str, payload: dict) -> str:
        last_error = "Unknown Gemini error"

        for attempt in range(1, self.MAX_RETRIES + 1):
            print(f"[Gemini] request attempt {attempt}/{self.MAX_RETRIES} model={self.model}")
            req = urllib.request.Request(
                url=url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=25) as response:
                    body = json.loads(response.read().decode("utf-8"))
                    text = body["candidates"][0]["content"]["parts"][0]["text"]
                    if not (text or "").strip():
                        raise GeminiAnalysisError(
                            "AI analysis unavailable",
                            "Empty Gemini response",
                        )
                    print(f"[Gemini] response received length={len(text)}")
                    return text
            except urllib.error.HTTPError as exc:
                err_body = ""
                try:
                    err_body = exc.read().decode("utf-8", errors="replace")[:500]
                except Exception:
                    pass
                last_error = f"HTTP {exc.code}: {err_body or exc.reason}"
                print(f"[Gemini] API error attempt {attempt}: {last_error}")
            except GeminiAnalysisError:
                raise
            except Exception as exc:
                last_error = str(exc)
                print(f"[Gemini] request failed attempt {attempt}: {last_error}")

            if attempt < self.MAX_RETRIES:
                time.sleep(self.RETRY_DELAY_SEC)

        raise GeminiAnalysisError("AI analysis unavailable", last_error)

    def _extract_json(self, text: str) -> dict:
        text = (text or "").strip()
        if not text:
            raise GeminiAnalysisError("AI analysis unavailable", "Empty Gemini JSON")

        candidates = [text]
        if not (text.startswith("{") and text.endswith("}")):
            match = re.search(r"\{.*\}", text, flags=re.DOTALL)
            if match:
                candidates.append(match.group(0))

        for candidate in candidates:
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict) and parsed:
                    print(f"[Gemini] parsed JSON keys={list(parsed.keys())}")
                    return parsed
            except json.JSONDecodeError:
                continue

        raise GeminiAnalysisError("AI analysis unavailable", "Could not parse Gemini JSON")

    def generate_opening_question(self, profile: dict) -> str:
        prompt = f"""
You are a professional human-like interviewer.
Candidate profile: {json.dumps(profile)}
Return JSON: {{"opening_question":"..."}}
Question must be warm, concise, and interview-like.
"""
        parsed = self._extract_json(self._call_gemini(prompt))
        question = (parsed.get("opening_question") or "").strip()
        if not question:
            raise GeminiAnalysisError("AI analysis unavailable", "Missing opening_question")
        return question

    def analyze_turn(self, question: str, answer: str, speech_metrics: dict, emotion_metrics: dict) -> dict:
        prompt = f"""
You are an expert interviewer. Analyze the turn and continue naturally.
Question: {question}
Answer: {answer}
Speech metrics: {json.dumps(speech_metrics)}
Emotion metrics: {json.dumps(emotion_metrics)}

Return strict JSON with keys:
communication_score (0-100),
technical_score (0-100),
confidence_score (0-100),
emotional_stability_score (0-100),
nervousness_detected (true/false),
coaching_line (short encouraging line),
next_question (human-like follow-up based on answer).
"""
        parsed = self._extract_json(self._call_gemini(prompt))
        return parsed

    def generate_final_feedback(self, summary: dict) -> dict:
        prompt = f"""
You are a senior interview coach. Generate personalized final feedback.
Interview summary: {json.dumps(summary)}
Return strict JSON with keys:
overall_score, communication_score, confidence_score, technical_score,
eye_contact_score, emotional_stability_score, filler_word_count,
feedback_text, spoken_feedback.
Keep feedback supportive and practical.
"""
        parsed = self._extract_json(self._call_gemini(prompt, max_output_tokens=1800))
        return parsed
