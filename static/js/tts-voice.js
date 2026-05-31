/**
 * Centralized AI speech — English (browser) + Hindi/Hinglish (server neural + browser fallback).
 * Call TTSVoice.unlockFromUserClick() on button click before async API calls.
 */
window.TTSVoice = (function () {
    let availableVoices = [];
    /** @type {HTMLAudioElement|null} */
    let currentAudio = null;

    function loadVoices() {
        if (!("speechSynthesis" in window)) {
            availableVoices = [];
            return availableVoices;
        }
        availableVoices = window.speechSynthesis.getVoices() || [];
        console.log("Loaded voices:", availableVoices);
        if (availableVoices.length) {
            console.table(
                availableVoices.map((v) => ({
                    name: v.name,
                    lang: v.lang,
                }))
            );
        }
        return availableVoices;
    }

    loadVoices();
    if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = () => {
            loadVoices();
        };
    }

    function normalizeLanguage(language) {
        const L = String(language || "english").toLowerCase();
        if (L === "en" || L === "english") return "english";
        if (L === "hi" || L === "hindi") return "hindi";
        if (L === "hinglish") return "hinglish";
        return L;
    }

    function toApiLanguage(language) {
        const L = normalizeLanguage(language);
        if (L === "english") return "en";
        if (L === "hindi") return "hi";
        return "hinglish";
    }

    function unlockFromUserClick() {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.resume();
        }
        try {
            const silent = new Audio(
                "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=="
            );
            silent.volume = 0.01;
            silent.play().catch(() => {});
        } catch {
            /* ignore */
        }
        console.log("[TTSVoice] Audio unlocked from user gesture");
    }

    function stopCurrentAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            if (currentAudio._blobUrl) URL.revokeObjectURL(currentAudio._blobUrl);
            currentAudio = null;
        }
    }

    function waitForVoices(maxMs = 4000) {
        return new Promise((resolve) => {
            loadVoices();
            if (availableVoices.length) {
                resolve(availableVoices);
                return;
            }
            const deadline = Date.now() + maxMs;
            const tick = () => {
                loadVoices();
                if (availableVoices.length || Date.now() >= deadline) {
                    resolve(availableVoices);
                    return;
                }
                setTimeout(tick, 120);
            };
            tick();
        });
    }

    function speakBrowser(text, language, callbacks = {}) {
        const { onStart, onEnd } = callbacks;
        return new Promise((resolve) => {
            if (!("speechSynthesis" in window)) {
                console.warn("[TTSVoice] speechSynthesis not supported");
                onEnd?.();
                resolve({ ok: false, method: "browser" });
                return;
            }

            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            const lang = normalizeLanguage(language);
            let selectedVoice = null;

            if (lang === "hindi" || lang === "hinglish") {
                utterance.lang = "hi-IN";
                selectedVoice = availableVoices.find(
                    (voice) => voice.lang.includes("hi") || voice.name.toLowerCase().includes("hindi")
                );
            } else {
                utterance.lang = "en-US";
                selectedVoice = availableVoices.find((voice) => voice.lang.includes("en"));
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log("Using voice:", selectedVoice.name);
                console.log("Selected voice:", selectedVoice.name);
            } else {
                console.warn("No matching voice found.");
                if (lang === "hindi" || lang === "hinglish") {
                    console.warn(
                        "Hindi voice not installed in this browser/system. " +
                            "Install Hindi: Windows Settings → Time & language → Speech → Hindi (India)."
                    );
                }
            }

            console.log("Selected language:", lang);
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 1;

            let started = false;
            utterance.onstart = () => {
                started = true;
                console.log("[TTSVoice] Browser speech started");
                onStart?.();
            };
            utterance.onend = () => {
                console.log("[TTSVoice] Browser speech ended");
                onEnd?.();
                resolve({ ok: true, method: "browser", voice: selectedVoice?.name });
            };
            utterance.onerror = (e) => {
                console.error("[TTSVoice] Browser speech error:", e?.error || e);
                onEnd?.();
                resolve({ ok: false, method: "browser", error: e?.error });
            };

            console.log("Speaking:", text);
            window.speechSynthesis.speak(utterance);

            setTimeout(() => {
                if (!started) {
                    console.log("[TTSVoice] Retrying browser speak…");
                    window.speechSynthesis.speak(utterance);
                }
            }, 300);
        });
    }

    async function speakServer(text, language, callbacks = {}) {
        const { onStart, onEnd } = callbacks;
        const apiLang = toApiLanguage(language);
        console.log("[TTSVoice] Server TTS:", apiLang);

        const res = await fetch("/api/tts/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ text, language: apiLang }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Server TTS HTTP ${res.status}`);
        }

        const blob = await res.blob();
        if (!blob.size) throw new Error("Empty audio from server");

        const voiceName = res.headers.get("X-TTS-Voice") || "hi-IN-SwaraNeural";
        console.log("Selected language:", normalizeLanguage(language));
        console.log("Selected voice:", voiceName);

        stopCurrentAudio();
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio._blobUrl = url;
        audio.volume = 1;
        currentAudio = audio;

        return new Promise((resolve, reject) => {
            audio.onplay = () => {
                console.log("[TTSVoice] Server audio playing");
                onStart?.();
            };
            audio.onended = () => {
                stopCurrentAudio();
                onEnd?.();
                resolve({ ok: true, method: "server", voice: voiceName });
            };
            audio.onerror = (e) => {
                stopCurrentAudio();
                onEnd?.();
                reject(e);
            };

            audio.play().catch((err) => {
                console.error("[TTSVoice] audio.play() blocked:", err);
                const msg =
                    "Audio blocked — click 'Test Hindi Voice' once, then Start Interview again.";
                if (window.AIService?.setSpeakingStatus) {
                    AIService.setSpeakingStatus(msg, "speaking-user");
                }
                reject(err);
            });
        });
    }

    /**
     * Central speak function — use for interview + tests.
     */
    async function speakAI(text, language = "english", callbacks = {}) {
        const message = (text || "").trim();
        if (!message) return { ok: false };

        const lang = normalizeLanguage(language);
        stopCurrentAudio();

        if (lang === "hindi" || lang === "hinglish") {
            try {
                return await speakServer(message, lang, callbacks);
            } catch (serverErr) {
                console.warn("[TTSVoice] Server TTS failed, trying browser:", serverErr);
            }
        }

        await waitForVoices();
        return speakBrowser(message, lang, callbacks);
    }

    function getLanguageFromSettings() {
        const key = window.InterviewSettings?.getLanguage?.() || "en";
        if (key === "hi") return "hindi";
        if (key === "hinglish") return "hinglish";
        return "english";
    }

    async function speakFromSettings(text, callbacks = {}) {
        return speakAI(text, getLanguageFromSettings(), callbacks);
    }

    return {
        availableVoices: () => availableVoices,
        loadVoices,
        waitForVoices,
        unlockFromUserClick,
        speakAI,
        speakBrowser,
        speakServer,
        speakFromSettings,
        stopCurrentAudio,
        getLanguageFromSettings,
        normalizeLanguage,
    };
})();
