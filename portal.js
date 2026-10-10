(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const TITLES = { mission: "Our Mission", human: "Human", object: "Object" };

  const app = $("app");
  const sidebar = $("sidebar");
  const scrim = $("scrim");
  const menuBtn = $("menuBtn");
  const views = Array.from(document.querySelectorAll("[data-view-id]"));
  const sideLinks = Array.from(document.querySelectorAll(".side-link"));

  /* ---------- Theme (saved in localStorage) ---------- */
  const themeBtn = $("themeToggle");

  function applyTheme(theme) {
    theme = theme === "light" ? "light" : "dark";
    root.dataset.theme = theme;
    try { localStorage.setItem("skyrl-theme", theme); } catch (e) {}
    themeBtn.textContent = theme === "dark" ? "☼" : "☾";
    themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#090d18" : "#f7f9fd");
  }

  themeBtn.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark"));
  applyTheme(root.dataset.theme);

  /* ---------- Pages ---------- */
  function show(name, focus) {
    if (!TITLES[name]) name = "mission";
    views.forEach((v) => { v.hidden = v.dataset.viewId !== name; });
    sideLinks.forEach((l) => {
      const on = l.dataset.view === name;
      l.classList.toggle("active", on);
      if (on) l.setAttribute("aria-current", "page"); else l.removeAttribute("aria-current");
    });
    $("crumb").textContent = TITLES[name];
    document.title = TITLES[name] + " · SkyRL";
    window.scrollTo(0, 0);
    if (focus) $("content").focus({ preventScroll: true });
  }

  function openView(name) {
    setMenu(false);
    setSidebar(false);
    if (window.location.hash === "#" + name) show(name, true);
    else window.location.hash = name; // triggers hashchange -> show()
  }

  window.addEventListener("hashchange", () => show(window.location.hash.slice(1), true));

  // One handler for every element with data-view: sidebar, Deploy menu, buttons.
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-view]");
    if (target) openView(target.dataset.view);
  });

  /* ---------- Deploy dropdown: hover + click ---------- */
  const dropdown = $("deploy");
  const deployBtn = $("deployBtn");
  const menu = $("deployMenu");
  const canHover = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches);
  let closeTimer = null;
  let openedByHover = false;

  function setMenu(open) {
    menu.hidden = !open;
    dropdown.classList.toggle("open", open);
    deployBtn.setAttribute("aria-expanded", String(open));
    if (!open) openedByHover = false;
  }

  deployBtn.addEventListener("click", () => {
    if (!menu.hidden && openedByHover) { openedByHover = false; return; } // keep open after hover-then-click
    setMenu(menu.hidden);
  });

  if (canHover) {
    dropdown.addEventListener("mouseenter", () => {
      clearTimeout(closeTimer);
      if (menu.hidden) { setMenu(true); openedByHover = true; }
    });
    dropdown.addEventListener("mouseleave", () => {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => setMenu(false), 180);
    });
  }

  deployBtn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMenu(true);
      menu.querySelector("button").focus();
    }
  });

  document.addEventListener("click", (e) => { if (!dropdown.contains(e.target)) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!menu.hidden) { setMenu(false); deployBtn.focus(); }
    if (app.classList.contains("nav-open")) { setSidebar(false); menuBtn.focus(); }
  });

  /* ---------- Mobile sidebar ---------- */
  function setSidebar(open) {
    app.classList.toggle("nav-open", open);
    scrim.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }

  menuBtn.addEventListener("click", () => setSidebar(!app.classList.contains("nav-open")));
  scrim.addEventListener("click", () => setSidebar(false));
  window.addEventListener("resize", () => { if (window.innerWidth > 800) setSidebar(false); });

  /* ---------- Start ---------- */
  show(window.location.hash.slice(1), false);
})();
