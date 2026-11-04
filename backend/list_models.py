import json
import os
import urllib.request

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
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        print("NO_KEY")
        return

    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
            models = [
                m.get("name", "").replace("models/", "")
                for m in body.get("models", [])
                if "generateContent" in (m.get("supportedGenerationMethods") or [])
            ]
            print("KEY_VALID=yes")
            print("MODEL_COUNT=", len(models))
            for name in models[:15]:
                print("MODEL", name)
    except Exception as exc:
        print("KEY_VALID=no")
        print("ERROR", exc)


if __name__ == "__main__":
    main()
