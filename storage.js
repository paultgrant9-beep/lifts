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

// Get the most recent log entry for an exercise
function getLastLog(exerciseId) {
  const logs = loadLogs();
  const exerciseLogs = logs.filter(l => l.exerciseId === exerciseId);
  if (exerciseLogs.length === 0) return null;
  return exerciseLogs.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

// Finish a workout and record results
function finishWorkout(routineId, results) {
  const routines = loadRoutines();
  const logs = loadLogs();
  const routine = routines.find(r => r.id === routineId);
  
  if (routine) {
    results.forEach(res => {
      const exercise = routine.exercises.find(e => e.id === res.exerciseId);
      if (exercise) {
        const newLog = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          routineId: routine.id,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight,
          completed: res.completed
        };
        logs.push(newLog);
        if (res.completed) {
          // Round to avoid floating-point drift with fractional increments
          exercise.weight = Math.round((exercise.weight + exercise.increment) * 100) / 100;
        }
      }
    });
    saveRoutines(routines);
    localStorage.setItem("logs", JSON.stringify(logs));
  }
}
