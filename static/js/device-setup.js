// Device setup + intelligent interview flow (vanilla JS)
/** @type {MediaStream|null} Single shared stream for setup + interview */
let globalMediaStream = null;
/** @deprecated alias — same reference as globalMediaStream */
let stream = null;

const AUDIO_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};
let cameraEnabled = false;
let micEnabled = false;
let cameraStatus = "checking";
let micStatus = "checking";
let recognition = null;
let interviewStarted = false;
let sessionId = null;
let currentQuestion = "";
let turnCount = 0;
let lastSpeechStartAt = 0;
const ANSWER_SUBMIT_PAUSE_MS = 2800;
let interviewTimerInterval = null;
let interviewStartedAt = null;
let askedQuestions = [];
let discussedTopics = [];
let userSkills = [];

let listeningForAnswer = false;
let answerBuffer = "";
let answerSubmitTimer = null;
let fillerNudgeSent = false;
let isSubmittingAnswer = false;
let userSpeechActive = false;

const ui = {
    cameraButton: document.getElementById("camera-button"),
    micButton: document.getElementById("mic-button"),
    testCameraButton: document.getElementById("test-camera-button"),
    testMicButton: document.getElementById("test-mic-button"),
    cameraVideo: document.getElementById("camera-video"),
    cameraOverlay: document.getElementById("camera-overlay"),
    micIndicator: document.getElementById("mic-indicator"),
    micDot: document.getElementById("mic-dot"),
    cameraStatusText: document.getElementById("camera-status-text"),
    micStatusText: document.getElementById("mic-status-text"),
    cameraStatusIcon: document.getElementById("camera-status-icon"),
    micStatusIcon: document.getElementById("mic-status-icon"),
    errorContainer: document.getElementById("error-container"),
    errorMessage: document.getElementById("error-message"),
    permissionHelp: document.getElementById("permission-help"),
    startInterviewContainer: document.getElementById("start-interview-container"),
    startInterviewBtn: document.getElementById("startInterviewBtn"),
    deviceStartTooltip: document.getElementById("device-start-tooltip"),
    deviceReadyHint: document.getElementById("device-ready-hint"),
    interviewSection: document.getElementById("interviewSection"),
    endInterviewBtn: document.getElementById("endInterviewBtn"),
    interviewUserVideo: document.getElementById("interview-user-video"),
    chatTranscript: document.getElementById("chat-transcript"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
    ui.cameraButton?.addEventListener("click", toggleCamera);
    ui.micButton?.addEventListener("click", toggleMicrophone);
    ui.testCameraButton?.addEventListener("click", toggleCamera);
    ui.testMicButton?.addEventListener("click", toggleMicrophone);
    ui.startInterviewBtn?.addEventListener("click", startInterview);
    ui.endInterviewBtn?.addEventListener("click", endInterview);
    document.addEventListener("auth:changed", renderStartInterviewState);

    if (window.AuthApp) {
        await AuthApp.init();
    }
    if (window.InterviewSettings) {
        await InterviewSettings.syncFromServer();
        wireDevicePrepSelectors();
    }
    detectDevices();
    if (window.EmotionDetection) {
        EmotionDetection.loadModels();
    }
    if (window.TTSVoice) {
        TTSVoice.loadVoices();
        TTSVoice.waitForVoices();
        wireVoiceTestButtons();
    }
}

function wireVoiceTestButtons() {
    const statusEl = document.getElementById("voice-test-status");

    const setStatus = (msg) => {
        if (statusEl) statusEl.textContent = msg;
    };

    document.getElementById("btn-test-voice-en")?.addEventListener("click", () => {
        TTSVoice.unlockFromUserClick();
        setStatus("Playing English test…");
        TTSVoice.speakAI("Hello, this is your AI interviewer. Your English voice test is working.", "english")
            .then((r) => setStatus(`English OK (${r?.method || "done"})`))
            .catch((e) => setStatus(`English failed: ${e.message}`));
    });

    document.getElementById("btn-test-voice-hi")?.addEventListener("click", () => {
        TTSVoice.unlockFromUserClick();
        setStatus("Playing Hindi test…");
        TTSVoice.speakAI("नमस्ते, आपका इंटरव्यू शुरू होने वाला है।", "hindi")
            .then((r) => setStatus(`Hindi OK — voice: ${r?.voice || r?.method}`))
            .catch((e) => setStatus(`Hindi failed: ${e.message}. Restart server & pip install edge-tts`));
    });

    document.getElementById("btn-test-voice-hinglish")?.addEventListener("click", () => {
        TTSVoice.unlockFromUserClick();
        setStatus("Playing Hinglish test…");
        TTSVoice.speakAI("Hello Pranshi, aaj hum interview start karenge. Please introduce yourself.", "hinglish")
            .then((r) => setStatus(`Hinglish OK — voice: ${r?.voice || r?.method}`))
            .catch((e) => setStatus(`Hinglish failed: ${e.message}`));
    });
}

function wireDevicePrepSelectors() {
    const settings = InterviewSettings.load();
    const modeEl = document.getElementById("deviceInterviewMode");
    const langEl = document.getElementById("deviceLanguage");
    if (modeEl) {
        modeEl.value = settings.interview_mode || "technical";
        modeEl.addEventListener("change", () => InterviewSettings.save({ interview_mode: modeEl.value }));
    }
    if (langEl) {
        langEl.value = settings.language || "en";
        langEl.addEventListener("change", () => {
            InterviewSettings.save({ language: langEl.value });
            InterviewSettings.saveLanguageToServer(langEl.value);
            if (window.AIService?.resetVoiceWarnings) AIService.resetVoiceWarnings();
        });
    }
}

async function detectDevices() {
    if (!navigator.mediaDevices?.getUserMedia) {
        showError("Media devices are not supported in this browser.");
        cameraStatus = "not_supported";
        micStatus = "not_supported";
        render();
        return;
    }

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        cameraStatus = devices.some((d) => d.kind === "videoinput") ? "available" : "not_found";
        micStatus = devices.some((d) => d.kind === "audioinput") ? "available" : "not_found";
        render();
    } catch (err) {
        showError(`Unable to enumerate devices: ${err.message}`);
    }
}

