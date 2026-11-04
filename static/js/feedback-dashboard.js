/** Renders professional AI interview feedback dashboard — real Gemini scores only */
window.FeedbackDashboard = (function () {
    function clampScore(value) {
        return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    }

    function hasRealScores(summary) {
        if (!summary) return false;
        if (summary.analysis_available === false) return false;
        if (summary.scores === null) return false;
        return summary.analysis_available === true || summary.overall_score != null;
    }

    function scoreBar(label, value, disabled) {
        const v = disabled ? 0 : clampScore(value);
        const display = disabled ? "0%" : `${v}%`;
        const extraClass = disabled ? " score-bar-row--disabled" : "";
        return `
            <div class="score-bar-row${extraClass}">
                <div class="score-bar-row__head"><span>${label}</span><span>${display}</span></div>
                <div class="score-bar-row__track">
                    <div class="score-bar-row__fill" data-score="${v}" style="width:0"></div>
                </div>
            </div>
        `;
    }

    function overallRing(value, disabled) {
        const v = disabled ? 0 : clampScore(value);
        const radius = 70;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (v / 100) * circumference;
        const display = disabled ? "0%" : `${v}%`;
        return `
            <div class="overall-ring${disabled ? " overall-ring--disabled" : ""}">
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
                    <span class="overall-ring__value">${display}</span>
                    <span class="overall-ring__text">Overall</span>
                </div>
            </div>
        `;
    }

    function renderList(items, className, emptyMessage) {
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (!list.length) {
            return `<p class="feedback-narrative">${emptyMessage}</p>`;
        }
        return `<ul class="feedback-list ${className}">${list.map((i) => `<li>${i}</li>`).join("")}</ul>`;
    }

    function renderCorrections(items) {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) {
            return `<p class="feedback-narrative">No grammar corrections were generated for this session.</p>`;
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

    function animateBars(root, disabled) {
        if (disabled) return;
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

    function renderUnavailable(container, message, detail) {
        if (!container) return;
        container.classList.remove("is-hidden");
        container.innerHTML = `
            <div class="feedback-shell">
                <div class="feedback-warning">
                    <h1><i class="fas fa-exclamation-triangle"></i> ${message || "No interview data available"}</h1>
                    <p>${detail || "Complete an interview with a valid transcript to receive AI-generated scores."}</p>
                    <div class="feedback-grid feedback-grid--scores feedback-grid--disabled">
                        <div class="feedback-card">${overallRing(0, true)}</div>
                        <div class="feedback-card">
                            <h2>Performance Scores</h2>
                            ${scoreBar("Communication", 0, true)}
                            ${scoreBar("Confidence", 0, true)}
                            ${scoreBar("Technical Knowledge", 0, true)}
                        </div>
                    </div>
                    <div class="feedback-actions">
                        <button type="button" class="feedback-btn feedback-btn--primary" onclick="window.location.href='/landing'">Practice Again</button>
                        <button type="button" class="feedback-btn feedback-btn--secondary" onclick="window.location.href='/device-setup'">Back to Device Setup</button>
                    </div>
                </div>
            </div>
        `;
        console.warn("[FeedbackDashboard] unavailable:", message, detail || "");
    }

    function render(container, summary) {
        if (!container) return;

        if (!hasRealScores(summary)) {
            renderUnavailable(container, "No interview data available", summary?.message);
            return;
        }

        const name = summary.candidate_name || "Candidate";
        const date = summary.generated_at
            ? new Date(summary.generated_at).toLocaleString()
            : new Date().toLocaleString();

        console.log("[FeedbackDashboard] rendering real scores overall=", summary.overall_score);

        container.innerHTML = `
            <div class="feedback-shell">
                <div class="feedback-header">
                    <h1>Interview Analysis Report</h1>
                    <p>${name} · ${date}</p>
                </div>

                <div class="feedback-grid feedback-grid--scores">
                    <div class="feedback-card">${overallRing(summary.overall_score, false)}</div>
                    <div class="feedback-card">
                        <h2><i class="fas fa-chart-line"></i> Performance Scores</h2>
                        ${scoreBar("Communication", summary.communication_score, false)}
                        ${scoreBar("Confidence", summary.confidence_score, false)}
                        ${scoreBar("Technical Knowledge", summary.technical_score, false)}
                        ${scoreBar("Speaking Fluency", summary.fluency_score, false)}
                        ${scoreBar("Clarity", summary.clarity_score, false)}
                        ${scoreBar("Grammar", summary.grammar_score, false)}
                        ${scoreBar("Introduction Quality", summary.introduction_quality_score, false)}
                        ${scoreBar("Eye Contact / Presence", summary.eye_contact_score, false)}
                        ${scoreBar("Vocabulary", summary.vocabulary_score, false)}
                    </div>
                </div>

                <div class="feedback-card" style="margin-top:1rem">
                    <h2><i class="fas fa-comment-dots"></i> AI Coach Summary</h2>
                    <p class="feedback-narrative">${summary.feedback_text || ""}</p>
                </div>

                <div class="feedback-grid feedback-grid--two" style="margin-top:1rem">
                    <div class="feedback-card">
                        <h2><i class="fas fa-check-circle"></i> Strengths</h2>
                        ${renderList(summary.strengths, "feedback-list--strengths", "No strengths were identified for this session.")}
                    </div>
                    <div class="feedback-card">
                        <h2><i class="fas fa-exclamation-triangle"></i> Areas to Improve</h2>
                        ${renderList(summary.weaknesses, "feedback-list--improve", "No improvement areas were identified for this session.")}
                    </div>
                </div>

                <div class="feedback-card" style="margin-top:1rem">
                    <h2><i class="fas fa-lightbulb"></i> Personalized Suggestions</h2>
                    ${renderList(summary.improvement_suggestions, "feedback-list--tips", "No suggestions were generated for this session.")}
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

        animateBars(container, false);
        document.getElementById("feedback-practice-again")?.addEventListener("click", () => {
            window.location.href = "/landing";
        });
        document.getElementById("feedback-device-setup")?.addEventListener("click", () => {
            window.location.href = "/device-setup";
        });

        speakFeedback(summary.spoken_feedback);
        console.log("[FeedbackDashboard] report rendered from Gemini analysis");
    }

    function showGenerating(container) {
        if (!container) return;
        container.classList.remove("is-hidden");
        container.innerHTML = `
            <div class="feedback-generating">
                <div class="feedback-spinner"></div>
                <h2 style="color:#fff;margin:0 0 .5rem">Generating your AI interview report…</h2>
                <p>Analyzing transcript with Gemini. No scores are shown until analysis completes.</p>
            </div>
        `;
    }

    function hide(container) {
        container?.classList.add("is-hidden");
    }

    return { render, renderUnavailable, showGenerating, hide, speakFeedback, hasRealScores };
})();
