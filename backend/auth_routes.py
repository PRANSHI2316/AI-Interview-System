from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash
import secrets
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from database.auth_db import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    update_user_password,
)


auth_bp = Blueprint("auth", __name__)

# Email configuration
EMAIL_CONFIG = {
    "SMTP_SERVER": os.environ.get("SMTP_SERVER", "smtp.gmail.com"),
    "SMTP_PORT": int(os.environ.get("SMTP_PORT", "587")),
    "SMTP_USERNAME": os.environ.get("SMTP_USERNAME", ""),
    "SMTP_PASSWORD": os.environ.get("SMTP_PASSWORD", ""),
    "EMAIL_FROM": os.environ.get("EMAIL_FROM", "noreply@aiinterview.com"),
    "RESET_TOKEN_EXPIRY_HOURS": 1
}

# In-memory storage for reset tokens (in production, use database)
reset_tokens = {}


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
    }


def generate_reset_token():
    """Generate a secure random token for password reset"""
    return secrets.token_urlsafe(32)


def send_reset_email(email: str, token: str):
    """Send password reset email to user"""
    if not EMAIL_CONFIG["SMTP_USERNAME"] or not EMAIL_CONFIG["SMTP_PASSWORD"]:
        print("Email credentials not configured. Skipping email send.")
        return False
    
    try:
        reset_link = f"http://127.0.0.1:5000/reset-password?token={token}"
        
        msg = MIMEMultipart('alternative')
        msg['From'] = EMAIL_CONFIG["EMAIL_FROM"]
        msg['To'] = email
        msg['Subject'] = 'Password Reset Request - AI Interview Assistant'
        
        html_content = f"""
        <html>
        <body>
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your AI Interview Assistant account.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="{reset_link}">{reset_link}</a></p>
            <p>This link will expire in {EMAIL_CONFIG['RESET_TOKEN_EXPIRY_HOURS']} hour(s).</p>
            <p>If you didn't request this, please ignore this email.</p>
        </body>
        </html>
        """
        
        msg.attach(MIMEText(html_content, 'html'))
        
        server = smtplib.SMTP(EMAIL_CONFIG["SMTP_SERVER"], EMAIL_CONFIG["SMTP_PORT"])
        server.starttls()
        server.login(EMAIL_CONFIG["SMTP_USERNAME"], EMAIL_CONFIG["SMTP_PASSWORD"])
        server.send_message(msg)
        server.quit()
        
        print(f"Password reset email sent to {email}")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


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


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    
    if not email:
        return jsonify({"success": False, "error": "Email is required."}), 400
    
    user = get_user_by_email(email)
    if not user:
        # For security, still return success even if email doesn't exist
        return jsonify({"success": True, "message": "If an account with this email exists, a password reset link will be sent."})
    
    # Generate reset token
    token = generate_reset_token()
    expiry = datetime.datetime.now() + datetime.timedelta(hours=EMAIL_CONFIG["RESET_TOKEN_EXPIRY_HOURS"])
    
    # Store token
    reset_tokens[token] = {
        "user_id": user["id"],
        "email": email,
        "expiry": expiry,
        "used": False
    }
    
    # Send email
    email_sent = send_reset_email(email, token)
    
    if email_sent:
        return jsonify({"success": True, "message": "Password reset link has been sent to your email."})
    else:
        # Fallback: return token in response for testing if email not configured
        return jsonify({
            "success": True, 
            "message": "Email not configured. Use this link for testing: http://127.0.0.1:5000/reset-password?token=" + token,
            "token": token  # Only for testing
        })


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    payload = request.get_json(silent=True) or {}
    token = payload.get("token") or ""
    new_password = payload.get("password") or ""
    
    if not token or not new_password:
        return jsonify({"success": False, "error": "Token and new password are required."}), 400
    
    if len(new_password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters."}), 400
    
    # Validate token
    if token not in reset_tokens:
        return jsonify({"success": False, "error": "Invalid or expired token."}), 400
    
    token_data = reset_tokens[token]
    
    # Check if token is expired
    if datetime.datetime.now() > token_data["expiry"]:
        del reset_tokens[token]
        return jsonify({"success": False, "error": "Token has expired."}), 400
    
    # Check if token already used
    if token_data["used"]:
        return jsonify({"success": False, "error": "Token has already been used."}), 400
    
    # Get user and update password
    user = get_user_by_id(token_data["user_id"])
    if not user:
        return jsonify({"success": False, "error": "User not found."}), 404
    
    # Update password in database
    new_password_hash = generate_password_hash(new_password)
    password_updated = update_user_password(token_data["user_id"], new_password_hash)
    
    if not password_updated:
        return jsonify({"success": False, "error": "Failed to update password."}), 500
    
    # Mark token as used and clean up
    token_data["used"] = True
    del reset_tokens[token]
    
    return jsonify({"success": True, "message": "Password has been reset successfully."})
