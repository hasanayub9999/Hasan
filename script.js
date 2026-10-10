
(() => {
  const root = document.documentElement;
  const themeButtons = document.querySelectorAll("[data-theme-toggle]");
  const menuButton = document.getElementById("mobileMenuButton");
  const navLinks = document.getElementById("navLinks");

  function applyTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";
    root.dataset.theme = nextTheme;

    try {
      localStorage.setItem("skyrl-theme", nextTheme);
    } catch (_) {}

    themeButtons.forEach(button => {
      button.setAttribute(
        "aria-label",
        nextTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
      button.textContent = nextTheme === "dark" ? "☼" : "◐";
    });
  }

  applyTheme(root.dataset.theme || "dark");

  themeButtons.forEach(button => {
    button.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  });

  if (menuButton && navLinks) {
    menuButton.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.textContent = isOpen ? "✕" : "☰";
    });

    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.textContent = "☰";
      });
    });
  }

  const sections = [...document.querySelectorAll("main section[id]")];
  const anchors = [...document.querySelectorAll('.nav-links a[href^="#"]')];

  if ("IntersectionObserver" in window && sections.length && anchors.length) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        anchors.forEach(anchor => {
          anchor.classList.toggle(
            "active",
            anchor.getAttribute("href") === `#${entry.target.id}`
          );
        });
      });
    }, { rootMargin: "-25% 0px -60% 0px" });

    sections.forEach(section => observer.observe(section));
  }
})();