function syncStreamAlias() {
    stream = globalMediaStream;
}

function applyTrackEnabledState(enableVideo, enableAudio) {
    if (!globalMediaStream) return;
    globalMediaStream.getVideoTracks().forEach((track) => {
        track.enabled = enableVideo;
    });
    globalMediaStream.getAudioTracks().forEach((track) => {
        track.enabled = enableAudio;
    });
}

async function initializeMedia({ enableVideo = true, enableAudio = true } = {}) {
    if (globalMediaStream) {
        applyTrackEnabledState(enableVideo, enableAudio);
        await attachStreamToVideoElements();
        return globalMediaStream;
    }

    console.log("Initializing media...");
    try {
        globalMediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: AUDIO_CONSTRAINTS,
        });
        syncStreamAlias();

        console.log("Camera track:", globalMediaStream.getVideoTracks());
        console.log("Microphone track:", globalMediaStream.getAudioTracks());

        applyTrackEnabledState(enableVideo, enableAudio);
        await attachStreamToVideoElements();
        return globalMediaStream;
    } catch (error) {
        console.error("Camera error:", error);
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        throw error;
    }
}

async function attachStreamToVideoElements() {
    if (!globalMediaStream) return;

    const videos = [ui.cameraVideo, ui.interviewUserVideo].filter(Boolean);
    if (!videos.length) {
        console.warn("No video elements found");
        return;
    }

    for (const video of videos) {
        console.log("Video element found");
        if (video.srcObject !== globalMediaStream) {
            video.srcObject = globalMediaStream;
        }
        video.muted = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("autoplay", "");
        video.style.display = "block";
        video.style.visibility = "visible";
        video.style.opacity = "1";

        try {
            await video.play();
            console.log("Media stream attached");
        } catch (playError) {
            console.warn("video.play() failed:", playError);
        }
    }
}

async function toggleCamera() {
    try {
        if (cameraEnabled) {
            const track = globalMediaStream?.getVideoTracks?.()[0];
            if (track) track.enabled = false;
            cameraEnabled = false;
            cameraStatus = "available";
            render();
            return;
        }

        await initializeMedia({ enableVideo: true, enableAudio: micEnabled });
        cameraEnabled = true;
        cameraStatus = "granted";
        clearError();
        render();
        console.log("Camera active");
    } catch (err) {
        cameraStatus = err.name === "NotAllowedError" ? "denied" : "error";
        showError(`Camera error: ${err.message}`);
        console.error("Camera error:", err);
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
        render();
    }
}

