// Only ids are kept; routines are always re-read from storage
// so the screen never shows stale data.
let currentRoutineId = null;
let editingExerciseId = null;
let currentScreen = 'home-screen';
// True while our own history.back() (from returning Home) hasn't landed yet
let pendingBack = false;

// In-progress workout: exerciseId -> true (completed) / false
let workoutRoutineId = null;
let workoutResults = {};

const screens = ['home-screen', 'editor-screen', 'workout-screen', 'summary-screen',
  'history-screen', 'history-detail-screen'].map(id => document.getElementById(id));
const routinesContainer = document.getElementById('routines-container');
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
const summaryContent = document.getElementById('summary-content');
const historyList = document.getElementById('history-list');
const historyDetailTitle = document.getElementById('history-detail-title');
const historyEntries = document.getElementById('history-entries');
const importFileInput = document.getElementById('import-file');

// Away from Home we keep one extra browser history entry, so the Android
// back gesture runs the screen's own back action instead of closing the app.
function showScreen(screenId) {
  screens.forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  currentScreen = screenId;
  window.scrollTo(0, 0);

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
  'workout-screen': () => cancelWorkout(),
  'summary-screen': () => goHome(),
  'history-screen': () => goHome(),
  'history-detail-screen': () => showHistory()
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
  // Back action was cancelled (e.g. kept the workout): restore the entry
  if (currentScreen !== 'home-screen' && !(history.state && history.state.inApp)) {
    history.pushState({ inApp: true }, '');
  }
});

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

function plannedText(item) {
  return `${item.sets} x ${item.reps} @ ${item.weight} lbs`;
}

// ---------- Home ----------

function renderHome() {
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
    const count = routine.exercises.length;
    div.querySelector('.exercise-count').textContent = `${count} exercise${count === 1 ? '' : 's'}`;

    div.querySelector('.edit-btn').addEventListener('click', () => openEditor(routine.id));
    div.querySelector('.start-btn').addEventListener('click', () => startWorkout(routine.id));

    routinesContainer.appendChild(div);
  });
}

function goHome() {
  closeExerciseForm();
  currentRoutineId = null;
  workoutRoutineId = null;
  workoutResults = {};
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
  workoutRoutineId = routineId;
  workoutResults = {};
  routine.exercises.forEach(ex => { workoutResults[ex.id] = false; });
  showScreen('workout-screen');
  renderWorkout();
}

function renderWorkout() {
  const routine = getRoutine(workoutRoutineId);
  if (!routine) return;

  workoutTitle.textContent = routine.name;
  workoutExercises.innerHTML = '';

  routine.exercises.forEach(ex => {
    const div = document.createElement('div');
    div.className = 'exercise-item';
    div.innerHTML = `
      <div class="exercise-info">
        <strong class="exercise-name"></strong>
        <div class="planned"></div>
        <div class="last-result muted"></div>
      </div>
      <div class="button-row toggle-row">
        <button class="secondary done-btn">Completed</button>
        <button class="secondary not-done-btn">Not completed</button>
      </div>
    `;
    div.querySelector('.exercise-name').textContent = ex.name;
    div.querySelector('.planned').textContent = plannedText(ex);

    const last = getLastLog(ex.id);
    div.querySelector('.last-result').textContent = last
      ? `Last: ${formatDate(last.date)} · ${last.weight} lbs · ${last.completed ? 'Completed' : 'Not completed'}`
      : 'No history.';

    const doneBtn = div.querySelector('.done-btn');
    const notDoneBtn = div.querySelector('.not-done-btn');
    const update = () => {
      const done = workoutResults[ex.id];
      doneBtn.classList.toggle('selected-done', done);
      notDoneBtn.classList.toggle('selected-not-done', !done);
      doneBtn.setAttribute('aria-pressed', String(done));
      notDoneBtn.setAttribute('aria-pressed', String(!done));
    };
    doneBtn.addEventListener('click', () => { workoutResults[ex.id] = true; update(); });
    notDoneBtn.addEventListener('click', () => { workoutResults[ex.id] = false; update(); });
    update();

    workoutExercises.appendChild(div);
  });
}

function cancelWorkout() {
  if (confirm('Discard this workout? Nothing will be saved.')) {
    goHome();
  }
}

function finishCurrentWorkout() {
  if (!confirm('Finish workout and save results?')) return;

  const before = getRoutine(workoutRoutineId);
  const results = before.exercises.map(ex => ({
    exerciseId: ex.id,
    completed: workoutResults[ex.id] === true
  }));
  finishWorkout(workoutRoutineId, results);
  const after = getRoutine(workoutRoutineId);

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
  addSection('Staying the same', stayed);
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
      `${item.count} entr${item.count === 1 ? 'y' : 'ies'} · last ${formatDate(item.lastDate)}`;
    btn.addEventListener('click', () => showHistoryDetail(item.exerciseId, item.name));
    historyList.appendChild(btn);
  });

  showScreen('history-screen');
}

function showHistoryDetail(exerciseId, name) {
  historyDetailTitle.textContent = name;
  historyEntries.innerHTML = '';

  getLogsForExercise(exerciseId).forEach(log => {
    const div = document.createElement('div');
    div.className = 'exercise-item';
    div.innerHTML = `
      <div class="history-date"></div>
      <div class="planned"></div>
      <div class="status"></div>
    `;
    div.querySelector('.history-date').textContent = formatDate(log.date);
    div.querySelector('.planned').textContent = plannedText(log);
    const status = div.querySelector('.status');
    status.textContent = log.completed ? '✓ Completed' : '✗ Not completed';
    status.classList.add(log.completed ? 'status-done' : 'status-not-done');
    historyEntries.appendChild(div);
  });

  showScreen('history-detail-screen');
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
    const msg = `Replace ALL current data with ${data.routines.length} routine(s) and ` +
      `${data.logs.length} log entr${data.logs.length === 1 ? 'y' : 'ies'} from this file? ` +
      'This cannot be undone.';
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

document.getElementById('finish-workout-btn').addEventListener('click', finishCurrentWorkout);
document.getElementById('cancel-workout-btn').addEventListener('click', cancelWorkout);
document.getElementById('summary-done-btn').addEventListener('click', goHome);

document.getElementById('history-btn').addEventListener('click', showHistory);
document.getElementById('history-back-btn').addEventListener('click', goHome);
document.getElementById('history-detail-back-btn').addEventListener('click', showHistory);

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
