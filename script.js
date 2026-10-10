
(() => {
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const currentYear = document.getElementById("currentYear");

  function getSavedTheme() {
    try {
      return localStorage.getItem("skyrl-theme");
    } catch {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem("skyrl-theme", theme);
    } catch {
      // The page still works if browser storage is unavailable.
    }
  }

  function setTheme(theme) {
    root.dataset.theme = theme;

    if (themeIcon) {
      themeIcon.textContent = theme === "dark" ? "☀" : "☾";
    }

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
      themeToggle.title = theme === "dark" ? "Light mode" : "Dark mode";
    }

    saveTheme(theme);
  }

  const savedTheme = getSavedTheme();
  const initialTheme = savedTheme === "dark" ? "dark" : "light";
  setTheme(initialTheme);

  themeToggle?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });

  menuToggle?.addEventListener("click", () => {
    const isOpen = mainNav?.classList.toggle("is-open") ?? false;
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation"
    );
    menuToggle.textContent = isOpen ? "✕" : "☰";
  });

  mainNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      menuToggle?.setAttribute("aria-expanded", "false");

      if (menuToggle) {
        menuToggle.textContent = "☰";
        menuToggle.setAttribute("aria-label", "Open navigation");
      }
    });
  });

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }
})();
