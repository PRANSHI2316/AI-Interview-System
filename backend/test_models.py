import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BACKEND_DIR)


def load_local_env():
    for env_path in (os.path.join(BACKEND_DIR, ".env"), os.path.join(ROOT_DIR, ".env")):
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
    from ai.gemini_service import GeminiInterviewService

    models = [
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-001",
        "gemini-2.0-flash-lite-001",
        "gemini-2.0-flash",
    ]
    for model in models:
        os.environ["GEMINI_MODEL"] = model
        svc = GeminiInterviewService()
        try:
            text = svc._call_gemini_raw('Reply with JSON only: {"status":"ok"}', max_output_tokens=32)
            print(f"WORKING_MODEL={model}")
            print(f"RESPONSE={text[:100]}")
            return 0
        except Exception as exc:
            print(f"FAIL {model}: {exc}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
