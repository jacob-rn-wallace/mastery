# CLAUDE.md — Mastery

This file is for AI assistants (Claude Code and others) working on this repository. Read it before making any changes.

---

## What this project is

Mastery is a browser-based practice tool with no build step, no package manager, no framework, and no server-side code. The app is `index.html`; the user's problem bank is `user/questions.js`. Supporting files (`questions.js` stub, `.gitignore`, `README.md`, `CLAUDE.md`, `LICENSE`) round out the repository.

**File inventory:**
- `index.html` — the entire application: HTML structure, CSS, and JavaScript in one file
- `user/questions.template.js` — the starter template for the problem bank; tracked by git. Users copy this to `user/questions.js` after cloning.
- `user/questions.js` — the user's personal problem bank (`COURSES` array); loaded by `index.html` via `<script src="user/questions.js">`. Git-ignored — never commit this.
- `questions.js` — a stub notice file redirecting editors to `user/questions.js`
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
2. On page load, `loadProgress()` reads `localStorage` under the key `practice_tool_v2_progress` and populates `state.progress`.
3. The user navigates: Home → Course → Topic → Practice.
4. Each question is drawn by `pickQuestion(topic)` (currently uniform random), then `resolveParams(problem)` substitutes `{{PARAM}}` placeholders and evaluates `answerFn` to compute the correct answer.
5. After the user answers, `applyScore()` updates `state.progress` and calls `saveProgress()` to write back to `localStorage`.

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
- `easeFactor += 0.1 - (5 - quality) * 0.08` (clamped to `minEaseFactor`)

**Date handling:** All dates are stored and compared as `YYYY-MM-DD` ISO strings. Lexicographic string comparison is valid for this format. Date objects for display are always constructed as `new Date(y, m-1, d)` (parsed from the stored string) to avoid UTC offset bugs — `new Date('YYYY-MM-DD')` parses as UTC midnight and can display the wrong local date in negative-offset timezones.

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

## What to be careful about

**`choices[0]` is always correct.** The shuffle happens in `shuffleChoices()` at render time. If you reorder choices in the config, the first entry is still treated as correct. Never change this invariant without updating both `shuffleChoices()` and the grading logic in `handleMCAnswer()`.

**`answerFn` is evaluated with `new Function`.** This is intentional — the config is trusted developer input, not user input. Don't add sanitization that breaks legitimate function expressions. Don't use `eval()` as a replacement.

**`localStorage` key is `practice_tool_v3_progress`.** If the progress schema ever changes in a breaking way, increment the version suffix and add a migration or clear path so returning users don't get corrupt state. The v2→v3 migration in `loadProgress()` is the reference example: read old key, backfill new fields with defaults, write under new key, leave old key intact.

**No frameworks, no transpilation.** Keep it that way. The entire value proposition of this tool is that it runs by opening a file. Do not introduce a build step, npm dependencies, or module bundlers. ES6+ syntax is fine; anything requiring transpilation is not.

**`user/questions.js` must remain valid in both browser and Node contexts.** The `if (typeof module !== "undefined") module.exports = { COURSES }` line at the bottom is what enables Node-based tooling (e.g., a validator script, tests). Don't remove it.

---

## Common tasks

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
