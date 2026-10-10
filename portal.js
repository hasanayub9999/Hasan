
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const pageNames = {
    mission: "Our Mission",
    humans: "Human",
    objects: "Object"
  };

  const navLinks = document.querySelectorAll(".side-link");
  const pageSections = document.querySelectorAll("[data-page-section]");
  const breadcrumb = document.getElementById("breadcrumb-current");

  function showPage(pageName) {
    if (!pageNames[pageName]) {
      return;
    }

    // Show the selected page and hide the others.
    pageSections.forEach((section) => {
      const isActive = section.dataset.pageSection === pageName;

      section.hidden = !isActive;
      section.classList.toggle("active", isActive);
    });

    // Update the sidebar selection.
    navLinks.forEach((link) => {
      const isActive = link.dataset.page === pageName;

      link.classList.toggle("active", isActive);
      link.setAttribute("aria-current", isActive ? "page" : "false");
    });

    // Update the breadcrumb.
    if (breadcrumb) {
      breadcrumb.textContent = pageNames[pageName];
    }

    // Keep the browser's page position tidy.
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // Sidebar navigation.
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      showPage(link.dataset.page);
    });
  });

  // Mission-page buttons and the SkyRL logo.
  document.querySelectorAll("[data-go], [data-page-link]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();

      const pageName =
        element.dataset.go || element.dataset.pageLink;

      showPage(pageName);
    });
  });

  // Scene toolbar controls.
  document.querySelectorAll(".simulation-scene").forEach((scene) => {
    const toolbar = scene.previousElementSibling;

    if (!toolbar || !toolbar.classList.contains("scene-toolbar")) {
      return;
    }

    const toolButtons = toolbar.querySelectorAll(".tool-button");

    toolButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const view = button.dataset.view;

        if (view === "grid") {
          const isHidden = scene.classList.toggle("grid-hidden");

          button.classList.toggle("active", !isHidden);
          button.setAttribute("aria-pressed", String(!isHidden));
          return;
        }

        if (view === "axes") {
          const isHidden = scene.classList.toggle("axes-hidden");

          button.classList.toggle("active", !isHidden);
          button.setAttribute("aria-pressed", String(!isHidden));
          return;
        }

        if (view === "fullscreen") {
          if (document.fullscreenElement === scene) {
            try {
              await document.exitFullscreen();
            } catch (error) {
              console.warn("Could not exit fullscreen:", error);
            }
          } else if (scene.requestFullscreen) {
            try {
              await scene.requestFullscreen();
            } catch (error) {
              // Fall back to the built-in fullscreen styling.
              scene.classList.toggle("fullscreen");
            }
          } else {
            scene.classList.toggle("fullscreen");
          }

          button.classList.toggle(
            "active",
            document.fullscreenElement === scene ||
              scene.classList.contains("fullscreen")
          );
        }
      });
    });
  });

  // Keep fullscreen button state synchronized.
  document.addEventListener("fullscreenchange", () => {
    document.querySelectorAll(".simulation-scene").forEach((scene) => {
      const toolbar = scene.previousElementSibling;

      if (!toolbar) {
        return;
      }

      const fullscreenButton = toolbar.querySelector(
        '[data-view="fullscreen"]'
      );

      if (fullscreenButton) {
        fullscreenButton.classList.toggle(
          "active",
          document.fullscreenElement === scene
        );
      }
    });
  });

  // Start on Our Mission.
  showPage("mission");
});
