
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;

  const pageNames = {
    mission: "Our Mission",
    humans: "Human",
    objects: "Object"
  };

  const navLinks = document.querySelectorAll(".side-link");
  const sections = document.querySelectorAll("[data-page-section]");
  const breadcrumb = document.getElementById("breadcrumb-current");

  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  const themeLabel = document.getElementById("theme-label");

  const deployWrap = document.getElementById("deploy-wrap");
  const deployButton = document.getElementById("deploy-button");
  const deployMenu = document.getElementById("deploy-menu");

  let pointerIsInsideDeploy = false;

  function showPage(page) {
    if (!Object.prototype.hasOwnProperty.call(pageNames, page)) {
      return;
    }

    sections.forEach((section) => {
      const active = section.dataset.pageSection === page;
      section.hidden = !active;
      section.classList.toggle("active", active);
    });

    navLinks.forEach((link) => {
      const active = link.dataset.page === page;

      link.classList.toggle("active", active);

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (breadcrumb) {
      breadcrumb.textContent = pageNames[page];
    }

    closeDeployMenu();

    // Keep navigation tidy without jumping the entire page unexpectedly.
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  // SIDEBAR NAVIGATION

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      showPage(link.dataset.page);
    });
  });

  // LOGO AND PAGE ACTIONS

  document.querySelectorAll("[data-page-link], [data-go]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();

      const page = element.dataset.pageLink || element.dataset.go;

      if (page === "mission") {
        showPage("mission");
      } else {
        showPage(page);
      }
    });
  });

  // THEME TOGGLE

  function applyTheme(theme, save = true) {
    const validTheme = theme === "light" ? "light" : "dark";

    root.dataset.theme = validTheme;

    if (themeIcon) {
      themeIcon.textContent = validTheme === "dark" ? "☼" : "☾";
    }

    if (themeLabel) {
      themeLabel.textContent =
        validTheme === "dark" ? "Light mode" : "Dark mode";
    }

    if (themeToggle) {
      const nextTheme = validTheme === "dark" ? "light" : "dark";

      themeToggle.setAttribute(
        "aria-label",
        `Switch to ${nextTheme} mode`
      );

      themeToggle.setAttribute("aria-pressed", String(validTheme === "light"));
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');

    if (themeColor) {
      themeColor.setAttribute(
        "content",
        validTheme === "dark" ? "#090c14" : "#f5f6fa"
      );
    }

    if (save) {
      try {
        localStorage.setItem("skyrl-theme", validTheme);
      } catch (error) {
        // Theme still works for the current page if storage is unavailable.
      }
    }
  }

  let initialTheme = root.dataset.theme === "light" ? "light" : "dark";

  try {
    const savedTheme = localStorage.getItem("skyrl-theme");

    if (savedTheme === "light" || savedTheme === "dark") {
      initialTheme = savedTheme;
    }
  } catch (error) {
    // Fall back to the theme set in the HTML.
  }

  applyTheme(initialTheme, false);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
    });
  }

  // DEPLOY DROPDOWN

  function openDeployMenu() {
    if (!deployMenu || !deployButton || !deployWrap) {
      return;
    }

    deployMenu.hidden = false;
    deployWrap.classList.add("open");
    deployButton.setAttribute("aria-expanded", "true");
  }

  function closeDeployMenu() {
    if (!deployMenu || !deployButton || !deployWrap) {
      return;
    }

    deployMenu.hidden = true;
    deployWrap.classList.remove("open");
    deployButton.setAttribute("aria-expanded", "false");
  }

  function toggleDeployMenu() {
    if (!deployMenu) {
      return;
    }

    if (deployMenu.hidden) {
      openDeployMenu();
    } else {
      closeDeployMenu();
    }
  }

  if (deployButton) {
    deployButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDeployMenu();
    });
  }

  // Open on hover for pointer devices. Clicking still works on touchscreens.
  if (deployWrap) {
    deployWrap.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") {
        pointerIsInsideDeploy = true;
        openDeployMenu();
      }
    });

    deployWrap.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") {
        pointerIsInsideDeploy = false;

        if (document.activeElement &&
            deployWrap.contains(document.activeElement)) {
          return;
        }

        closeDeployMenu();
      }
    });

    deployWrap.addEventListener("focusout", () => {
      // Let focus move to the next dropdown item before checking.
      requestAnimationFrame(() => {
        if (
          !pointerIsInsideDeploy &&
          !deployWrap.contains(document.activeElement)
        ) {
          closeDeployMenu();
        }
      });
    });
  }

  // Choosing an environment from Deploy navigates to that workspace.
  document.querySelectorAll("[data-deploy-page]").forEach((option) => {
    option.addEventListener("click", () => {
      showPage(option.dataset.deployPage);
    });
  });

  // The hero CTA opens the same Deploy menu.
  document.querySelectorAll("[data-open-deploy]").forEach((button) => {
    button.addEventListener("click", () => {
      openDeployMenu();

      if (deployButton) {
        deployButton.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });

        deployButton.focus({ preventScroll: true });
      }
    });
  });

  // Close the dropdown when clicking outside it.
  document.addEventListener("click", (event) => {
    if (deployWrap && !deployWrap.contains(event.target)) {
      closeDeployMenu();
    }
  });

  // Escape closes the menu and returns focus to Deploy.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && deployMenu && !deployMenu.hidden) {
      closeDeployMenu();

      if (deployButton) {
        deployButton.focus();
      }
    }
  });

  // SCENE CONTROLS

  document.querySelectorAll(".simulation-scene").forEach((scene) => {
    const toolbar = scene.closest(".scene-panel")?.querySelector(".scene-toolbar");

    if (!toolbar) {
      return;
    }

    toolbar.querySelectorAll("[data-scene-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.sceneAction;

        if (action === "grid") {
          const hidden = scene.classList.toggle("grid-hidden");

          button.classList.toggle("active", !hidden);
          button.setAttribute("aria-pressed", String(!hidden));
          return;
        }

        if (action === "axes") {
          const hidden = scene.classList.toggle("axes-hidden");

          button.classList.toggle("active", !hidden);
          button.setAttribute("aria-pressed", String(!hidden));
          return;
        }

        if (action === "fullscreen") {
          try {
            if (document.fullscreenElement === scene) {
              await document.exitFullscreen();
            } else if (document.fullscreenElement) {
              await document.exitFullscreen();
              await scene.requestFullscreen();
            } else if (scene.requestFullscreen) {
              await scene.requestFullscreen();
            } else {
              scene.classList.toggle("fallback-fullscreen");
            }
          } catch (error) {
            // Keep a usable fullscreen alternative if browser fullscreen fails.
            scene.classList.toggle("fallback-fullscreen");
          }

          button.classList.toggle(
            "active",
            document.fullscreenElement === scene ||
              scene.classList.contains("fallback-fullscreen")
          );
        }
      });
    });
  });

  document.addEventListener("fullscreenchange", () => {
    document.querySelectorAll('[data-scene-action="fullscreen"]').forEach((button) => {
      const scene = button.closest(".scene-panel")?.querySelector(".simulation-scene");

      if (scene) {
        button.classList.toggle(
          "active",
          document.fullscreenElement === scene ||
            scene.classList.contains("fallback-fullscreen")
        );
      }
    });
  });

  // Initial page.
  showPage("mission");
});
