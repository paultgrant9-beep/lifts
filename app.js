// Only ids are kept; routines are always re-read from storage
// so the screen never shows stale data.
let currentRoutineId = null;
let editingExerciseId = null;
let currentScreen = 'home-screen';
// True while our own history.back() (from returning Home) hasn't landed yet
let pendingBack = false;

// In-progress workout (mirrors the "activeWorkout" storage key):
// { routineId, startedAt, sets: { exerciseId: [reps or null, ...] }, timerStart }
let workout = null;
let timerInterval = null;

// History screens
let historyExercise = null; // { exerciseId, name }
let historyView = 'table';
let editingLogId = null;

const screens = ['home-screen', 'editor-screen', 'workout-screen', 'summary-screen',
  'history-screen', 'history-detail-screen', 'log-edit-screen'].map(id => document.getElementById(id));
const routinesContainer = document.getElementById('routines-container');
const resumeBanner = document.getElementById('resume-banner');
const resumeText = document.getElementById('resume-text');
const exercisesContainer = document.getElementById('exercises-container');
const routineNameInput = document.getElementById('routine-name-input');
const exerciseFormContainer = document.getElementById('exercise-form-container');
const exerciseFormTitle = document.getElementById('exercise-form-title');
const addExerciseBtn = document.getElementById('add-exercise-btn');
const exNameInput = document.getElementById('ex-name');
const exSetsInput = document.getElementById('ex-sets');
const exRepsInput = document.getElementById('ex-reps');
const exWeightInput = document.getElementById('ex-weight');
const exIncrementInput = document.getElementById('ex-increment');
const workoutTitle = document.getElementById('workout-title');
const workoutExercises = document.getElementById('workout-exercises');
const restTimer = document.getElementById('rest-timer');
const restTime = document.getElementById('rest-time');
const summaryContent = document.getElementById('summary-content');
const historyList = document.getElementById('history-list');
const historyDetailTitle = document.getElementById('history-detail-title');
const historyViewContainer = document.getElementById('history-view');
const viewTableBtn = document.getElementById('view-table-btn');
const viewChartBtn = document.getElementById('view-chart-btn');
const logEditTarget = document.getElementById('log-edit-target');
const logDateInput = document.getElementById('log-date');
const logWeightInput = document.getElementById('log-weight');
const logSetsContainer = document.getElementById('log-sets');
const importFileInput = document.getElementById('import-file');

// Away from Home we keep one extra browser history entry, so the Android
// back gesture runs the screen's own back action instead of closing the app.
function showScreen(screenId) {
  screens.forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  currentScreen = screenId;
  window.scrollTo(0, 0);
  updateTimer();

  const inApp = history.state && history.state.inApp;
  if (screenId !== 'home-screen' && !inApp) {
    history.pushState({ inApp: true }, '');
  } else if (screenId === 'home-screen' && inApp && !pendingBack) {
    pendingBack = true;
    history.back();
  }
}

const backActions = {
  'editor-screen': () => goHome(),
  // Progress is saved, so back just leaves; Home offers Resume
  'workout-screen': () => goHome(),
  'summary-screen': () => goHome(),
  'history-screen': () => goHome(),
  'history-detail-screen': () => showHistory(),
  'log-edit-screen': () => openHistoryDetail()
};

window.addEventListener('popstate', () => {
  if (pendingBack) {
    // Our own back from returning Home. If a screen was opened before it
    // landed, that screen still needs its history entry.
    pendingBack = false;
    if (currentScreen !== 'home-screen') history.pushState({ inApp: true }, '');
    return;
  }
  if (currentScreen === 'home-screen') return;
  backActions[currentScreen]();
  // Back action was cancelled: restore the entry
  if (currentScreen !== 'home-screen' && !(history.state && history.state.inApp)) {
    history.pushState({ inApp: true }, '');
  }
});

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

