import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Optional


DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "database"))
DB_PATH = os.path.join(DB_DIR, "interview.db")


def _now_iso():
    return datetime.utcnow().isoformat()


def get_conn():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interview_sessions (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            profile_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interview_turns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            coaching_line TEXT,
            communication_score REAL,
            technical_score REAL,
            confidence_score REAL,
            emotional_stability_score REAL,
            filler_word_count INTEGER,
            pause_count INTEGER,
            speaking_speed_wpm REAL,
            eye_contact_score REAL,
            nervousness INTEGER,
            emotion_json TEXT,
            speech_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES interview_sessions(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interview_summaries (
            session_id TEXT PRIMARY KEY,
            summary_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES interview_sessions(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interview_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            turn_number INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES interview_sessions(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interview_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            question_id INTEGER,
            answer_text TEXT NOT NULL,
            speech_json TEXT,
            emotion_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES interview_sessions(id),
            FOREIGN KEY(question_id) REFERENCES interview_questions(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interview_feedback (
            session_id TEXT PRIMARY KEY,
            report_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(session_id) REFERENCES interview_sessions(id)
        )
        """
    )
    # Compatibility tables with simpler names requested by UI/portfolio docs.
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interviews (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            status TEXT NOT NULL,
            profile_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            interview_id TEXT NOT NULL,
            turn_number INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            interview_id TEXT NOT NULL,
            question_id INTEGER,
            answer_text TEXT NOT NULL,
            speech_json TEXT,
            emotion_json TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS feedback_reports (
            interview_id TEXT PRIMARY KEY,
            report_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def update_session_profile(session_id: str, profile: dict):
    now = _now_iso()
    payload = json.dumps(profile)
    conn = get_conn()
    conn.execute(
        "UPDATE interview_sessions SET profile_json = ?, updated_at = ? WHERE id = ?",
        (payload, now, session_id),
    )
    conn.execute(
        "UPDATE interviews SET profile_json = ?, updated_at = ? WHERE id = ?",
        (payload, now, session_id),
    )
    conn.commit()
    conn.close()


def list_user_interviews(user_id: int):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT i.id, i.status, i.profile_json, i.created_at, i.updated_at,
               s.summary_json
        FROM interviews i
        LEFT JOIN interview_summaries s ON s.session_id = i.id
        WHERE i.user_id = ?
        ORDER BY i.created_at DESC
        """,
        (user_id,),
    ).fetchall()
    conn.close()
    results = []
    for row in rows:
        profile = {}
        summary = {}
        try:
            profile = json.loads(row["profile_json"] or "{}")
        except Exception:
            profile = {}
        try:
            summary = json.loads(row["summary_json"] or "{}") if row["summary_json"] else {}
        except Exception:
            summary = {}
        results.append(
            {
                "session_id": row["id"],
                "status": row["status"],
                "created_at": row["created_at"],
                "interview_mode": profile.get("interview_mode_label") or profile.get("interview_mode", "Interview"),
                "language": profile.get("language", "en"),
                "overall_score": summary.get("overall_score"),
                "confidence_score": summary.get("confidence_score"),
                "communication_score": summary.get("communication_score"),
                "feedback_summary": (summary.get("feedback_text") or "")[:220],
            }
        )
    return results


def get_interview_user_id(session_id: str) -> Optional[int]:
    conn = get_conn()
    row = conn.execute("SELECT user_id FROM interviews WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return row["user_id"] if row else None


def create_session(profile: dict, user_id: Optional[int] = None) -> str:
    session_id = str(uuid.uuid4())
    now = _now_iso()
    conn = get_conn()
    conn.execute(
        "INSERT INTO interview_sessions (id, status, profile_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (session_id, "active", json.dumps(profile), now, now),
    )
    conn.execute(
        "INSERT OR REPLACE INTO interviews (id, user_id, status, profile_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, user_id, "active", json.dumps(profile), now, now),
    )
    conn.commit()
    conn.close()
    return session_id


def save_turn(session_id: str, turn: dict):
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO interview_turns (
            session_id, question, answer, coaching_line,
            communication_score, technical_score, confidence_score, emotional_stability_score,
            filler_word_count, pause_count, speaking_speed_wpm, eye_contact_score, nervousness,
            emotion_json, speech_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_id,
            turn.get("question", ""),
            turn.get("answer", ""),
            turn.get("coaching_line", ""),
            turn.get("communication_score", 0),
            turn.get("technical_score", 0),
            turn.get("confidence_score", 0),
            turn.get("emotional_stability_score", 0),
            int(turn.get("filler_word_count", 0)),
            int(turn.get("pause_count", 0)),
            float(turn.get("speaking_speed_wpm", 0)),
            float(turn.get("eye_contact_score", 0)),
            1 if turn.get("nervousness", False) else 0,
            json.dumps(turn.get("emotion", {})),
            json.dumps(turn.get("speech", {})),
            _now_iso(),
        ),
    )
    conn.execute("UPDATE interview_sessions SET updated_at = ? WHERE id = ?", (_now_iso(), session_id))
    conn.execute("UPDATE interviews SET updated_at = ? WHERE id = ?", (_now_iso(), session_id))
    conn.commit()
    conn.close()


def get_turns(session_id: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM interview_turns WHERE session_id = ? ORDER BY id ASC",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def close_session(session_id: str):
    conn = get_conn()
    conn.execute("UPDATE interview_sessions SET status = ?, updated_at = ? WHERE id = ?", ("completed", _now_iso(), session_id))
    conn.execute("UPDATE interviews SET status = ?, updated_at = ? WHERE id = ?", ("completed", _now_iso(), session_id))
    conn.commit()
    conn.close()


def save_summary(session_id: str, summary: dict):
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO interview_summaries (session_id, summary_json, created_at) VALUES (?, ?, ?)",
        (session_id, json.dumps(summary), _now_iso()),
    )
    conn.commit()
    conn.close()


def get_summary(session_id: str):
    conn = get_conn()
    row = conn.execute("SELECT summary_json FROM interview_summaries WHERE session_id = ?", (session_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["summary_json"])


def get_session_profile(session_id: str) -> dict:
    conn = get_conn()
    row = conn.execute("SELECT profile_json FROM interview_sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    if not row or not row["profile_json"]:
        return {}
    try:
        return json.loads(row["profile_json"])
    except Exception:
        return {}


def save_qa_pair(session_id: str, turn_number: int, question: str, answer: str, speech: dict, emotion: dict) -> int:
    now = _now_iso()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO interview_questions (session_id, turn_number, question_text, created_at) VALUES (?, ?, ?, ?)",
        (session_id, turn_number, question, now),
    )
    question_id = cur.lastrowid
    cur.execute(
        """
        INSERT INTO interview_answers (session_id, question_id, answer_text, speech_json, emotion_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (session_id, question_id, answer, json.dumps(speech or {}), json.dumps(emotion or {}), now),
    )
    cur.execute(
        "INSERT INTO questions (interview_id, turn_number, question_text, created_at) VALUES (?, ?, ?, ?)",
        (session_id, turn_number, question, now),
    )
    legacy_question_id = cur.lastrowid
    cur.execute(
        """
        INSERT INTO answers (interview_id, question_id, answer_text, speech_json, emotion_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (session_id, legacy_question_id, answer, json.dumps(speech or {}), json.dumps(emotion or {}), now),
    )
    conn.commit()
    conn.close()
    return question_id


def update_interview_user(session_id: str, user_id: int):
    conn = get_conn()
    conn.execute("UPDATE interviews SET user_id = ? WHERE id = ?", (user_id, session_id))
    conn.commit()
    conn.close()


def save_interview_feedback(session_id: str, report: dict):
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO interview_feedback (session_id, report_json, created_at) VALUES (?, ?, ?)",
        (session_id, json.dumps(report), _now_iso()),
    )
    conn.execute(
        "INSERT OR REPLACE INTO feedback_reports (interview_id, report_json, created_at) VALUES (?, ?, ?)",
        (session_id, json.dumps(report), _now_iso()),
    )
    conn.commit()
    conn.close()
