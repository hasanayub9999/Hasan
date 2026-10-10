```javascript
document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("themeToggle");

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

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme;
      setTheme(current === "light" ? "dark" : "light");
    });
  }
});
```
