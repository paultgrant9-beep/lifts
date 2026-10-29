PROJECT SPEC
App: personal weightlifting tracker. Progressive Web App for Android Chrome (Pixel 8 Pro). Single user, no login, no server.
Tech: plain HTML, CSS, JavaScript only. No frameworks, no build tools, no external libraries. Data stored in localStorage as JSON.
Files: index.html, styles.css, storage.js (all data functions), app.js (all UI and screen logic). Later: manifest.json, sw.js.
Units: pounds.

Data model:
- exercise: { id, name, sets, reps, weight, increment }
- routine: { id, name, exercises: [exercise, ...] }
- log entry: { id, date (ISO string), routineId, exerciseId, exerciseName, sets, reps, weight, completed (true or false) }
- localStorage keys: "routines" and "logs"

Progression rule: when a workout is finished, each exercise is marked completed or not. If completed, that exercise's weight increases by its increment for next time. If not completed, the weight stays the same. The log always records the weight actually used.

Design: mobile first, single column, dark theme, tap targets at least 44px tall, readable at arm's length in a gym.