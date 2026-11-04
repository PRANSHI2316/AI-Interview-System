from flask import Flask, request, jsonify, render_template, session, Response
from flask_cors import CORS
import os
import json
import tempfile

from ai.ai_interviewer import AIInterviewer
from ai.whisper_service import transcribe_file, is_whisper_loaded
from ai.feedback_generator import FeedbackGenerator
from ai.gemini_service import GeminiAnalysisError, GeminiInterviewService
from ai.scoring_validation import error_payload, validate_transcript, validate_turns_exist
from ai.tts_service import synthesize_speech, is_tts_available, get_voice_name
from auth_routes import auth_bp
from database.auth_db import (
    get_user_by_id,
    init_auth_db,
    save_user_interview_session,
    get_language_preference,
    save_language_preference,
)
from database.db import (
    init_db,
    create_session,
    save_turn,
    get_turns,
    close_session,
    save_summary,
    get_summary,
    get_session_profile,
    save_qa_pair,
    save_interview_feedback,
    update_interview_user,
    update_session_profile,
    list_user_interviews,
    get_interview_user_id,
)
from emotion_detection.analyzer import normalize_emotion_metrics


app = Flask(__name__, template_folder="../templates", static_folder="../static")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "ai-interview-dev-secret-change-me")
CORS(app, supports_credentials=True)
app.register_blueprint(auth_bp)


