const questions = [
    "Tell me about yourself.",
    "What are your strengths?",
    "Why should we hire you?",
    "What are your weaknesses?"
];

let currentQuestionIndex = 0;
let recognition = null;
let stream = null;

const startInterviewBtn = document.getElementById("start-interview-btn");
const endInterviewBtn = document.getElementById("end-interview-btn");
const userVideo = document.getElementById("user-video");
const interviewState = document.getElementById("interview-state");
const currentQuestionText = document.getElementById("current-question-text");
const transcriptText = document.getElementById("transcript-text");
const progressBar = document.getElementById("progress-bar");
const progressPercent = document.getElementById("progress-percent");
const currentQuestionNum = document.getElementById("current-question-num");

document.addEventListener("DOMContentLoaded", init);

function init() {
    startInterviewBtn?.addEventListener("click", startInterview);
    endInterviewBtn?.addEventListener("click", endInterview);
    startCamera();
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (userVideo) {
            userVideo.srcObject = stream;
            await userVideo.play();
        }
    } catch (error) {
        setState("Camera/Mic access denied");
    }
}

async function startInterview() {
    if (startInterviewBtn) startInterviewBtn.style.display = "none";
    if (endInterviewBtn) endInterviewBtn.style.display = "inline-block";
    currentQuestionIndex = 0;
    updateProgress();

    const intro = "Hello, I am your AI Interview Assistant. I will conduct your interview today. First, please introduce yourself. Tell me about yourself.";
    await speak(intro);
    startListening();
}

function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        setState("Speech recognition not supported");
        return;
    }

    if (recognition) {
        try {
            recognition.stop();
        } catch (_) {
            // no-op
        }
    }

    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    setState("Listening...");
    recognition.onresult = (event) => {
        let finalText = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
            if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
            else interim += event.results[i][0].transcript;
        }
        transcriptText.textContent = `You said: ${finalText || interim}`;
        if (finalText.trim()) {
            handleAnswer();
        }
    };

    recognition.onerror = () => setState("Listening failed");
    recognition.start();
}

async function handleAnswer() {
    currentQuestionIndex += 1;
    if (currentQuestionIndex >= questions.length) {
        await speak("Thank you. The interview is complete.");
        setState("Interview Complete");
        return;
    }

    updateProgress();
    const question = questions[currentQuestionIndex];
    currentQuestionText.textContent = question;
    await speak(question);
    startListening();
}

function speak(text) {
    currentQuestionText.textContent = text;
    setState("Speaking...");
    return new Promise((resolve) => {
        if (!("speechSynthesis" in window)) {
            resolve();
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = resolve;
        utterance.onerror = resolve;
        speechSynthesis.speak(utterance);
    });
}

function updateProgress() {
    const total = questions.length;
    const index = Math.min(currentQuestionIndex + 1, total);
    const percent = Math.round((index / total) * 100);

    if (currentQuestionNum) currentQuestionNum.textContent = String(index);
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
}

function setState(text) {
    if (interviewState) interviewState.textContent = text;
}

function endInterview() {
    try {
        recognition?.stop();
    } catch (_) {
        // no-op
    }
    stream?.getTracks()?.forEach((t) => t.stop());
    window.location.href = "/device-setup";
}
