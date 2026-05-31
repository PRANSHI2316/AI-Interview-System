/** Settings page — language, theme, voice, device status */
document.addEventListener("DOMContentLoaded", async () => {
    await AuthApp.init();

    const STORAGE_KEY = "ai_interview_app_settings";
    const defaults = {
        theme: "dark",
        voiceOn: true,
        voiceSpeed: 1,
        cameraStatus: "unknown",
        micStatus: "unknown",
    };

    function loadAppSettings() {
        try {
            return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
        } catch {
            return { ...defaults };
        }
    }

    function saveAppSettings(partial) {
        const next = { ...loadAppSettings(), ...partial };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
    }

    function applyTheme(theme) {
        document.body.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    }

    function showToast(msg) {
        const el = document.getElementById("settingsToast");
        if (!el) return;
        el.textContent = msg;
        el.classList.add("settings-toast--visible");
        setTimeout(() => el.classList.remove("settings-toast--visible"), 2500);
    }

    function syncUIFromStorage() {
        const app = loadAppSettings();
        const lang = InterviewSettings?.load?.()?.language || "en";

        document.querySelectorAll('input[name="settings_language"]').forEach((input) => {
            input.checked = input.value === lang;
        });
        document.querySelectorAll('input[name="settings_theme"]').forEach((input) => {
            input.checked = input.value === app.theme;
        });

        const voiceOn = document.getElementById("settingsVoiceOn");
        const voiceSpeed = document.getElementById("settingsVoiceSpeed");
        const speedVal = document.getElementById("voiceSpeedValue");
        if (voiceOn) voiceOn.checked = app.voiceOn !== false;
        if (voiceSpeed) {
            voiceSpeed.value = app.voiceSpeed || 1;
            if (speedVal) speedVal.textContent = `${Number(voiceSpeed.value).toFixed(1)}×`;
        }

        updateDeviceStatusUI(app);
        applyTheme(app.theme);
    }

    function updateDeviceStatusUI(app) {
        const camDot = document.getElementById("settingsCamDot");
        const micDot = document.getElementById("settingsMicDot");
        const camStatus = document.getElementById("settingsCamStatus");
        const micStatus = document.getElementById("settingsMicStatus");

        const setItem = (dot, label, state) => {
            if (!dot || !label) return;
            dot.className = "device-status-dot";
            if (state === "ok") {
                dot.classList.add("device-status-dot--ok");
                label.textContent = "Ready";
            } else if (state === "denied") {
                dot.classList.add("device-status-dot--warn");
                label.textContent = "Permission denied";
            } else {
                dot.classList.add("device-status-dot--off");
                label.textContent = state === "unknown" ? "Not checked — open Device Setup" : state;
            }
        };

        setItem(camDot, camStatus, app.cameraStatus);
        setItem(micDot, micStatus, app.micStatus);
    }

    async function probeDevices() {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasCam = devices.some((d) => d.kind === "videoinput");
            const hasMic = devices.some((d) => d.kind === "audioinput");
            saveAppSettings({
                cameraStatus: hasCam ? "ok" : "not_found",
                micStatus: hasMic ? "ok" : "not_found",
            });
            syncUIFromStorage();
        } catch {
            /* ignore */
        }
    }

    syncUIFromStorage();
    probeDevices();

    document.getElementById("settingsVoiceSpeed")?.addEventListener("input", (e) => {
        const val = document.getElementById("voiceSpeedValue");
        if (val) val.textContent = `${Number(e.target.value).toFixed(1)}×`;
    });

    document.getElementById("btnSaveSettings")?.addEventListener("click", async () => {
        const lang = document.querySelector('input[name="settings_language"]:checked')?.value || "en";
        const theme = document.querySelector('input[name="settings_theme"]:checked')?.value || "dark";
        const voiceOn = document.getElementById("settingsVoiceOn")?.checked ?? true;
        const voiceSpeed = Number(document.getElementById("settingsVoiceSpeed")?.value || 1);

        InterviewSettings.save({ language: lang });
        await InterviewSettings.saveLanguageToServer(lang);
        saveAppSettings({ theme, voiceOn, voiceSpeed });
        applyTheme(theme);

        if (window.InterviewSettings) {
            localStorage.setItem(
                "ai_interview_settings",
                JSON.stringify({ ...InterviewSettings.load(), voiceOn, voiceSpeed })
            );
        }

        showToast("Settings saved successfully");
    });

    document.getElementById("btnResetSettings")?.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        InterviewSettings.save({ language: "en", interview_mode: "technical" });
        syncUIFromStorage();
        showToast("Reset to defaults");
    });

    document.getElementById("btnTestVoiceSettings")?.addEventListener("click", () => {
        if (!window.TTSVoice) return;
        TTSVoice.unlockFromUserClick();
        const lang = document.querySelector('input[name="settings_language"]:checked')?.value || "en";
        const map = { en: "english", hi: "hindi", hinglish: "hinglish" };
        const samples = {
            english: "Hello, this is your AI interviewer speaking.",
            hindi: "नमस्ते, आपका इंटरव्यू शुरू होने वाला है।",
            hinglish: "Hello, aaj hum interview start karenge. Please introduce yourself.",
        };
        const key = map[lang] || "english";
        TTSVoice.speakAI(samples[key], key);
    });
});

// Expose voice settings for AIService
window.getVoiceSettings = function () {
    try {
        const app = JSON.parse(localStorage.getItem("ai_interview_app_settings") || "{}");
        const interview = JSON.parse(localStorage.getItem("ai_interview_settings") || "{}");
        return {
            voiceOn: app.voiceOn !== false && interview.voiceOn !== false,
            voiceSpeed: app.voiceSpeed || interview.voiceSpeed || 1,
        };
    } catch {
        return { voiceOn: true, voiceSpeed: 1 };
    }
};