async function toggleMicrophone() {
    try {
        if (micEnabled) {
            const track = globalMediaStream?.getAudioTracks?.()[0];
            if (track) track.enabled = false;
            micEnabled = false;
            micStatus = "available";
            render();
            return;
        }

        await initializeMedia({ enableVideo: cameraEnabled, enableAudio: true });
        micEnabled = true;
        micStatus = "granted";
        clearError();
        render();
        console.log("Microphone active");
    } catch (err) {
        micStatus = err.name === "NotAllowedError" ? "denied" : "error";
        showError(`Microphone error: ${err.message}`);
        console.error("Camera error:", err);
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
        render();
    }
}

function render() {
    renderCameraUI();
    renderMicUI();
    renderStartInterviewState();
    renderPermissionHelp();
}

function renderCameraUI() {
    if (ui.cameraStatusText) ui.cameraStatusText.textContent = getStatusText(cameraStatus, "Camera");
    if (ui.cameraStatusIcon) ui.cameraStatusIcon.innerHTML = getStatusIcon(cameraStatus);
    if (ui.cameraOverlay) ui.cameraOverlay.style.display = cameraEnabled ? "none" : "flex";

    if (ui.cameraButton) {
        ui.cameraButton.innerHTML = cameraEnabled
            ? '<i class="fas fa-video w-5 h-5"></i> Stop Camera'
            : '<i class="fas fa-video-slash w-5 h-5"></i> Start Camera';
    }
}

function renderMicUI() {
    if (ui.micStatusText) ui.micStatusText.textContent = getStatusText(micStatus, "Microphone");
    if (ui.micStatusIcon) ui.micStatusIcon.innerHTML = getStatusIcon(micStatus);

    if (ui.micButton) {
        ui.micButton.innerHTML = micEnabled
            ? '<i class="fas fa-microphone w-5 h-5"></i> Stop Microphone'
            : '<i class="fas fa-microphone-slash w-5 h-5"></i> Start Microphone';
    }

    if (ui.micIndicator) {
        ui.micIndicator.style.display = micEnabled ? "block" : "none";
        if (ui.micDot) {
            ui.micDot.className = micEnabled
                ? "w-3 h-3 rounded-full bg-green-400 animate-pulse"
                : "w-3 h-3 rounded-full bg-gray-500";
        }
    }
}

function renderStartInterviewState() {
    const devicesReady = cameraEnabled && micEnabled;
    const loggedIn = window.AuthApp?.isLoggedIn?.() ?? false;
    const canStart = loggedIn && devicesReady && !interviewStarted;

    if (ui.startInterviewContainer) {
        ui.startInterviewContainer.style.display = interviewStarted ? "none" : "block";
    }
    if (ui.startInterviewBtn) {
        ui.startInterviewBtn.style.display = interviewStarted ? "none" : "inline-flex";
        ui.startInterviewBtn.disabled = !canStart;
        ui.startInterviewBtn.classList.toggle("btn-start-interview--enabled", canStart);
        ui.startInterviewBtn.classList.toggle("btn-start-interview--locked", !canStart);
        ui.startInterviewBtn.classList.toggle("btn-start-interview--ready", canStart);
    }

    if (ui.deviceStartTooltip) {
        if (!loggedIn) {
            ui.deviceStartTooltip.textContent = "Please login first";
            ui.deviceStartTooltip.style.display = "block";
        } else if (!devicesReady) {
            ui.deviceStartTooltip.textContent = "Enable camera and microphone first";
            ui.deviceStartTooltip.style.display = "block";
        } else {
            ui.deviceStartTooltip.style.display = "none";
        }
    }

    if (ui.deviceReadyHint) {
        ui.deviceReadyHint.textContent = canStart
            ? "All devices are ready! You can begin your interview now."
            : "Enable camera and microphone to begin.";
    }

    if (canStart) {
        console.log("Interview button enabled");
    }
}

