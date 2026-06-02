# Mastery

A self-contained, browser-based practice tool for building subject mastery through adaptive problem sets. Configure courses, topics, and problems in a single JavaScript file — no server, no API, no cost.

**[Try it →](#usage)** &nbsp;·&nbsp; **[Add problems →](#adding-problems)** &nbsp;·&nbsp; **[Add a course →](#adding-a-course)**

---

## Project structure

```
├── index.html                     # the app — HTML, CSS, and JavaScript in one file
└── user/
    ├── questions.template.js      # starter template — tracked by git
    └── questions.js               # your personal problem bank — git-ignored
```

The root of the repository is tracked by git — pulling updates only ever changes app files. Inside `user/`, the template file is tracked; your personal `user/questions.js` is git-ignored, so it is never overwritten by a pull or accidentally committed.

---

## What it does

You select a course, pick a topic, and answer problems one at a time. After each answer you get immediate feedback and an explanation. Your progress is tracked per topic and persists across sessions via `localStorage`.

Two scoring modes are supported, configured per course:

- **Continuous** — each topic has a score from 0–100. Correct answers add points scaled by difficulty; wrong answers subtract points. Reaching 80 marks the topic as mastered.
- **Streak** — each topic requires a configurable number of consecutive correct answers before it is marked mastered. Any wrong answer resets the streak to zero.

Problems come in two types:

- **Multiple choice** — four shuffled options, one correct. The correct answer is always `choices[0]` in the config; Mastery shuffles before display.
- **Numerical** — the user enters a number. Answers are accepted within a configurable fractional tolerance (default ±1%). Units are ignored; only the number matters.

Numerical problems can be **parametric**: define named parameter ranges in the config and use `{{PARAM_NAME}}` placeholders in the question text. Mastery substitutes a random integer from each range every time the question is drawn, so the same problem has different numbers each session.

---

## Usage

Mastery runs from `index.html`, which loads your problem bank from `user/questions.js`. Both files must be served together.

**Option 1 — open locally:**
Clone this repository, copy the template to create your personal problem bank, then start a local server:

```bash
# macOS / Linux
cp user/questions.template.js user/questions.js

# Windows
copy user\questions.template.js user\questions.js
```

```bash
python3 -m http.server
```

Open `http://localhost:8000` in your browser, then edit `user/questions.js` to add your own courses. Git will never track changes to `user/questions.js`, so your problem bank is safe across pulls.

**Option 2 — GitHub Pages:**
Fork this repository and enable GitHub Pages on the `main` branch. The tool is immediately available at your Pages URL with no configuration.

> **Note on local file loading:** Because `index.html` loads `user/questions.js` as an external script, opening `index.html` directly via `file://` will be blocked by Chrome's local file policy. Use `python3 -m http.server` (Option 1) or GitHub Pages (Option 2) instead.

---

## Adding problems

Open `user/questions.js`. Find the course and topic you want to add to, and append an object to the `problems` array.

### Multiple choice problem

```js
{
  type: "mc",
  difficulty: 2,
  question: "The Reynolds number Re = ρVL/μ represents the ratio of:",
  choices: [
    "Inertial forces to viscous forces",   // ← correct answer is always first
    "Pressure forces to gravitational forces",
    "Viscous forces to surface tension forces",
    "Kinetic energy to pressure energy"
  ],
  explanation: "Re = inertial / viscous. Low Re → laminar. High Re → turbulent."
}
```

### Numerical problem (fixed answer)

```js
{
  type: "numerical",
  difficulty: 2,
  question: "Water flows at 2 m/s through a 0.05 m diameter pipe (ρ = 1000 kg/m³, μ = 0.001 Pa·s). What is the Reynolds number?",
  answer: 100000,
  tolerance: 0.01,   // ±1% — omit to use the default of 0.01
  explanation: "Re = ρVD/μ = 1000 × 2 × 0.05 / 0.001 = 100,000."
}
```

### Numerical problem (parametric — randomized numbers)

```js
{
  type: "numerical",
  difficulty: 2,
  question: "Water (ρ = 1000 kg/m³, μ = 0.001 Pa·s) flows at {{V}} m/s through a pipe of diameter {{D}} cm. What is the Reynolds number?",
  params: {
    V: [1, 5],    // random integer in [1, 5] inclusive
    D: [2, 10]    // random integer in [2, 10] inclusive
  },
  answerFn: "(p) => 1000 * p.V * (p.D / 100) / 0.001",
  tolerance: 0.01,
  explanation: "Re = ρVD/μ. Convert D from cm to m (÷100)."
}
```

`answerFn` is a JavaScript arrow function string. `p` is an object whose keys are your parameter names. The function must return the correct numeric answer for the substituted values.

### Difficulty levels

| Value | Meaning |
|-------|---------|
| `1` | Recall / definition |
| `2` | Single-step calculation or application |
| `3` | Multi-step or synthesis |

Difficulty affects scoring in continuous mode: correct answers give `+10 × difficulty` points; wrong answers give `−5 × difficulty` points.

### Optional: source field

Any problem can include an optional `source` field. When present, it is displayed in the feedback panel after the answer is revealed — useful for pointing back to a lecture, textbook chapter, or section.

```js
source: "Lecture 4 — Fluid Statics"
```

---

## Adding a course

Append a new object to the `COURSES` array in `user/questions.js`:

```js
{
  id: "phys101",               // unique string, no spaces
  name: "PHYS 101 — Mechanics",
  color: "#7c3aed",            // hex accent color shown in the UI
  scoringMode: "continuous",   // "continuous" or "streak"
  // masteryThreshold: 4,      // streak mode only: consecutive correct answers needed
  topics: [
    {
      id: "kinematics",
      name: "Kinematics",
      problems: [
        // ... problem objects here
      ]
    }
  ]
}
```

In **continuous** mode, `masteryThreshold` is not used. In **streak** mode, omitting it defaults to... well, define it — it's required for streak mode to function correctly.

### Optional: prerequisites field

Any topic can declare an array of topic IDs that must be sufficiently completed before the topic unlocks:

```js
{
  id: "dynamics",
  name: "Dynamics",
  prerequisites: ["kinematics"],   // topic IDs from the same course
  problems: [ ... ]
}
```

Unlock thresholds by scoring mode:
- **Continuous** — the prerequisite topic's score must be ≥ 60.
- **Streak** — the prerequisite topic must be marked mastered.

A topic with no progress entry is always treated as locked. Every course should have at least one topic with no prerequisites so there is always a free entry point.

---

## Scoring reference

### Continuous mode
| Outcome | d1 | d2 | d3 |
|---------|----|----|-----|
| Correct | +10 | +20 | +30 |
| Wrong | −5 | −10 | −15 |

Score is clamped to [0, 100]. Topic is marked mastered at ≥ 80.

### Streak mode
Correct answers increment the streak. Any wrong answer resets it to 0. Topic is mastered when streak ≥ `masteryThreshold`.

---

## Contributing

Contributions of problem sets for any subject are welcome. The most useful thing you can do is add problems to an existing topic or add new topics/courses for subjects not yet covered.

When contributing problems:
- Make sure `choices[0]` is always the correct answer for MC problems.
- Test parametric problems by mentally substituting a few values to verify `answerFn` is correct.
- Keep `explanation` genuinely useful — it's shown after both correct and incorrect answers and is the primary learning moment.
- Aim for a mix of difficulty levels within each topic.

---

## License

MIT — see `LICENSE`.
