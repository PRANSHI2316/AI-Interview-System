"""Validate that scores exist only from real Gemini analysis."""

from typing import Dict, List, Optional


TURN_SCORE_KEYS = (
    "communication_score",
    "technical_score",
    "confidence_score",
    "emotional_stability_score",
)

REPORT_SCORE_KEYS = (
    "overall_score",
    "communication_score",
    "confidence_score",
    "technical_score",
    "fluency_score",
    "clarity_score",
    "grammar_score",
    "introduction_quality_score",
    "vocabulary_score",
    "eye_contact_score",
    "emotional_stability_score",
)


def error_payload(message: str, detail: Optional[str] = None) -> dict:
    payload = {
        "success": False,
        "message": message,
        "scores": None,
        "analysis_available": False,
    }
    if detail:
        payload["error"] = detail
    return payload


def validate_transcript(answer: str) -> Optional[dict]:
    if not (answer or "").strip():
        return error_payload("No transcript available")
    return None


def validate_turns_exist(turns: list) -> Optional[dict]:
    if not turns:
        return error_payload("No interview data available")
    has_answer = any((t.get("answer") or "").strip() for t in turns)
    if not has_answer:
        return error_payload("No transcript available")
    return None


def extract_valid_scores(data: dict, keys: List[str]) -> Dict[str, float]:
    if not isinstance(data, dict):
        raise ValueError("Gemini returned invalid score payload")

    scores = {}
    for key in keys:
        if key not in data or data[key] is None:
            raise ValueError(f"Missing score from Gemini analysis: {key}")
        try:
            value = float(data[key])
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid score value for {key}") from exc
        scores[key] = max(0.0, min(100.0, value))

    return scores
