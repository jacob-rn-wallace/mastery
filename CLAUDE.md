# CLAUDE.md — Mastery

This file is for AI assistants (Claude Code and others) working on this repository. Read it before making any changes.

---

## What this project is

Mastery is a browser-based practice tool with no build step, no package manager, no framework, and no server-side code. The app is `index.html`; the user's problem bank is `user/questions.js`. Supporting files (`questions.js` stub, `.gitignore`, `README.md`, `CLAUDE.md`, `LICENSE`) round out the repository.

**File inventory:**
- `index.html` — the entire application: HTML structure, CSS, and JavaScript in one file
- `user/questions.template.js` — the starter template for the problem bank; tracked by git. Users copy this to `user/questions.js` after cloning.
- `user/questions.js` — the user's personal problem bank (`COURSES` array); loaded by `index.html` via `<script src="user/questions.js">`. Git-ignored — never commit this.
- `server.js` — Companion shutdown listener — started by start.command, not used when serving manually.
- `start.command` — macOS startup script — double-click in Finder to start the app and companion server.
- `questions.js` — a stale stub file (root level). It describes an older architecture where the problem bank lived inside `index.html`; its contents are now outdated but the file is kept to redirect confused editors. Do not load or require it — it is not used by the app.
- `.gitignore` — excludes everything in `user/` except `user/questions.template.js`, plus common system files
- `README.md` — user-facing documentation
- `CLAUDE.md` — this file
- `LICENSE` — MIT

`user/questions.js` is git-ignored — never commit it. `user/questions.template.js` is the tracked starter template. Any other files created inside `user/` (backups, exports, etc.) are also git-ignored.

There is no `package.json`, no `node_modules`, no `dist/`, no transpilation.

---

## Architecture

### Data flow

1. `index.html` loads `user/questions.js` via `<script src="user/questions.js">`, making `COURSES` available as a global variable.
2. On page load, `loadProgress()` reads `localStorage` under the key `practice_tool_v3_progress` and populates `state.progress`.
3. The user navigates: Home → Course → Topic → Practice.
4. Each question is drawn by `pickQuestion(topic)` using adaptive weighted random selection (see below), then `resolveParams(problem)` substitutes `{{PARAM}}` placeholders and evaluates `answerFn` to compute the correct answer.
5. After the user answers, `applyScore()` updates `state.progress` and calls `saveProgress()` to write back to `localStorage`.

### Question selection (`pickQuestion`)

`pickQuestion` uses **adaptive weighted random selection** — it is not uniform. Each problem in the topic gets a weight:

```js
weight = (4 - difficulty) + (1 - progress) * difficulty * 3
```

where `progress` is `score / 100` in continuous mode or `streak / masteryThreshold` in streak mode (clamped to 1).

Effect of the formula:
- **Base weight** `(4 - d)` favours lower difficulty: d1 → 3, d2 → 2, d3 → 1.
- **Performance term** `(1 - progress) * d * 3` adds weight to harder problems when performance is low. At `progress = 0`, the totals are d1 → 6, d2 → 8, d3 → 10 (harder problems dominate). At `progress = 1.0`, totals are d1 → 3, d2 → 2, d3 → 1 (easier problems dominate).

The net result is that when a student is struggling, harder problems are drawn more often; when they are performing well, easier problems are drawn more often.

### State object

```js
state = {
  activeCourse:  null,   // full course object from COURSES
  activeTopic:   null,   // full topic object
  currentQ:      null,   // resolved question (with _resolvedParams, _computedAnswer, etc.)
  answered:      false,
  progress:      {},     // { courseId: { topicId: { score, streak, mastered, ...sm2 } } }
  sessionStats:  { correct: 0, total: 0, difficultySum: 0 }
                         // reset by openPractice(); updated by applyScore(); consumed by closePracticeSession()
}
```

### Progress schema (localStorage)

Stored under the key `practice_tool_v3_progress`. Each topic entry always carries both scoring fields and all SM-2 fields, regardless of whether SM-2 is enabled for the course:

