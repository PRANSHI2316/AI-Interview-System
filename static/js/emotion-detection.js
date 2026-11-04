/** Face-api emotion tracking + confidence meter UI */
window.EmotionDetection = (function () {
    let intervalId = null;
    let videoEl = null;
    let liveEmotion = {
        eye_contact_score: 0,
        smile_score: 0,
        stress_score: 0,
        confidence_signal: 0,
        nervousness: false,
        emotional_stability_score: 0,
        metrics_available: false,
    };

    function getMetrics() {
        return { ...liveEmotion };
    }

    async function loadModels() {
        if (!window.faceapi) {
            console.warn("[EmotionDetection] face-api not loaded");
            return false;
        }
        try {
            const modelPath = "https://justadudewhohacks.github.io/face-api.js/models";
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
                faceapi.nets.faceExpressionNet.loadFromUri(modelPath),
            ]);
            console.log("[EmotionDetection] models loaded");
            return true;
        } catch (err) {
            console.warn("[EmotionDetection] model load failed:", err);
            return false;
        }
    }

    function updateMeterUI() {
        const confidenceBar = document.getElementById("confidence-meter-fill");
        const confidenceLabel = document.getElementById("confidence-meter-value");
        const eyeLabel = document.getElementById("eye-contact-value");
        const stressLabel = document.getElementById("stress-meter-value");

        const conf = Math.round(liveEmotion.confidence_signal || 0);
        const hasMetrics = liveEmotion.metrics_available;
        if (confidenceBar) confidenceBar.style.width = hasMetrics ? `${conf}%` : "0%";
        if (confidenceLabel) confidenceLabel.textContent = hasMetrics ? `${conf}%` : "—";
        if (eyeLabel) eyeLabel.textContent = hasMetrics ? `${Math.round(liveEmotion.eye_contact_score || 0)}%` : "—";
        if (stressLabel) stressLabel.textContent = hasMetrics ? `${Math.round(liveEmotion.stress_score || 0)}%` : "—";
    }

    function start(video, { onNervous } = {}) {
        stop();
        videoEl = video;
        if (!videoEl || !window.faceapi) return;

        console.log("[EmotionDetection] tracking started");
        intervalId = setInterval(async () => {
            try {
                const result = await faceapi
                    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
                    .withFaceExpressions();

                if (!result?.expressions) return;

                const { happy = 0, neutral = 0, fearful = 0, sad = 0 } = result.expressions;
                const smile = Math.round(happy * 100);
                const stress = Math.round(Math.min(100, (fearful + sad) * 100));
                const confidenceSignal = Math.round(Math.min(100, neutral * 55 + happy * 45));

                liveEmotion = {
                    eye_contact_score: Math.max(0, confidenceSignal),
                    smile_score: smile,
                    stress_score: stress,
                    confidence_signal: confidenceSignal,
                    nervousness: stress > 60 || confidenceSignal < 45,
                    emotional_stability_score: Math.round(Math.max(0, Math.min(100, (100 - stress) * 0.65 + confidenceSignal * 0.35))),
                    metrics_available: true,
                };

                updateMeterUI();

                if (liveEmotion.nervousness && typeof onNervous === "function") {
                    onNervous(liveEmotion);
                }
            } catch (_) {
                /* smooth runtime */
            }
        }, 2500);
    }

    function stop() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
            console.log("[EmotionDetection] tracking stopped");
        }
    }

    return { loadModels, start, stop, getMetrics, updateMeterUI };
})();
