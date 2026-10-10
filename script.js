
document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const themeButton = document.getElementById("themeToggle");
  const deployButton = document.getElementById("deployToggle");
  const deployMenu = document.getElementById("deployMenu");
  const deployWrap = document.querySelector(".deploy-wrap");
  const loginModal = document.getElementById("loginModal");
  const loginOpen = document.getElementById("loginOpen");
  const loginClose = document.getElementById("loginClose");
  const googleButton = document.getElementById("googleBtn");
  const emailContinue = document.getElementById("emailContinue");
  const loginMessage = document.getElementById("loginMessage");

  function setTheme(theme) {
    root.dataset.theme = theme;
    if (themeButton) {
      themeButton.textContent = theme === "dark" ? "☀" : "☾";
      themeButton.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
    }
    try {
      localStorage.setItem("skyrl-theme", theme);
    } catch (e) {}
  }

  let savedTheme = "dark";
  try {
    savedTheme = localStorage.getItem("skyrl-theme") || "dark";
  } catch (e) {}
  setTheme(savedTheme);

  themeButton?.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });

  function setDeployOpen(open) {
    if (!deployButton || !deployMenu) return;
    deployMenu.hidden = !open;
    deployButton.setAttribute("aria-expanded", String(open));
  }

  deployButton?.addEventListener("click", event => {
    event.stopPropagation();
    setDeployOpen(deployMenu.hidden);
  });

  deployWrap?.addEventListener("mouseenter", () => setDeployOpen(true));
  deployWrap?.addEventListener("mouseleave", () => setDeployOpen(false));

  deployMenu?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => setDeployOpen(false));
  });

  document.addEventListener("click", event => {
    if (deployWrap && !deployWrap.contains(event.target)) {
      setDeployOpen(false);
    }
  });

  function openLogin() {
    if (!loginModal) return;
    loginModal.hidden = false;
    document.body.style.overflow = "hidden";
    loginClose?.focus();
  }

  function closeLogin() {
    if (!loginModal) return;
    loginModal.hidden = true;
    document.body.style.overflow = "";
    loginOpen?.focus();
  }

  loginOpen?.addEventListener("click", openLogin);
  loginClose?.addEventListener("click", closeLogin);

  loginModal?.addEventListener("click", event => {
    if (event.target === loginModal) closeLogin();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setDeployOpen(false);
      if (loginModal && !loginModal.hidden) closeLogin();
    }
  });

  googleButton?.addEventListener("click", () => {
    if (loginMessage) {
      loginMessage.textContent =
        "Google sign-in is not connected yet.";
    }
  });

  emailContinue?.addEventListener("click", () => {
    const email = document.getElementById("loginEmail");
    if (!email?.value.trim()) {
      email?.focus();
      if (loginMessage) loginMessage.textContent = "Enter your email address to continue.";
      return;
    }
    if (loginMessage) {
      loginMessage.textContent =
        "Authentication is not connected yet. No account has been created.";
    }
  });
});
