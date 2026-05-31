/** Face-api emotion tracking + confidence meter UI */
window.EmotionDetection = (function () {
    let intervalId = null;
    let videoEl = null;
    let liveEmotion = {
        eye_contact_score: 70,
        smile_score: 50,
        stress_score: 35,
        confidence_signal: 65,
        nervousness: false,
        emotional_stability_score: 70,
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
        if (confidenceBar) confidenceBar.style.width = `${conf}%`;
        if (confidenceLabel) confidenceLabel.textContent = `${conf}%`;
        if (eyeLabel) eyeLabel.textContent = `${Math.round(liveEmotion.eye_contact_score || 0)}%`;
        if (stressLabel) stressLabel.textContent = `${Math.round(liveEmotion.stress_score || 0)}%`;
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
                    eye_contact_score: Math.max(40, confidenceSignal),
                    smile_score: smile,
                    stress_score: stress,
                    confidence_signal: confidenceSignal,
                    nervousness: stress > 60 || confidenceSignal < 45,
                    emotional_stability_score: Math.round(Math.max(0, Math.min(100, (100 - stress) * 0.65 + confidenceSignal * 0.35))),
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
