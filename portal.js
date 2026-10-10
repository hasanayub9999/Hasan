
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const STORAGE_KEY = "skyrl-workspace-v2";

  const defaults = {
    objects: {
      name: "",
      preset: "balanced",
      count: 10,
      interaction: "standard",
      complexity: 50,
      logging: true,
      seed: 42,
      frequency: "Every 10 steps",
      observation: "Default",
      outputDetail: "Standard",
      notes: ""
    },
    humans: {
      name: "",
      preset: "balanced",
      count: 10,
      interaction: "standard",
      complexity: 50,
      logging: true,
      seed: 42,
      frequency: "Every 10 steps",
      observation: "Default",
      outputDetail: "Standard",
      notes: ""
    }
  };

  let store = loadStore();
  let currentProject = "objects";

  function loadStore() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      );

      return {
        objects: { ...defaults.objects, ...(saved.objects || {}) },
        humans: { ...defaults.humans, ...(saved.humans || {}) },
        history: Array.isArray(saved.history) ? saved.history : []
      };
    } catch {
      return {
        objects: { ...defaults.objects },
        humans: { ...defaults.humans },
        history: []
      };
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      console.warn("Could not save workspace settings.", error);
    }

    updateCounts();
  }

  function projectData() {
    return store[currentProject];
  }

  function projectLabel(key = currentProject) {
    return key === "objects" ? "Objects" : "Humans";
  }

  function updateCounts() {
    const count = $("#saved-count");
    if (count) count.textContent = store.history.length;

    const projectCount = $("#project-count");
    if (projectCount) projectCount.textContent = "2";
  }

  function showPage(page) {
    $$(".page-section").forEach(section => {
      section.classList.add("hidden");
    });

    const section = $(`#${page}-page`);

    if (section) {
      section.classList.remove("hidden");
    }

    $$(".side-link").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    const names = {
      overview: "Overview",
      projects: "Projects",
      project: "Project workspace",
      experiments: "Experiment setup",
      results: "Results & evaluation",
      history: "Experiment history"
    };

    const crumb = $("#crumb-current");

    if (crumb) {
      crumb.textContent = names[page] || "Overview";
    }

    if (page === "history") {
      renderHistory();
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function openProject(key) {
    currentProject = key === "humans" ? "humans" : "objects";

    $("#project-eyebrow").textContent =
      currentProject === "objects" ? "PROJECT 01" : "PROJECT 02";

    $("#project-title").innerHTML =
      `${projectLabel()}<span class="heading-period">.</span>`;

    $("#project-description").textContent =
      currentProject === "objects"
        ? "Configure object properties and interaction parameters for your environment."
        : "Configure human-agent parameters independently from the Objects project.";

    $("#project-badge").textContent =
      currentProject === "objects"
        ? "OBJECT CONFIG"
        : "HUMAN CONFIG";

    $("#panel-eyebrow").textContent =
      currentProject === "objects"
        ? "OBJECT PARAMETERS"
        : "HUMAN PARAMETERS";

    $("#panel-title").textContent =
      currentProject === "objects"
        ? "Object environment configuration"
        : "Human-agent configuration";

    fillForm();
    switchTab("configuration");
    showPage("project");
  }

  function fillForm() {
    const data = projectData();

    $("#config-name").value = data.name;
    $("#preset").value = data.preset;
    $("#entity-count").value = data.count;
    $("#interaction").value = data.interaction;
    $("#complexity").value = data.complexity;
    $("#complexity-value").textContent = `${data.complexity}%`;
    $("#logging").checked = data.logging;
    $("#seed").value = data.seed;
    $("#frequency").value = data.frequency;
    $("#observation").value = data.observation;
    $("#output-detail").value = data.outputDetail;
    $("#project-notes").value = data.notes;

    $("#save-message").textContent =
      "Changes are stored locally in this browser.";
  }

  function readForm() {
    const data = projectData();

    data.name = $("#config-name").value.trim();
    data.preset = $("#preset").value;

    data.count = Math.max(
      1,
      Math.min(100, Number($("#entity-count").value) || 1)
    );

    data.interaction = $("#interaction").value;
    data.complexity = Number($("#complexity").value);
    data.logging = $("#logging").checked;

    data.seed = Math.max(
      0,
      Number($("#seed").value) || 0
    );

    data.frequency = $("#frequency").value;
    data.observation = $("#observation").value;
    data.outputDetail = $("#output-detail").value;
    data.notes = $("#project-notes").value;

    return data;
  }

  function saveConfiguration(kind = "configuration") {
    const data = readForm();

    const entry = {
      project: currentProject,
      label: projectLabel(),
      name: data.name || `${projectLabel()} configuration`,
      kind,
      when: new Date().toLocaleString(),
      settings: { ...data }
    };

    store.history.unshift(entry);
    store.history = store.history.slice(0, 30);

    persist();

    $("#save-message").textContent =
      "Saved successfully in this browser.";

    renderHistory();
  }

  function switchTab(tab) {
    $$(".tab-button").forEach(button => {
      const active = button.dataset.tab === tab;

      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });

    ["configuration", "advanced", "notes"].forEach(name => {
      const panel = $(`#${name}-panel`);

      if (panel) {
        panel.classList.toggle("hidden", name !== tab);
      }
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function renderHistory() {
    const list = $("#history-list");

    if (!list) return;

    if (!store.history.length) {
      list.innerHTML =
        '<div class="empty-state">No saved configurations yet. Open a project and save its settings.</div>';

      return;
    }

    list.innerHTML = store.history.map(item => `
      <div class="history-item">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <p>
            ${escapeHtml(item.label)} ·
            ${escapeHtml(item.kind)} ·
            ${escapeHtml(item.when)}
          </p>
        </div>
        <span class="history-tag">
          ${item.project === "objects" ? "OBJECTS" : "HUMANS"}
        </span>
      </div>
    `).join("");
  }

  // Sidebar navigation
  $$(".side-link").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });

  // Other navigation buttons
  $$("[data-page]")
    .filter(element => !element.classList.contains("side-link"))
    .forEach(button => {
      button.addEventListener("click", () => {
        showPage(button.dataset.page);
      });
    });

  // Open Objects or Humans
  $$("[data-open-project]").forEach(button => {
    button.addEventListener("click", () => {
      openProject(button.dataset.openProject);
    });
  });

  // Return to project library
  $("#back-to-projects").addEventListener("click", () => {
    showPage("projects");
  });

  // Configuration tabs
  $$(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
    });
  });

  // Complexity slider
  $("#complexity").addEventListener("input", event => {
    $("#complexity-value").textContent =
      `${event.target.value}%`;
  });

  // Save configuration
  $("#save-config").addEventListener("click", () => {
    saveConfiguration("configuration");
  });

  // Save advanced settings
  $("#save-advanced").addEventListener("click", () => {
    saveConfiguration("advanced settings");
  });

  // Save project notes
  $("#save-notes").addEventListener("click", () => {
    saveConfiguration("notes");
  });

  // Refresh experiment history
  $("#refresh-history").addEventListener("click", renderHistory);

  // Light/dark theme toggle
  $("#theme-toggle").addEventListener("click", () => {
    document.body.classList.toggle("light-theme");

    try {
      localStorage.setItem(
        "skyrl-theme",
        document.body.classList.contains("light-theme")
          ? "light"
          : "dark"
      );
    } catch (error) {
      console.warn("Could not save theme preference.", error);
    }
  });

  // Restore saved theme
  try {
    if (localStorage.getItem("skyrl-theme") === "light") {
      document.body.classList.add("light-theme");
    }
  } catch {}

  // Initialize the workspace
  updateCounts();
})();
