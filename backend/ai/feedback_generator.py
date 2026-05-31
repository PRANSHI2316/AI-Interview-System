import json
from datetime import datetime

from ai.gemini_service import GeminiInterviewService


class FeedbackGenerator:
    def __init__(self):
        self.gemini = GeminiInterviewService()

    def generate_full_report(self, profile: dict, turns: list, summary_seed: dict) -> dict:
        candidate_name = profile.get("name") or profile.get("username") or "Candidate"

        fallback = {
            "candidate_name": candidate_name,
            "generated_at": datetime.utcnow().isoformat(),
            "overall_score": round(
                (
                    float(summary_seed.get("communication_score", 70))
                    + float(summary_seed.get("technical_score", 70))
                    + float(summary_seed.get("confidence_score", 70))
                )
                / 3,
                1,
            ),
            "communication_score": summary_seed.get("communication_score", 70),
            "confidence_score": summary_seed.get("confidence_score", 68),
            "technical_score": summary_seed.get("technical_score", 69),
            "fluency_score": summary_seed.get("fluency_score", 67),
            "clarity_score": summary_seed.get("clarity_score", 66),
            "grammar_score": summary_seed.get("grammar_score", 65),
            "introduction_quality_score": summary_seed.get("introduction_quality_score", 68),
            "vocabulary_score": summary_seed.get("vocabulary_score", 66),
            "nervousness_score": summary_seed.get("nervousness_score", 35),
            "eye_contact_score": summary_seed.get("eye_contact_score", 70),
            "emotional_stability_score": summary_seed.get("emotional_stability_score", 71),
            "filler_word_count": summary_seed.get("filler_word_count", 0),
            "feedback_text": (
                f"{candidate_name}, your introduction was understandable, but you can improve sentence structure "
                "and confidence. Try explaining skills with concrete examples and use complete professional sentences."
            ),
            "spoken_feedback": (
                f"{candidate_name}, you performed reasonably well overall. "
                "Your confidence was decent, but improve communication clarity and provide longer, structured technical explanations."
            ),
            "strengths": [
                "Participated actively in the interview",
                "Showed basic technical awareness",
                "Maintained a calm tone",
            ],
            "weaknesses": [
                "Improve grammar and article usage",
                "Give longer, structured answers",
                "Reduce hesitation and filler words",
            ],
            "improvement_suggestions": [
                "Practice introducing yourself confidently in 60 seconds.",
                "Use professional vocabulary during interviews.",
                "Explain projects using Situation-Task-Action-Result format.",
                "Improve fluency with daily mock interview practice.",
            ],
            "corrected_answers": [],
        }

        transcript = []
        for idx, turn in enumerate(turns, start=1):
            transcript.append(
                {
                    "turn": idx,
                    "question": turn.get("question"),
                    "answer": turn.get("answer"),
                    "speech": json.loads(turn.get("speech_json") or "{}") if isinstance(turn.get("speech_json"), str) else turn.get("speech", {}),
                    "emotion": json.loads(turn.get("emotion_json") or "{}") if isinstance(turn.get("emotion_json"), str) else turn.get("emotion", {}),
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

Analyze:
1. Communication skills
2. Confidence
3. Grammar mistakes
4. Introduction quality
5. Speaking fluency
6. Nervousness
7. Technical answer quality
8. Eye contact / facial confidence
9. Clarity
10. Vocabulary

If grammar issues exist, include corrected versions like:
Original: "I am hardworking person"
Improved: "I am a hardworking and motivated person."

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
  "feedback_text": "2-3 paragraphs, personalized, mention candidate by name, include specific examples from answers",
  "spoken_feedback": "supportive 30-45 second spoken summary for text-to-speech",
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "improvement_suggestions": ["...", "..."],
  "corrected_answers": [
    {{"original":"...", "improved":"...", "note":"short grammar coaching note"}}
  ]
}}
"""
        try:
            parsed = self.gemini._extract_json(
                self.gemini._call_gemini(prompt, max_output_tokens=1800),
                fallback,
            )
            report = {**fallback, **parsed}
            report["candidate_name"] = candidate_name
            report["generated_at"] = datetime.utcnow().isoformat()
            return report
        except Exception as exc:
            print(f"[FeedbackGenerator] fallback: {exc}")
            fallback["generated_at"] = datetime.utcnow().isoformat()
            return fallback
