/** Interview mode + language preferences (local + server sync) */
window.InterviewSettings = (function () {
    const STORAGE_KEY = "ai_interview_settings";

    const INTERVIEW_MODES = {
        hr: "HR Interview",
        technical: "Technical Interview",
        java: "Java Interview",
        sql: "SQL Interview",
        fullstack: "Full Stack Interview",
        aiml: "AI/ML Interview",
        behavioral: "Behavioral Interview",
    };

    const LANGUAGES = {
        en: { label: "English", speech: "en-US", recognition: "en-US" },
        hi: { label: "Hindi", speech: "hi-IN", recognition: "hi-IN" },
        hinglish: { label: "Hinglish", speech: "hi-IN", recognition: "hi-IN" },
    };

    function load() {
        try {
            return { interview_mode: "technical", language: "en", ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
        } catch {
            return { interview_mode: "technical", language: "en" };
        }
    }

    function save(partial) {
        const next = { ...load(), ...partial };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        console.log("[InterviewSettings] saved", next);
        return next;
    }

    function getMode() {
        return load().interview_mode || "technical";
    }

    function getLanguage() {
        return load().language || "en";
    }

    function getModeLabel() {
        return INTERVIEW_MODES[getMode()] || "Technical Interview";
    }

    function getSpeechLang() {
        return LANGUAGES[getLanguage()]?.speech || "en-US";
    }

    function getRecognitionLang() {
        return LANGUAGES[getLanguage()]?.recognition || "en-US";
    }

    function getProfileExtras() {
        return {
            interview_mode: getMode(),
            interview_mode_label: getModeLabel(),
            language: getLanguage(),
        };
    }

    async function syncFromServer() {
        try {
            const res = await fetch("/api/user/language-preference", { credentials: "same-origin" });
            const data = await res.json();
            if (data.success && data.language) {
                save({ language: data.language });
            }
        } catch {
            /* ignore */
        }
    }

    async function saveLanguageToServer(language) {
        save({ language });
        if (window.AIService?.ensureVoicesReady) {
            await AIService.ensureVoicesReady();
        }
        try {
            await fetch("/api/user/language-preference", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ language }),
            });
        } catch {
            /* ignore */
        }
    }

    return {
        INTERVIEW_MODES,
        LANGUAGES,
        load,
        save,
        getMode,
        getLanguage,
        getModeLabel,
        getSpeechLang,
        getRecognitionLang,
        getProfileExtras,
        syncFromServer,
        saveLanguageToServer,
    };
})();
