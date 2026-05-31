def normalize_emotion_metrics(emotion_payload: dict) -> dict:
    emotion_payload = emotion_payload or {}
    eye_contact = float(emotion_payload.get("eye_contact_score", 70))
    smile = float(emotion_payload.get("smile_score", 50))
    stress = float(emotion_payload.get("stress_score", 40))
    confidence = float(emotion_payload.get("confidence_signal", max(0, 100 - stress)))

    nervousness = stress > 65 or eye_contact < 45
    emotional_stability = max(0, min(100, (100 - stress) * 0.65 + eye_contact * 0.35))

    return {
        "eye_contact_score": max(0, min(100, eye_contact)),
        "smile_score": max(0, min(100, smile)),
        "stress_score": max(0, min(100, stress)),
        "confidence_signal": max(0, min(100, confidence)),
        "nervousness": nervousness,
        "emotional_stability_score": round(emotional_stability, 2),
    }
