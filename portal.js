
(() => {
  const root = document.documentElement;

  const canvas = document.getElementById("simulationCanvas");
  const ctx = canvas?.getContext("2d");

  const scenarioSelect = document.getElementById("scenarioSelect");
  const runButton = document.getElementById("runSimulation");
  const stepButton = document.getElementById("stepSimulation");
  const resetButton = document.getElementById("resetSimulation");

  const simulationStatus = document.getElementById("simulationStatus");
  const scenarioStatus = document.getElementById("scenarioStatus");
  const canvasMessage = document.getElementById("canvasMessage");
  const stepCounter = document.getElementById("stepCounter");

  const metricSteps = document.getElementById("metricSteps");
  const metricDistance = document.getElementById("metricDistance");
  const metricSuccess = document.getElementById("metricSuccess");

  const algorithmSelect = document.getElementById("algorithmSelect");
  const episodeRange = document.getElementById("episodeRange");
  const rewardRange = document.getElementById("rewardRange");
  const difficultySelect = document.getElementById("difficultySelect");
  const episodeValue = document.getElementById("episodeValue");
  const rewardValue = document.getElementById("rewardValue");
  const saveConfig = document.getElementById("saveConfig");
  const configFeedback = document.getElementById("configFeedback");
  const appliedSummary = document.getElementById("appliedSummary");

  const themeToggle = document.getElementById("portalThemeToggle");
  const themeIcon = document.getElementById("portalThemeIcon");
  const portalMenu = document.getElementById("portalMenu");
  const sidebar = document.getElementById("sidebar");
  const exportButton = document.getElementById("exportSession");

  const scenarioNames = {
    basic: "Basic course",
    obstacles: "Obstacle field",
    maze: "Maze course"
  };

  const scenarios = {
    basic: {
      start: { x: 0.10, y: 0.74 },
      goal: { x: 0.90, y: 0.24 },
      path: [
        { x: 0.10, y: 0.74 },
        { x: 0.28, y: 0.60 },
        { x: 0.45, y: 0.65 },
        { x: 0.63, y: 0.43 },
        { x: 0.77, y: 0.39 },
        { x: 0.90, y: 0.24 }
      ],
      obstacles: [
        { x: 0.28, y: 0.30, r: 0.045 },
        { x: 0.48, y: 0.35, r: 0.055 },
        { x: 0.71, y: 0.67, r: 0.050 }
      ]
    },

    obstacles: {
      start: { x: 0.10, y: 0.78 },
      goal: { x: 0.90, y: 0.22 },
      path: [
        { x: 0.10, y: 0.78 },
        { x: 0.20, y: 0.62 },
        { x: 0.32, y: 0.48 },
        { x: 0.43, y: 0.25 },
        { x: 0.57, y: 0.22 },
        { x: 0.69, y: 0.40 },
        { x: 0.81, y: 0.36 },
        { x: 0.90, y: 0.22 }
      ],
      obstacles: [
        { x: 0.24, y: 0.36, r: 0.055 },
        { x: 0.37, y: 0.70, r: 0.065 },
        { x: 0.49, y: 0.47, r: 0.060 },
        { x: 0.62, y: 0.62, r: 0.065 },
        { x: 0.75, y: 0.23, r: 0.045 }
      ]
    },

    maze: {
      start: { x: 0.10, y: 0.82 },
      goal: { x: 0.90, y: 0.18 },
      path: [
        { x: 0.10, y: 0.82 },
        { x: 0.24, y: 0.82 },
        { x: 0.24, y: 0.57 },
        { x: 0.43, y: 0.57 },
        { x: 0.43, y: 0.31 },
        { x: 0.64, y: 0.31 },
        { x: 0.64, y: 0.68 },
        { x: 0.82, y: 0.68 },
        { x: 0.82, y: 0.18 },
        { x: 0.90, y: 0.18 }
      ],
      obstacles: [
        { x: 0.33, y: 0.72, r: 0.050 },
        { x: 0.33, y: 0.39, r: 0.045 },
        { x: 0.53, y: 0.48, r: 0.055 },
        { x: 0.74, y: 0.48, r: 0.050 },
        { x: 0.75, y: 0.84, r: 0.045 }
      ]
    }
  };

  let scenarioKey = "basic";
  let pathIndex = 0;
  let steps = 0;
  let success = false;
  let running = false;
  let runTimer = null;
  let appliedSettings = {
    algorithm: "PPO",
    episodes: 500,
    targetReward: 100,
    difficulty: 2
  };

  function getSavedTheme() {
    try {
      return localStorage.getItem("skyrl-theme");
    } catch {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem("skyrl-theme", theme);
    } catch {
      // Theme switching still works if storage is blocked.
    }
  }

  function setTheme(theme) {
    root.dataset.theme = theme;

    if (themeIcon) {
      themeIcon.textContent = theme === "dark" ? "☀" : "☾";
    }

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
    }

    saveTheme(theme);
    drawSimulation();
  }

  setTheme(getSavedTheme() === "dark" ? "dark" : "light");

  themeToggle?.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });

  portalMenu?.addEventListener("click", () => {
    const open = sidebar?.classList.toggle("is-open") ?? false;

    portalMenu.setAttribute("aria-expanded", String(open));
    portalMenu.textContent = open ? "✕" : "☰";
  });

  document.querySelectorAll(".side-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".side-link").forEach((item) => {
        item.classList.remove("active");
      });

      link.classList.add("active");
      sidebar?.classList.remove("is-open");
      portalMenu?.setAttribute("aria-expanded", "false");

      if (portalMenu) {
        portalMenu.textContent = "☰";
      }
    });
  });

  function getColors() {
    const styles = getComputedStyle(root);

    return {
      text: styles.getPropertyValue("--text").trim() || "#18221d",
      muted: styles.getPropertyValue("--muted").trim() || "#68736c",
      line: styles.getPropertyValue("--line").trim() || "#dfe4dc",
      surface: styles.getPropertyValue("--surface").trim() || "#ffffff",
      accent: styles.getPropertyValue("--accent").trim() || "#52785f",
      target: "#d6a34a",
      obstacle: "#929a93"
    };
  }

  function currentScenario() {
    return scenarios[scenarioKey] || scenarios.basic;
  }

  function currentPosition() {
    const scenario = currentScenario();
    const index = Math.min(pathIndex, scenario.path.length - 1);
    return scenario.path[index];
  }

  function distanceToTarget() {
    const position = currentPosition();
    const goal = currentScenario().goal;
    const dx = goal.x - position.x;
    const dy = goal.y - position.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  function stopRun() {
    running = false;

    if (runTimer !== null) {
      clearInterval(runTimer);
      runTimer = null;
    }

    if (runButton) {
      runButton.textContent = "▶ Run demo";
    }
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(rect.width * pixelRatio);
    canvas.height = Math.round(rect.height * pixelRatio);

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawSimulation();
  }

  function drawSimulation() {
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (!width || !height) return;

    const colors = getColors();
    const scenario = currentScenario();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = getComputedStyle(root).getPropertyValue("--surface-alt").trim();
    ctx.fillRect(0, 0, width, height);

    const margin = 22;
    const plotWidth = width - margin * 2;
    const plotHeight = height - margin * 2;

    function px(point) {
      return {
        x: margin + point.x * plotWidth,
        y: margin + point.y * plotHeight
      };
    }

    // Background grid
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;

    const gridSpacing = 24;

    for (let x = margin; x <= width - margin; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }

    for (let y = margin; y <= height - margin; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }

    // Planned route
    ctx.save();
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();

    scenario.path.forEach((point, index) => {
      const position = px(point);

      if (index === 0) {
        ctx.moveTo(position.x, position.y);
      } else {
        ctx.lineTo(position.x, position.y);
      }
    });

    ctx.stroke();
    ctx.restore();

    // Obstacles
    scenario.obstacles.forEach((obstacle) => {
      const position = px(obstacle);
      const radius = Math.max(5, obstacle.r * Math.min(plotWidth, plotHeight));

      ctx.beginPath();
      ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colors.obstacle;
      ctx.fill();
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Starting point
    const start = px(scenario.start);
    ctx.beginPath();
    ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = colors.muted;
    ctx.fill();

    // Goal marker
    const goal = px(scenario.goal);
    ctx.strokeStyle = colors.target;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(goal.x, goal.y, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(goal.x, goal.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.target;
    ctx.fill();

    // Agent
    const agent = px(currentPosition());

    ctx.save();
    ctx.translate(agent.x, agent.y);

    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();

    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    updateMetrics();
  }

  function updateMetrics() {
    if (metricSteps) metricSteps.textContent = String(steps);

    if (metricDistance) {
      metricDistance.textContent = success
        ? "0.00"
        : distanceToTarget().toFixed(2);
    }

    if (metricSuccess) {
      metricSuccess.textContent = success ? "Yes" : "No";
    }

    if (stepCounter) {
      stepCounter.textContent = `Step ${steps}`;
    }
  }

  function advanceStep() {
    if (success) {
      stopRun();
      return;
    }

    const scenario = currentScenario();

    if (pathIndex < scenario.path.length - 1) {
      pathIndex += 1;
      steps += 1;
    }

    if (pathIndex >= scenario.path.length - 1) {
      success = true;

      if (canvasMessage) {
        canvasMessage.textContent = "Demo route completed";
      }

      if (simulationStatus) {
        simulationStatus.textContent = "Completed";
      }

      stopRun();
    } else {
      if (canvasMessage) {
        canvasMessage.textContent = "Demo agent moving along a predefined route";
      }

      if (simulationStatus) {
        simulationStatus.textContent = "Running";
      }
    }

    drawSimulation();
  }

  function resetSimulation() {
    stopRun();

    pathIndex = 0;
    steps = 0;
    success = false;

    if (simulationStatus) simulationStatus.textContent = "Ready";

    if (canvasMessage) {
      canvasMessage.textContent = "Ready to begin";
    }

    drawSimulation();
  }

  function changeScenario() {
    scenarioKey = scenarioSelect?.value || "basic";

    if (scenarioStatus) {
      scenarioStatus.textContent = scenarioNames[scenarioKey];
    }

    resetSimulation();
  }

  scenarioSelect?.addEventListener("change", changeScenario);

  resetButton?.addEventListener("click", resetSimulation);
  stepButton?.addEventListener("click", advanceStep);

  runButton?.addEventListener("click", () => {
    if (running) {
      stopRun();

      if (simulationStatus) {
        simulationStatus.textContent = success ? "Completed" : "Paused";
      }

      if (canvasMessage && !success) {
        canvasMessage.textContent = "Demo paused";
      }

      return;
    }

    if (success) {
      resetSimulation();
    }

    running = true;
    runButton.textContent = "Ⅱ Pause demo";

    if (simulationStatus) {
      simulationStatus.textContent = "Running";
    }

    if (canvasMessage) {
      canvasMessage.textContent = "Demo agent moving along a predefined route";
    }

    runTimer = setInterval(() => {
      if (!running) return;
      advanceStep();
    }, 550);
  });

  episodeRange?.addEventListener("input", () => {
    if (episodeValue) episodeValue.textContent = episodeRange.value;
  });

  rewardRange?.addEventListener("input", () => {
    if (rewardValue) rewardValue.textContent = rewardRange.value;
  });

  function readConfiguration() {
    return {
      algorithm: algorithmSelect?.value || "PPO",
      episodes: Number(episodeRange?.value || 500),
      targetReward: Number(rewardRange?.value || 100),
      difficulty: Number(difficultySelect?.value || 2)
    };
  }

  saveConfig?.addEventListener("click", () => {
    appliedSettings = readConfiguration();

    if (appliedSummary) {
      appliedSummary.textContent =
        `${appliedSettings.algorithm} · ` +
        `${appliedSettings.episodes} episodes · ` +
        `Level ${appliedSettings.difficulty}`;
    }

    if (configFeedback) {
      configFeedback.textContent =
        "Configuration applied to the demo workspace. " +
        "No model training has been started.";
    }
  });

  exportButton?.addEventListener("click", () => {
    const session = {
      project: "SkyRL",
      exportType: "browser-demo-session",
      exportedAt: new Date().toISOString(),
      scenario: scenarioKey,
      scenarioName: scenarioNames[scenarioKey],
      simulation: {
        status: success ? "completed" : running ? "running" : "stopped",
        steps,
        targetReached: success,
        remainingDistance: Number(distanceToTarget().toFixed(4))
      },
      appliedSettings,
      notes: [
        "This export describes the browser-based 2D demonstration.",
        "It is not a trained reinforcement learning model result.",
        "The route is predefined and does not represent autonomous learning."
      ]
    };

    const blob = new Blob(
      [JSON.stringify(session, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "skyrl-demo-session.json";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  });

  window.addEventListener("resize", resizeCanvas);

  if (typeof ResizeObserver !== "undefined" && canvas) {
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
  }

  changeScenario();
  resizeCanvas();
})();
