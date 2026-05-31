/** Shared auth UI + session handling for landing and device setup */
window.AuthApp = (function () {
    let currentUser = null;

    const els = () => ({
        navGuest: document.getElementById("nav-guest"),
        navUser: document.getElementById("nav-user"),
        navUsername: document.getElementById("nav-username"),
        loginModal: document.getElementById("login-modal"),
        signupModal: document.getElementById("signup-modal"),
        loginForm: document.getElementById("login-form"),
        signupForm: document.getElementById("signup-form"),
        loginError: document.getElementById("login-error"),
        signupError: document.getElementById("signup-error"),
    });

    function isLoggedIn() {
        return Boolean(currentUser);
    }

    function getUser() {
        return currentUser;
    }

    function openModal(modal) {
        if (modal) modal.classList.add("modal-open");
    }

    function closeModal(modal) {
        if (modal) modal.classList.remove("modal-open");
    }

    function closeAllModals() {
        const e = els();
        closeModal(e.loginModal);
        closeModal(e.signupModal);
    }

    function updateNavbar() {
        const e = els();
        if (e.navGuest) e.navGuest.style.display = isLoggedIn() ? "none" : "flex";
        if (e.navUser) e.navUser.style.display = isLoggedIn() ? "flex" : "none";
        if (e.navUsername && currentUser) {
            e.navUsername.textContent = currentUser.username;
        }
    }

    function notifyAuthChange() {
        updateNavbar();
        document.dispatchEvent(
            new CustomEvent("auth:changed", { detail: { loggedIn: isLoggedIn(), user: currentUser } })
        );
    }

    async function checkSession() {
        try {
            const res = await fetch("/api/auth/me", { credentials: "same-origin" });
            const data = await res.json();
            if (data.logged_in && data.user) {
                currentUser = data.user;
            } else {
                currentUser = null;
            }
        } catch {
            currentUser = null;
        }
        notifyAuthChange();
        return isLoggedIn();
    }

    async function handleLogin(event) {
        event.preventDefault();
        const e = els();
        const form = event.target;
        const email = form.email?.value?.trim();
        const password = form.password?.value || "";

        if (e.loginError) e.loginError.textContent = "";

        try {
            const res = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                if (e.loginError) e.loginError.textContent = data.error || "Login failed.";
                return;
            }
            currentUser = data.user;
            console.log("User logged in");
            closeAllModals();
            notifyAuthChange();
        } catch {
            if (e.loginError) e.loginError.textContent = "Network error. Please try again.";
        }
    }

    async function handleSignup(event) {
        event.preventDefault();
        const e = els();
        const form = event.target;
        const username = form.username?.value?.trim();
        const email = form.email?.value?.trim();
        const password = form.password?.value || "";

        if (e.signupError) e.signupError.textContent = "";

        try {
            const res = await fetch("/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ username, email, password }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                if (e.signupError) e.signupError.textContent = data.error || "Sign up failed.";
                return;
            }
            currentUser = data.user;
            console.log("User logged in");
            closeAllModals();
            notifyAuthChange();
        } catch {
            if (e.signupError) e.signupError.textContent = "Network error. Please try again.";
        }
    }

    async function logout() {
        try {
            await fetch("/logout", { method: "POST", credentials: "same-origin" });
        } catch {
            /* ignore */
        }
        currentUser = null;
        notifyAuthChange();
    }

    let navEventsBound = false;

    function bindNavEvents() {
        if (navEventsBound) return;
        navEventsBound = true;

        document.getElementById("btn-open-login")?.addEventListener("click", () => {
            closeAllModals();
            openModal(els().loginModal);
        });
        document.getElementById("btn-open-signup")?.addEventListener("click", () => {
            closeAllModals();
            openModal(els().signupModal);
        });
        document.getElementById("btn-logout")?.addEventListener("click", logout);

        document.querySelectorAll("[data-close-modal]").forEach((btn) => {
            btn.addEventListener("click", closeAllModals);
        });

        document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
            backdrop.addEventListener("click", (ev) => {
                if (ev.target === backdrop) closeAllModals();
            });
        });

        document.getElementById("link-to-signup")?.addEventListener("click", (ev) => {
            ev.preventDefault();
            closeAllModals();
            openModal(els().signupModal);
        });
        document.getElementById("link-to-login")?.addEventListener("click", (ev) => {
            ev.preventDefault();
            closeAllModals();
            openModal(els().loginModal);
        });

        els().loginForm?.addEventListener("submit", handleLogin);
        els().signupForm?.addEventListener("submit", handleSignup);
    }

    async function init() {
        bindNavEvents();
        await checkSession();
    }

    return { init, isLoggedIn, getUser, checkSession, logout };
})();