// Compact date for table rows; year only when it isn't this year
function formatShortDate(iso) {
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

// yyyy-mm-dd in local time, for <input type="date">
function toDateInputValue(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function plannedText(item) {
  return `${item.sets} x ${item.reps} @ ${item.weight} lbs`;
}

// Reps done per set as text, e.g. "5 5 4". Older entries have no setReps.
function repsText(log) {
  if (log.setReps) return log.setReps.join(' ');
  return log.completed ? Array(log.sets).fill(log.reps).join(' ') : '—';
}

function plural(n, word, pluralWord) {
  return `${n} ${n === 1 ? word : (pluralWord || word + 's')}`;
}

// ---------- Home ----------

function renderHome() {
  renderResumeBanner();
  const routines = loadRoutines();
  routinesContainer.innerHTML = '';

  if (routines.length === 0) {
    routinesContainer.innerHTML = '<p>No routines yet.</p>';
    return;
  }

  routines.forEach(routine => {
    const div = document.createElement('div');
    div.className = 'routine-item';
    div.innerHTML = `
      <div class="routine-header">
        <span class="routine-name"></span>
        <span class="exercise-count"></span>
      </div>
      <div class="button-row">
        <button class="secondary edit-btn">Edit</button>
        <button class="start-btn">Start</button>
      </div>
    `;
    // textContent so names containing < or & display correctly
    div.querySelector('.routine-name').textContent = routine.name || 'Untitled';
    div.querySelector('.exercise-count').textContent = plural(routine.exercises.length, 'exercise');

    div.querySelector('.edit-btn').addEventListener('click', () => openEditor(routine.id));
    div.querySelector('.start-btn').addEventListener('click', () => startWorkout(routine.id));

    routinesContainer.appendChild(div);
  });
}

function renderResumeBanner() {
  const active = loadActiveWorkout();
  const routine = active && getRoutine(active.routineId);
  if (active && !routine) clearActiveWorkout();
  resumeBanner.hidden = !routine;
  if (routine) resumeText.textContent = `Workout in progress: ${routine.name}`;
}

function goHome() {
  closeExerciseForm();
  currentRoutineId = null;
  workout = null;
  showScreen('home-screen');
  renderHome();
}

// ---------- Routine editor ----------

function openEditor(routineId) {
  currentRoutineId = routineId;
  const routine = getRoutine(routineId);
  if (!routine) return;
  routineNameInput.value = routine.name;
  showScreen('editor-screen');
  closeExerciseForm();
  renderEditor();
}

function renderEditor() {
  const routine = getRoutine(currentRoutineId);
  if (!routine) return;

  exercisesContainer.innerHTML = '';

  if (routine.exercises.length === 0) {
    exercisesContainer.innerHTML = '<p>No exercises yet.</p>';
  }

  routine.exercises.forEach(ex => {
    const div = document.createElement('div');
    div.className = 'exercise-item';
    div.innerHTML = `
      <div class="exercise-info">
        <strong class="exercise-name"></strong><br>
        <span class="exercise-meta"></span>
      </div>
      <div class="button-row">
        <button class="secondary edit-ex-btn">Edit</button>
        <button class="danger delete-ex-btn">Delete</button>
      </div>
    `;
    div.querySelector('.exercise-name').textContent = ex.name;
    div.querySelector('.exercise-meta').textContent = `${plannedText(ex)} (+${ex.increment})`;

    div.querySelector('.edit-ex-btn').addEventListener('click', () => openExerciseForm(ex));
    div.querySelector('.delete-ex-btn').addEventListener('click', () => {
      if (confirm(`Delete ${ex.name}?`)) {
        deleteExercise(currentRoutineId, ex.id);
        if (editingExerciseId === ex.id) closeExerciseForm();
        renderEditor();
      }
    });

    exercisesContainer.appendChild(div);
  });
}

function openExerciseForm(ex = null) {
  exerciseFormContainer.style.display = 'block';
  addExerciseBtn.style.display = 'none';
  if (ex) {
    editingExerciseId = ex.id;
    exerciseFormTitle.textContent = 'Edit Exercise';
    exNameInput.value = ex.name;
    exSetsInput.value = ex.sets;
    exRepsInput.value = ex.reps;
    exWeightInput.value = ex.weight;
    exIncrementInput.value = ex.increment;
  } else {
    editingExerciseId = null;
    exerciseFormTitle.textContent = 'Add Exercise';
    exNameInput.value = '';
    exSetsInput.value = 3;
    exRepsInput.value = 10;
    exWeightInput.value = 135;
    exIncrementInput.value = 5;
  }
  exerciseFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeExerciseForm() {
  editingExerciseId = null;
  exerciseFormContainer.style.display = 'none';
  addExerciseBtn.style.display = 'block';
}

// ---------- Workout ----------

function startWorkout(routineId) {
  const routine = getRoutine(routineId);
  if (!routine) return;
  if (routine.exercises.length === 0) {
    alert('Add some exercises to this routine first.');
    return;
  }

  const active = loadActiveWorkout();
  const activeRoutine = active && getRoutine(active.routineId);
  if (activeRoutine) {
    if (active.routineId === routineId) {
      resumeWorkout();
      return;
    }
    if (!confirm(`You have a ${activeRoutine.name} workout in progress. Discard it and start ${routine.name}?`)) {
      return;
    }
  }

  workout = { routineId, startedAt: new Date().toISOString(), sets: {}, timerStart: null };
  routine.exercises.forEach(ex => { workout.sets[ex.id] = Array(ex.sets).fill(null); });
  saveActiveWorkout(workout);
  showScreen('workout-screen');
  renderWorkout();
}

function resumeWorkout() {
  workout = loadActiveWorkout();
  if (!workout) return;
  showScreen('workout-screen');
  renderWorkout();
}

// Match saved sets to the routine, in case it was edited mid-workout
function workoutSetsFor(ex) {
  const saved = workout.sets[ex.id] || [];
  const sets = [];
  for (let i = 0; i < ex.sets; i++) {
    const r = saved[i];
    sets.push(r === undefined || r === null ? null : Math.min(r, ex.reps));
  }
  workout.sets[ex.id] = sets;
  return sets;
}

function renderWorkout() {
  const routine = getRoutine(workout.routineId);
  if (!routine) return;

  workoutTitle.textContent = routine.name;
  workoutExercises.innerHTML = '';

  routine.exercises.forEach(ex => {
    const sets = workoutSetsFor(ex);
    const div = document.createElement('div');
    div.className = 'exercise-item';
    div.innerHTML = `
      <div class="exercise-info">
        <strong class="exercise-name"></strong>
        <div class="planned"></div>
        <div class="last-result muted"></div>
      </div>
      <div class="bubbles"></div>
      <div class="exercise-result"></div>
    `;
    div.querySelector('.exercise-name').textContent = ex.name;
    div.querySelector('.planned').textContent = plannedText(ex);

    const last = getLastLog(ex.id);
    div.querySelector('.last-result').textContent = last
      ? `Last: ${formatDate(last.date)} · ${last.weight} lbs · ${last.setReps ? repsText(last) : (last.completed ? 'Completed' : 'Not completed')}`
      : 'No history.';

    const bubbles = div.querySelector('.bubbles');
    sets.forEach((reps, i) => {
      const b = document.createElement('button');
      b.className = 'bubble';
      if (reps === null) {
        b.textContent = ex.reps;
        b.setAttribute('aria-label', `Set ${i + 1}: not done`);
      } else {
        b.textContent = reps;
        b.classList.add(reps >= ex.reps ? 'full' : 'short');
        b.setAttribute('aria-label', `Set ${i + 1}: ${reps} reps`);
      }
      b.addEventListener('click', () => tapBubble(ex, i));
      bubbles.appendChild(b);
    });

    // Once every set is tapped, say what happens next time
    const result = div.querySelector('.exercise-result');
    if (sets.every(r => r !== null)) {
      if (allRepsHit(sets, ex.sets, ex.reps)) {
        const next = Math.round((ex.weight + ex.increment) * 100) / 100;
        result.textContent = ex.increment > 0
          ? `✓ All reps hit. Weight goes up to ${next} lbs next time.`
          : '✓ All reps hit.';
        result.className = 'exercise-result status-done';
      } else {
        result.textContent = `Missed reps. Same weight (${ex.weight} lbs) next time.`;
        result.className = 'exercise-result status-not-done';
      }
    }

    workoutExercises.appendChild(div);
  });

  updateTimer();
}

// Tap cycle: untapped -> full reps -> one fewer each tap -> 0 -> untapped
function tapBubble(ex, i) {
  const sets = workout.sets[ex.id];
  const current = sets[i];
  if (current === null) {
    sets[i] = ex.reps;
    // First tap on a set starts rest, unless that was the exercise's last set
    workout.timerStart = sets.every(r => r !== null) ? null : Date.now();
  } else {
    sets[i] = current === 0 ? null : current - 1;
  }
  saveActiveWorkout(workout);
  renderWorkout();
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// Time is computed from the saved start, so it stays right after the
// phone sleeps or the app is reopened.
function updateTimer() {
  const show = currentScreen === 'workout-screen' && workout && workout.timerStart;
  restTimer.hidden = !show;
  clearInterval(timerInterval);
  timerInterval = null;
  if (show) {
    const tick = () => { restTime.textContent = formatElapsed(Date.now() - workout.timerStart); };
    tick();
    timerInterval = setInterval(tick, 250);
  }
}

function cancelWorkout() {
  if (confirm('Discard this workout? Nothing will be saved.')) {
    clearActiveWorkout();
    goHome();
  }
}

function finishCurrentWorkout() {
  const before = getRoutine(workout.routineId);
  const untapped = before.exercises.reduce(
    (n, ex) => n + workoutSetsFor(ex).filter(r => r === null).length, 0);
  const msg = untapped > 0
    ? `${plural(untapped, 'set')} not tapped will count as 0 reps. Finish anyway?`
    : 'Finish workout and save results?';
  if (!confirm(msg)) return;

  const results = before.exercises.map(ex => ({ exerciseId: ex.id, setReps: workoutSetsFor(ex) }));
  finishWorkout(workout.routineId, results);
  clearActiveWorkout();
  workout = null;
  const after = getRoutine(before.id);

  const wentUp = [];
  const stayed = [];
  before.exercises.forEach(ex => {
    const updated = after.exercises.find(e => e.id === ex.id);
    if (updated && updated.weight > ex.weight) {
      wentUp.push(`${ex.name}: ${ex.weight} → ${updated.weight} lbs`);
    } else {
      stayed.push(`${ex.name}: ${ex.weight} lbs`);
    }
  });
  renderSummary(wentUp, stayed);
  showScreen('summary-screen');
}

function renderSummary(wentUp, stayed) {
  summaryContent.innerHTML = '';
  const addSection = (heading, items) => {
    if (items.length === 0) return;
    const h = document.createElement('h3');
    h.textContent = heading;
    const ul = document.createElement('ul');
    ul.className = 'summary-list';
    items.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    summaryContent.append(h, ul);
  };
  addSection('Going up next time', wentUp);
  addSection('Same weight next time', stayed);
}

// ---------- History ----------

function showHistory() {
  const exercises = getLoggedExercises();
  historyList.innerHTML = '';

  if (exercises.length === 0) {
    historyList.innerHTML = '<p>No workouts logged yet.</p>';
  }

  exercises.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'secondary history-item';
    btn.innerHTML = '<strong class="exercise-name"></strong><span class="muted"></span>';
    btn.querySelector('.exercise-name').textContent = item.name;
    btn.querySelector('.muted').textContent =
      `${plural(item.count, 'entry', 'entries')} · last ${formatDate(item.lastDate)}`;
    btn.addEventListener('click', () => {
      historyExercise = { exerciseId: item.exerciseId, name: item.name };
      openHistoryDetail();
    });
    historyList.appendChild(btn);
  });

  document.getElementById('clear-all-history-btn').hidden = exercises.length === 0;
  showScreen('history-screen');
}

// Shows the current history exercise; falls back to the list if it has no entries left
function openHistoryDetail() {
  const logs = getLogsForExercise(historyExercise.exerciseId);
  if (logs.length === 0) {
    showHistory();
    return;
  }
  historyDetailTitle.textContent = historyExercise.name;
  viewTableBtn.classList.toggle('active', historyView === 'table');
  viewChartBtn.classList.toggle('active', historyView === 'chart');
  viewTableBtn.setAttribute('aria-selected', String(historyView === 'table'));
  viewChartBtn.setAttribute('aria-selected', String(historyView === 'chart'));
  if (historyView === 'table') {
    renderHistoryTable(logs);
  } else {
    renderHistoryChart(logs);
  }
  if (currentScreen !== 'history-detail-screen') showScreen('history-detail-screen');
}

function renderHistoryTable(logs) {
  historyViewContainer.innerHTML = `
    <p class="muted">Tap an entry to edit or delete it.</p>
    <table class="history-table">
      <thead><tr><th>Date</th><th>Weight</th><th>Reps</th><th></th></tr></thead>
      <tbody></tbody>
    </table>
  `;
  const tbody = historyViewContainer.querySelector('tbody');
  logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td></td><td></td><td></td><td></td>';
    const cells = tr.children;
    cells[0].textContent = formatShortDate(log.date);
    cells[1].textContent = log.weight;
    cells[2].textContent = repsText(log);
    cells[3].textContent = log.completed ? '✓' : '✗';
    cells[3].className = log.completed ? 'status-done' : 'status-not-done';
    tr.addEventListener('click', () => openLogEditor(log.id));
    tbody.appendChild(tr);
  });
}