```json
{
  "mae335": {
    "fluid-properties": {
      "score": 60, "streak": 0, "mastered": false,
      "easeFactor": 2.5, "interval": 1, "repetitions": 0,
      "nextReviewDate": "2026-06-03", "lastReviewDate": "2026-06-02"
    },
    "bernoulli-energy-cv": {
      "score": 80, "streak": 0, "mastered": true,
      "easeFactor": 2.8, "interval": 15, "repetitions": 3,
      "nextReviewDate": "2026-06-17", "lastReviewDate": "2026-06-02"
    }
  }
}
```

Both `score` and `streak` are stored for every topic regardless of `scoringMode`. SM-2 fields are stored for every topic regardless of whether `sm2.enabled` is true — they are simply ignored at runtime when SM-2 is off. `loadProgress()` migrates v2 entries (which have no SM-2 fields) by adding `SM2_DEFAULTS` to each topic entry and saving under the v3 key.

### SM-2 scheduling

SM-2 is an optional spaced-repetition algorithm that schedules topic reviews at growing intervals. It is self-contained in `index.html` and requires no external dependencies.

**Session flow:**
1. `openPractice()` resets `state.sessionStats` to `{ correct: 0, total: 0, difficultySum: 0 }`.
2. Each answered question calls `applyScore()`, which updates both the topic's score/streak and `state.sessionStats`.
3. At the top of `loadNextQuestion()`, if `state.sessionStats.total >= course.sm2.sessionSize`, `closePracticeSession()` is called instead of drawing another question.
4. `closePracticeSession()`: computes session quality via `getSessionQuality(sessionStats)` → calls `updateSM2(topicState, quality, minEaseFactor)` if SM-2 is enabled → calls `saveProgress()` → navigates back to the topic list.
5. The back button also calls `closePracticeSession()`, so SM-2 fields are updated even if the user exits early.

**Gating functions — both must return `true` for a topic to be accessible:**
- `isTopicUnlocked(course, topic)` — checks prerequisites. Reads `state.progress` directly (not via `getTopicState`) to avoid creating default entries that would make unseen topics appear unlocked.
- `isTopicDue(course, topicState)` — checks SM-2 scheduling. Returns `true` if SM-2 is disabled for the course, if `nextReviewDate` is null, or if today ≥ `nextReviewDate`.

Topics that fail `isTopicUnlocked` show a lock icon; topics that fail `isTopicDue` show a calendar icon with the next review date.

**Review status helper:**
`getTopicReviewStatus(course, topic, topicState)` returns one of four strings:
- `"unscheduled"` — SM-2 disabled or topic not yet reviewed (`nextReviewDate` is null)
- `"due"` — `nextReviewDate` equals today
- `"overdue"` — `nextReviewDate` is before today
- `"upcoming"` — `nextReviewDate` is after today

Used by `renderTopicList()` (pill badges on accessible topic rows) and `renderHome()` (due count on course cards).

**SM-2 algorithm (`updateSM2`):**
Implements the standard SM-2 algorithm. `quality` (0–5 integer from `getSessionQuality`) drives updates:
- `quality < 3`: reset `repetitions` to 0, set `interval` to 1
- `repetitions === 0`: `interval = 1`
- `repetitions === 1`: `interval = 6`
- `repetitions >= 2`: `interval = round(interval * easeFactor)`
- `easeFactor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)` (clamped to `minEaseFactor`)

**Date handling:** All dates are stored and compared as `YYYY-MM-DD` ISO strings. Lexicographic string comparison is valid for this format. Date objects for display are always constructed as `new Date(y, m-1, d)` (parsed from the stored string) to avoid UTC offset bugs — `new Date('YYYY-MM-DD')` parses as UTC midnight and can display the wrong local date in negative-offset timezones.

---

## Startup infrastructure

### `start.command` flow

1. `cd "$(dirname "$0")"` — ensures the script runs from the repo root regardless of where it is invoked.
2. Checks that `user/questions.js` exists; exits with a helpful error if not.
3. Starts `python3 -m http.server 8000` in the background and captures its PID.
4. Starts `node server.js $PYTHON_PID` in the background, passing the Python PID as an argument.
5. Sleeps 1 second (gives both processes time to bind their ports).
6. Opens `http://localhost:8000` in the system default browser.
7. Waits for both background processes — the terminal window stays open until both exit.

