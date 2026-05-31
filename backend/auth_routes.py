from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from database.auth_db import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
)


auth_bp = Blueprint("auth", __name__)


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
    }


@auth_bp.route("/signup", methods=["POST"])
def signup():
    payload = request.get_json(silent=True) or {}
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not username or not email or not password:
        return jsonify({"success": False, "error": "Username, email, and password are required."}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters."}), 400
    if get_user_by_email(email):
        return jsonify({"success": False, "error": "Email is already registered."}), 409
    if get_user_by_username(username):
        return jsonify({"success": False, "error": "Username is already taken."}), 409

    password_hash = generate_password_hash(password)
    user_id = create_user(username, email, password_hash)
    session["user_id"] = user_id
    user = get_user_by_id(user_id)
    return jsonify({"success": True, "user": _public_user(user)})


@auth_bp.route("/login", methods=["POST"])
def login():
    payload = request.get_json(silent=True) or {}
    identifier = (payload.get("email") or payload.get("username") or "").strip()
    password = payload.get("password") or ""

    if not identifier or not password:
        return jsonify({"success": False, "error": "Email/username and password are required."}), 400

    user = get_user_by_email(identifier) if "@" in identifier else get_user_by_username(identifier)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"success": False, "error": "Invalid credentials."}), 401

    session["user_id"] = user["id"]
    return jsonify({"success": True, "user": _public_user(user)})


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"success": True})


@auth_bp.route("/api/auth/me", methods=["GET"])
def auth_me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"logged_in": False})
    user = get_user_by_id(user_id)
    if not user:
        session.pop("user_id", None)
        return jsonify({"logged_in": False})
    return jsonify({"logged_in": True, "user": _public_user(user)})
