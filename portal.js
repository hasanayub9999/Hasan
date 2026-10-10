
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const root = document.documentElement;

  const views = {
    workspace: $("homeView"),
    objects: $("objectsView"),
    humans: $("humansView")
  };

  const projectSettings = {
    objects: {
      name: "objectName",
      environment: "objectEnvironment",
      processing: "objectProcessing",
      label: "objectLabel",
      enabled: "objectEnabled",
      status: "objectSaveStatus"
    },
    humans: {
      name: "humanName",
      environment: "humanEnvironment",
      processing: "humanProcessing",
      label: "humanLabel",
      enabled: "humanEnabled",
      status: "humanSaveStatus"
    }
  };

  function setTheme(theme) {
    const selected = theme === "light" ? "light" : "dark";
    root.dataset.theme = selected;

    try {
      localStorage.setItem("skyrl-theme", selected);
    } catch (_) {}

    $("themeToggle").textContent = selected === "dark" ? "☼" : "◐";
    $("themeToggle").setAttribute(
      "aria-label",
      selected === "dark" ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  setTheme(root.dataset.theme || "dark");

  $("themeToggle").addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });

  function showView(name) {
    if (!views[name]) return;

    Object.entries(views).forEach(([key, view]) => {
      view.hidden = key !== name;
    });

    const titles = {
      workspace: "Workspace",
      objects: "Objects",
      humans: "Humans"
    };

    $("breadcrumbCurrent").textContent = titles[name];

    document.querySelectorAll("[data-section='workspace']").forEach(button => {
      button.classList.toggle("active", name === "workspace");
    });

    document.querySelectorAll(".project-link").forEach(button => {
      button.classList.toggle("active", button.dataset.mode === name);
    });

    document.querySelectorAll(".project-tab[data-mode]").forEach(button => {
      const selected = button.dataset.mode === name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });

    if (name !== "workspace") {
      const enabledInput = $(projectSettings[name].enabled);

      if (enabledInput && !enabledInput.checked) {
        const status = $(projectSettings[name].status);
        status.textContent = "Project disabled — enable it in settings to proceed.";
      }
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  document.querySelectorAll("[data-mode]").forEach(button => {
    button.addEventListener("click", () => {
      showView(button.dataset.mode);
    });
  });

  document.querySelectorAll("[data-section='workspace']").forEach(button => {
    button.addEventListener("click", () => showView("workspace"));
  });

  function storageKey(project) {
    return `skyrl-project-${project}-settings`;
  }

  function readProject(project) {
    const fields = projectSettings[project];

    return {
      name: $(fields.name).value.trim(),
      environment: $(fields.environment).value,
      processing: $(fields.processing).value,
      label: $(fields.label).value.trim(),
      enabled: $(fields.enabled).checked
    };
  }

  function setStatus(project, message, saved = false) {
    const status = $(projectSettings[project].status);
    status.textContent = message;
    status.classList.toggle("saved", saved);
  }

  function saveProject(project) {
    const fields = projectSettings[project];
    const settings = readProject(project);

    if (!settings.name || !settings.label) {
      setStatus(project, "Enter a project name and experiment label.");
      return;
    }

    try {
      localStorage.setItem(storageKey(project), JSON.stringify(settings));
      setStatus(project, "Settings saved in this browser.", true);
    } catch (_) {
      setStatus(project, "Browser storage unavailable. Settings remain in this page.");
    }
  }

  function loadProject(project) {
    const fields = projectSettings[project];

    try {
      const stored = localStorage.getItem(storageKey(project));
      if (!stored) return;

      const settings = JSON.parse(stored);

      if (typeof settings.name === "string") {
        $(fields.name).value = settings.name;
      }

      if (["default", "custom", "test"].includes(settings.environment)) {
        $(fields.environment).value = settings.environment;
      }

      if (["manual", "automatic"].includes(settings.processing)) {
        $(fields.processing).value = settings.processing;
      }

      if (typeof settings.label === "string") {
        $(fields.label).value = settings.label;
      }

      if (typeof settings.enabled === "boolean") {
        $(fields.enabled).checked = settings.enabled;
      }

      setStatus(project, "Saved settings restored.", true);
    } catch (_) {
      setStatus(project, "Using the default project settings.");
    }
  }

  $("saveObjects").addEventListener("click", () => saveProject("objects"));
  $("saveHumans").addEventListener("click", () => saveProject("humans"));

  ["objects", "humans"].forEach(project => {
    loadProject(project);

    const fields = projectSettings[project];

    [
      fields.name,
      fields.environment,
      fields.processing,
      fields.label,
      fields.enabled
    ].forEach(id => {
      $(id).addEventListener("input", () => {
        setStatus(project, "Unsaved changes");
      });

      $(id).addEventListener("change", () => {
        setStatus(project, "Unsaved changes");
      });
    });

    $(fields.enabled).addEventListener("change", () => {
      $("".concat(project === "objects" ? "objectEngineStatus" : "humanEngineStatus"))
        .textContent = "Engine not connected";
    });
  });

  showView("workspace");
})();
