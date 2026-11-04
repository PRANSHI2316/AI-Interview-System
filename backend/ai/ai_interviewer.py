import json
import re
from typing import List, Optional

from ai.gemini_service import GeminiAnalysisError, GeminiInterviewService
from ai.scoring_validation import TURN_SCORE_KEYS, extract_valid_scores, validate_transcript
from database.db import get_session_profile


MODE_GUIDANCE = {
    "hr": "Focus on HR topics: introduction, strengths, weaknesses, teamwork, motivation, culture fit.",
    "technical": "Focus on general technical fundamentals, problem solving, and project depth.",
    "java": "Focus on Java, OOP, collections, JVM, Spring Boot, JDBC, and Java project experience.",
    "sql": "Focus on SQL queries, joins, indexes, normalization, and database design.",
    "fullstack": "Focus on frontend, backend, APIs, databases, deployment, and full project architecture.",
    "aiml": "Focus on ML basics, Python, models, datasets, NLP, and AI project experience.",
    "behavioral": "Focus on STAR method, past experiences, conflict handling, leadership, and soft skills.",
}

LANGUAGE_GUIDANCE = {
    "en": "Speak entirely in clear professional English.",
    "hi": "Speak entirely in natural Hindi. Example tone: 'Namaste, sabse pehle apna introduction dijiye.'",
    "hinglish": "Speak in natural Hinglish mixing Hindi and English the way Indian professionals do in interviews.",
}

SKILL_KEYWORDS = {
    "java": ["java"],
    "spring": ["spring boot", "spring"],
    "sql": ["sql", "mysql", "postgresql", "database"],
    "python": ["python"],
    "react": ["react", "frontend"],
    "javascript": ["javascript", "node", "nodejs"],
    "dsa": ["dsa", "data structure", "algorithm", "leetcode", "coding problem"],
    "oop": ["oop", "object oriented", "inheritance", "polymorphism"],
    "aiml": ["machine learning", "ai", "ml", "deep learning", "nlp", "chatbot"],
    "api": ["rest", "api", "backend"],
}

TOPIC_FOLLOWUPS = {
    "java": [
        "Which Java concepts did you use in that project?",
        "How did you structure the backend using Java?",
        "Did you use OOP principles like inheritance or polymorphism in your project?",
        "How do you handle exceptions and logging in Java applications?",
    ],
    "spring": [
        "Did you use Spring Boot in that project?",
        "How did you design your REST APIs?",
        "How did you connect your Spring application to the database?",
    ],
    "sql": [
        "How did you design your database schema for that project?",
        "Can you explain a complex SQL query you wrote?",
        "Did you use joins or indexes in your database design?",
    ],
    "dsa": [
        "What types of DSA problems do you practice most often?",
        "How do you approach a new coding problem step by step?",
        "Which data structure do you find most useful in interviews?",
    ],
    "project": [
        "What problem does your system solve for users?",
        "What was the most difficult part of building that project?",
        "How did you test and validate your application?",
        "How did you structure the backend architecture?",
        "Did you integrate a database with that project?",
    ],
    "aiml": [
        "What model or approach did you use in that project?",
        "How did you prepare or clean your dataset?",
        "What was the biggest challenge in your AI/ML implementation?",
    ],
    "api": [
        "How did you design the API endpoints for that project?",
        "How did you handle authentication or validation on the backend?",
    ],
}

GENERIC_QUESTION_PATTERNS = [
    r"explain.*(?:specific )?example",
    r"(?:give|share|provide).*(?:an? )?example",
    r"walk me through",
    r"can you elaborate",
    r"tell me more about that",
    r"explain that with",
    r"specific example from your experience",
]

FRUSTRATION_PHRASES = [
    "already explained",
    "i told you",
    "i said that",
    "as i said",
    "i mentioned",
    "you asked",
    "repeat",
]


