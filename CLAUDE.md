# CLAUDE.md — Mastery

This file is for AI assistants (Claude Code and others) working on this repository. Read it before making any changes.

---

## What this project is

Mastery is a two-file, self-contained browser-based practice tool. There is no build step, no package manager, no framework, and no server-side code. It runs by opening `index.html` directly in a browser.

**File inventory:**
- `index.html` — the entire application: HTML structure, CSS, and JavaScript in one file
- `user/questions.js` — the user's personal problem bank (`COURSES` array); loaded by `index.html` via `<script src="user/questions.js">`. **Git-ignored — never commit this file or anything else inside `user/`.**
- `questions.js` — a stub notice file redirecting editors to `user/questions.js`
- `.gitignore` — excludes `user/` and common system files
- `README.md` — user-facing documentation
- `CLAUDE.md` — this file
- `LICENSE` — MIT

The `user/` folder is git-ignored. Never commit anything from it, even temporarily. Do not add it to version control under any circumstances.

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
  activeCourse: null,   // full course object from COURSES
  activeTopic:  null,   // full topic object
  currentQ:     null,   // resolved question (with _resolvedParams, _computedAnswer, etc.)
  answered:     false,
  progress: {}          // { courseId: { topicId: { score, streak, mastered } } }
}
```

### Progress schema (localStorage)

```json
{
  "mae335": {
    "fluid-properties": { "score": 60, "streak": 0, "mastered": false },
    "bernoulli-energy-cv": { "score": 80, "streak": 0, "mastered": true }
  }
}
```

Both `score` and `streak` are stored for every topic regardless of the course's `scoringMode`. Only the relevant field is used at runtime.

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
| `topics` | Topic[] | yes | |

### Topic object

| Field | Type | Required |
|-------|------|----------|
| `id` | string | yes — unique within the course |
| `name` | string | yes |
| `problems` | Problem[] | yes |

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

**`localStorage` key is `practice_tool_v2_progress`.** If the progress schema ever changes in a breaking way, increment the version suffix and add a migration or clear path so returning users don't get corrupt state.

**No frameworks, no transpilation.** Keep it that way. The entire value proposition of this tool is that it runs by opening a file. Do not introduce a build step, npm dependencies, or module bundlers. ES6+ syntax is fine; anything requiring transpilation is not.

**`questions.js` must remain valid in both browser and Node contexts.** The `if (typeof module !== "undefined") module.exports = { COURSES }` line at the bottom is what enables Node-based tooling (e.g., a validator script, tests). Don't remove it.

---

## Common tasks

### Validate user/questions.js for syntax errors
```bash
node --check user/questions.js
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
localStorage.removeItem('practice_tool_v2_progress');
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
