import json
import os
import re
import urllib.error
import urllib.request


class GeminiInterviewService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    def _call_gemini(self, prompt: str, max_output_tokens: int = 700) -> str:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.75,
                "maxOutputTokens": max_output_tokens,
                "responseMimeType": "application/json",
            },
        }

        return self._post_gemini(url, payload)

    def call_gemini_chat(
        self,
        system_instruction: str,
        messages: list,
        max_output_tokens: int = 1200,
    ) -> str:
        """Multi-turn chat with system instruction — messages: [{role, content}]."""
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY not configured")

        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            if role == "assistant":
                role = "model"
            text = msg.get("content", "")
            if text:
                contents.append({"role": role, "parts": [{"text": text}]})

        if not contents:
            raise RuntimeError("No messages for Gemini chat")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
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

    def _post_gemini(self, url: str, payload: dict) -> str:
        req = urllib.request.Request(
            url=url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as response:
                body = json.loads(response.read().decode("utf-8"))
                return body["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Gemini HTTP error: {exc.code}") from exc
        except Exception as exc:
            raise RuntimeError(f"Gemini request failed: {exc}") from exc

    def _extract_json(self, text: str, fallback: dict) -> dict:
        text = text.strip()
        if text.startswith("{") and text.endswith("}"):
            try:
                return json.loads(text)
            except Exception:
                pass

        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                return fallback
        return fallback

    def generate_opening_question(self, profile: dict) -> str:
        fallback = "Tell me about yourself and your recent work experience."
        prompt = f"""
You are a professional human-like interviewer.
Candidate profile: {json.dumps(profile)}
Return JSON: {{"opening_question":"..."}}
Question must be warm, concise, and interview-like.
"""
        try:
            parsed = self._extract_json(self._call_gemini(prompt), {"opening_question": fallback})
            return parsed.get("opening_question", fallback)
        except Exception:
            return fallback

    def analyze_turn(self, question: str, answer: str, speech_metrics: dict, emotion_metrics: dict) -> dict:
        fallback = {
            "communication_score": 72,
            "technical_score": 68,
            "confidence_score": 66,
            "emotional_stability_score": 70,
            "nervousness_detected": bool(emotion_metrics.get("nervousness", False)),
            "coaching_line": "Good effort. Try to answer with one specific example next time.",
            "next_question": "Can you share one project where you solved a difficult problem?",
        }

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
        try:
            parsed = self._extract_json(self._call_gemini(prompt), fallback)
            return {**fallback, **parsed}
        except Exception:
            return fallback

    def generate_final_feedback(self, summary: dict) -> dict:
        fallback = {
            "overall_score": 72,
            "communication_score": summary.get("communication_score", 70),
            "confidence_score": summary.get("confidence_score", 68),
            "technical_score": summary.get("technical_score", 69),
            "eye_contact_score": summary.get("eye_contact_score", 70),
            "emotional_stability_score": summary.get("emotional_stability_score", 71),
            "filler_word_count": summary.get("filler_word_count", 0),
            "feedback_text": (
                "Your interview performance was good overall. "
                "Focus on reducing filler words and keep eye contact steady. "
                "Your technical direction is promising."
            ),
            "spoken_feedback": (
                "Overall your interview performance was good. "
                "Focus more on communication confidence and reducing hesitation."
            ),
        }

        prompt = f"""
You are a senior interview coach. Generate personalized final feedback.
Interview summary: {json.dumps(summary)}
Return strict JSON with keys:
overall_score, communication_score, confidence_score, technical_score,
eye_contact_score, emotional_stability_score, filler_word_count,
feedback_text, spoken_feedback.
Keep feedback supportive and practical.
"""
        try:
            parsed = self._extract_json(self._call_gemini(prompt), fallback)
            return {**fallback, **parsed}
        except Exception:
            return fallback
