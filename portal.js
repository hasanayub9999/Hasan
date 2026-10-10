```javascript
document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("themeToggle");
  const deployBtn = document.getElementById("deployBtn");
  const deployMenu = document.getElementById("deployMenu");

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;

    if (themeToggle) {
      const light = theme === "light";
      themeToggle.textContent = light ? "☾" : "☼";
      themeToggle.setAttribute(
        "aria-label",
        light ? "Switch to dark mode" : "Switch to light mode"
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

  themeToggle?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "light" ? "dark" : "light");
  });

  function closeMenu() {
    if (!deployMenu || !deployBtn) return;
    deployMenu.hidden = true;
    deployBtn.setAttribute("aria-expanded", "false");
  }

  deployBtn?.addEventListener("click", () => {
    if (!deployMenu) return;

    const opening = deployMenu.hidden;
    deployMenu.hidden = !opening;
    deployBtn.setAttribute("aria-expanded", String(opening));
  });

  document.addEventListener("click", event => {
    if (
      deployMenu &&
      deployBtn &&
      !event.target.closest(".deploy-dropdown")
    ) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  deployMenu?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });
});
```