function renderPermissionHelp() {
    if (!ui.permissionHelp) return;
    const denied = cameraStatus === "denied" || micStatus === "denied";
    ui.permissionHelp.style.display = denied ? "block" : "none";
}

async function startInterview() {
    if (!window.AuthApp?.isLoggedIn?.()) return;
    if (!(cameraEnabled && micEnabled)) return;

    // Required: unlock audio in same click gesture (Chrome autoplay policy)
    if (window.TTSVoice) {
        TTSVoice.unlockFromUserClick();
    }

    interviewStarted = true;
    console.log("Interview started");
    renderStartInterviewState();

    const setupGrid = document.querySelector(".grid.grid-cols-1.lg\\:grid-cols-2.gap-8");
    if (setupGrid) setupGrid.style.display = "none";
    if (ui.interviewSection) {
        ui.interviewSection.classList.remove("is-hidden");
        ui.interviewSection.style.display = "block";
    }
    const chat = document.getElementById("chat-transcript");
    if (chat) chat.innerHTML = "";

    if (globalMediaStream) {
        await attachStreamToVideoElements();
    }

    if (window.EmotionDetection && ui.interviewUserVideo) {
        EmotionDetection.start(ui.interviewUserVideo, {
            onNervous: () => {
                if (!window.AIService?.state?.isSpeaking) {
                    AIService.setSpeakingStatus(
                        "You seem nervous — take a deep breath. You are doing well.",
                        "speaking-user"
                    );
                }
            },
        });
    }
    updateInterviewTopBar();
    startInterviewTimer();
    askedQuestions = [];
    discussedTopics = [];
    userSkills = [];
    logConversationMemory();
    startInterviewSession();
}

function endInterview() {
    if (!sessionId) {
        resetInterviewUI();
        return;
    }
    console.log("[Interview] End Interview clicked — generating report");
    generateAndShowFeedback();
}

function resetInterviewUI() {
    interviewStarted = false;
    stopInterviewTimer();
    stopAnswerListening();
    if (window.EmotionDetection) EmotionDetection.stop();
    if (ui.interviewSection) {
        ui.interviewSection.classList.add("is-hidden");
        ui.interviewSection.style.display = "none";
    }
    const setupGrid = document.querySelector(".grid.grid-cols-1.lg\\:grid-cols-2.gap-8");
    if (setupGrid) setupGrid.style.display = "grid";
    if (window.AIService) {
        AIService.setAIMessage("Waiting for AI interviewer…");
        AIService.setBotStatus("Ready", "status-ready");
    }
    renderStartInterviewState();
}

async function generateAndShowFeedback() {
    const overlay = document.getElementById("feedbackOverlay");
    interviewStarted = false;
    stopInterviewTimer();
    stopAnswerListening();
    if (window.EmotionDetection) EmotionDetection.stop();

    if (window.FeedbackDashboard && overlay) {
        FeedbackDashboard.showGenerating(overlay);
    }

    try {
        const data = await AIService.finalizeInterview();
        console.log("[Interview] feedback report ready");
        if (window.FeedbackDashboard && overlay) {
            FeedbackDashboard.render(overlay, data.summary);
        }
    } catch (error) {
        console.error("[Interview] feedback generation failed:", error);
        if (window.FeedbackDashboard && overlay) {
            FeedbackDashboard.renderUnavailable(
                overlay,
                error.message || "AI analysis unavailable",
                "Scores are only shown after successful Gemini analysis."
            );
        } else if (overlay) {
            overlay.innerHTML = `
                <div class="feedback-generating">
                    <h2 style="color:#fff">Could not generate report</h2>
                    <p>${error.message}</p>
                    <button type="button" class="feedback-btn feedback-btn--secondary" onclick="window.location.href='/device-setup'">Back</button>
                </div>
            `;
        }
    }
}

function logConversationMemory() {
    console.log("Previously discussed:", discussedTopics);
    console.log("Asked questions:", askedQuestions);
    console.log("Current detected skills:", userSkills);
}

