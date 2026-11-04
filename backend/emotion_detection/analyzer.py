def normalize_emotion_metrics(emotion_payload: dict) -> dict:
    emotion_payload = emotion_payload or {}

    has_data = any(
        key in emotion_payload and emotion_payload.get(key) is not None
        for key in (
            "eye_contact_score",
            "smile_score",
            "stress_score",
            "confidence_signal",
        )
    )

    if not has_data:
        return {
            "eye_contact_score": 0,
            "smile_score": 0,
            "stress_score": 0,
            "confidence_signal": 0,
            "nervousness": False,
            "emotional_stability_score": 0,
            "metrics_available": False,
        }

    eye_contact = float(emotion_payload.get("eye_contact_score", 0))
    smile = float(emotion_payload.get("smile_score", 0))
    stress = float(emotion_payload.get("stress_score", 0))
    confidence = float(
        emotion_payload.get("confidence_signal", max(0, 100 - stress))
    )

    nervousness = stress > 65 or eye_contact < 45
    emotional_stability = max(0, min(100, (100 - stress) * 0.65 + eye_contact * 0.35))

    return {
        "eye_contact_score": max(0, min(100, eye_contact)),
        "smile_score": max(0, min(100, smile)),
        "stress_score": max(0, min(100, stress)),
        "confidence_signal": max(0, min(100, confidence)),
        "nervousness": nervousness,
        "emotional_stability_score": round(emotional_stability, 2),
        "metrics_available": True,
    }
