/**
 * MASTERY — PROBLEM BANK
 * ======================
 * This is the only file you need to edit to customize the tool for your courses.
 *
 * HOW TO ADD A COURSE:
 *   Add a new entry to the COURSES array. Each course has:
 *     - id:          unique string identifier (no spaces)
 *     - name:        display name
 *     - color:       hex accent color for the course
 *     - scoringMode: "continuous" | "streak"
 *         continuous — each topic has a 0–100 score; correct answers add points
 *                      (scaled by difficulty), wrong answers subtract points.
 *                      Topic is mastered at 80.
 *         streak     — each topic requires `masteryThreshold` correct answers in
 *                      a row before it is marked mastered. Any wrong answer
 *                      resets the streak to 0.
 *     - masteryThreshold: (streak mode only) consecutive correct answers needed.
 *     - topics:      array of topic objects (see below)
 *
 * HOW TO ADD A TOPIC:
 *   Each topic has:
 *     - id:       unique string within the course (no spaces)
 *     - name:     display name
 *     - problems: array of problem objects (see below)
 *
 * HOW TO ADD A PROBLEM:
 *   Each problem has:
 *     - type:        "mc" (multiple choice) | "numerical"
 *     - difficulty:  1 (recall/definition), 2 (single-step), 3 (multi-step)
 *     - question:    the question text. Use {{PARAM_NAME}} for randomized parameters.
 *     - params:      (optional) object mapping param names to [min, max] integer ranges.
 *                    A random integer in [min, max] inclusive is substituted each time.
 *     - answer:      (numerical, no params) the correct numeric answer.
 *     - answerFn:    (numerical, with params) JS arrow function string: "(p) => value"
 *                    p is an object whose keys are your param names.
 *                    Example: "(p) => p.A + p.B"
 *     - tolerance:   (numerical) fractional tolerance, e.g. 0.01 = ±1%. Default: 0.01.
 *     - choices:     (mc) array of strings. choices[0] is ALWAYS the correct answer;
 *                    the app shuffles them before display.
 *     - explanation: shown after answering, regardless of correct/incorrect.
 *
 * DIFFICULTY SCORING (continuous mode):
 *   Correct:   +10 * difficulty  (d1 → +10, d2 → +20, d3 → +30), capped at 100.
 *   Incorrect: −5  * difficulty  (d1 →  −5, d2 → −10, d3 → −15), floored at 0.
 *
 * STREAK SCORING:
 *   Correct increments the streak. Incorrect resets it to 0.
 *   Once streak >= masteryThreshold, the topic is mastered.
 */

const COURSES = [

  // ─────────────────────────────────────────────────────────────────
  //  EXAMPLE COURSE A — demonstrates continuous scoring mode
  //  Replace this with your own course.
  // ─────────────────────────────────────────────────────────────────
  {
    id: "example-continuous",
    name: "Example Course — Continuous Scoring",
    color: "#2563eb",
    scoringMode: "continuous",
    topics: [
      {
        id: "topic-mc",
        name: "Multiple Choice Examples",
        problems: [
          {
            // Difficulty 1: pure recall
            type: "mc",
            difficulty: 1,
            question: "Which of the following is the SI unit of force?",
            choices: [
              "Newton",       // ← correct answer is always first; app shuffles before display
              "Joule",
              "Pascal",
              "Watt"
            ],
            explanation: "The Newton (N) is the SI unit of force, defined as kg·m/s². Joules are energy, Pascals are pressure, and Watts are power."
          },
          {
            // Difficulty 2: requires application
            type: "mc",
            difficulty: 2,
            question: "A 10 kg object accelerates at 3 m/s². What net force acts on it?",
            choices: [
              "30 N",
              "3.33 N",
              "13 N",
              "0.3 N"
            ],
            explanation: "F = ma = 10 kg × 3 m/s² = 30 N."
          },
          {
            // Difficulty 3: multi-step or synthesis
            type: "mc",
            difficulty: 3,
            question: "An object is thrown upward at 20 m/s. Ignoring air resistance, approximately how long does it take to return to its starting height? (g = 10 m/s²)",
            choices: [
              "4 s",
              "2 s",
              "1 s",
              "20 s"
            ],
            explanation: "Time to peak: t = v/g = 20/10 = 2 s. Total time (up + down) = 4 s. Symmetry of projectile motion: the descent mirrors the ascent."
          }
        ]
      },
      {
        id: "topic-numerical",
        name: "Numerical Examples",
        problems: [
          {
            // Fixed answer (no params)
            type: "numerical",
            difficulty: 1,
            question: "What is the area of a rectangle with width 4 m and height 5 m? (answer in m²)",
            answer: 20,
            tolerance: 0.01,
            explanation: "Area = width × height = 4 × 5 = 20 m²."
          },
          {
            // Parametric: numbers randomize each session
            type: "numerical",
            difficulty: 2,
            question: "A rectangle has width {{W}} m and height {{H}} m. What is its area in m²?",
            params: {
              W: [2, 9],   // random integer from 2 to 9 inclusive
              H: [2, 9]
            },
            answerFn: "(p) => p.W * p.H",
            tolerance: 0.01,
            explanation: "Area = width × height = W × H."
          },
          {
            // Parametric with a more involved answerFn
            type: "numerical",
            difficulty: 3,
            question: "A triangle has base {{B}} m and height {{H}} m. What is its area in m²?",
            params: {
              B: [2, 12],
              H: [2, 12]
            },
            answerFn: "(p) => 0.5 * p.B * p.H",
            tolerance: 0.01,
            explanation: "Area of a triangle = ½ × base × height = 0.5 × B × H."
          }
        ]
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────────
  //  EXAMPLE COURSE B — demonstrates streak scoring mode
  //  Replace this with your own course.
  // ─────────────────────────────────────────────────────────────────
  {
    id: "example-streak",
    name: "Example Course — Streak Scoring",
    color: "#dc2626",
    scoringMode: "streak",
    masteryThreshold: 3,   // 3 correct in a row to master each topic
    topics: [
      {
        id: "topic-streak-demo",
        name: "Streak Mode Demo",
        problems: [
          {
            type: "mc",
            difficulty: 1,
            question: "In streak mode, what happens when you answer a question incorrectly?",
            choices: [
              "The streak resets to 0",
              "The streak decreases by 1",
              "The topic is locked for one session",
              "Nothing — only correct answers affect the streak"
            ],
            explanation: "Any wrong answer resets the streak to 0. You need to build the full streak again from the beginning."
          },
          {
            type: "mc",
            difficulty: 1,
            question: "In this example course, how many consecutive correct answers are needed to master a topic?",
            choices: [
              "3",
              "4",
              "5",
              "10"
            ],
            explanation: "This course has masteryThreshold: 3, so 3 correct answers in a row marks the topic as mastered."
          },
          {
            type: "numerical",
            difficulty: 2,
            question: "If masteryThreshold is 3 and you have a streak of 2, how many more correct answers do you need to master the topic?",
            answer: 1,
            tolerance: 0.01,
            explanation: "3 − 2 = 1. One more correct answer in a row reaches the threshold."
          }
        ]
      }
    ]
  }

];

// Export for Node.js compatibility (used for validation scripts and tooling).
// The browser ignores this — `module` is undefined in a browser context.
if (typeof module !== "undefined") module.exports = { COURSES };
