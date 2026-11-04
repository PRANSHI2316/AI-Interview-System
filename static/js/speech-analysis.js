/** Speech metrics: filler words, pace, pauses, clarity */
window.SpeechAnalysis = (function () {
    const FILLER_TOKENS = [
        "um",
        "uh",
        "umm",
        "ahh",
        "ah",
        "hmm",
        "hm",
        "like",
        "actually",
        "you know",
        "basically",
        "sort of",
    ];

    const FILLER_ENCOURAGEMENT = [
        "Take a deep breath — you can explain calmly.",
        "Think step by step. You're doing okay.",
        "No worries — slow down and continue when ready.",
    ];

    function countFillers(text) {
        const clean = (text || "").toLowerCase();
        let fillerCount = 0;
        FILLER_TOKENS.forEach((token) => {
            const regex = new RegExp(`\\b${token.replace(/\s+/g, "\\s+")}\\b`, "gi");
            fillerCount += (clean.match(regex) || []).length;
        });
        return fillerCount;
    }

    function pickFillerEncouragement() {
        return FILLER_ENCOURAGEMENT[Math.floor(Math.random() * FILLER_ENCOURAGEMENT.length)];
    }

    function buildMetrics(text, startedAtMs) {
        const raw = text || "";
        const clean = raw.toLowerCase();
        let fillerCount = 0;

        FILLER_TOKENS.forEach((token) => {
            const regex = new RegExp(`\\b${token.replace(/\s+/g, "\\s+")}\\b`, "gi");
            fillerCount += (clean.match(regex) || []).length;
        });

        const words = clean.trim() ? clean.trim().split(/\s+/).length : 0;
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - (startedAtMs || Date.now())) / 1000));
        const wpm = words ? Math.round((words * 60) / elapsedSeconds) : 0;
        const pauseCount = (raw.match(/,|\.{3}|\.\s/g) || []).length;
        const clarityScore = words
            ? Math.max(0, Math.min(100, 100 - fillerCount * 8 - Math.max(0, 130 - wpm) * 0.12))
            : 0;
        const confidenceScore = words
            ? Math.max(0, Math.min(100, 100 - fillerCount * 9 - pauseCount * 4))
            : 0;

        const metrics = {
            filler_count: fillerCount,
            pause_count: pauseCount,
            wpm,
            clarity_score: Math.round(clarityScore),
            confidence_score: Math.round(confidenceScore),
        };

        console.log("[SpeechAnalysis] metrics:", metrics);
        return metrics;
    }

    return { buildMetrics, countFillers, pickFillerEncouragement, FILLER_TOKENS };
})();
