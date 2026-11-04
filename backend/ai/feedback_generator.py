import json
from datetime import datetime

from ai.gemini_service import GeminiAnalysisError, GeminiInterviewService
from ai.scoring_validation import REPORT_SCORE_KEYS, extract_valid_scores, validate_turns_exist


class FeedbackGenerator:
    def __init__(self):
        self.gemini = GeminiInterviewService()

    def generate_full_report(self, profile: dict, turns: list, summary_seed: dict) -> dict:
        missing = validate_turns_exist(turns)
        if missing:
            raise GeminiAnalysisError(missing["message"])

        if not self.gemini.is_configured():
            raise GeminiAnalysisError("AI analysis unavailable", "GEMINI_API_KEY not configured")

        if not self.gemini.test_connectivity():
            raise GeminiAnalysisError("AI analysis unavailable", "Gemini connectivity test failed")

        candidate_name = profile.get("name") or profile.get("username") or "Candidate"
        transcript_length = sum(len((t.get("answer") or "").strip()) for t in turns)
        print(f"[FeedbackGenerator] transcript_length={transcript_length} turns={len(turns)}")

        transcript = []
        for idx, turn in enumerate(turns, start=1):
            transcript.append(
                {
                    "turn": idx,
                    "question": turn.get("question"),
                    "answer": turn.get("answer"),
                    "speech": json.loads(turn.get("speech_json") or "{}")
                    if isinstance(turn.get("speech_json"), str)
                    else turn.get("speech", {}),
                    "emotion": json.loads(turn.get("emotion_json") or "{}")
                    if isinstance(turn.get("emotion_json"), str)
                    else turn.get("emotion", {}),
                    "scores": {
                        "communication": turn.get("communication_score"),
                        "technical": turn.get("technical_score"),
                        "confidence": turn.get("confidence_score"),
                    },
                }
            )

        prompt = f"""
You are a senior HR interviewer and communication coach.
Generate a realistic, supportive final interview report for {candidate_name}.

Candidate profile: {json.dumps(profile)}
Aggregated metrics: {json.dumps(summary_seed)}
Full transcript with speech/emotion signals: {json.dumps(transcript)}

Analyze communication, confidence, grammar, introduction quality, fluency,
nervousness, technical answers, eye contact, clarity, and vocabulary.

Return strict JSON:
{{
  "overall_score": 0-100,
  "communication_score": 0-100,
  "confidence_score": 0-100,
  "technical_score": 0-100,
  "fluency_score": 0-100,
  "clarity_score": 0-100,
  "grammar_score": 0-100,
  "introduction_quality_score": 0-100,
  "vocabulary_score": 0-100,
  "nervousness_score": 0-100,
  "eye_contact_score": 0-100,
  "emotional_stability_score": 0-100,
  "filler_word_count": number,
  "feedback_text": "2-3 paragraphs personalized to candidate answers",
  "spoken_feedback": "30-45 second spoken summary",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "improvement_suggestions": ["...", "..."],
  "corrected_answers": [
    {{"original":"...", "improved":"...", "note":"short grammar coaching note"}}
  ]
}}
"""
        print("[FeedbackGenerator] requesting Gemini final report")
        raw = self.gemini._call_gemini(prompt, max_output_tokens=1800)
        parsed = self.gemini._extract_json(raw)

        scores = extract_valid_scores(parsed, list(REPORT_SCORE_KEYS))
        print(f"[FeedbackGenerator] Gemini scores={scores}")

        feedback_text = (parsed.get("feedback_text") or "").strip()
        spoken_feedback = (parsed.get("spoken_feedback") or "").strip()
        if not feedback_text:
            raise GeminiAnalysisError("AI analysis unavailable", "Empty feedback_text from Gemini")

        report = {
            **scores,
            "candidate_name": candidate_name,
            "generated_at": datetime.utcnow().isoformat(),
            "analysis_available": True,
            "filler_word_count": int(parsed.get("filler_word_count", summary_seed.get("filler_word_count", 0)) or 0),
            "feedback_text": feedback_text,
            "spoken_feedback": spoken_feedback or feedback_text[:500],
            "strengths": parsed.get("strengths") or [],
            "weaknesses": parsed.get("weaknesses") or [],
            "improvement_suggestions": parsed.get("improvement_suggestions") or [],
            "corrected_answers": parsed.get("corrected_answers") or [],
        }
        return report
