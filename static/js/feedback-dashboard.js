/** Renders professional AI interview feedback dashboard */
window.FeedbackDashboard = (function () {
    function clampScore(value) {
        return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    }

    function scoreBar(label, value) {
        const v = clampScore(value);
        return `
            <div class="score-bar-row">
                <div class="score-bar-row__head"><span>${label}</span><span>${v}%</span></div>
                <div class="score-bar-row__track">
                    <div class="score-bar-row__fill" data-score="${v}" style="width:0"></div>
                </div>
            </div>
        `;
    }

    function overallRing(value) {
        const v = clampScore(value);
        const radius = 70;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (v / 100) * circumference;
        return `
            <div class="overall-ring">
                <svg viewBox="0 0 160 160" aria-hidden="true">
                    <circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="12"/>
                    <circle cx="80" cy="80" r="${radius}" fill="none" stroke="url(#ringGrad)" stroke-width="12"
                        stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
                    <defs>
                        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#6366f1"/>
                            <stop offset="100%" stop-color="#a78bfa"/>
                        </linearGradient>
                    </defs>
                </svg>
                <div class="overall-ring__label">
                    <span class="overall-ring__value">${v}%</span>
                    <span class="overall-ring__text">Overall</span>
                </div>
            </div>
        `;
    }

    function renderList(items, fallback, className) {
        const list = Array.isArray(items) && items.length ? items : fallback;
        return `<ul class="feedback-list ${className}">${list.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    }

    function renderCorrections(items) {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) {
            return `<p class="feedback-narrative">No major grammar issues detected. Keep practicing polished phrasing.</p>`;
        }
        return list
            .map(
                (item) => `
            <div class="correction-card">
                <div class="correction-card__label">Your answer</div>
                <div class="correction-card__original">"${item.original || ""}"</div>
                <div class="correction-card__label">Better version</div>
                <div class="correction-card__improved">"${item.improved || ""}"</div>
                ${item.note ? `<p class="feedback-meta">${item.note}</p>` : ""}
            </div>
        `
            )
            .join("");
    }

    function renderTranscript(turns) {
        if (!Array.isArray(turns) || !turns.length) {
            return `<p class="feedback-narrative">No transcript available for this session.</p>`;
        }
        return turns
            .map(
                (turn) => `
            <div class="transcript-turn transcript-turn--ai">
                <div class="transcript-turn__role">Interviewer</div>
                <p class="transcript-turn__text">${turn.question || ""}</p>
            </div>
            <div class="transcript-turn transcript-turn--user">
                <div class="transcript-turn__role">You</div>
                <p class="transcript-turn__text">${turn.answer || ""}</p>
            </div>
        `
            )
            .join("");
    }

    function animateBars(root) {
        requestAnimationFrame(() => {
            root.querySelectorAll(".score-bar-row__fill").forEach((el) => {
                el.style.width = `${el.dataset.score || 0}%`;
            });
        });
    }

    async function speakFeedback(text) {
        if (!text) return;
        if (window.TTSVoice) {
            TTSVoice.unlockFromUserClick();
            const lang = TTSVoice.getLanguageFromSettings();
            try {
                await TTSVoice.speakAI(text, lang);
                return;
            } catch (e) {
                console.warn("[FeedbackDashboard] TTS failed", e);
            }
        }
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = window.InterviewSettings?.getSpeechLang?.() || "en-US";
        utterance.rate = 0.93;
        window.speechSynthesis.speak(utterance);
    }

    function render(container, summary) {
        if (!container || !summary) return;

        const name = summary.candidate_name || "Candidate";
        const date = summary.generated_at
            ? new Date(summary.generated_at).toLocaleString()
            : new Date().toLocaleString();

        container.innerHTML = `
            <div class="feedback-shell">
                <div class="feedback-header">
                    <h1>Interview Analysis Report</h1>
                    <p>${name} · ${date}</p>
                </div>

                <div class="feedback-grid feedback-grid--scores">
                    <div class="feedback-card">${overallRing(summary.overall_score)}</div>
                    <div class="feedback-card">
                        <h2><i class="fas fa-chart-line"></i> Performance Scores</h2>
                        ${scoreBar("Communication", summary.communication_score)}
                        ${scoreBar("Confidence", summary.confidence_score)}
                        ${scoreBar("Technical Knowledge", summary.technical_score)}
                        ${scoreBar("Speaking Fluency", summary.fluency_score)}
                        ${scoreBar("Clarity", summary.clarity_score)}
                        ${scoreBar("Grammar", summary.grammar_score)}
                        ${scoreBar("Introduction Quality", summary.introduction_quality_score)}
                        ${scoreBar("Eye Contact / Presence", summary.eye_contact_score)}
                        ${scoreBar("Vocabulary", summary.vocabulary_score)}
                    </div>
                </div>

                <div class="feedback-card" style="margin-top:1rem">
                    <h2><i class="fas fa-comment-dots"></i> AI Coach Summary</h2>
                    <p class="feedback-narrative">${summary.feedback_text || ""}</p>
                </div>

                <div class="feedback-grid feedback-grid--two" style="margin-top:1rem">
                    <div class="feedback-card">
                        <h2><i class="fas fa-check-circle"></i> Strengths</h2>
                        ${renderList(summary.strengths, ["Shows willingness to participate"], "feedback-list--strengths")}
                    </div>
                    <div class="feedback-card">
                        <h2><i class="fas fa-exclamation-triangle"></i> Areas to Improve</h2>
                        ${renderList(summary.weaknesses, ["Continue improving answer structure"], "feedback-list--improve")}
                    </div>
                </div>

                <div class="feedback-card" style="margin-top:1rem">
                    <h2><i class="fas fa-lightbulb"></i> Personalized Suggestions</h2>
                    ${renderList(summary.improvement_suggestions, ["Practice mock interviews weekly"], "feedback-list--tips")}
                </div>

                <div class="feedback-card" style="margin-top:1rem">
                    <h2><i class="fas fa-spell-check"></i> Corrected Answers</h2>
                    ${renderCorrections(summary.corrected_answers)}
                </div>

                <div class="feedback-card" style="margin-top:1rem">
                    <h2><i class="fas fa-comments"></i> Interview Transcript</h2>
                    <div class="transcript-thread">${renderTranscript(summary.turns)}</div>
                </div>

                <div class="feedback-actions">
                    <button type="button" class="feedback-btn feedback-btn--primary" id="feedback-practice-again">Practice Again</button>
                    <button type="button" class="feedback-btn feedback-btn--secondary" id="feedback-device-setup">Back to Device Setup</button>
                </div>
                <p class="feedback-meta">Session ID: ${summary.session_id || "—"}</p>
            </div>
        `;

        animateBars(container);
        document.getElementById("feedback-practice-again")?.addEventListener("click", () => {
            window.location.href = "/landing";
        });
        document.getElementById("feedback-device-setup")?.addEventListener("click", () => {
            window.location.href = "/device-setup";
        });

        speakFeedback(summary.spoken_feedback);
        console.log("[FeedbackDashboard] report rendered");
    }

    function showGenerating(container) {
        if (!container) return;
        container.classList.remove("is-hidden");
        container.innerHTML = `
            <div class="feedback-generating">
                <div class="feedback-spinner"></div>
                <h2 style="color:#fff;margin:0 0 .5rem">Generating your AI interview report…</h2>
                <p>Analyzing communication, confidence, grammar, and technical responses.</p>
            </div>
        `;
    }

    function hide(container) {
        container?.classList.add("is-hidden");
    }

    return { render, showGenerating, hide, speakFeedback };
})();