function extractTopicsFromText(text) {
    const lower = (text || "").toLowerCase();
    const topics = [];
    const map = {
        java: ["java"],
        spring: ["spring boot", "spring"],
        sql: ["sql", "mysql", "database"],
        dsa: ["dsa", "data structure", "algorithm", "leetcode"],
        project: ["built", "developed", "project", "system"],
        aiml: ["machine learning", "ai", "ml", "chatbot"],
    };
    Object.entries(map).forEach(([topic, keywords]) => {
        if (keywords.some((kw) => lower.includes(kw))) topics.push(topic);
    });
    return topics;
}

function extractSkillsFromText(text) {
    const lower = (text || "").toLowerCase();
    const skills = [];
    if (lower.includes("java")) skills.push("java");
    if (lower.includes("spring")) skills.push("spring");
    if (lower.includes("sql") || lower.includes("database")) skills.push("sql");
    if (lower.includes("dsa") || lower.includes("algorithm")) skills.push("dsa");
    if (lower.includes("python")) skills.push("python");
    if (lower.includes("react")) skills.push("react");
    if (lower.includes("chatbot") || lower.includes("machine learning")) skills.push("aiml");
    return skills;
}

function syncMemoryFromAnswer(answer) {
    extractTopicsFromText(answer).forEach((t) => {
        if (!discussedTopics.includes(t)) discussedTopics.push(t);
    });
    extractSkillsFromText(answer).forEach((s) => {
        if (!userSkills.includes(s)) userSkills.push(s);
    });
    logConversationMemory();
}

function syncMemoryFromServer(memory) {
    if (!memory) return;
    if (Array.isArray(memory.discussed_topics)) discussedTopics = [...memory.discussed_topics];
    if (Array.isArray(memory.skills_mentioned)) userSkills = [...memory.skills_mentioned];
    if (Array.isArray(memory.asked_questions)) askedQuestions = [...memory.asked_questions];
    logConversationMemory();
}

function formatTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startInterviewTimer() {
    interviewStartedAt = Date.now();
    stopInterviewTimer();
    const el = document.getElementById("interview-timer");
    if (!el) return;
    el.textContent = "00:00";
    interviewTimerInterval = setInterval(() => {
        const secs = Math.floor((Date.now() - interviewStartedAt) / 1000);
        el.textContent = formatTimer(secs);
    }, 1000);
}

function stopInterviewTimer() {
    if (interviewTimerInterval) {
        clearInterval(interviewTimerInterval);
        interviewTimerInterval = null;
    }
}

function updateInterviewTopBar() {
    const modeEl = document.getElementById("interview-mode-badge");
    const langEl = document.getElementById("interview-lang-badge");
    if (modeEl && window.InterviewSettings) {
        modeEl.textContent = InterviewSettings.getModeLabel();
    }
    if (langEl && window.InterviewSettings) {
        const lang = InterviewSettings.getLanguage();
        langEl.textContent = InterviewSettings.LANGUAGES[lang]?.label || "English";
    }
}

function buildInterviewProfile() {
    const user = window.AuthApp?.getUser?.();
    const extras = window.InterviewSettings?.getProfileExtras?.() || {};
    return {
        name: user?.username || "Candidate",
        role: "Software Engineer",
        experience: "Fresher",
        ...extras,
    };
}

function updateCurrentQuestion(text) {
    const el = document.getElementById("current-question-line");
    if (el) el.textContent = text ? `Current: ${text}` : "";
}

async function startInterviewSession() {
    try {
        const data = await AIService.startSession(buildInterviewProfile());
        sessionId = AIService.state.sessionId;
        turnCount = 0;
        currentQuestion = data.question || "";
        if (currentQuestion) askedQuestions.push(currentQuestion);
        updateCurrentQuestion(currentQuestion);
        logConversationMemory();
        console.log("[Interview] Gemini session ready");

        AIService.speakAndThenListen(data.interviewer_message, () => startListening());
    } catch (error) {
        console.error("[Interview] start failed:", error);
        showError(`Unable to start AI interview session: ${error.message}`);
    }
}

function clearAnswerSubmitTimer() {
    if (answerSubmitTimer) {
        clearTimeout(answerSubmitTimer);
        answerSubmitTimer = null;
    }
}

