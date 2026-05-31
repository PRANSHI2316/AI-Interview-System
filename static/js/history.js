/** Interview history list + detail view */
document.addEventListener("DOMContentLoaded", async () => {
    await AuthApp.init();
    if (window.InterviewSettings) await InterviewSettings.syncFromServer();

    const listEl = document.getElementById("historyList");
    const detailEl = document.getElementById("historyDetail");
    const detailContent = document.getElementById("historyDetailContent");
    const loadingEl = document.getElementById("historyLoading");
    const emptyEl = document.getElementById("historyEmpty");
    const loginPrompt = document.getElementById("historyLoginPrompt");

    document.getElementById("historyBackBtn")?.addEventListener("click", () => {
        detailEl?.classList.add("is-hidden");
        listEl.style.display = "";
    });

    document.getElementById("btn-history-login")?.addEventListener("click", () => {
        document.getElementById("btn-open-login")?.click();
    });

    if (!AuthApp.isLoggedIn()) {
        loadingEl.style.display = "none";
        loginPrompt.style.display = "block";
        return;
    }

    loadHistory();

    async function loadHistory() {
        try {
            const res = await fetch("/api/interview/history", { credentials: "same-origin" });
            const data = await res.json();
            loadingEl.style.display = "none";

            if (!data.success) throw new Error(data.error || "Failed to load");

            const items = data.history || [];
            if (!items.length) {
                emptyEl.style.display = "block";
                return;
            }

            listEl.innerHTML = items
                .map(
                    (item) => `
                <article class="history-card" data-session="${item.session_id}">
                    <div class="history-card__top">
                        <span class="history-card__date">${formatDate(item.created_at)}</span>
                        <span class="history-card__mode">${escapeHtml(item.interview_mode || "Interview")}</span>
                    </div>
                    <div class="history-card__meta">
                        <span><i class="fas fa-language"></i> ${langLabel(item.language)}</span>
                        <span><i class="fas fa-star"></i> Overall: ${scoreOrDash(item.overall_score)}</span>
                    </div>
                    <div class="history-card__scores">
                        <span>Confidence: ${scoreOrDash(item.confidence_score)}</span>
                        <span>Communication: ${scoreOrDash(item.communication_score)}</span>
                    </div>
                    <p class="history-card__summary">${escapeHtml(item.feedback_summary || "No summary yet.")}</p>
                </article>`
                )
                .join("");

            listEl.querySelectorAll(".history-card").forEach((card) => {
                card.addEventListener("click", () => openDetail(card.dataset.session));
            });
        } catch (err) {
            loadingEl.style.display = "none";
            listEl.innerHTML = `<p class="history-error">${escapeHtml(err.message)}</p>`;
        }
    }

    async function openDetail(sessionId) {
        detailContent.innerHTML = '<div class="history-loading"><span class="ai-loading__spinner"></span> Loading…</div>';
        listEl.style.display = "none";
        detailEl.classList.remove("is-hidden");

        try {
            const res = await fetch(`/api/interview/history/${sessionId}`, { credentials: "same-origin" });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Not found");

            const summary = data.summary || {};
            const turns = data.turns || [];
            const profile = data.profile || {};

            detailContent.innerHTML = `
                <header class="history-detail__header">
                    <h2>${escapeHtml(profile.interview_mode_label || profile.interview_mode || "Interview")}</h2>
                    <p>${langLabel(profile.language)} · ${formatDate(data.turns?.[0]?.created_at || "")}</p>
                </header>
                <div class="history-detail__scores">
                    <div class="history-score-pill">Overall <strong>${scoreOrDash(summary.overall_score)}</strong></div>
                    <div class="history-score-pill">Confidence <strong>${scoreOrDash(summary.confidence_score)}</strong></div>
                    <div class="history-score-pill">Communication <strong>${scoreOrDash(summary.communication_score)}</strong></div>
                </div>
                ${
                    summary.feedback_text
                        ? `<section class="history-section"><h3>AI Feedback</h3><p>${escapeHtml(summary.feedback_text)}</p></section>`
                        : ""
                }
                ${
                    summary.improvement_suggestions?.length
                        ? `<section class="history-section"><h3>Suggestions</h3><ul>${summary.improvement_suggestions.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></section>`
                        : ""
                }
                <section class="history-section">
                    <h3>Transcript</h3>
                    <div class="history-transcript">
                        ${turns
                            .map(
                                (t, i) => `
                            <div class="history-turn">
                                <p class="history-turn__q"><strong>Q${i + 1}:</strong> ${escapeHtml(t.question || "")}</p>
                                <p class="history-turn__a"><strong>You:</strong> ${escapeHtml(t.answer || "")}</p>
                                ${t.coaching_line ? `<p class="history-turn__coach"><em>${escapeHtml(t.coaching_line)}</em></p>` : ""}
                            </div>`
                            )
                            .join("")}
                    </div>
                </section>`;
        } catch (err) {
            detailContent.innerHTML = `<p class="history-error">${escapeHtml(err.message)}</p>`;
        }
    }

    function formatDate(iso) {
        if (!iso) return "—";
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    }

    function langLabel(code) {
        return InterviewSettings?.LANGUAGES?.[code]?.label || code || "English";
    }

    function scoreOrDash(val) {
        if (val === null || val === undefined || val === "") return "—";
        return `${Math.round(Number(val))}%`;
    }

    function escapeHtml(text) {
        const d = document.createElement("div");
        d.textContent = text || "";
        return d.innerHTML;
    }
});