### `server.js` (shutdown listener)

- Listens on **port 9999**.
- Two endpoints, both respond with `Content-Type: application/json` and `Access-Control-Allow-Origin: *`:
  - `GET /ping` → `{"ok":true}` (200) — used by the app to detect whether the server is running.
  - `POST /shutdown` → `{"ok":true}` (200), then after 100 ms kills the Python HTTP server process and calls `process.exit(0)`.
- All other paths → `{"ok":false}` (404).
- Requires the Python PID as `process.argv[2]`; exits with an error if it is missing or non-numeric.

### Shutdown button

- The shutdown button (`#btn-shutdown`) is **hidden by default** (`style="display:none"`).
- On page load, the app fires a one-shot `fetch` to `http://localhost:9999/ping` with a 1-second `AbortController` timeout.
- If the ping succeeds and returns `{ok:true}`, the button is made visible.
- Clicking the button: disables it, updates the label to "shutting down...", POSTs to `/shutdown` (races with a 500 ms timeout so it never hangs), then calls `window.close()`.
- When the app is served manually (e.g. `python3 -m http.server` without `start.command`), the ping fails silently and the button stays hidden.

---

## questions.js schema

The file exports `COURSES` (array). It also does `module.exports = { COURSES }` at the bottom for Node.js compatibility (used in tests or tooling), but the browser ignores this since `module` is undefined — the `if (typeof module !== "undefined")` guard prevents errors.

### Course object

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Unique. Used as key in `state.progress`. No spaces. |
| `name` | string | yes | Display name. |
| `color` | string | yes | Hex color used for progress bars and card accents. |
| `scoringMode` | `"continuous"` \| `"streak"` | yes | Determines scoring behavior. |
| `masteryThreshold` | number | streak mode only | Consecutive correct answers needed to master a topic. |
| `sm2` | object | no | SM-2 spaced-repetition config. Omit or set `enabled: false` to disable entirely. |
| `sm2.enabled` | boolean | no | Activates SM-2 scheduling for this course. Default: `false`. |
| `sm2.initialEaseFactor` | number | no | Starting ease factor for new topics. Default: `2.5` (SM-2 spec). |
| `sm2.minEaseFactor` | number | no | Floor for ease factor decay. Default: `1.3` (SM-2 spec). Passed to `updateSM2()`. |
| `sm2.sessionSize` | number | no | Questions per session before SM-2 fields are updated and session closes. |
| `topics` | Topic[] | yes | |

### Topic object

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes — unique within the course | |
| `name` | string | yes | |
| `prerequisites` | string[] | no | Array of topic IDs from the same course. A topic is unlocked when all prerequisites pass their threshold: continuous mode requires score ≥ 60; streak mode requires `mastered === true`. A topic with no progress entry is treated as locked. Omit or use `[]` for no prerequisites. Every course must have at least one prerequisite-free topic as its entry point. |
| `problems` | Problem[] | yes | |

### Problem object

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `type` | `"mc"` \| `"numerical"` | yes | |
| `difficulty` | `1` \| `2` \| `3` | yes | 1=recall, 2=single-step, 3=multi-step |
| `question` | string | yes | May contain `{{PARAM_NAME}}` placeholders |
| `params` | object | no | Maps param names to `[min, max]` integer ranges. Required if using placeholders. |
| `answer` | number | numerical only | Used when there are no params. |
| `answerFn` | string | numerical + params | JS arrow function string: `"(p) => expression"`. `p` keys are param names. |
| `tolerance` | number | no | Fractional tolerance for numerical grading. Default: `0.01` (±1%). |
| `choices` | string[] | mc only | `choices[0]` is always correct. Shuffled before display. |
| `explanation` | string | no | Shown after every answer. |
| `source` | string | no | Displayed in the feedback panel after answering. Intended for lecture, chapter, or section references (e.g. `"Lecture 4 — Bernoulli"`). |