function scheduleAnswerSubmit() {
    clearAnswerSubmitTimer();
    if (!answerBuffer.trim() || !listeningForAnswer) return;

    answerSubmitTimer = setTimeout(() => {
        if (!listeningForAnswer || !answerBuffer.trim() || isSubmittingAnswer) return;
        const text = answerBuffer.trim();
        answerBuffer = "";
        console.log("[Interview] auto-submit after pause:", text);
        submitBufferedAnswer(text);
    }, ANSWER_SUBMIT_PAUSE_MS);
}

function stopAnswerListening() {
    listeningForAnswer = false;
    userSpeechActive = false;
    answerBuffer = "";
    clearAnswerSubmitTimer();
    fillerNudgeSent = false;
    if (window.SilenceMonitor) SilenceMonitor.stop();
    stopRecognition();
    if (window.AIService) AIService.setListeningVisual(false);
}

function deliverSilenceNudge(message) {
    if (!listeningForAnswer || isSubmittingAnswer) return;
    if (window.AIService?.state?.isSpeaking || window.AIService?.state?.isNudging) return;

    SilenceMonitor.pause();
    const wasListening = listeningForAnswer;
    stopRecognition();

    AIService.speakNudge(message, () => {
        if (wasListening && interviewStarted) {
            SilenceMonitor.resume();
            startListening({ resume: true });
        }
    });
}

function submitBufferedAnswer(text) {
    if (isSubmittingAnswer || !text.trim()) return;
    isSubmittingAnswer = true;
    listeningForAnswer = false;
    SilenceMonitor.stop();
    clearAnswerSubmitTimer();
    stopRecognition();

    const metrics = window.SpeechAnalysis
        ? SpeechAnalysis.buildMetrics(text, lastSpeechStartAt)
        : {};

    handleAnswerComplete(text, metrics);
}

function startListening({ resume = false } = {}) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        AIService?.setSpeakingStatus("Speech recognition not supported in this browser.", "speaking-user");
        return;
    }

    if (!resume) {
        answerBuffer = "";
        fillerNudgeSent = false;
    }

    listeningForAnswer = true;
    isSubmittingAnswer = false;
    lastSpeechStartAt = Date.now();
    AIService.markListening();

    if (window.SilenceMonitor) {
        SilenceMonitor.start({
            hasAnswerStarted: () => Boolean(answerBuffer.trim()),
            isUserSpeaking: () => userSpeechActive,
            isBlocked: () =>
                isSubmittingAnswer ||
                AIService.state.isSpeaking ||
                AIService.state.isThinking ||
                AIService.state.isNudging,
            onPrompt: (message) => deliverSilenceNudge(message),
        });
    }

    stopRecognition();
    recognition = new SpeechRecognition();
    recognition.lang = window.InterviewSettings?.getRecognitionLang?.() || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
        console.log("[Interview] recognition started");
    };

    recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const part = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalText += part;
            else interimText += part;
        }

        const preview = `${finalText} ${interimText}`.trim();
        if (!preview) return;

        userSpeechActive = true;
        if (window.SilenceMonitor) SilenceMonitor.onSpeechActivity();

        AIService.setSpeakingStatus(`You: ${preview}`, "speaking-user speaking-active");

        if (finalText.trim()) {
            answerBuffer = answerBuffer ? `${answerBuffer} ${finalText.trim()}` : finalText.trim();
            userSpeechActive = false;
            scheduleAnswerSubmit();
        }
    };

    recognition.onspeechend = () => {
        userSpeechActive = false;
        if (answerBuffer.trim() && !fillerNudgeSent && window.SpeechAnalysis) {
            if (SpeechAnalysis.countFillers(answerBuffer) >= 4) {
                fillerNudgeSent = true;
                deliverSilenceNudge(SpeechAnalysis.pickFillerEncouragement());
                return;
            }
        }
        scheduleAnswerSubmit();
    };

    recognition.onerror = (ev) => {
        console.error("[Interview] recognition error:", ev.error);
        if (ev.error === "no-speech" && listeningForAnswer) return;
        AIService.setSpeakingStatus("Listening issue — retrying…", "speaking-user");
    };

    recognition.onend = () => {
        if (!listeningForAnswer || !interviewStarted || isSubmittingAnswer) return;
        console.log("[Interview] recognition ended — restarting listener");
        try {
            recognition.start();
        } catch (_) {
            setTimeout(() => startListening({ resume: true }), 400);
        }
    };

    try {
        recognition.start();
    } catch (err) {
        console.error("[Interview] recognition.start failed:", err);
        setTimeout(() => startListening({ resume: true }), 500);
    }
}

