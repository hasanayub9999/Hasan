```javascript
document.addEventListener("DOMContentLoaded", () => {
  const views = [...document.querySelectorAll("[data-view-id]")];
  const navLinks = [...document.querySelectorAll(".top-link")];
  const viewButtons = [...document.querySelectorAll("[data-view]")];
  const themeToggle = document.getElementById("themeToggle");

  function showView(name) {
    const target = views.find(view => view.dataset.viewId === name);

    if (!target) return;

    views.forEach(view => {
      view.hidden = view !== target;
    });

    navLinks.forEach(link => {
      const active = link.dataset.view === name;
      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    document.title =
      (name === "mission"
        ? "Our Mission"
        : name.charAt(0).toUpperCase() + name.slice(1)) +
      " · SkyRL";

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  viewButtons.forEach(button => {
    button.addEventListener("click", () => {
      showView(button.dataset.view);
    });
  });

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;

    if (themeToggle) {
      const isLight = theme === "light";
      themeToggle.textContent = isLight ? "☾" : "☼";
      themeToggle.setAttribute(
        "aria-label",
        isLight ? "Switch to dark mode" : "Switch to light mode"
      );
    }

    try {
      localStorage.setItem("skyrl-theme", theme);
    } catch (e) {}
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme;
      setTheme(current === "light" ? "dark" : "light");
    });
  }

  setTheme(
    document.documentElement.dataset.theme === "light" ? "light" : "dark"
  );

  showView("mission");
});
```
