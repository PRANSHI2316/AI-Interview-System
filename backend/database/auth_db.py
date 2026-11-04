import os
import sqlite3
from datetime import datetime


AUTH_DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "database"))
AUTH_DB_PATH = os.path.join(AUTH_DB_DIR, "interview_ai.db")


def _now_iso():
    return datetime.utcnow().isoformat()


def get_auth_conn():
    os.makedirs(AUTH_DB_DIR, exist_ok=True)
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db():
    conn = get_auth_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interview_sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            interview_score REAL,
            feedback TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS language_preferences (
            user_id INTEGER PRIMARY KEY,
            language TEXT NOT NULL DEFAULT 'en',
            updated_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
        """
    )
    conn.commit()
    conn.close()


def create_user(username: str, email: str, password_hash: str) -> int:
    conn = get_auth_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        (username.strip(), email.strip().lower(), password_hash, _now_iso()),
    )
    user_id = cur.lastrowid
    conn.commit()
    conn.close()
    return user_id


def get_user_by_email(email: str):
    conn = get_auth_conn()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_username(username: str):
    conn = get_auth_conn()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username.strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: int):
    conn = get_auth_conn()
    row = conn.execute("SELECT id, username, email, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def save_user_interview_session(user_id: int, session_id: str, interview_score: float, feedback: str):
    conn = get_auth_conn()
    conn.execute(
        """
        INSERT OR REPLACE INTO interview_sessions (session_id, user_id, interview_score, feedback, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (session_id, user_id, interview_score, feedback, _now_iso()),
    )
    conn.commit()
    conn.close()


def get_language_preference(user_id: int) -> str:
    conn = get_auth_conn()
    row = conn.execute("SELECT language FROM language_preferences WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()
    return row["language"] if row else "en"


def save_language_preference(user_id: int, language: str):
    conn = get_auth_conn()
    conn.execute(
        """
        INSERT OR REPLACE INTO language_preferences (user_id, language, updated_at)
        VALUES (?, ?, ?)
        """,
        (user_id, language, _now_iso()),
    )
    conn.commit()
    conn.close()


def update_user_password(user_id: int, new_password_hash: str) -> bool:
    """Update user password"""
    conn = get_auth_conn()
    try:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (new_password_hash, user_id)
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating password: {e}")
        conn.close()
        return False
