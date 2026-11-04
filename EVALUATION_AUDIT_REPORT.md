# Interview Evaluation Audit Report

Generated after removing fake/hardcoded scoring and enforcing Gemini-only analysis.

## Summary

The dashboard previously showed scores (70%, 72%, 68%, etc.) without a real interview because **fallback dictionaries** in the backend returned fabricated scores whenever Gemini failed or was skipped. That behavior has been removed.

**New rule:** Scores appear only after:
1. A non-empty transcript exists
2. Gemini API responds successfully (with 3 retries)
3. Parsed JSON contains all required score fields

Otherwise the UI shows **"No interview data available"** / **"AI analysis unavailable"** with **0%** and disabled charts.

---

## Files Where Mock / Fake Data Was Found

| File | Issue | Fix Applied |
|------|--------|-------------|
| `backend/ai/gemini_service.py` | Fallback dicts with scores 72/68/70; silent `return fallback` on errors | Rewritten: 3 retries, logging, raises `GeminiAnalysisError`, no fake scores |
| `backend/ai/ai_interviewer.py` | `start_interview` / `process_turn` merged fake scores (72/70/68) on Gemini failure | Raises errors; returns only Gemini-parsed scores |
| `backend/ai/feedback_generator.py` | Entire fake report (scores 65–72, sample strengths/weaknesses) used as fallback | Raises on failure; validates transcript + Gemini response |
| `backend/app.py` | `save_turn` defaulted missing scores to **70** | Uses only scores from Gemini analysis; validates empty transcript |
| `backend/emotion_detection/analyzer.py` | Default eye_contact **70** when no camera data | Returns **0** and `metrics_available: false` |
| `static/js/emotion-detection.js` | Initial live metrics 70/65/35 before face detection | Starts at **0**, shows **—** until face-api detects |
| `static/js/feedback-dashboard.js` | Default list fallbacks ("Shows willingness to participate") | Empty-state messages; `renderUnavailable()` with 0% disabled charts |
| `static/js/speech-analysis.js` | Minimum score floor of **20** without transcript | **0** when no words |
| `templates/device_setup.html` | Hardcoded **70%** / **35%** in metric cards | Shows **—** until real detection |
| `frontend/src/components/InterviewScreen.jsx` | `Math.random()` confidence/clarity; hardcoded 75/80/70; fake end feedback | Removed random simulation; `onEnd(null)` |
| `frontend/src/components/FeedbackPage.jsx` | Computed scores from local fake feedback object | Empty state when no Gemini data |

### Not changed (intentionally)

| File | Reason |
|------|--------|
| `static/js/speech-analysis.js` | Filler/wpm metrics are **inputs** to Gemini from real transcript text — not dashboard scores |
| `static/js/silence-monitor.js` | `Math.random` picks encouragement **messages**, not scores |
| `static/js/ai-service.js` | `scoreVoice()` ranks TTS voices, not interview scores |

---

## Locations Where Fake Scores Were Generated

1. **`gemini_service.analyze_turn()`** — returned `{communication_score: 72, ...}` on any error  
2. **`gemini_service.generate_final_feedback()`** — returned overall_score 72 + template feedback text  
3. **`ai_interviewer.process_turn()`** — merged `{**fallback, **parsed}` where fallback contained 72/70/68  
4. **`feedback_generator.generate_full_report()`** — 140-line fallback report with fixed percentages  
5. **`app.py` `save_turn()`** — `.get("communication_score", 70)` for missing keys  
6. **`InterviewScreen.jsx` `simulateAnalysis()`** — random confidence/clarity every 2–3 seconds  
7. **`device_setup.html`** — static 70% labels before interview started  

---

## Gemini API Status

| Check | Result |
|-------|--------|
| Key loaded from `.env` | Yes (53 chars) |
| Model | `gemini-2.0-flash` |
| Connectivity test | **Failed — HTTP 429 (quota exceeded)** |
| Retries | 3 attempts with 1.5s delay (logged) |

**Your new API key is saved in `.env` (not committed to git).**  
The key loads correctly, but Google returns **429 quota exceeded** for `gemini-2.0-flash` on the free tier. Until quota/billing is fixed:

- Interview **start/turn/finalize** return `"AI analysis unavailable"`
- Dashboard shows **warning + 0%** — **no fake scores**

### Recommended fixes for Gemini

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and verify the key’s project has quota  
2. Enable billing or wait for quota reset  
3. Try in `.env`: `GEMINI_MODEL=gemini-1.5-flash`  
4. Run: `cd backend && python test_gemini.py`

---

## New Analysis Flow

```
Interview Recording
       ↓
Speech-to-Text (browser / Whisper)
       ↓
Transcript validation (non-empty)
       ↓
Gemini analysis (3 retries, logged)
       ↓
Score validation (all required keys present)
       ↓
Save to DB + Dashboard
```

### API error responses

```json
{
  "success": false,
  "message": "No transcript available",
  "scores": null,
  "analysis_available": false
}
```

```json
{
  "success": false,
  "message": "AI analysis unavailable",
  "scores": null,
  "analysis_available": false,
  "error": "HTTP 429: quota exceeded"
}
```

---

## Logging Added

- `[Gemini] request attempt N/3`
- `[Gemini] response received length=...`
- `[Gemini] parsed JSON keys=...`
- `[AIInterviewer] transcript_length=...` / `Gemini turn scores=...`
- `[FeedbackGenerator] transcript_length=...` / `Gemini scores=...`
- `[interview/turn|finalize] Gemini error: ...`

---

## How to Verify

1. Restart Flask: `cd backend && python app.py`
2. Run Gemini test: `python test_gemini.py` → expect SUCCESS when quota works  
3. Complete an interview → dashboard should show real scores **only** if Gemini succeeds  
4. Open feedback without session → **"No interview data available"** with 0%
