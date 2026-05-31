/**
 * Human-like silence detection while waiting for candidate answers.
 * Fires gentle nudges at 5s / 10s / 15s without interrupting active speech.
 */
window.SilenceMonitor = (function () {
    const TIERS = [
        {
            key: "tier_5s",
            ms: 5000,
            emptyPrompts: [
                "Are you there?",
                "I'm here whenever you're ready.",
                "Take your time — I'm listening.",
            ],
            startedPrompts: [
                "Keep going — you're doing fine.",
                "Take your time, finish your thought.",
                "No rush, I'm still listening.",
            ],
        },
        {
            key: "tier_10s",
            ms: 10000,
            emptyPrompts: [
                "You can answer slowly — no pressure.",
                "Relax and think calmly.",
                "It's okay to pause for a moment.",
            ],
            startedPrompts: [
                "You can explain step by step.",
                "Take a deep breath and continue.",
                "Think calmly — I'm listening.",
            ],
        },
        {
            key: "tier_15s",
            ms: 15000,
            emptyPrompts: [
                "Would you like me to repeat the question?",
                "Please try to answer in your own words.",
                "I'm listening — please stay focused.",
            ],
            startedPrompts: [
                "Can you add a little more detail?",
                "Please continue — even a short answer helps.",
                "Try to wrap up your point when you're ready.",
            ],
        },
    ];

    let intervalId = null;
    let lastSpeechAt = 0;
    let firedTiers = new Set();
    let paused = false;
    let ctx = null;

    function pickRandom(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function start(context) {
        stop();
        ctx = context;
        paused = false;
        lastSpeechAt = Date.now();
        firedTiers.clear();
        intervalId = setInterval(tick, 400);
        console.log("[SilenceMonitor] started");
    }

    function stop() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        ctx = null;
        firedTiers.clear();
        console.log("[SilenceMonitor] stopped");
    }

    function pause() {
        paused = true;
        console.log("[SilenceMonitor] paused");
    }

    function resume() {
        paused = false;
        lastSpeechAt = Date.now();
        console.log("[SilenceMonitor] resumed");
    }

    function onSpeechActivity() {
        lastSpeechAt = Date.now();
        firedTiers.clear();
        console.log("[SilenceMonitor] speech detected — timers reset");
    }

    function tick() {
        if (!ctx || paused) return;
        if (ctx.isBlocked?.()) return;

        if (ctx.isUserSpeaking?.()) {
            lastSpeechAt = Date.now();
            return;
        }

        const silentMs = Date.now() - lastSpeechAt;
        const hasStarted = Boolean(ctx.hasAnswerStarted?.());

        for (const tier of TIERS) {
            if (silentMs < tier.ms || firedTiers.has(tier.key)) continue;

            firedTiers.add(tier.key);
            const pool = hasStarted ? tier.startedPrompts : tier.emptyPrompts;
            const message = pickRandom(pool);
            console.log(`[SilenceMonitor] ${tier.key} (${silentMs}ms):`, message);
            ctx.onPrompt?.(message, tier.key);
            break;
        }
    }

    return { start, stop, pause, resume, onSpeechActivity };
})();