// Round a raw step up to 1, 2, 2.5 or 5 times a power of ten
function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return mult * pow;
}

function renderHistoryChart(logs) {
  // One point per day: the heaviest weight that day
  const days = {};
  logs.forEach(log => {
    const d = new Date(log.date);
    const key = toDateInputValue(log.date);
    const day = days[key];
    if (!day || log.weight > day.weight) {
      days[key] = {
        time: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
        date: log.date, weight: log.weight, completed: log.completed, reps: repsText(log)
      };
    } else if (log.weight === day.weight && log.completed) {
      day.completed = true;
    }
  });
  const points = Object.values(days).sort((a, b) => a.time - b.time);

  const W = 360, H = 240;
  const left = 48, right = 16, top = 16, bottom = 40;
  const plotW = W - left - right, plotH = H - top - bottom;

  // Y axis: nice ticks around the weight range
  let minW = Math.min(...points.map(p => p.weight));
  let maxW = Math.max(...points.map(p => p.weight));
  if (minW === maxW) { minW -= 10; maxW += 10; }
  // Pad so the lowest/highest points don't sit on the chart's edge
  const pad = (maxW - minW) * 0.1;
  minW -= pad;
  maxW += pad;
  const step = niceStep((maxW - minW) / 4);
  const yMin = Math.max(0, Math.floor(minW / step) * step);
  const yMax = Math.ceil(maxW / step) * step;
  const y = w => top + plotH - ((w - yMin) / (yMax - yMin)) * plotH;

  // X axis: real dates, so gaps between workouts show as gaps
  const tMin = points[0].time, tMax = points[points.length - 1].time;
  const inset = 12;
  const x = t => (tMax === tMin
    ? left + plotW / 2
    : left + inset + ((t - tMin) / (tMax - tMin)) * (plotW - 2 * inset));

  let svg = '';
  for (let v = yMin; v <= yMax + step / 2; v += step) {
    const yy = y(v).toFixed(1);
    svg += `<line class="chart-grid" x1="${left}" x2="${W - right}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text class="chart-label" x="${left - 6}" y="${yy}" text-anchor="end" dominant-baseline="middle">${Math.round(v * 100) / 100}</text>`;
  }

  const shortDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const labelY = H - bottom + 20;
  if (tMax === tMin) {
    svg += `<text class="chart-label" x="${x(tMin)}" y="${labelY}" text-anchor="middle">${shortDate(tMin)}</text>`;
  } else {
    svg += `<text class="chart-label" x="${left}" y="${labelY}" text-anchor="start">${shortDate(tMin)}</text>`;
    svg += `<text class="chart-label" x="${W - right}" y="${labelY}" text-anchor="end">${shortDate(tMax)}</text>`;
    if (tMax - tMin >= 4 * 86400000) {
      const tMid = (tMin + tMax) / 2;
      svg += `<text class="chart-label" x="${x(tMid)}" y="${labelY}" text-anchor="middle">${shortDate(tMid)}</text>`;
    }
  }

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(1)},${y(p.weight).toFixed(1)}`).join(' ');
  svg += `<path class="chart-line" d="${path}"/>`;
  points.forEach((p, i) => {
    const cx = x(p.time).toFixed(1), cy = y(p.weight).toFixed(1);
    svg += `<circle class="chart-point ${p.completed ? 'done' : 'missed'}" cx="${cx}" cy="${cy}" r="5.5"/>`;
    // Larger invisible circle so points are easy to tap
    svg += `<circle class="chart-hit" data-i="${i}" cx="${cx}" cy="${cy}" r="16"/>`;
  });

  historyViewContainer.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time">${svg}</svg>
    <p class="chart-legend"><span class="status-done">●</span> All reps hit &nbsp; <span class="status-not-done">○</span> Missed reps</p>
    <p id="chart-caption" class="chart-caption muted">Tap a point for details.</p>
  `;
  const caption = historyViewContainer.querySelector('#chart-caption');
  historyViewContainer.querySelectorAll('.chart-hit').forEach(hit => {
    hit.addEventListener('click', () => {
      const p = points[Number(hit.dataset.i)];
      caption.textContent = `${formatDate(p.date)} · ${p.weight} lbs · reps ${p.reps}`;
    });
  });
}

