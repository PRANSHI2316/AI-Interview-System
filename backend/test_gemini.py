"""Quick Gemini API check — run: python test_gemini.py"""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BACKEND_DIR)


def load_local_env():
    for env_path in (
        os.path.join(BACKEND_DIR, ".env"),
        os.path.join(ROOT_DIR, ".env"),
    ):
        if not os.path.exists(env_path):
            continue
        with open(env_path, encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value


def main():
    load_local_env()
    key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    print(f"GEMINI_API_KEY set: {bool(key)} (length: {len(key)})")
    print(f"GEMINI_MODEL: {model}")

    if not key:
        print("\nRESULT: FAIL — Add GEMINI_API_KEY to .env (project root or backend/)")
        sys.exit(1)

    from ai.gemini_service import GeminiInterviewService

    svc = GeminiInterviewService()
    try:
        raw = svc._call_gemini(
            'Reply with exactly one word: GEMINI_OK',
            max_output_tokens=32,
        )
        if "GEMINI_OK" in raw.upper():
            print("\nRESULT: SUCCESS — Gemini API returned a live response.")
            print(f"API reply: {raw.strip()[:200]}")
        else:
            print("\nRESULT: PARTIAL — API responded but unexpected body:")
            print(raw.strip()[:300])

        question = svc.generate_opening_question(
            {"name": "Test", "role": "Developer", "experience": "Fresher"}
        )
        print(f"\nInterview opening question: {question[:200]}")
    except Exception as exc:
        print("\nRESULT: FAIL")
        print(f"Error: {exc}")
        print("\nCommon fixes:")
        print("  - Get a key: https://aistudio.google.com/apikey")
        print("  - Ensure billing/API is enabled for your Google project")
        print("  - Try GEMINI_MODEL=gemini-1.5-flash if 2.0 is unavailable")
        sys.exit(1)


if __name__ == "__main__":
    main()