### Resolved question (internal, not in config)

After `resolveParams()`, the problem object gains private fields prefixed with `_`:
- `_resolvedParams` — the actual random values used
- `_resolvedQuestion` — question string with placeholders substituted
- `_computedAnswer` — result of evaluating `answerFn(params)`

These are not stored; they are recomputed fresh each time a question is drawn.

---

## Scoring logic

### Continuous mode (`scoringMode: "continuous"`)

```
correct:   score = min(100, score + 10 * difficulty)
incorrect: score = max(0,   score - 5  * difficulty)
mastered = score >= 80
```

### Streak mode (`scoringMode: "streak"`)

```
correct:   streak++; if streak >= masteryThreshold → mastered = true
incorrect: streak = 0
```

Mastery is permanent once achieved (no un-mastering). The mastery celebration overlay fires once per mastery event, detected by checking the state transition within `showFeedback()`.

---

## UI structure

Three screens, toggled by adding/removing the `active` class:

| Screen ID | Purpose |
|-----------|---------|
| `screen-home` | Course selection grid |
| `screen-course` | Topic list for the active course |
| `screen-practice` | Active practice session |

Navigation is managed by `showScreen(id)`. The back buttons call `renderHome()` or `renderTopicList()` before switching screens to ensure the UI is fresh.

The mastery overlay (`#mastery-overlay`) is a fixed-position element layered above all screens, shown by adding the `show` class.

---

## UI rendering details

### `scoreColor(score)`
Returns a CSS variable string used to tint score displays:
- `score >= 80` → `var(--correct)` (green)
- `score >= 50` → `var(--accent)` (lime/yellow)
- `score < 50` → `var(--muted)` (grey)

### `formatNumber(n)`
Used in the feedback panel to display the correct answer for numerical questions the user got wrong.
- `|n| < 0.001` or `|n| >= 10000` → `n.toExponential(3)` (scientific notation, 3 sig figs)
- Otherwise → `parseFloat(n.toPrecision(4)).toString()` (4 significant figures, trailing zeros stripped)

### MC choices

`LETTERS = ['A','B','C','D','E']` — the app supports **at most 5 choices** for a multiple-choice problem. The validator warns at >6 but the render loop would silently drop any choice beyond index 4. Keep choices ≤ 5 in practice.

### Numerical input keyboard shortcut

The numerical answer input field (`#num-input`) listens for the **Enter** key and triggers `handleNumericalAnswer()`. Users do not need to click the "submit" button.

### Session progress bar

`#session-progress` (text above the question card showing "question X of Y") is only rendered when `course.sm2.enabled` is `true`. For non-SM-2 courses it stays hidden.

### Design tokens and fonts

All colours and spacing are driven by CSS custom properties on `:root`:

| Token | Default | Purpose |
|-------|---------|---------|
| `--bg` | `#0d0d0f` | Page background |
| `--surface` | `#16161a` | Card/panel background |
| `--surface2` | `#1e1e24` | Hover state surface |
| `--border` | `#2a2a35` | Default border |
| `--border2` | `#3a3a48` | Hover/focus border |
| `--text` | `#e8e8f0` | Body text |
| `--muted` | `#7a7a90` | Secondary/metadata text |
| `--accent` | `#c8ff00` | Lime highlight, correct-answer button |
| `--correct` | `#00e676` | Green — correct feedback |
| `--wrong` | `#ff4d4d` | Red — incorrect feedback |

Fonts loaded from Google Fonts (network request; app degrades gracefully to system fonts if offline):
- **IBM Plex Sans** (`var(--sans)`) — body text, UI labels
- **Space Mono** (`var(--mono)`) — metadata, scores, tags, code

---

## What to be careful about

**`choices[0]` is always correct.** The shuffle happens in `shuffleChoices()` at render time. If you reorder choices in the config, the first entry is still treated as correct. Never change this invariant without updating both `shuffleChoices()` and the grading logic in `handleMCAnswer()`.

**MC choices are capped at 5 by the LETTERS array.** `LETTERS = ['A','B','C','D','E']`. Any choice beyond index 4 will render without a letter label. Keep `choices` arrays at 5 entries or fewer.

