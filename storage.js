// Load routines from localStorage
function loadRoutines() {
  const data = localStorage.getItem("routines");
  return data ? JSON.parse(data) : [];
}

// Save routines to localStorage
function saveRoutines(routines) {
  localStorage.setItem("routines", JSON.stringify(routines));
}

// Add a new routine
function addRoutine(name) {
  const routines = loadRoutines();
  const newRoutine = {
    id: crypto.randomUUID(),
    name: name,
    exercises: []
  };
  routines.push(newRoutine);
  saveRoutines(routines);
  return newRoutine;
}

// Get a single routine by id
function getRoutine(id) {
  return loadRoutines().find(r => r.id === id) || null;
}

// Update a routine's fields (e.g. name)
function updateRoutine(id, changes) {
  const routines = loadRoutines();
  const routine = routines.find(r => r.id === id);
  if (routine) {
    Object.assign(routine, changes);
    saveRoutines(routines);
    return routine;
  }
  return null;
}

// Delete a routine by id
function deleteRoutine(id) {
  const routines = loadRoutines();
  const filtered = routines.filter(r => r.id !== id);
  saveRoutines(filtered);
}

// Add an exercise to a routine
function addExercise(routineId, exerciseData) {
  const routines = loadRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (routine) {
    const newExercise = {
      id: crypto.randomUUID(),
      name: exerciseData.name,
      sets: exerciseData.sets,
      reps: exerciseData.reps,
      weight: exerciseData.weight,
      increment: exerciseData.increment
    };
    routine.exercises.push(newExercise);
    saveRoutines(routines);
    return newExercise;
  }
  return null;
}

// Update an exercise in a routine
function updateExercise(routineId, exerciseId, changes) {
  const routines = loadRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (routine) {
    const exercise = routine.exercises.find(e => e.id === exerciseId);
    if (exercise) {
      Object.assign(exercise, changes);
      saveRoutines(routines);
      return exercise;
    }
  }
  return null;
}

// Delete an exercise from a routine
function deleteExercise(routineId, exerciseId) {
  const routines = loadRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (routine) {
    routine.exercises = routine.exercises.filter(e => e.id !== exerciseId);
    saveRoutines(routines);
  }
}

// Load logs from localStorage
function loadLogs() {
  const data = localStorage.getItem("logs");
  return data ? JSON.parse(data) : [];
}

// Save logs to localStorage
function saveLogs(logs) {
  localStorage.setItem("logs", JSON.stringify(logs));
}

// All log entries for an exercise, newest first
function getLogsForExercise(exerciseId) {
  return loadLogs()
    .filter(l => l.exerciseId === exerciseId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// One summary per exercise that has log entries (including exercises
// since deleted from their routine), sorted by name
function getLoggedExercises() {
  const byId = {};
  loadLogs().forEach(l => {
    const entry = byId[l.exerciseId];
    if (!entry) {
      byId[l.exerciseId] = { exerciseId: l.exerciseId, name: l.exerciseName, count: 1, lastDate: l.date };
    } else {
      entry.count++;
      if (new Date(l.date) > new Date(entry.lastDate)) {
        entry.lastDate = l.date;
        entry.name = l.exerciseName;
      }
    }
  });
  return Object.values(byId).sort((a, b) => a.name.localeCompare(b.name));
}

// Everything needed for a backup file
function exportData() {
  return {
    app: "weightlifting-tracker",
    exportedAt: new Date().toISOString(),
    routines: loadRoutines(),
    logs: loadLogs()
  };
}

// Check that parsed JSON looks like an export file. Returns an error
// message, or null if it's valid.
function validateImport(data) {
  if (!data || typeof data !== "object") return "File is not a backup.";
  if (!Array.isArray(data.routines) || !Array.isArray(data.logs)) {
    return "File is missing routines or logs.";
  }
  const badRoutine = data.routines.some(r =>
    !r || typeof r.id !== "string" || typeof r.name !== "string" || !Array.isArray(r.exercises));
  if (badRoutine) return "File has an invalid routine.";
  const badLog = data.logs.some(l =>
    !l || typeof l.id !== "string" || typeof l.date !== "string" || typeof l.exerciseId !== "string");
  if (badLog) return "File has an invalid log entry.";
  return null;
}

// Replace all current data with an export file's data
function importData(data) {
  saveRoutines(data.routines);
  saveLogs(data.logs);
  // Any in-progress workout may point at routines that no longer exist
  clearActiveWorkout();
}

// Get the most recent log entry for an exercise
function getLastLog(exerciseId) {
  const logs = loadLogs();
  const exerciseLogs = logs.filter(l => l.exerciseId === exerciseId);
  if (exerciseLogs.length === 0) return null;
  return exerciseLogs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

// True if every set was done and reached the target reps
function allRepsHit(setReps, targetSets, targetReps) {
  return setReps.length >= targetSets && setReps.every(r => r !== null && r >= targetReps);
}

// Finish a workout and record results.
// results: [{ exerciseId, setReps: [reps or null, ...] }]; null counts as 0.
function finishWorkout(routineId, results) {
  const routines = loadRoutines();
  const logs = loadLogs();
  const routine = routines.find(r => r.id === routineId);

  if (routine) {
    const date = new Date().toISOString();
    results.forEach(res => {
      const exercise = routine.exercises.find(e => e.id === res.exerciseId);
      if (exercise) {
        const setReps = res.setReps.map(r => (r === null ? 0 : r));
        const completed = allRepsHit(setReps, exercise.sets, exercise.reps);
        logs.push({
          id: crypto.randomUUID(),
          date: date,
          routineId: routine.id,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          setReps: setReps,
          completed: completed
        });
        if (completed) {
          // Round to avoid floating-point drift with fractional increments
          exercise.weight = Math.round((exercise.weight + exercise.increment) * 100) / 100;
        }
      }
    });
    saveRoutines(routines);
    saveLogs(logs);
  }
}

// Edit a log entry (date, weight, setReps, completed)
function updateLog(id, changes) {
  const logs = loadLogs();
  const log = logs.find(l => l.id === id);
  if (log) {
    Object.assign(log, changes);
    saveLogs(logs);
  }
}

// Delete one log entry
function deleteLog(id) {
  saveLogs(loadLogs().filter(l => l.id !== id));
}

// Delete all log entries for one exercise
function deleteLogsForExercise(exerciseId) {
  saveLogs(loadLogs().filter(l => l.exerciseId !== exerciseId));
}

// Delete all log entries
function clearLogs() {
  saveLogs([]);
}

// In-progress workout, saved on every tap so it survives the app closing
function loadActiveWorkout() {
  const data = localStorage.getItem("activeWorkout");
  return data ? JSON.parse(data) : null;
}

function saveActiveWorkout(workout) {
  localStorage.setItem("activeWorkout", JSON.stringify(workout));
}

function clearActiveWorkout() {
  localStorage.removeItem("activeWorkout");
}