function openLogEditor(logId) {
  const log = loadLogs().find(l => l.id === logId);
  if (!log) return;
  editingLogId = logId;

  logEditTarget.textContent = `${log.exerciseName} · target ${log.sets} x ${log.reps}`;
  logDateInput.value = toDateInputValue(log.date);
  logWeightInput.value = log.weight;

  // Older entries without setReps: full reps if completed, blank if unknown
  const setReps = log.setReps || Array(log.sets).fill(log.completed ? log.reps : '');
  logSetsContainer.innerHTML = '';
  setReps.forEach((r, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.innerHTML = `<label></label><input type="number" min="0" step="1" inputmode="numeric">`;
    wrap.querySelector('label').textContent = `Set ${i + 1}`;
    wrap.querySelector('input').value = r;
    logSetsContainer.appendChild(wrap);
  });

  showScreen('log-edit-screen');
}

function saveLogEdit() {
  const log = loadLogs().find(l => l.id === editingLogId);
  if (!log) return;

  const weight = parseFloat(logWeightInput.value);
  if (!(weight >= 0)) {
    alert('Weight must be a number (0 or more).');
    return;
  }
  const setReps = [...logSetsContainer.querySelectorAll('input')].map(inp => parseInt(inp.value, 10));
  if (setReps.some(r => !(r >= 0))) {
    alert('Enter reps for every set (0 or more).');
    return;
  }
  if (!logDateInput.value) {
    alert('Please enter a date.');
    return;
  }

  const changes = {
    weight,
    setReps,
    completed: allRepsHit(setReps, log.sets, log.reps)
  };
  // Only touch the date if it changed, so the original time of day is kept
  if (logDateInput.value !== toDateInputValue(log.date)) {
    const [y, m, d] = logDateInput.value.split('-').map(Number);
    changes.date = new Date(y, m - 1, d, 12).toISOString();
  }
  updateLog(editingLogId, changes);
  openHistoryDetail();
}

