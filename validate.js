#!/usr/bin/env node
'use strict';

let COURSES;
try {
  ({ COURSES } = require('./user/questions.js'));
} catch (e) {
  console.error('[ERROR] Could not load user/questions.js:', e.message);
  process.exit(1);
}

if (!Array.isArray(COURSES)) {
  console.error('[ERROR] user/questions.js did not export a valid COURSES array.');
  process.exit(1);
}

// Each issue: { type, courseId?, topicId?, problemNum?, problemType?, msg }
const issues = [];
function error(loc, msg) { issues.push({ type: 'error', ...loc, msg }); }
function warn(loc, msg)  { issues.push({ type: 'warn',  ...loc, msg }); }

const G = {}; // global scope — no courseId

// ── Global: duplicate course IDs ───────────────────────────────────────────

const seenCourseIds = new Set();
const dupCourseIds  = new Set();
for (const c of COURSES) {
  if (seenCourseIds.has(c.id)) dupCourseIds.add(c.id);
  seenCourseIds.add(c.id);
}
if (dupCourseIds.size > 0) {
  error(G, `duplicate course IDs: ${[...dupCourseIds].map(id => `"${id}"`).join(', ')}`);
}

// ── Per-course ─────────────────────────────────────────────────────────────

for (const course of COURSES) {
  const C      = { courseId: course.id, courseName: course.name };
  const topics = Array.isArray(course.topics) ? course.topics : [];

  // Duplicate topic IDs
  const seenTopicIds = new Set();
  const dupTopicIds  = new Set();
  for (const t of topics) {
    if (seenTopicIds.has(t.id)) dupTopicIds.add(t.id);
    seenTopicIds.add(t.id);
  }
  if (dupTopicIds.size > 0) {
    error(C, `duplicate topic IDs: ${[...dupTopicIds].map(id => `"${id}"`).join(', ')}`);
  }

  // scoringMode
  if (!['continuous', 'streak'].includes(course.scoringMode)) {
    error(C, `scoringMode must be "continuous" or "streak", got ${JSON.stringify(course.scoringMode)}`);
  }

  // masteryThreshold for streak mode
  if (course.scoringMode === 'streak') {
    if (!Number.isInteger(course.masteryThreshold) || course.masteryThreshold < 1) {
      error(C, `scoringMode is "streak" but masteryThreshold is missing or not a positive integer`);
    }
  }

  // sm2.sessionSize when sm2 is enabled
  if (course.sm2 && course.sm2.enabled === true) {
    if (!Number.isInteger(course.sm2.sessionSize) || course.sm2.sessionSize < 1) {
      error(C, `sm2.enabled is true but sm2.sessionSize is missing or not a positive integer`);
    }
  }

  // No entry point (warn)
  if (topics.length > 0 && !topics.some(t => !t.prerequisites || t.prerequisites.length === 0)) {
    warn(C, `every topic has prerequisites — there is no entry point for this course`);
  }

  // ── Per-topic ────────────────────────────────────────────────────────────

  for (const topic of topics) {
    const T        = { ...C, topicId: topic.id, topicName: topic.name };
    const problems = Array.isArray(topic.problems) ? topic.problems : [];

    // Prerequisites reference unknown topic IDs
    for (const prereqId of (topic.prerequisites || [])) {
      if (!seenTopicIds.has(prereqId)) {
        error(T, `prerequisites references unknown topic ID "${prereqId}"`);
      }
    }

    // Fewer than 2 problems (warn)
    if (problems.length < 2) {
      warn(T, `only ${problems.length} problem(s) — add more for variety`);
    }

    // ── Per-problem ──────────────────────────────────────────────────────

    for (let i = 0; i < problems.length; i++) {
      const p = problems[i];
      const P = { ...T, problemNum: i + 1, problemType: p.type };

      // type
      if (!['mc', 'numerical'].includes(p.type)) {
        error(P, `type must be "mc" or "numerical", got ${JSON.stringify(p.type)}`);
      }

      // difficulty
      if (![1, 2, 3].includes(p.difficulty)) {
        error(P, `difficulty must be 1, 2, or 3, got ${JSON.stringify(p.difficulty)}`);
      }

      // question
      if (!p.question || typeof p.question !== 'string' || p.question.trim() === '') {
        error(P, `question is missing or empty`);
      }

      // explanation (warn — optional but strongly recommended)
      if (!p.explanation) {
        warn(P, `explanation is missing`);
      }

      // MC-specific
      if (p.type === 'mc') {
        if (!p.choices || !Array.isArray(p.choices)) {
          error(P, `choices is missing or not an array`);
        } else if (p.choices.length < 2) {
          error(P, `choices has fewer than 2 entries (has ${p.choices.length})`);
        } else if (p.choices.length > 6) {
          warn(P, `choices has ${p.choices.length} entries — more than 6 is unusual`);
        }
      }

      // Numerical-specific
      if (p.type === 'numerical') {
        if (p.answer === undefined && p.answerFn === undefined) {
          error(P, `no answer or answerFn`);
        }
        if (p.params !== undefined && p.answerFn === undefined) {
          error(P, `params is present but answerFn is missing`);
        }
        if (p.answerFn !== undefined) {
          try {
            new Function('p', `return (${p.answerFn})(p)`);
          } catch (e) {
            error(P, `answerFn cannot be parsed as a valid function: ${e.message}`);
          }
        }
        if (p.tolerance !== undefined && p.tolerance > 0.5) {
          warn(P, `tolerance is ${p.tolerance} (±${(p.tolerance * 100).toFixed(0)}%) — this seems too high`);
        }
      }
    }
  }
}

// ── Output ─────────────────────────────────────────────────────────────────

const lbl = type => type === 'error' ? '[ERROR]' : '[WARN] ';

// Global issues (no courseId)
for (const issue of issues.filter(i => !i.courseId)) {
  console.log(`${lbl(issue.type)} ${issue.msg}`);
}

// Per-course, preserving COURSES order
for (const course of COURSES) {
  const courseIssues = issues.filter(i => i.courseId === course.id);
  if (courseIssues.length === 0) continue;

  console.log(`\nCourse: ${course.name}`);

  for (const issue of courseIssues.filter(i => !i.topicId)) {
    console.log(`  ${lbl(issue.type)} ${issue.msg}`);
  }

  const topics = Array.isArray(course.topics) ? course.topics : [];
  for (const topic of topics) {
    const topicIssues = courseIssues.filter(i => i.topicId === topic.id);
    if (topicIssues.length === 0) continue;

    console.log(`\n  Topic: ${topic.name}`);

    for (const issue of topicIssues.filter(i => i.problemNum == null)) {
      console.log(`    ${lbl(issue.type)} ${issue.msg}`);
    }

    const numProblems = Array.isArray(topic.problems) ? topic.problems.length : 0;
    for (let pi = 1; pi <= numProblems; pi++) {
      const probIssues = topicIssues.filter(i => i.problemNum === pi);
      if (probIssues.length === 0) continue;

      const pType = probIssues[0].problemType || 'unknown';
      console.log(`\n    Problem ${pi} (${pType}):`);
      for (const issue of probIssues) {
        console.log(`      ${lbl(issue.type)} ${issue.msg}`);
      }
    }
  }
}

// Summary
const errorCount = issues.filter(i => i.type === 'error').length;
const warnCount  = issues.filter(i => i.type === 'warn').length;

console.log();
if (errorCount === 0 && warnCount === 0) {
  console.log('All good.');
} else {
  console.log(`${errorCount} error(s), ${warnCount} warning(s) found.`);
}

process.exit(errorCount > 0 ? 1 : 0);
