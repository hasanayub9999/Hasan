```javascript
document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("themeToggle");
  const launchBtn = document.getElementById("launchBtn");
  const launchMenu = document.getElementById("launchMenu");
  const dropdown = document.querySelector(".launch-dropdown");

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;

    if (themeToggle) {
      themeToggle.textContent = theme === "light" ? "☾" : "☼";
      themeToggle.setAttribute(
        "aria-label",
        theme === "light" ? "Switch to dark mode" : "Switch to light mode"
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
    setTheme(
      document.documentElement.dataset.theme === "light" ? "dark" : "light"
    );
  });

  function closeMenu() {
    if (!launchMenu || !launchBtn) return;
    launchMenu.hidden = true;
    launchBtn.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    if (!launchMenu || !launchBtn) return;
    launchMenu.hidden = false;
    launchBtn.setAttribute("aria-expanded", "true");
  }

  launchBtn?.addEventListener("click", () => {
    if (!launchMenu) return;

    if (launchMenu.hidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  dropdown?.addEventListener("mouseenter", openMenu);
  dropdown?.addEventListener("mouseleave", closeMenu);

  dropdown?.querySelectorAll(".launch-menu a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", event => {
    if (dropdown && !dropdown.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMenu();
      launchBtn?.focus();
    }
  });
});
```