async function handleAnswerComplete(answer, speechMetrics) {
    isSubmittingAnswer = true;
    listeningForAnswer = false;
    clearAnswerSubmitTimer();
    if (window.SilenceMonitor) SilenceMonitor.stop();

    AIService.addChatBubble("user", answer);
    syncMemoryFromAnswer(answer);

    try {
        const emotionMetrics = window.EmotionDetection
            ? EmotionDetection.getMetrics()
            : {};

        const data = await AIService.submitTurn({
            question: currentQuestion,
            answer,
            speechMetrics,
            emotionMetrics,
        });

        turnCount = AIService.state.turnCount;
        currentQuestion = data.next_question || currentQuestion;
        syncMemoryFromServer(data.memory);
        if (currentQuestion && !askedQuestions.includes(currentQuestion)) {
            askedQuestions.push(currentQuestion);
        }
        updateCurrentQuestion(currentQuestion);
        logConversationMemory();

        const stageLabel = document.getElementById("interview-stage-label");
        if (stageLabel) stageLabel.textContent = `Question ${turnCount} · ${InterviewSettings?.getModeLabel?.() || "Interview"}`;

        isSubmittingAnswer = false;
        AIService.speakAndThenListen(data.interviewer_message, () => startListening());
    } catch (error) {
        isSubmittingAnswer = false;
        console.error("[Interview] turn failed:", error);
        const msg = error.message || "AI analysis unavailable";
        AIService.setSpeakingStatus(msg, "speaking-user");
        AIService.addChatBubble("ai", `${msg}. Please try answering again when the AI service is available.`);
        setTimeout(() => startListening({ resume: true }), 1200);
    }
}

async function finalizeInterview() {
    stopAnswerListening();
    const overlay = document.getElementById("feedbackOverlay");
    if (window.FeedbackDashboard && overlay) {
        FeedbackDashboard.showGenerating(overlay);
    }

    try {
        const data = await AIService.finalizeInterview();
        console.log("[Interview] auto-finalize complete");
        if (window.FeedbackDashboard && overlay) {
            FeedbackDashboard.render(overlay, data.summary);
        } else {
            window.location.href = `/feedback?session_id=${encodeURIComponent(sessionId)}`;
        }
    } catch (error) {
        console.error("[Interview] finalize failed:", error);
        const msg = error.message || "AI analysis unavailable";
        if (window.FeedbackDashboard && overlay) {
            FeedbackDashboard.renderUnavailable(overlay, msg, "Scores are only shown after successful Gemini analysis.");
        } else {
            showError(`Unable to generate final feedback: ${msg}`);
            window.location.href = `/feedback?session_id=${encodeURIComponent(sessionId || "")}`;
        }
    }
}

function stopRecognition() {
    try {
        if (recognition) recognition.stop();
    } catch (_) {
        // no-op
    }
}

function getStatusIcon(status) {
    switch (status) {
        case "granted":
        case "available":
            return '<i class="fas fa-check-circle w-5 h-5 text-green-400"></i>';
        case "denied":
        case "not_found":
        case "error":
            return '<i class="fas fa-exclamation-circle w-5 h-5 text-red-400"></i>';
        case "checking":
            return '<i class="fas fa-spinner w-5 h-5 text-yellow-400 animate-spin"></i>';
        default:
            return "";
    }
}

function getStatusText(status, deviceName) {
    switch (status) {
        case "granted":
            return `${deviceName} active`;
        case "available":
            return `${deviceName} available`;
        case "denied":
            return `${deviceName} permission denied`;
        case "not_found":
            return `${deviceName} not found`;
        case "error":
            return `${deviceName} error`;
        default:
            return `Checking ${deviceName}...`;
    }
}

function showError(message) {
    if (ui.errorContainer) ui.errorContainer.style.display = "block";
    if (ui.errorMessage) ui.errorMessage.textContent = message;
}

function clearError() {
    if (ui.errorContainer) ui.errorContainer.style.display = "none";
}