**`answerFn` is evaluated with `new Function`.** This is intentional — the config is trusted developer input, not user input. Don't add sanitization that breaks legitimate function expressions. Don't use `eval()` as a replacement.

**`getTopicState` creates progress entries as a side effect.** Any call to `getTopicState(courseId, topicId, course)` writes a default entry into `state.progress` if one doesn't exist. `renderHome()` calls it for every topic in every course on every home render — so by the time a user navigates into a course, all topics already have entries in `state.progress`. `isTopicUnlocked` deliberately reads `state.progress` directly (not via `getTopicState`) because it must return `false` for unseen prerequisite topics; using `getTopicState` there would silently create an entry and make the prerequisite appear to have a score of 0 (which evaluates as unlocked for no-threshold courses).

**`localStorage` key is `practice_tool_v3_progress`.** If the progress schema ever changes in a breaking way, increment the version suffix and add a migration or clear path so returning users don't get corrupt state. The v2→v3 migration in `loadProgress()` is the reference example: read old key, backfill new fields with defaults, write under new key, leave old key intact.

**No frameworks, no transpilation.** Keep it that way. The entire value proposition of this tool is that it runs by opening a file. Do not introduce a build step, npm dependencies, or module bundlers. ES6+ syntax is fine; anything requiring transpilation is not.

**`user/questions.js` must remain valid in both browser and Node contexts.** The `if (typeof module !== "undefined") module.exports = { COURSES }` line at the bottom is what enables Node-based tooling (e.g., a validator script, tests). Don't remove it.

---

## Common tasks

### Validate the problem bank
```bash
node validate.js
```

`validate.js` loads `user/questions.js` via `require` and runs structural checks. It exits with code `1` if any errors are found, `0` if clean or warnings only.

**Errors** (block a valid problem bank):
- Duplicate course IDs across `COURSES`
- Duplicate topic IDs within a course
- `scoringMode` is not `"continuous"` or `"streak"`
- Streak mode course missing `masteryThreshold` (must be a positive integer)
- `sm2.enabled: true` but `sm2.sessionSize` is missing or not a positive integer
- A topic's `prerequisites` array references a topic ID that doesn't exist in the same course
- `type` not `"mc"` or `"numerical"`
- `difficulty` not `1`, `2`, or `3`
- `question` field missing or empty
- MC problem: `choices` missing, not an array, or fewer than 2 entries
- Numerical problem: neither `answer` nor `answerFn` present
- Numerical problem: `params` present but `answerFn` absent
- Numerical problem: `answerFn` cannot be parsed as a valid JS function

**Warnings** (noted but do not block):
- A course has no prerequisite-free topic (no entry point)
- A topic has fewer than 2 problems
- A problem is missing an `explanation`
- An MC problem has more than 6 choices
- A numerical problem's `tolerance` is greater than `0.5` (±50%)

### Validate the problem bank for syntax errors
```bash
node --check user/questions.js          # personal copy
node --check user/questions.template.js # starter template
```

### Count problems per course
```bash
node -e "
const { COURSES } = require('./user/questions.js');
COURSES.forEach(c => {
  const n = c.topics.reduce((a, t) => a + t.problems.length, 0);
  console.log(c.name + ': ' + c.topics.length + ' topics, ' + n + ' problems');
});
"
```

### Serve locally (avoids any browser file:// quirks)
```bash
python3 -m http.server
# then open http://localhost:8000
```

### Reset a user's progress
Open the browser console and run:
```js
localStorage.removeItem('practice_tool_v3_progress');
location.reload();
```
Or use the "reset all progress" button in the app header.

---

## Out of scope (do not add without discussion)

- Build tooling, bundlers, or transpilers
- Backend / server-side components
- User accounts or remote progress sync
- Paid API dependencies (the tool must remain free to run)
- Autogenerated problems via LLM at runtime (increases cost and reduces reliability of correct answers)
- Replacing the SM-2 implementation with a backend scheduling service or external API — the algorithm is intentionally self-contained in `index.html` and runs entirely in the browser with no network calls
