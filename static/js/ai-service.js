/** Interview API + chat bubbles + voice synthesis */
window.AIService = (function () {
    const state = {
        sessionId: null,
        turnCount: 0,
        currentQuestion: "",
        isSpeaking: false,
        isListening: false,
        isThinking: false,
        isNudging: false,
    };

    let typingTimer = null;
    let cachedVoices = [];
    let hindiVoiceWarningShown = false;
    let voicesReadyPromise = null;
    /** @type {HTMLAudioElement|null} */
    let currentAudio = null;
    let serverTtsAvailable = null;

    function getCurrentLanguage() {
        return window.InterviewSettings?.getLanguage?.() || "en";
    }

    function getSpeechLangCode() {
        return window.InterviewSettings?.getSpeechLang?.() || "en-US";
    }

    function needsHindiVoice() {
        const lang = getCurrentLanguage();
        return lang === "hi" || lang === "hinglish";
    }

    function loadVoices() {
        if (!("speechSynthesis" in window)) return [];
        cachedVoices = window.speechSynthesis.getVoices() || [];
        return cachedVoices;
    }

    function ensureVoicesReady() {
        if (!("speechSynthesis" in window)) {
            return Promise.resolve([]);
        }
        if (voicesReadyPromise) return voicesReadyPromise;

        voicesReadyPromise = new Promise((resolve) => {
            const finish = () => {
                const voices = loadVoices();
                console.log("Available voices:", voices.map((v) => ({ name: v.name, lang: v.lang })));
                resolve(voices);
            };

            const voices = loadVoices();
            if (voices.length > 0) {
                finish();
                return;
            }

            const onVoicesChanged = () => {
                const loaded = loadVoices();
                if (loaded.length > 0) {
                    window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
                    finish();
                }
            };

            window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
            // Chrome loads voices asynchronously; also nudge load
            window.speechSynthesis.getVoices();
            setTimeout(() => {
                if (loadVoices().length > 0) {
                    window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
                    finish();
                }
            }, 500);
            setTimeout(() => {
                window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
                finish();
            }, 3000);
        });

        return voicesReadyPromise;
    }

    function scoreVoice(voice, preferHindi) {
        let score = 0;
        const name = (voice.name || "").toLowerCase();
        const lang = (voice.lang || "").toLowerCase();

        if (preferHindi) {
            if (/^hi(-|_)?/.test(lang)) score += 100;
            if (/hindi|india|indian/.test(name)) score += 40;
            if (/google/.test(name)) score += 25;
            if (/microsoft|edge/.test(name)) score += 20;
            if (/hemant|heera|swara|kalpana|lekha|neerja/.test(name)) score += 30;
            if (voice.localService) score += 10;
            // Penalize English voices for Hindi mode
            if (/^en(-|_)?/.test(lang)) score -= 200;
        } else {
            if (/^en(-|_)?(us|gb)?/.test(lang)) score += 100;
            if (/google|natural/.test(name)) score += 20;
            if (voice.default) score += 5;
            if (voice.localService) score += 5;
        }
        return score;
    }

    function pickVoice(voices, langCode) {
        const preferHindi = langCode.startsWith("hi") || needsHindiVoice();
        const pool = voices.length ? voices : loadVoices();

        if (!pool.length) {
            console.warn("[AIService] No speech voices loaded yet");
            return null;
        }

        const ranked = pool
            .map((v) => ({ voice: v, score: scoreVoice(v, preferHindi) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score);

        const best = ranked[0]?.voice || null;

        if (preferHindi && !best) {
            console.warn("[AIService] No Hindi voice found in browser");
            return null;
        }

        if (!preferHindi && !best) {
            return (
                pool.find((v) => /^en/i.test(v.lang)) ||
                pool.find((v) => v.default) ||
                pool[0]
            );
        }

        return best;
    }

    function showHindiVoiceWarning() {
        if (hindiVoiceWarningShown) return;
        hindiVoiceWarningShown = true;
        const msg = "Hindi voice not available in browser. Install Hindi speech pack or use Chrome/Edge. Still attempting speech…";
        console.warn("[AIService]", msg);
        setSpeakingStatus(msg, "speaking-user");
    }

    function applyVoiceToUtterance(utterance) {
        const langCode = getSpeechLangCode();
        const languageKey = getCurrentLanguage();
        utterance.lang = langCode;
        utterance.rate = languageKey === "hi" ? 0.92 : 0.94;
        utterance.pitch = 1;

        const voice = pickVoice(cachedVoices.length ? cachedVoices : loadVoices(), langCode);
        console.log("Selected language:", languageKey, "→", langCode);
        console.log("Selected voice:", voice ? { name: voice.name, lang: voice.lang } : "(browser default for lang)");

        if (needsHindiVoice()) {
            if (!voice) {
                showHindiVoiceWarning();
                // Do NOT assign English voice — let browser pick by utterance.lang
            } else {
                utterance.voice = voice;
            }
        } else if (voice) {
            utterance.voice = voice;
        }

        return { voice, langCode, languageKey };
    }

    // Preload voices early
    if (typeof window !== "undefined" && window.TTSVoice) {
        TTSVoice.loadVoices();
        TTSVoice.waitForVoices();
    }

    function stopCurrentAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.src = "";
            if (currentAudio._objectUrl) {
                URL.revokeObjectURL(currentAudio._objectUrl);
            }
            currentAudio = null;
        }
    }

    async function checkServerTts() {
        if (serverTtsAvailable !== null) return serverTtsAvailable;
        try {
            const res = await fetch("/api/tts/status", { credentials: "same-origin" });
            const data = await res.json();
            serverTtsAvailable = Boolean(data.success && data.available);
            if (serverTtsAvailable) {
                console.log("[AIService] Server neural TTS ready:", data.voices);
            }
        } catch {
            serverTtsAvailable = false;
        }
        return serverTtsAvailable;
    }

    /**
     * Hindi/Hinglish speech via backend (Microsoft Swara neural voice).
     * Works even when the browser has no Hindi speech pack.
     */
    async function speakWithBackendTts(message, { onEnd, onStart } = {}) {
        const language = getCurrentLanguage();
        console.log("[AIService] Backend TTS request — language:", language);

        const res = await fetch("/api/tts/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ text: message, language }),
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `TTS HTTP ${res.status}`);
        }

        const voiceHeader = res.headers.get("X-TTS-Voice");
        console.log("Selected language:", language);
        console.log("Selected voice:", voiceHeader || "hi-IN-SwaraNeural (server)");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        stopCurrentAudio();
        window.speechSynthesis.cancel();

        const audio = new Audio(url);
        audio._objectUrl = url;
        currentAudio = audio;

        return new Promise((resolve) => {
            const done = () => {
                stopCurrentAudio();
                resolve();
            };

            audio.onplay = () => {
                console.log("[AIService] Hindi/Hinglish audio playback started");
                onStart?.();
            };
            audio.onended = () => {
                console.log("[AIService] Hindi/Hinglish audio playback ended");
                onEnd?.();
                done();
            };
            audio.onerror = (e) => {
                console.error("[AIService] Audio playback error:", e);
                onEnd?.();
                done();
            };

            audio.play().catch((playErr) => {
                console.error("[AIService] audio.play() failed:", playErr);
                onEnd?.();
                done();
            });
        });
    }

    function setAvatarSpeaking(active) {
        const wrap = document.getElementById("ai-avatar-wrap");
        const waves = document.getElementById("ai-sound-waves");
        if (wrap) wrap.classList.toggle("ai-avatar--speaking", active);
        if (waves) waves.classList.toggle("sound-waves--active", active);
    }

    function setListeningVisual(active) {
        const mic = document.getElementById("mic-live-status");
        const bars = document.getElementById("mic-viz-bars");
        if (mic) mic.classList.toggle("mic-status-pill--live", active);
        if (bars) bars.classList.toggle("mic-viz--active", active);
    }

    function clearTypingAnimation() {
        if (typingTimer) {
            clearInterval(typingTimer);
            typingTimer = null;
        }
        const dots = document.getElementById("ai-typing-dots");
        if (dots) dots.style.display = "none";
    }

    function showTypingAnimation() {
        const el = document.getElementById("botMessage");
        const dots = document.getElementById("ai-typing-dots");
        if (dots) dots.style.display = "inline-flex";
        if (!el) return Promise.resolve();

        return new Promise((resolve) => {
            let step = 0;
            const frames = ["Thinking", "Thinking.", "Thinking..", "Thinking..."];
            el.textContent = frames[0];
            typingTimer = setInterval(() => {
                step = (step + 1) % frames.length;
                el.textContent = frames[step];
            }, 320);
            setTimeout(() => {
                clearTypingAnimation();
                resolve();
            }, 900);
        });
    }

    function setLoading(active) {
        state.isThinking = active;
        const el = document.getElementById("ai-loading");
        if (el) el.style.display = active ? "flex" : "none";
        if (active) {
            setBotStatus("Thinking", "status-thinking");
            setSpeakingStatus("Thinking…", "speaking-thinking");
        }
    }

    function addChatBubble(role, text) {
        const container = document.getElementById("chat-transcript");
        if (!container || !text) return;

        const bubble = document.createElement("div");
        bubble.className = role === "ai" ? "chat-bubble chat-bubble--ai" : "chat-bubble chat-bubble--user";

        const label = document.createElement("span");
        label.className = "chat-bubble__label";
        label.textContent = role === "ai" ? "Interviewer" : "You";

        const body = document.createElement("p");
        body.className = "chat-bubble__text";
        body.textContent = text;

        bubble.appendChild(label);
        bubble.appendChild(body);
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
        console.log(`[AIService] ${role} bubble added`);
    }

    function setAIMessage(text) {
        const el = document.getElementById("botMessage");
        if (el) el.textContent = text;
    }

    function setBotStatus(label, stateClass) {
        const el = document.getElementById("bot-status");
        if (!el) return;
        el.className = `interview-status-pill ${stateClass || "status-ready"}`;
        el.innerHTML = `<span class="status-dot"></span>${label}`;
    }

    function setSpeakingStatus(label, stateClass) {
        const el = document.getElementById("speaking-status");
        if (!el) return;
        el.textContent = label;
        el.className = `speaking-indicator ${stateClass || ""}`;
    }

    async function speak(text, { onEnd, onStart, skipTyping = false } = {}) {
        const message = (text || "").trim();
        state.isListening = false;
        setListeningVisual(false);

        if (!skipTyping && message) {
            await showTypingAnimation();
        }

        setAIMessage(message);
        setBotStatus("Speaking", "status-speaking");
        setSpeakingStatus("Speaking…", "speaking-ai");
        setAvatarSpeaking(true);
        state.isSpeaking = true;
        state.isNudging = false;

        if (!message) {
            state.isSpeaking = false;
            setAvatarSpeaking(false);
            onEnd?.();
            return;
        }

        try {
            if (!window.TTSVoice) {
                throw new Error("TTSVoice module not loaded");
            }

            const lang = TTSVoice.getLanguageFromSettings();
            console.log("[AIService] Speaking via TTSVoice, language:", lang);

            await TTSVoice.speakFromSettings(message, {
                onStart: () => {
                    console.log("[AIService] Audio playback started");
                    onStart?.();
                },
                onEnd: () => {
                    console.log("[AIService] Audio playback finished");
                    state.isSpeaking = false;
                    setAvatarSpeaking(false);
                    if (!state.isThinking) {
                        setBotStatus("Listening", "status-listening");
                        setSpeakingStatus("Listening…", "speaking-listen");
                    }
                    onEnd?.();
                },
            });
        } catch (err) {
            console.error("[AIService] speak failed:", err);
            state.isSpeaking = false;
            setAvatarSpeaking(false);
            setSpeakingStatus(
                "Voice error — check console. For Hindi: restart server with edge-tts installed.",
                "speaking-user"
            );
            onEnd?.();
        }
    }

    function speakAndThenListen(text, onListenReady) {
        addChatBubble("ai", text);
        speak(text, { onEnd: onListenReady });
    }

    /** Short HR nudge during silence — does not advance interview turn */
    function speakNudge(text, onEnd) {
        state.isNudging = true;
        addChatBubble("ai", text);
        speak(text, { onEnd, skipTyping: true });
    }

    function markListening() {
        state.isListening = true;
        state.isThinking = false;
        state.isNudging = false;
        setBotStatus("Listening", "status-listening");
        setSpeakingStatus("Listening…", "speaking-listen");
        setListeningVisual(true);
        console.log("[AIService] listening for candidate");
    }

    async function startSession(profile) {
        setLoading(true);
        console.log("[AIService] starting interview session");
        try {
            const res = await fetch("/api/interview/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ profile }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Failed to start interview");

            state.sessionId = data.session_id;
            state.turnCount = 0;
            state.currentQuestion = data.question || "";
            const message = data.interviewer_message || `${data.greeting || ""} ${data.question || ""}`.trim();
            console.log("[AIService] session started:", state.sessionId);
            return { ...data, interviewer_message: message };
        } finally {
            setLoading(false);
        }
    }

    async function submitTurn({ question, answer, speechMetrics, emotionMetrics }) {
        setLoading(true);
        console.log("[AIService] submitting turn", state.turnCount + 1);
        try {
            const res = await fetch("/api/interview/turn", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    session_id: state.sessionId,
                    question,
                    answer,
                    speech_metrics: speechMetrics,
                    emotion_metrics: emotionMetrics,
                }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Turn failed");

            state.turnCount += 1;
            state.currentQuestion = data.next_question || state.currentQuestion;
            const message =
                data.interviewer_message ||
                `${data.coaching_line || ""} ${data.next_question || ""}`.trim();

            return { ...data, interviewer_message: message, memory: data.memory };
        } finally {
            setLoading(false);
        }
    }

    async function finalizeInterview() {
        setLoading(true);
        const res = await fetch("/api/interview/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ session_id: state.sessionId }),
        });
        const data = await res.json();
        setLoading(false);
        if (!data.success) throw new Error(data.error || "Finalize failed");
        return data;
    }

    function resetVoiceWarnings() {
        hindiVoiceWarningShown = false;
    }

    return {
        state,
        addChatBubble,
        setAIMessage,
        setBotStatus,
        setSpeakingStatus,
        setAvatarSpeaking,
        setListeningVisual,
        setLoading,
        speak,
        speakAndThenListen,
        speakNudge,
        markListening,
        startSession,
        submitTurn,
        finalizeInterview,
        ensureVoicesReady,
        applyVoiceToUtterance,
        resetVoiceWarnings,
        checkServerTts,
        speakAI: (text, lang, cb) => window.TTSVoice?.speakAI(text, lang, cb),
    };
})();
