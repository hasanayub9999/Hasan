/* ==========================================================================
   SkyRL Workspace Portal Interactive Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Theme Management with localStorage persistence
    const themeToggle = document.getElementById('themeToggle');
    const htmlElement = document.documentElement;

    const savedTheme = localStorage.getItem('skyrl_theme') || 'dark';
    htmlElement.setAttribute('data-theme', savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('skyrl_theme', newTheme);
        });
    }

    // Tab Navigation Logic
    const sidebarLinks = document.querySelectorAll('.sidebar-link[data-tab]');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const activeViewTitle = document.getElementById('activeViewTitle');
    const activeViewDesc = document.getElementById('activeViewDesc');

    const viewMeta = {
        config: {
            title: "Experiment Configuration",
            desc: "Configure environment parameters, agent hyperparameters, and simulation runs."
        },
        results: {
            title: "Live Telemetry & Results",
            desc: "Inspect evaluation metrics, convergence charts, and comparative performance data."
        },
        history: {
            title: "Experiment History Logs",
            desc: "Review past simulation runs, random seeds, and stored performance checkpoints."
        },
        auth: {
            title: "Authentication Architecture",
            desc: "Review integration guidelines for Clerk user authentication."
        }
    };

    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');
            
            // Update active states on sidebar
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active tab panes
            tabPanes.forEach(pane => pane.classList.remove('active'));
            const targetPane = document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
            if (targetPane) {
                targetPane.classList.add('active');
            }

            // Update header title & description
            if (viewMeta[tabId]) {
                activeViewTitle.innerText = viewMeta[tabId].title;
                activeViewDesc.innerText = viewMeta[tabId].desc;
            }
        });
    });

    // Real-time Range Input Value Bindings
    const episodeCount = document.getElementById('episodeCount');
    const episodeVal = document.getElementById('episodeVal');
    if (episodeCount && episodeVal) {
        episodeCount.addEventListener('input', () => {
            episodeVal.innerText = episodeCount.value;
        });
    }

    const learningRate = document.getElementById('learningRate');
    const lrVal = document.getElementById('lrVal');
    if (learningRate && lrVal) {
        learningRate.addEventListener('input', () => {
            lrVal.innerText = learningRate.value;
        });
    }

    const explorationRate = document.getElementById('explorationRate');
    const expVal = document.getElementById('expVal');
    if (explorationRate && expVal) {
        explorationRate.addEventListener('input', () => {
            expVal.innerText = explorationRate.value;
        });
    }

    // Config Action Buttons
    const resetConfigBtn = document.getElementById('resetConfigBtn');
    const configForm = document.getElementById('configForm');
    if (resetConfigBtn && configForm) {
        resetConfigBtn.addEventListener('click', () => {
            configForm.reset();
            if (episodeVal) episodeVal.innerText = "500";
            if (lrVal) lrVal.innerText = "0.0003";
            if (expVal) expVal.innerText = "0.15";
            alert("Configuration settings reset to default values.");
        });
    }

    const applyConfigBtn = document.getElementById('applyConfigBtn');
    if (applyConfigBtn) {
        applyConfigBtn.addEventListener('click', () => {
            const env = document.getElementById('envSelect').value;
            document.getElementById('simEnvLabel').innerText = env;
            document.getElementById('simStateLabel').innerText = "Parameters Applied / Ready";
            alert(`Configuration saved successfully for environment: ${env}`);
        });
    }

    // Demo Experiment Runner
    const runDemoBtn = document.getElementById('runDemoBtn');
    const quickRunBtn = document.getElementById('quickRunBtn');
    const simStateLabel = document.getElementById('simStateLabel');

    function executeDemoRun() {
        if (simStateLabel) {
            simStateLabel.innerText = "Running Simulation...";
            simStateLabel.className = "status-val text-warning";
        }

        setTimeout(() => {
            // Randomize metrics slightly for realistic demo simulation
            const randomReward = (380 + Math.random() * 60).toFixed(1);
            const randomSuccess = (90 + Math.random() * 8).toFixed(1) + "%";
            const randomLength = (115 + Math.floor(Math.random() * 25)) + " steps";

            document.getElementById('metricReward').innerText = randomReward;
            document.getElementById('metricSuccess').innerText = randomSuccess;
            document.getElementById('metricLength').innerText = randomLength;
            document.getElementById('barPpoVal').innerText = randomSuccess;
            document.getElementById('barPpoFill').style.width = randomSuccess;

            // Update Polyline points for chart animation
            const polyline = document.getElementById('chartPolyline');
            if (polyline) {
                const p1 = 200 - Math.random() * 40;
                const p2 = 140 - Math.random() * 40;
                const p3 = 90 - Math.random() * 30;
                polyline.setAttribute('points', `0,220 100,180 200,${p1} 300,${p2} 400,${p3} 500,45 600,30`);
            }

            if (simStateLabel) {
                simStateLabel.innerText = "Experiment Complete [SUCCESS]";
                simStateLabel.className = "status-val text-success";
            }

            // Append to history table
            const historyTableBody = document.querySelector('#historyTable tbody');
            if (historyTableBody) {
                const runId = 'run_' + Math.random().toString(36).substring(2, 8);
                const env = document.getElementById('envSelect').value;
                const eps = document.getElementById('episodeCount').value;
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td><code>${runId}</code></td>
                    <td>${env}</td>
                    <td>${eps}</td>
                    <td>${randomReward}</td>
                    <td><span class="badge success">${randomSuccess}</span></td>
                    <td>Just now (Demo)</td>
                `;
                historyTableBody.prepend(newRow);
            }

            alert(`Demo experiment completed successfully!\nMean Reward: ${randomReward}\nSuccess Rate: ${randomSuccess}`);
        }, 800);
    }

    if (runDemoBtn) runDemoBtn.addEventListener('click', executeDemoRun);
    if (quickRunBtn) quickRunBtn.addEventListener('click', executeDemoRun);

    // Clear History Logs
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            const historyTableBody = document.querySelector('#historyTable tbody');
            if (historyTableBody) {
                historyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No experimental logs found. Run a demo experiment to generate telemetry.</td></tr>`;
            }
        });
    }
});
