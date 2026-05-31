/** Landing page: Start Interview + interview mode/language settings */
function applyThemeFromStorage() {
    try {
        const app = JSON.parse(localStorage.getItem("ai_interview_app_settings") || "{}");
        document.body.setAttribute("data-theme", app.theme === "light" ? "light" : "dark");
    } catch {
        document.body.setAttribute("data-theme", "dark");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    applyThemeFromStorage();
    await AuthApp.init();
    if (window.InterviewSettings) {
        await InterviewSettings.syncFromServer();
        applySettingsToUI();
    }
    wireInterviewPrep();

    const startBtn = document.getElementById("startInterviewLanding");
    const tooltip = document.getElementById("start-interview-tooltip");

    function updateStartButton() {
        if (!startBtn) return;

        const loggedIn = AuthApp.isLoggedIn();
        startBtn.disabled = !loggedIn;
        startBtn.classList.toggle("btn-start-interview--enabled", loggedIn);
        startBtn.classList.toggle("btn-start-interview--locked", !loggedIn);

        if (tooltip) {
            tooltip.textContent = loggedIn ? "" : "Please login first";
            tooltip.style.display = loggedIn ? "none" : "block";
        }

        if (loggedIn) {
            console.log("Interview button enabled");
        }
    }

    startBtn?.addEventListener("click", () => {
        if (!AuthApp.isLoggedIn()) return;
        persistInterviewPrep();
        window.location.href = "/device-setup";
    });

    document.addEventListener("auth:changed", updateStartButton);
    updateStartButton();
});

function applySettingsToUI() {
    const settings = InterviewSettings.load();
    const modeEl = document.getElementById("landingInterviewMode");
    const langEl = document.getElementById("landingLanguage");
    if (modeEl) modeEl.value = settings.interview_mode || "technical";
    if (langEl) langEl.value = settings.language || "en";

    document.querySelectorAll('input[name="interview_language"]').forEach((input) => {
        input.checked = input.value === (settings.language || "en");
    });
}

function persistInterviewPrep() {
    const modeEl = document.getElementById("landingInterviewMode");
    const langEl = document.getElementById("landingLanguage");
    const partial = {};
    if (modeEl) partial.interview_mode = modeEl.value;
    if (langEl) {
        partial.language = langEl.value;
        InterviewSettings.saveLanguageToServer(langEl.value);
    }
    InterviewSettings.save(partial);
}

function wireInterviewPrep() {
    const modeEl = document.getElementById("landingInterviewMode");
    const langEl = document.getElementById("landingLanguage");
    modeEl?.addEventListener("change", () => InterviewSettings.save({ interview_mode: modeEl.value }));
    langEl?.addEventListener("change", () => {
        InterviewSettings.save({ language: langEl.value });
        InterviewSettings.saveLanguageToServer(langEl.value);
        if (window.AIService?.resetVoiceWarnings) AIService.resetVoiceWarnings();
        document.querySelectorAll('input[name="interview_language"]').forEach((input) => {
            input.checked = input.value === langEl.value;
        });
    });
}

function wireLanguageModal() {
    const modal = document.getElementById("languageModal");
    const saveBtn = document.getElementById("btn-save-language");
    if (!modal) return;

    function openModal() {
        applySettingsToUI();
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }

    document.querySelectorAll(".btn-language-settings").forEach((btn) => btn.addEventListener("click", openModal));
    modal.querySelectorAll("[data-close-language]").forEach((el) => el.addEventListener("click", closeModal));

    saveBtn?.addEventListener("click", () => {
        const selected = document.querySelector('input[name="interview_language"]:checked');
        const language = selected?.value || "en";
        InterviewSettings.saveLanguageToServer(language);
        if (window.AIService?.resetVoiceWarnings) AIService.resetVoiceWarnings();
        const langEl = document.getElementById("landingLanguage");
        if (langEl) langEl.value = language;
        closeModal();
    });
}
