(() => {
  const DURATIONS = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const RING_CIRCUMFERENCE = 2 * Math.PI * 108;

  const state = {
    mode: "work",
    secondsLeft: DURATIONS.work,
    running: false,
    intervalId: null,
    sessionCount: 1,
    tasks: loadTasks(),
    activeTaskId: null,
  };

  const timeDisplay = document.getElementById("timeDisplay");
  const sessionLabel = document.getElementById("sessionLabel");
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const skipBtn = document.getElementById("skipBtn");
  const ringProgress = document.querySelector(".ring-progress");
  const modeTabs = document.querySelectorAll(".mode-tab");
  const taskForm = document.getElementById("taskForm");
  const taskInput = document.getElementById("taskInput");
  const taskList = document.getElementById("taskList");
  const tasksCount = document.getElementById("tasksCount");

  ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;

  function loadTasks() {
    try {
      const raw = localStorage.getItem("focusflow_tasks");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem("focusflow_tasks", JSON.stringify(state.tasks));
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function updateRing() {
    const total = DURATIONS[state.mode];
    const fraction = state.secondsLeft / total;
    ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - fraction);
  }

  function render() {
    timeDisplay.textContent = formatTime(state.secondsLeft);
    updateRing();

    const labels = { work: `Session ${state.sessionCount}`, short: "Short Break", long: "Long Break" };
    sessionLabel.textContent = labels[state.mode];

    startBtn.textContent = state.running ? "Pause" : "Start";

    document.title = `${formatTime(state.secondsLeft)} — Focus Flow`;
  }

  function setMode(mode, resetTime = true) {
    state.mode = mode;
    if (resetTime) state.secondsLeft = DURATIONS[mode];
    modeTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
    render();
    updateWaterfallPace();
  }

  function tick() {
    if (state.secondsLeft <= 0) {
      handleSessionComplete();
      return;
    }
    state.secondsLeft -= 1;
    render();
  }

  function handleSessionComplete() {
    pause();
    playChime();

    if (state.mode === "work") {
      if (state.activeTaskId) {
        const t = state.tasks.find((x) => x.id === state.activeTaskId);
        if (t) { t.pomos = (t.pomos || 0) + 1; saveTasks(); renderTasks(); }
      }
      const nextMode = state.sessionCount % 4 === 0 ? "long" : "short";
      setMode(nextMode);
    } else {
      if (state.mode === "long") state.sessionCount = 1;
      else state.sessionCount += 1;
      setMode("work");
    }
    render();
  }

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      /* audio unsupported, ignore */
    }
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.intervalId = setInterval(tick, 1000);
    render();
    updateWaterfallPace();
  }

  function pause() {
    state.running = false;
    clearInterval(state.intervalId);
    state.intervalId = null;
    render();
    updateWaterfallPace();
  }

  function toggleStartPause() {
    state.running ? pause() : start();
  }

  function reset() {
    pause();
    state.secondsLeft = DURATIONS[state.mode];
    render();
  }

  function skip() {
    pause();
    handleSessionComplete();
  }

  startBtn.addEventListener("click", toggleStartPause);
  resetBtn.addEventListener("click", reset);
  skipBtn.addEventListener("click", skip);

  modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      pause();
      setMode(tab.dataset.mode);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (document.activeElement === taskInput) return;
    if (e.code === "Space") { e.preventDefault(); toggleStartPause(); }
    else if (e.key.toLowerCase() === "r") reset();
    else if (e.key.toLowerCase() === "s") skip();
  });

  // --- Tasks ---

  function renderTasks() {
    taskList.innerHTML = "";
    const done = state.tasks.filter((t) => t.done).length;
    tasksCount.textContent = `${done}/${state.tasks.length}`;

    if (state.tasks.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No tasks yet — add one to focus on.";
      taskList.appendChild(empty);
      return;
    }

    state.tasks.forEach((task) => {
      const li = document.createElement("li");
      li.className = "task-item" + (task.done ? " done" : "") + (task.id === state.activeTaskId ? " active" : "");

      const checkbox = document.createElement("button");
      checkbox.className = "task-checkbox" + (task.done ? " checked" : "");
      checkbox.textContent = "✓";
      checkbox.addEventListener("click", () => {
        task.done = !task.done;
        saveTasks();
        renderTasks();
      });

      const text = document.createElement("span");
      text.className = "task-text";
      text.textContent = task.text;
      text.title = "Click to set as active task";
      text.addEventListener("click", () => {
        state.activeTaskId = state.activeTaskId === task.id ? null : task.id;
        renderTasks();
      });

      const pomos = document.createElement("span");
      pomos.className = "task-pomos";
      pomos.textContent = task.pomos ? "🍅".repeat(Math.min(task.pomos, 5)) : "";

      const del = document.createElement("button");
      del.className = "task-delete";
      del.textContent = "×";
      del.addEventListener("click", () => {
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        if (state.activeTaskId === task.id) state.activeTaskId = null;
        saveTasks();
        renderTasks();
      });

      li.append(checkbox, text, pomos, del);
      taskList.appendChild(li);
    });
  }

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;
    state.tasks.push({ id: Date.now().toString(36), text, done: false, pomos: 0 });
    taskInput.value = "";
    saveTasks();
    renderTasks();
  });

  // --- Waterfall background ---

  function initWaterfall() {
    const container = document.getElementById("waterfall");
    if (!container) return;
    const STREAK_COUNT = 26;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const streak = document.createElement("div");
      streak.className = "waterfall-streak";
      streak.style.setProperty("--x", `${Math.random() * 100}%`);
      streak.style.setProperty("--w", `${1 + Math.random() * 2}px`);
      streak.style.setProperty("--o", `${0.25 + Math.random() * 0.4}`);
      streak.style.setProperty("--dur", `${1.6 + Math.random() * 1.8}s`);
      streak.style.setProperty("--delay", `${Math.random() * -3}s`);
      container.appendChild(streak);
    }
  }

  function updateWaterfallPace() {
    const container = document.getElementById("waterfall");
    if (!container) return;
    container.classList.toggle("waterfall-active", state.running && state.mode === "work");
    container.classList.toggle("waterfall-calm", state.running && state.mode !== "work");
  }

  initWaterfall();
  updateWaterfallPace();

  render();
  renderTasks();
})();