def load_local_env():
    backend_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".env"))
    project_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    for env_path in (backend_env_path, project_env_path):
        if not os.path.exists(env_path):
            continue
        with open(env_path, "r", encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value


load_local_env()

# Whisper loads lazily on first /transcribe request (singleton in whisper_service).
# Gemini services are lightweight API clients — safe to initialize at startup.
ai_interviewer = AIInterviewer()
feedback_generator = FeedbackGenerator()
gemini_service = GeminiInterviewService()
init_db()
init_auth_db()

if gemini_service.is_configured():
    if gemini_service.test_connectivity():
        print("[Gemini] API connectivity OK")
    else:
        print("[Gemini] WARNING: API connectivity test failed — analysis will be unavailable")
else:
    print("[Gemini] WARNING: GEMINI_API_KEY not configured")


def _enrich_profile(profile: dict) -> dict:
    profile = dict(profile or {})
    user_id = session.get("user_id")
    if user_id and not profile.get("name"):
        user = get_user_by_id(user_id)
        if user:
            profile["name"] = user.get("username", "Candidate")
            profile["username"] = user.get("username")
    if user_id and not profile.get("language"):
        profile["language"] = get_language_preference(user_id)
    mode = profile.get("interview_mode", "technical")
    mode_labels = {
        "hr": "HR Interview",
        "technical": "Technical Interview",
        "java": "Java Interview",
        "sql": "SQL Interview",
        "fullstack": "Full Stack Interview",
        "aiml": "AI/ML Interview",
        "behavioral": "Behavioral Interview",
    }
    if not profile.get("interview_mode_label"):
        profile["interview_mode_label"] = mode_labels.get(mode, "Technical Interview")
    profile.setdefault("name", profile.get("name") or "Candidate")
    profile.setdefault("role", "Software Engineer")
    profile.setdefault("experience", "Fresher")
    profile.setdefault("interview_mode", "technical")
    profile.setdefault("language", "en")
    profile.setdefault("skills_mentioned", [])
    return profile


@app.route("/")
def home():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>AI Interview Assistant</title>
        <meta http-equiv="refresh" content="0; url=/landing">
    </head>
    <body>
        <h1>Redirecting to AI Interview Assistant...</h1>
        <p><a href="/landing">Click here if not redirected</a></p>
    </body>
    </html>
    """


@app.route("/landing")
def landing():
    return render_template("landing.html")


@app.route("/device-setup")
def device_setup():
    return render_template("device_setup.html")


@app.route("/interview")
def interview():
    return render_template("interview.html")


@app.route("/feedback")
def feedback():
    return render_template("feedback.html")


@app.route("/history")
def history_page():
    return render_template("history.html")


@app.route("/settings")
def settings_page():
    return render_template("settings.html")


@app.route("/reset-password")
def reset_password_page():
    return render_template("reset_password.html")


@app.route("/api/user/language-preference", methods=["GET", "POST"])
def language_preference():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "Login required"}), 401
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        language = (payload.get("language") or "en").strip()
        if language not in ("en", "hi", "hinglish"):
            return jsonify({"success": False, "error": "Invalid language"}), 400
        save_language_preference(user_id, language)
        return jsonify({"success": True, "language": language})
    return jsonify({"success": True, "language": get_language_preference(user_id)})


@app.route("/api/interview/history", methods=["GET"])
def api_interview_history():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "Login required"}), 401
    return jsonify({"success": True, "history": list_user_interviews(user_id)})


@app.route("/api/interview/history/<session_id>", methods=["GET"])
def api_interview_history_detail(session_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "error": "Login required"}), 401
    owner_id = get_interview_user_id(session_id)
    if owner_id is not None and owner_id != user_id:
        return jsonify({"success": False, "error": "Not found"}), 404
    summary = get_summary(session_id)
    turns = get_turns(session_id)
    profile = get_session_profile(session_id)
    if not summary and not turns:
        return jsonify({"success": False, "error": "Not found"}), 404
    return jsonify(
        {
            "success": True,
            "session_id": session_id,
            "profile": profile,
            "turns": turns,
            "summary": summary or {},
        }
    )


@app.route("/api/tts/speak", methods=["POST"])
def api_tts_speak():
    """Neural TTS for Hindi/Hinglish (and English) — works without browser Hindi voices."""
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    language = (payload.get("language") or "en").strip()

    if not text:
        return jsonify({"success": False, "error": "text is required"}), 400

    if language not in ("en", "hi", "hinglish"):
        language = "hi" if language.startswith("hi") else "en"

    if not is_tts_available():
        return jsonify(
            {
                "success": False,
                "error": "Server TTS not installed. Run: pip install edge-tts",
            }
        ), 503

    try:
        audio_bytes = synthesize_speech(text, language)
        if not audio_bytes:
            return jsonify({"success": False, "error": "Empty audio generated"}), 500
        voice = get_voice_name(language)
        resp = Response(audio_bytes, mimetype="audio/mpeg")
        resp.headers["X-TTS-Voice"] = voice or ""
        resp.headers["X-TTS-Language"] = language
        return resp
    except Exception as exc:
        print(f"[TTS] error: {exc}")
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/health", methods=["GET"])
def health():
    """Lightweight health check for Railway (does not load Whisper)."""
    return jsonify(
        {
            "status": "ok",
            "whisper_loaded": is_whisper_loaded(),
        }
    )


@app.route("/api/tts/status", methods=["GET"])
def api_tts_status():
    return jsonify(
        {
            "success": True,
            "available": is_tts_available(),
            "voices": {
                "en": get_voice_name("en"),
                "hi": get_voice_name("hi"),
                "hinglish": get_voice_name("hinglish"),
            },
        }
    )


@app.route("/transcribe", methods=["POST"])
def transcribe():
    temp_path = None
    try:
        if "audio" not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio = request.files["audio"]
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            temp_path = tmp.name
            audio.save(temp_path)

        result = transcribe_file(temp_path)
        if not result.get("ok"):
            status_code = 503 if "overloaded" in (result.get("error") or "").lower() else 500
            return jsonify(
                {"status": "error", "message": result.get("error", "Transcription failed")}
            ), status_code

        return jsonify({"status": "success", "text": result.get("text", "")})
    except Exception as exc:
        print(f"[transcribe] error: {exc}")
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


@app.route("/api/interview/start", methods=["POST"])
def api_interview_start():
    try:
        payload = request.get_json(silent=True) or {}
        profile = _enrich_profile(payload.get("profile", {}))
        start_payload = ai_interviewer.start_interview(profile)
        user_id = session.get("user_id")
        session_id = create_session(profile, user_id=user_id)
        return jsonify(
            {
                "success": True,
                "analysis_available": True,
                "session_id": session_id,
                "question": start_payload.get("opening_question"),
                "greeting": start_payload.get("greeting"),
                "interviewer_message": start_payload.get("interviewer_message"),
            }
        )
    except GeminiAnalysisError as exc:
        print(f"[interview/start] Gemini error: {exc.message}")
        if exc.detail:
            print(f"[interview/start] detail: {exc.detail}")
        return jsonify({**error_payload(exc.message, exc.detail)}), 503
    except Exception as exc:
        print(f"[interview/start] error: {exc}")
        return jsonify({**error_payload("Could not start interview. Please try again.", str(exc))}), 503


@app.route("/api/interview/turn", methods=["POST"])
def api_interview_turn():
    try:
        payload = request.get_json(silent=True) or {}
        session_id = payload.get("session_id")
        question = payload.get("question", "")
        answer = payload.get("answer", "")
        speech_metrics = payload.get("speech_metrics", {})
        emotion_metrics = normalize_emotion_metrics(payload.get("emotion_metrics", {}))

        if not session_id:
            return jsonify({**error_payload("session_id is required")}), 400

        transcript_error = validate_transcript(answer)
        if transcript_error:
            print(f"[interview/turn] empty transcript session={session_id}")
            return jsonify(transcript_error), 400

        prior_turns = get_turns(session_id)
        analysis = ai_interviewer.process_turn(
            session_id, question, answer, speech_metrics, emotion_metrics, prior_turns=prior_turns
        )

        updated_profile = ai_interviewer.merge_conversation_state(
            get_session_profile(session_id) or {},
            answer,
            turns=prior_turns,
            asked_question=question,
            next_question=analysis.get("next_question"),
        )
        update_session_profile(session_id, updated_profile)

        coaching = analysis.get("coaching_line", "")
        support_message = analysis.get("support_message", "")
        if support_message:
            coaching = f"{support_message} {coaching}".strip()
        elif analysis.get("nervousness_detected"):
            coaching = f"It's okay, take your time. {coaching}".strip()

        turn_number = len(prior_turns) + 1
        save_qa_pair(session_id, turn_number, question, answer, speech_metrics, emotion_metrics)
        save_turn(
            session_id,
            {
                "question": question,
                "answer": answer,
                "coaching_line": coaching,
                "communication_score": analysis["communication_score"],
                "technical_score": analysis["technical_score"],
                "confidence_score": analysis["confidence_score"],
                "emotional_stability_score": analysis["emotional_stability_score"],
                "filler_word_count": speech_metrics.get("filler_count", 0),
                "pause_count": speech_metrics.get("pause_count", 0),
                "speaking_speed_wpm": speech_metrics.get("wpm", 0),
                "eye_contact_score": emotion_metrics.get("eye_contact_score", 0),
                "nervousness": analysis.get("nervousness_detected", emotion_metrics.get("nervousness", False)),
                "emotion": emotion_metrics,
                "speech": speech_metrics,
            },
        )

        return jsonify(
            {
                "success": True,
                "analysis_available": True,
                "analysis": analysis,
                "coaching_line": coaching,
                "support_message": support_message,
                "next_question": analysis.get("next_question"),
                "interviewer_message": analysis.get("interviewer_message"),
                "scores": {
                    "communication_score": analysis["communication_score"],
                    "technical_score": analysis["technical_score"],
                    "confidence_score": analysis["confidence_score"],
                    "emotional_stability_score": analysis["emotional_stability_score"],
                },
                "memory": {
                    "discussed_topics": updated_profile.get("discussed_topics", []),
                    "skills_mentioned": updated_profile.get("skills_mentioned", []),
                    "asked_questions": updated_profile.get("asked_questions", []),
                    "projects_mentioned": updated_profile.get("projects_mentioned", []),
                },
            }
        )
    except GeminiAnalysisError as exc:
        print(f"[interview/turn] Gemini error: {exc.message}")
        if exc.detail:
            print(f"[interview/turn] detail: {exc.detail}")
        return jsonify({**error_payload(exc.message, exc.detail)}), 503
    except Exception as exc:
        print(f"[interview/turn] error: {exc}")
        return jsonify({**error_payload("Interview processing failed. Please try again.", str(exc))}), 503


@app.route("/api/interview/finalize", methods=["POST"])
def api_interview_finalize():
    try:
        payload = request.get_json(silent=True) or {}
        session_id = payload.get("session_id")
        if not session_id:
            return jsonify({**error_payload("session_id is required")}), 400

        turns = get_turns(session_id)
        missing = validate_turns_exist(turns)
        if missing:
            print(f"[interview/finalize] no data session={session_id}")
            return jsonify(missing), 400

        print(f"[interview/finalize] turns={len(turns)} session={session_id}")

        def avg(key):
            if not turns:
                return 0
            vals = [float(t.get(key, 0) or 0) for t in turns]
            return round(sum(vals) / max(1, len(vals)), 2)

        def avg_speech(key):
            if not turns:
                return 0
            vals = []
            for t in turns:
                raw = t.get("speech_json")
                try:
                    speech = json.loads(raw) if isinstance(raw, str) else (raw or {})
                except Exception:
                    speech = {}
                if key in speech:
                    vals.append(float(speech.get(key, 0) or 0))
            return round(sum(vals) / max(1, len(vals)), 2) if vals else 0

        nervous_count = sum(1 for t in turns if int(t.get("nervousness", 0) or 0))
        nervousness_score = round((nervous_count / max(1, len(turns))) * 100, 2) if turns else 0

        summary_seed = {
            "questions_asked": len(turns),
            "communication_score": avg("communication_score"),
            "technical_score": avg("technical_score"),
            "confidence_score": avg("confidence_score"),
            "emotional_stability_score": avg("emotional_stability_score"),
            "eye_contact_score": avg("eye_contact_score"),
            "fluency_score": avg_speech("clarity_score"),
            "clarity_score": avg_speech("clarity_score"),
            "grammar_score": max(0, 100 - avg_speech("filler_count") * 8) if turns else 0,
            "introduction_quality_score": avg("communication_score"),
            "vocabulary_score": avg("technical_score"),
            "nervousness_score": nervousness_score,
            "filler_word_count": int(sum(int(t.get("filler_word_count", 0) or 0) for t in turns)),
            "pause_count": int(sum(int(t.get("pause_count", 0) or 0) for t in turns)),
        }

        profile = _enrich_profile(get_session_profile(session_id))
        final_feedback = feedback_generator.generate_full_report(profile, turns, summary_seed)
        final_summary = {**summary_seed, **final_feedback}
        final_summary["turns"] = turns
        final_summary["session_id"] = session_id
        final_summary["username"] = profile.get("username") or profile.get("name")

        save_summary(session_id, final_summary)
        save_interview_feedback(session_id, final_summary)
        close_session(session_id)

        user_id = session.get("user_id")
        if user_id:
            update_interview_user(session_id, user_id)
            overall = float(
                final_summary.get("overall_score")
                or (
                    float(final_summary.get("communication_score", 0))
                    + float(final_summary.get("technical_score", 0))
                    + float(final_summary.get("confidence_score", 0))
                )
                / 3.0
            )
            feedback_text = final_summary.get("feedback_text") or ""
            save_user_interview_session(user_id, session_id, round(overall, 2), str(feedback_text))

        return jsonify(
            {
                "success": True,
                "analysis_available": True,
                "summary": final_summary,
            }
        )
    except GeminiAnalysisError as exc:
        print(f"[interview/finalize] Gemini error: {exc.message}")
        if exc.detail:
            print(f"[interview/finalize] detail: {exc.detail}")
        return jsonify({**error_payload(exc.message, exc.detail)}), 503
    except Exception as exc:
        print(f"[interview/finalize] error: {exc}")
        return jsonify({**error_payload("Could not generate feedback. Please try again.", str(exc))}), 503


@app.route("/api/interview/<session_id>/summary", methods=["GET"])
def api_interview_summary(session_id):
    summary = get_summary(session_id)
    if not summary:
        return jsonify({**error_payload("No interview data available")}), 404
    if summary.get("analysis_available") is False:
        return jsonify({**error_payload("AI analysis unavailable")}), 503
    return jsonify({"success": True, "analysis_available": True, "summary": summary})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() in ("1", "true", "yes")
    print(f"Starting Flask server on port {port}...")
    app.run(debug=debug, host="0.0.0.0", port=port)