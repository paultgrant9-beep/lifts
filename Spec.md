PROJECT SPEC
App: personal weightlifting tracker. Progressive Web App for Android Chrome (Pixel 8 Pro). Single user, no login, no server.
Tech: plain HTML, CSS, JavaScript only. No frameworks, no build tools, no external libraries. Data stored in localStorage as JSON.
Files: index.html, styles.css, storage.js (all data functions), app.js (all UI and screen logic), manifest.json, sw.js, icons/.
Units: pounds.

Data model:
- exercise: { id, name, sets, reps, weight, increment }
- routine: { id, name, exercises: [exercise, ...] }
- log entry: { id, date (ISO string), routineId, exerciseId, exerciseName, sets, reps, weight, setReps, completed (true or false) }
  - sets, reps: the target for that workout. setReps: reps actually done on each set, e.g. [5, 5, 4].
  - completed is true only if every set reached the target reps.
  - Entries logged before setReps existed have no setReps; treat them as every set at target reps if completed, unknown if not.
- active workout (in progress, so it survives the app being closed): { routineId, startedAt (ISO string), sets: { exerciseId: [reps or null, ...] }, timerStart (ms timestamp or null) }
- localStorage keys: "routines", "logs", and "activeWorkout"

Workout: each exercise shows one bubble per planned set, with the target reps inside. First tap marks the set done at full reps; each further tap lowers the reps by one; tapping at 0 resets the bubble to untapped. Once all of an exercise's bubbles are tapped, it shows whether the weight goes up next time. Untapped sets count as 0 reps when the workout is finished.

Rest timer: a stopwatch counting up in minutes and seconds. It restarts on the first tap of any bubble, and hides when an exercise's last untapped bubble is tapped, until the next first tap.

Progression rule: when a workout is finished, each exercise is completed only if every set reached the target reps. If completed, that exercise's weight increases by its increment for next time. If not completed, the weight stays the same. The log always records the weight actually used.

History: per exercise, as a table and as a line chart (x: date, scaled by days; y: weight; one point per day, using the heaviest weight that day; filled point = all reps hit, hollow = missed reps). Entries can be edited (date, weight, reps per set) or deleted; one exercise's history or all history can be cleared. Editing history does not change routine weights.

Design: mobile first, single column, dark theme, tap targets at least 44px tall, readable at arm's length in a gym.
