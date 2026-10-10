
(() => {
  const $ = id => document.getElementById(id);
  const root = document.documentElement;

  const defaults = {
    environment: "grid",
    episodes: 100,
    seed: 42,
    steps: 10000,
    learningRate: "0.0003",
    exploration: 50,
    evalRuns: "10"
  };

  const environmentNames = {
    grid: "Grid navigation",
    waypoint: "Waypoint navigation",
    obstacle: "Obstacle avoidance"
  };

  const environmentDescriptions = {
    grid: "An abstract grid-navigation task used for demonstration.",
    waypoint: "An illustrative task involving a sequence of navigation targets.",
    obstacle: "An abstract obstacle-avoidance task; no physical simulation is running."
  };

  let runCount = 0;
  let history = [];
  let latestRun = null;

  function applyTheme(theme) {
    root.dataset.theme = theme === "light" ? "light" : "dark";

    try {
      localStorage.setItem("skyrl-theme", root.dataset.theme);
    } catch (_) {}

    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      button.textContent = root.dataset.theme === "dark" ? "☼" : "◐";
      button.setAttribute(
        "aria-label",
        root.dataset.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    });

    if (latestRun) drawChart(latestRun.chart);
  }

  document.querySelectorAll("[data-theme-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  });

  applyTheme(root.dataset.theme || "dark");

  const environment = $("environment");
  const episodes = $("episodes");
  const seed = $("seed");
  const steps = $("steps");
  const learningRate = $("learningRate");
  const exploration = $("exploration");
  const evalRuns = $("evalRuns");

  function updateLabels() {
    $("episodesOutput").textContent = Number(episodes.value).toLocaleString();
    $("stepsOutput").textContent = Number(steps.value).toLocaleString();
    $("explorationOutput").textContent = `${exploration.value}%`;
    $("environmentHelp").textContent = environmentDescriptions[environment.value];
  }

  [episodes, steps, exploration, environment].forEach(control => {
    control.addEventListener("input", updateLabels);
    control.addEventListener("change", updateLabels);
  });

  function readSettings() {
    return {
      environment: environment.value,
      episodes: Number(episodes.value),
      seed: Math.max(0, Math.min(999999, Math.floor(Number(seed.value) || 0))),
      steps: Number(steps.value),
      learningRate: learningRate.value,
      exploration: Number(exploration.value),
      evalRuns: Number(evalRuns.value)
    };
  }

  function resetSettings() {
    environment.value = defaults.environment;
    episodes.value = defaults.episodes;
    seed.value = defaults.seed;
    steps.value = defaults.steps;
    learningRate.value = defaults.learningRate;
    exploration.value = defaults.exploration;
    evalRuns.value = defaults.evalRuns;
    updateLabels();
  }

  $("resetButton").addEventListener("click", resetSettings);

  // A seeded pseudo-random generator keeps demo output reproducible.
  // This generates illustrative data only; it does not train a model.
  function seededRandom(initialSeed) {
    let state = initialSeed >>> 0;

    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createDemoResult(settings) {
    const environmentOffset = {
      grid: 0,
      waypoint: -4,
      obstacle: -8
    }[settings.environment];

    const learningRateOffset = {
      "0.0001": 2,
      "0.0003": 5,
      "0.001": 1,
      "0.003": -5
    }[settings.learningRate];

    const random = seededRandom(
      settings.seed +
      settings.episodes * 13 +
      settings.steps * 7 +
      settings.exploration * 19 +
      Math.round(Number(settings.learningRate) * 10000000)
    );

    const progressFactor = Math.min(1, settings.steps / 25000);
    const explorationFactor = 1 - Math.abs(settings.exploration - 45) / 120;

    const base = 40 +
      environmentOffset +
      learningRateOffset +
      progressFactor * 20 +
      explorationFactor * 12;

    const chart = [];
    const points = 25;

    for (let i = 0; i < points; i++) {
      const progress = i / (points - 1);
      const noise = (random() - 0.5) * 12;
      const value = 8 + (base - 8) * progress + noise;
      chart.push(Math.max(0, Math.round(value * 10) / 10));
    }

    const averageReward = Math.round(
      chart.reduce((total, value) => total + value, 0) / chart.length * 10
    ) / 10;

    const successRate = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (25 + progressFactor * 35 + explorationFactor * 22 +
          environmentOffset / 2 + learningRateOffset + (random() - 0.5) * 10) * 10
        ) / 10
      )
    );

    const averageLength = Math.round(
      Math.max(5, 100 - progressFactor * 40 + random() * 15)
    );

    return {
      settings,
      chart,
      averageReward,
      successRate,
      averageLength,
      evalRuns: settings.evalRuns,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    };
  }

  function svgElement(tag, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);

    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });

    return element;
  }

  function drawChart(values) {
    const svg = $("rewardChart");
    if (!svg) return;

    svg.replaceChildren();

    const width = 600;
    const height = 240;
    const left = 42;
    const right = 15;
    const top = 18;
    const bottom = 25;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const isLight = root.dataset.theme === "light";
    const gridColor = isLight ? "#dfe6f1" : "#263249";
    const labelColor = isLight ? "#74819a" : "#8190aa";
    const lineColor = isLight ? "#285dd0" : "#79a7ff";
    const fillColor = isLight ? "#dce8ff" : "#263e69";

    const data = values && values.length
      ? values
      : [5, 9, 7, 12, 10, 14, 13, 18, 17, 22, 20, 25];

    const maxValue = Math.max(20, Math.ceil(Math.max(...data) / 10) * 10);

    for (let i = 0; i <= 4; i++) {
      const y = top + chartHeight * i / 4;
      const value = maxValue * (1 - i / 4);

      svg.appendChild(svgElement("line", {
        x1: left, y1: y, x2: width - right, y2: y,
        stroke: gridColor, "stroke-width": 1
      }));

      const label = svgElement("text", {
        x: left - 9,
        y: y + 4,
        fill: labelColor,
        "font-size": 10,
        "text-anchor": "end"
      });
      label.textContent = Math.round(value);
      svg.appendChild(label);
    }

    const coords = data.map((value, index) => ({
      x: left + (data.length === 1 ? 0 : index / (data.length - 1)) * chartWidth,
      y: top + (1 - value / maxValue) * chartHeight
    }));

    const linePath = coords.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    ).join(" ");

    const areaPath =
      `M ${coords[0].x} ${top + chartHeight} ` +
      coords.map(point => `L ${point.x} ${point.y}`).join(" ") +
      ` L ${coords[coords.length - 1].x} ${top + chartHeight} Z`;

    svg.appendChild(svgElement("path", {
      d: areaPath,
      fill: fillColor,
      opacity: 0.7
    }));

    svg.appendChild(svgElement("path", {
      d: linePath,
      fill: "none",
      stroke: lineColor,
      "stroke-width": 2.5,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    }));

    coords.forEach(point => {
      svg.appendChild(svgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: 2.2,
        fill: lineColor
      }));
    });

    const first = svgElement("text", {
      x: left, y: height - 4, fill: labelColor, "font-size": 10
    });
    first.textContent = "1";
    svg.appendChild(first);

    const last = svgElement("text", {
      x: width - right, y: height - 4,
      fill: labelColor, "font-size": 10, "text-anchor": "end"
    });
    last.textContent = String(data.length);
    svg.appendChild(last);
  }

  function updateMetrics(result) {
    $("metricRuns").textContent = String(runCount);
    $("metricSuccess").innerHTML =
      `${result.successRate}<span class="metric-unit">%</span>`;
    $("metricReward").textContent = result.averageReward.toFixed(1);

    $("resultSuccess").textContent = `${result.successRate}%`;
    $("resultReward").textContent = result.averageReward.toFixed(1);
    $("resultLength").textContent = String(result.averageLength);
    $("resultSamples").textContent = String(result.evalRuns);

    $("resultsLabel").textContent = `Latest demo · ${result.timestamp}`;
    drawChart(result.chart);
  }

  function renderHistory() {
    const body = $("historyBody");
    body.replaceChildren();

    if (!history.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.className = "empty-state";
      cell.textContent = "No runs yet. Run a demo experiment to populate this table.";
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    history.forEach(result => {
      const row = document.createElement("tr");
      const cells = [
        `Demo #${result.id}`,
        environmentNames[result.settings.environment],
        result.settings.episodes.toLocaleString(),
        result.averageReward.toFixed(1),
        `${result.successRate}%`
      ];

      cells.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      const modeCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = "history-mode";
      badge.textContent = "Illustrative";
      modeCell.appendChild(badge);
      row.appendChild(modeCell);

      body.appendChild(row);
    });
  }

  // Add a comparison control without requiring another HTML component.
  const historyHeading = $("clearHistoryButton").parentElement;
  const compareButton = document.createElement("button");
  compareButton.type = "button";
  compareButton.className = "button button-secondary button-small";
  compareButton.textContent = "Compare latest runs";
  compareButton.id = "compareButton";
  historyHeading.insertBefore(compareButton, $("clearHistoryButton"));

  const comparison = document.createElement("div");
  comparison.className = "history-compare";
  comparison.hidden = true;
  comparison.setAttribute("aria-live", "polite");
  $("history").insertBefore(comparison, document.querySelector(".history-card"));

  compareButton.addEventListener("click", () => {
    if (history.length < 2) {
      comparison.hidden = false;
      comparison.textContent = "Run at least two demo experiments to compare their illustrative outputs.";
      return;
    }

    const newest = history[0];
    const previous = history[1];
    const rewardDifference = newest.averageReward - previous.averageReward;
    const successDifference = newest.successRate - previous.successRate;

    comparison.hidden = false;
    comparison.replaceChildren();

    const heading = document.createElement("strong");
    heading.textContent = `Demo #${newest.id} compared with Demo #${previous.id}`;
    comparison.appendChild(heading);

    const details = document.createElement("p");
    details.style.margin = "7px 0 0";
    details.textContent =
      `Illustrative reward difference: ${rewardDifference >= 0 ? "+" : ""}${rewardDifference.toFixed(1)}. ` +
      `Illustrative success-rate difference: ${successDifference >= 0 ? "+" : ""}${successDifference.toFixed(1)} percentage points. ` +
      "Different settings and random seeds can affect these demo values; this is not evidence of real model improvement.";
    comparison.appendChild(details);
  });

  function runDemo() {
    const settings = readSettings();
    runCount++;

    const result = createDemoResult(settings);
    result.id = runCount;

    latestRun = result;
    history.unshift(result);

    updateMetrics(result);
    renderHistory();

    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("runButton").addEventListener("click", runDemo);
  $("runTopButton").addEventListener("click", runDemo);

  $("clearHistoryButton").addEventListener("click", () => {
    history = [];
    runCount = 0;
    latestRun = null;

    $("metricRuns").textContent = "0";
    $("metricSuccess").textContent = "—";
    $("metricReward").textContent = "—";
    $("resultSuccess").textContent = "—";
    $("resultReward").textContent = "—";
    $("resultLength").textContent = "—";
    $("resultSamples").textContent = "—";
    $("resultsLabel").textContent = "Waiting for first demo run";

    comparison.hidden = true;
    renderHistory();
    drawChart([]);
  });

  // Sidebar navigation highlights the section currently being viewed.
  const sections = [...document.querySelectorAll(
    "#overview, #configuration, #results, #history"
  )];
  const links = [...document.querySelectorAll(".sidebar-link")];

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        links.forEach(link => {
          link.classList.toggle(
            "active",
            link.getAttribute("href") === `#${entry.target.id}`
          );
        });
      });
    }, { rootMargin: "-15% 0px -70% 0px" });

    sections.forEach(section => observer.observe(section));
  }

  updateLabels();
  renderHistory();
  drawChart([]);
})();