// ---------- Export / Import ----------

function exportToFile() {
  const json = JSON.stringify(exportData(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lifts-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (e) {
      alert('That file is not valid JSON.');
      return;
    }
    const error = validateImport(data);
    if (error) {
      alert(`Can't import: ${error}`);
      return;
    }
    const msg = `Replace ALL current data with ${plural(data.routines.length, 'routine')} and ` +
      `${plural(data.logs.length, 'log entry', 'log entries')} from this file? This cannot be undone.`;
    if (confirm(msg)) {
      importData(data);
      renderHome();
      alert('Import complete.');
    }
  };
  reader.readAsText(file);
}

// ---------- Event Listeners ----------

document.getElementById('add-routine-btn').addEventListener('click', () => {
  const name = prompt('Enter routine name:');
  if (name && name.trim()) {
    const newRoutine = addRoutine(name.trim());
    openEditor(newRoutine.id);
  }
});

document.getElementById('back-btn').addEventListener('click', goHome);

document.getElementById('delete-routine-btn').addEventListener('click', () => {
  if (confirm('Are you sure you want to delete this entire routine?')) {
    deleteRoutine(currentRoutineId);
    goHome();
  }
});

addExerciseBtn.addEventListener('click', () => {
  openExerciseForm();
});

document.getElementById('cancel-exercise-btn').addEventListener('click', closeExerciseForm);

document.getElementById('save-exercise-btn').addEventListener('click', () => {
  const exerciseData = {
    name: exNameInput.value.trim(),
    sets: parseInt(exSetsInput.value, 10),
    reps: parseInt(exRepsInput.value, 10),
    // Weights can be fractional (e.g. 2.5 lb plates)
    weight: parseFloat(exWeightInput.value),
    increment: parseFloat(exIncrementInput.value)
  };

  if (!exerciseData.name) {
    alert('Please enter an exercise name.');
    return;
  }
  if (!(exerciseData.sets > 0) || !(exerciseData.reps > 0)) {
    alert('Sets and reps must be at least 1.');
    return;
  }
  if (!(exerciseData.weight >= 0) || !(exerciseData.increment >= 0)) {
    alert('Weight and increment must be numbers (0 or more).');
    return;
  }

  if (editingExerciseId) {
    updateExercise(currentRoutineId, editingExerciseId, exerciseData);
  } else {
    addExercise(currentRoutineId, exerciseData);
  }

  closeExerciseForm();
  renderEditor();
});

// Save routine name as it's typed
routineNameInput.addEventListener('input', () => {
  if (currentRoutineId) {
    updateRoutine(currentRoutineId, { name: routineNameInput.value });
  }
});

document.getElementById('resume-btn').addEventListener('click', resumeWorkout);
document.getElementById('discard-active-btn').addEventListener('click', () => {
  if (confirm('Discard the workout in progress? Nothing will be saved.')) {
    clearActiveWorkout();
    renderHome();
  }
});

document.getElementById('finish-workout-btn').addEventListener('click', finishCurrentWorkout);
document.getElementById('cancel-workout-btn').addEventListener('click', cancelWorkout);
document.getElementById('summary-done-btn').addEventListener('click', goHome);

document.getElementById('history-btn').addEventListener('click', showHistory);
document.getElementById('history-back-btn').addEventListener('click', goHome);
document.getElementById('clear-all-history-btn').addEventListener('click', () => {
  if (confirm('Delete ALL workout history? This cannot be undone. (Export first if you want a backup.)')) {
    clearLogs();
    showHistory();
  }
});

document.getElementById('history-detail-back-btn').addEventListener('click', showHistory);
viewTableBtn.addEventListener('click', () => { historyView = 'table'; openHistoryDetail(); });
viewChartBtn.addEventListener('click', () => { historyView = 'chart'; openHistoryDetail(); });
document.getElementById('clear-exercise-history-btn').addEventListener('click', () => {
  const count = getLogsForExercise(historyExercise.exerciseId).length;
  if (confirm(`Delete all ${plural(count, 'entry', 'entries')} for ${historyExercise.name}? This cannot be undone.`)) {
    deleteLogsForExercise(historyExercise.exerciseId);
    showHistory();
  }
});

document.getElementById('log-save-btn').addEventListener('click', saveLogEdit);
document.getElementById('log-cancel-btn').addEventListener('click', openHistoryDetail);
document.getElementById('log-delete-btn').addEventListener('click', () => {
  if (confirm('Delete this entry? This cannot be undone.')) {
    deleteLog(editingLogId);
    openHistoryDetail();
  }
});

document.getElementById('export-btn').addEventListener('click', exportToFile);
document.getElementById('import-btn').addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', () => {
  const file = importFileInput.files[0];
  // Clear so picking the same file again still fires 'change'
  importFileInput.value = '';
  if (file) importFromFile(file);
});

// Offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}

// Initial render
renderHome();