class AIInterviewer:
    def __init__(self):
        self.gemini = GeminiInterviewService()

    def _format_history(self, turns: list) -> str:
        if not turns:
            return "No previous turns yet."
        lines = []
        for idx, turn in enumerate(turns, start=1):
            lines.append(f"Turn {idx}")
            lines.append(f"Interviewer: {turn.get('question', '')}")
            lines.append(f"Candidate: {turn.get('answer', '')}")
        return "\n".join(lines)

    def _build_chat_messages(self, turns: list, current_question: str, current_answer: str) -> list:
        """Structured Gemini conversation history (user/model alternating)."""
        messages = [{"role": "user", "content": "Interview session started. Track all Q&A below."}]
        for turn in turns:
            q = (turn.get("question") or "").strip()
            a = (turn.get("answer") or "").strip()
            if q:
                messages.append({"role": "model", "content": q})
            if a:
                messages.append({"role": "user", "content": a})
        if current_question:
            messages.append({"role": "model", "content": current_question})
        if current_answer:
            messages.append({"role": "user", "content": current_answer})
        return messages

    def _asked_questions(self, turns: list, profile: dict = None) -> list:
        from_turns = [t.get("question", "").strip() for t in turns if t.get("question")]
        from_profile = (profile or {}).get("asked_questions") or []
        seen = set()
        merged = []
        for q in from_profile + from_turns:
            key = q.strip().lower()
            if key and key not in seen:
                seen.add(key)
                merged.append(q.strip())
        return merged

    def _profile_block(self, profile: dict) -> str:
        mode = profile.get("interview_mode", "technical")
        return json.dumps(
            {
                "name": profile.get("name") or profile.get("username") or "Candidate",
                "role": profile.get("role", "Software Engineer"),
                "experience": profile.get("experience", "Fresher"),
                "interview_mode": mode,
                "interview_mode_label": profile.get("interview_mode_label") or mode,
                "language": profile.get("language", "en"),
                "skills_mentioned": profile.get("skills_mentioned", []),
                "discussed_topics": profile.get("discussed_topics", []),
                "projects_mentioned": profile.get("projects_mentioned", []),
            }
        )

    def _system_prompt(self, profile: dict) -> str:
        mode = profile.get("interview_mode", "technical")
        lang = profile.get("language", "en")
        return f"""
You are a professional, intelligent human interviewer — conversational like ChatGPT voice mode, NOT a scripted bot.
Interview mode: {profile.get('interview_mode_label', mode)}
Mode guidance: {MODE_GUIDANCE.get(mode, MODE_GUIDANCE['technical'])}
Language: {LANGUAGE_GUIDANCE.get(lang, LANGUAGE_GUIDANCE['en'])}

Critical rules:
- Read the FULL conversation. The candidate's latest answer may already contain projects, examples, and technologies.
- NEVER ask "Can you explain with a specific example?" if they already described a project or gave concrete details.
- NEVER repeat a question or ask the same type of generic follow-up twice.
- Ask ONE new, specific follow-up that drills into something they mentioned but have NOT fully explained yet.
- If they mention Java → ask about Java concepts, architecture, or Spring used in THEIR project.
- If they mention a project name → ask about problem solved, tech stack, challenges, or backend structure.
- If they mention DSA → ask about problem-solving approach, not generic examples.
- If they seem frustrated ("I already explained") → acknowledge briefly, apologize, then ask a NEW different question.
- Be warm, professional, and specific to their words.
"""

    def _extract_skills_from_text(self, text: str) -> list:
        found = []
        lower = (text or "").lower()
        for skill, keywords in SKILL_KEYWORDS.items():
            if any(kw in lower for kw in keywords):
                found.append(skill)
        return found

    def _extract_projects_from_text(self, text: str) -> list:
        projects = []
        if not text:
            return projects
        # Named project patterns — stop before "using", "with", "and I", etc.
        patterns = [
            r"(?:built|developed|created|worked on|made)\s+(?:a|an|the)?\s*([A-Z][A-Za-z0-9\s]{2,40}?)(?:\s+(?:using|with|in|for|where|that|and)\b|\s*[,.]|$)",
            r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}\s+(?:System|Project|App|Application|Platform|Portal))\b",
        ]
        stop_words = {"using", "with", "and", "for", "in", "the", "a", "an"}
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                name = re.sub(r"\s+", " ", match.group(1).strip())
                words = name.split()
                while words and words[-1].lower() in stop_words:
                    words.pop()
                name = " ".join(words)
                if len(name) > 3 and name.lower() not in {p.lower() for p in projects}:
                    projects.append(name)
        return projects[:5]

    def _extract_discussed_topics(self, turns: list, answer: str = "") -> list:
        all_text = answer + " " + " ".join(
            f"{t.get('question', '')} {t.get('answer', '')}" for t in turns
        )
        topics = set(self._extract_skills_from_text(all_text))
        lower = all_text.lower()
        if any(w in lower for w in ["built", "developed", "project", "system", "application"]):
            topics.add("project")
        if any(w in lower for w in ["backend", "rest", "api"]):
            topics.add("api")
        return sorted(topics)

    def _detect_frustration(self, answer: str) -> bool:
        lower = (answer or "").lower()
        return any(phrase in lower for phrase in FRUSTRATION_PHRASES)

    def _is_generic_question(self, question: str) -> bool:
        ql = (question or "").lower()
        return any(re.search(p, ql) for p in GENERIC_QUESTION_PATTERNS)

    def _normalize_words(self, text: str) -> set:
        return set(re.sub(r"[^\w\s]", "", (text or "").lower()).split())

    def _questions_similar(self, q1: str, q2: str) -> bool:
        w1, w2 = self._normalize_words(q1), self._normalize_words(q2)
        if not w1 or not w2:
            return False
        overlap = len(w1 & w2) / min(len(w1), len(w2))
        if overlap >= 0.55:
            return True
        if self._is_generic_question(q1) and self._is_generic_question(q2):
            return True
        return False

    def _already_provided_detail(self, turns: list, answer: str) -> bool:
        all_text = (answer + " " + " ".join(t.get("answer", "") for t in turns)).lower()
        detail_signals = ["built", "developed", "created", "project", "system", "using java", "spring", "database"]
        return len(all_text) > 50 and any(s in all_text for s in detail_signals)

    def _smart_followup(
        self,
        profile: dict,
        answer: str,
        turns: list,
        asked: list,
        frustrated: bool = False,
    ) -> str:
        """Context-aware follow-up — never generic 'give an example' when detail exists."""
        topics = self._extract_discussed_topics(turns, answer)
        skills = profile.get("skills_mentioned") or []
        projects = self._extract_projects_from_text(answer) or profile.get("projects_mentioned") or []
        lang = profile.get("language", "en")

        candidates = []

        if frustrated:
            if lang == "hi":
                candidates.append("Theek hai, dhanyavaad. Aapne backend mein kaun si technologies use ki thi?")
            elif lang == "hinglish":
                candidates.append("You're right, thank you for clarifying. Backend mein aapne kaun si technologies use ki?")
            else:
                candidates.append("You're right, thank you for clarifying. What technologies did you use in the backend?")

        if projects:
            proj = projects[0]
            candidates.extend([
                f"What problem does {proj} solve for users?",
                f"What was the most challenging part of building {proj}?",
                f"How did you structure the backend for {proj}?",
                f"Did you use database integration in {proj}?",
            ])

        for topic in topics:
            for q in TOPIC_FOLLOWUPS.get(topic, []):
                candidates.append(q)

        for skill in skills:
            for q in TOPIC_FOLLOWUPS.get(skill, []):
                candidates.append(q)

        if not candidates:
            mode = profile.get("interview_mode", "technical")
            mode_defaults = {
                "java": "Which Java collections or OOP concepts did you apply in your project?",
                "sql": "How would you design a database schema for a support ticket system?",
                "aiml": "What ML model or library have you worked with recently?",
            }
            candidates.append(mode_defaults.get(mode, "What was the toughest technical decision in your recent project?"))

        asked_lower = [a.lower() for a in asked]
        for candidate in candidates:
            c_lower = candidate.lower()
            if c_lower in asked_lower:
                continue
            if any(self._questions_similar(candidate, prev) for prev in asked):
                continue
            if self._already_provided_detail(turns, answer) and self._is_generic_question(candidate):
                continue
            return candidate

        return candidates[0] if candidates else "What was the toughest technical decision you made in that project?"

    def _ensure_intelligent_question(
        self,
        next_question: str,
        profile: dict,
        answer: str,
        turns: list,
        asked: list,
        frustrated: bool = False,
    ) -> str:
        asked_all = list(asked)
        q = (next_question or "").strip()

        needs_replace = (
            not q
            or q.lower() in [a.lower() for a in asked_all]
            or any(self._questions_similar(q, prev) for prev in asked_all)
            or (self._is_generic_question(q) and self._already_provided_detail(turns, answer))
        )

        if needs_replace:
            smart = self._smart_followup(profile, answer, turns, asked_all, frustrated=frustrated)
            print(f"[AIInterviewer] Replaced generic/repeated question with: {smart[:80]}...")
            return smart

        return q

    def _merge_skills(self, profile: dict, answer: str) -> dict:
        skills = set(profile.get("skills_mentioned") or [])
        skills.update(self._extract_skills_from_text(answer))
        profile = dict(profile)
        profile["skills_mentioned"] = sorted(skills)
        return profile

    def merge_conversation_state(
        self,
        profile: dict,
        answer: str,
        turns: list = None,
        asked_question: str = None,
        next_question: str = None,
    ) -> dict:
        profile = self._merge_skills(profile, answer)
        turns = turns or []
        profile["discussed_topics"] = self._extract_discussed_topics(turns, answer)
        projects = set(profile.get("projects_mentioned") or [])
        projects.update(self._extract_projects_from_text(answer))
        for t in turns:
            projects.update(self._extract_projects_from_text(t.get("answer", "")))
        profile["projects_mentioned"] = list(projects)[:8]

        asked = list(profile.get("asked_questions") or [])
        for q in [asked_question, next_question]:
            if q and q.strip().lower() not in {a.lower() for a in asked}:
                asked.append(q.strip())
        profile["asked_questions"] = asked[-30:]
        return profile

    def merge_answer_into_profile(self, profile: dict, answer: str) -> dict:
        return self.merge_conversation_state(profile, answer)

    def start_interview(self, profile: dict) -> dict:
        if not self.gemini.is_configured():
            raise GeminiAnalysisError("AI analysis unavailable", "GEMINI_API_KEY not configured")

        if not self.gemini.test_connectivity():
            raise GeminiAnalysisError("AI analysis unavailable", "Gemini connectivity test failed")

        prompt = f"""
{self._system_prompt(profile)}

Candidate profile: {self._profile_block(profile)}

Start the interview with a natural opening in the selected language.
Return strict JSON:
{{
  "greeting": "warm welcome using candidate name",
  "opening_question": "first question appropriate for interview mode",
  "interviewer_message": "greeting + opening question as one flowing spoken paragraph"
}}
"""
        print("[AIInterviewer] start_interview requesting Gemini opening")
        parsed = self.gemini._extract_json(self.gemini._call_gemini(prompt, max_output_tokens=900))

        greeting = (parsed.get("greeting") or "").strip()
        opening_question = (parsed.get("opening_question") or "").strip()
        if not opening_question:
            raise GeminiAnalysisError("AI analysis unavailable", "Missing opening_question from Gemini")

        interviewer_message = (parsed.get("interviewer_message") or "").strip()
        if not interviewer_message:
            interviewer_message = f"{greeting} {opening_question}".strip()

        print(f"[AIInterviewer] opening question length={len(opening_question)}")
        return {
            "greeting": greeting,
            "opening_question": opening_question,
            "interviewer_message": interviewer_message,
            "analysis_available": True,
        }

    def process_turn(
        self,
        session_id: str,
        question: str,
        answer: str,
        speech_metrics: dict,
        emotion_metrics: dict,
        prior_turns: Optional[List] = None,
    ) -> dict:
        profile = get_session_profile(session_id) or {}
        profile = self._merge_skills(profile, answer)
        turns = prior_turns if prior_turns is not None else []
        turn_number = len(turns) + 1
        asked = self._asked_questions(turns, profile)
        frustrated = self._detect_frustration(answer)
        discussed = self._extract_discussed_topics(turns, answer)

        print(f"[AIInterviewer] turn={turn_number} transcript_length={len((answer or '').strip())}")
        print(f"[AIInterviewer] discussed_topics={discussed}")
        print(f"[AIInterviewer] asked_questions={asked}")
        print(f"[AIInterviewer] skills={profile.get('skills_mentioned', [])}")
        if frustrated:
            print("[AIInterviewer] frustration detected in answer")

        transcript_error = validate_transcript(answer)
        if transcript_error:
            raise GeminiAnalysisError(transcript_error["message"])

        memory_block = f"""
Conversation memory (use this — do NOT ignore):
- Already asked questions: {json.dumps(asked)}
- Discussed topics: {json.dumps(discussed)}
- Skills mentioned: {json.dumps(profile.get('skills_mentioned', []))}
- Projects mentioned: {json.dumps(profile.get('projects_mentioned', []))}
- Candidate already gave project/detail: {self._already_provided_detail(turns, answer)}
- Candidate frustrated: {frustrated}
"""

        json_instruction = f"""
{memory_block}

Analyze the candidate's latest answer and continue the interview.
Return strict JSON only:
{{
  "communication_score": 0-100,
  "technical_score": 0-100,
  "confidence_score": 0-100,
  "emotional_stability_score": 0-100,
  "nervousness_detected": true/false,
  "support_message": "short encouragement if needed else empty",
  "coaching_line": "brief acknowledgment referencing something specific they said",
  "next_question": "ONE specific NEW follow-up — drill into their project/tech, NOT a generic example request",
  "interviewer_message": "support_message + coaching_line + next_question as natural spoken paragraph",
  "should_continue": true
}}

FORBIDDEN for next_question (candidate already gave details):
- "Can you explain that with a specific example?"
- "Can you walk me through an example?"
- Any question asking for an example when they already described a project.
"""

        chat_messages = self._build_chat_messages(turns, question, answer)
        chat_messages.append({"role": "user", "content": json_instruction})

        print("[AIInterviewer] requesting Gemini turn analysis")
        parsed = self.gemini._extract_json(
            self.gemini.call_gemini_chat(
                system_instruction=self._system_prompt(profile),
                messages=chat_messages,
                max_output_tokens=1200,
            )
        )

        scores = extract_valid_scores(parsed, list(TURN_SCORE_KEYS))
        print(f"[AIInterviewer] Gemini turn scores={scores}")

        next_q = self._ensure_intelligent_question(
            parsed.get("next_question", ""),
            profile,
            answer,
            turns,
            asked + [question],
            frustrated=frustrated,
        )
        if not next_q.strip():
            raise GeminiAnalysisError("AI analysis unavailable", "Missing next_question from Gemini")

        coaching_line = (parsed.get("coaching_line") or "").strip()
        if not coaching_line:
            raise GeminiAnalysisError("AI analysis unavailable", "Missing coaching_line from Gemini")

        support_message = (parsed.get("support_message") or "").strip()
        interviewer_message = (parsed.get("interviewer_message") or "").strip()
        if not interviewer_message:
            interviewer_message = " ".join(p for p in [support_message, coaching_line, next_q] if p).strip()

        return {
            **scores,
            "nervousness_detected": bool(parsed.get("nervousness_detected", emotion_metrics.get("nervousness", False))),
            "support_message": support_message,
            "coaching_line": coaching_line,
            "next_question": next_q,
            "interviewer_message": interviewer_message,
            "should_continue": bool(parsed.get("should_continue", True)),
            "discussed_topics": discussed,
            "skills_mentioned": profile.get("skills_mentioned", []),
            "asked_questions": asked + [question, next_q],
            "analysis_available": True,
        }
