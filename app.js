// Only the id is kept; the routine itself is always re-read from storage
// so the screen never shows stale data.
let currentRoutineId = null;
let editingExerciseId = null;

const homeScreen = document.getElementById('home-screen');
const editorScreen = document.getElementById('editor-screen');
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

function showScreen(screenId) {
  [homeScreen, editorScreen].forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0, 0);
}

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
        <button class="secondary start-btn">Start</button>
      </div>
    `;
    // textContent so names containing < or & display correctly
    div.querySelector('.routine-name').textContent = routine.name || 'Untitled';
    const count = routine.exercises.length;
    div.querySelector('.exercise-count').textContent = `${count} exercise${count === 1 ? '' : 's'}`;

    div.querySelector('.edit-btn').addEventListener('click', () => openEditor(routine.id));
    div.querySelector('.start-btn').addEventListener('click', () => alert('Coming soon'));

    routinesContainer.appendChild(div);
  });
}

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
    div.querySelector('.exercise-meta').textContent =
      `${ex.sets} x ${ex.reps} @ ${ex.weight} lbs (+${ex.increment})`;

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

function goHome() {
  closeExerciseForm();
  currentRoutineId = null;
  showScreen('home-screen');
  renderHome();
}

// Event Listeners
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

// Initial render
renderHome();
