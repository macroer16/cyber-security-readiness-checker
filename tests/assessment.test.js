import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS, MAX_POINTS, CONTROLS, scoreAssessment, levelFor, controlBreakdown, actionPlanText,
} from '../src/assessment.js';

const all = (answer) => Object.fromEntries(QUESTIONS.map((q) => [q.id, answer]));

test('every question has an id, a known control, a positive weight and advice', () => {
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(q.id && !ids.has(q.id), `duplicate or missing id: ${q.id}`);
    ids.add(q.id);
    assert.ok(q.control in CONTROLS, `unknown control on ${q.id}`);
    assert.ok(q.weight > 0);
    assert.ok(q.text && q.why && q.action);
  }
});

test('all "yes" scores 100 with no gaps', () => {
  const r = scoreAssessment(all('yes'));
  assert.equal(r.score, 100);
  assert.equal(r.gaps.length, 0);
  assert.equal(r.level, 'Strong foundation');
});

test('all "no" scores 0 and lists every question as a gap', () => {
  const r = scoreAssessment(all('no'));
  assert.equal(r.score, 0);
  assert.equal(r.gaps.length, QUESTIONS.length);
  assert.equal(r.level, 'High risk');
});

test('"unsure" counts the same as "no"', () => {
  assert.equal(scoreAssessment(all('unsure')).score, scoreAssessment(all('no')).score);
});

test('"partly" everywhere scores 50', () => {
  assert.equal(scoreAssessment(all('partly')).score, 50);
});

test('unanswered questions score zero but are not counted as answered', () => {
  const r = scoreAssessment({ mfa: 'yes' });
  assert.equal(r.answered, 1);
  assert.equal(r.score, Math.round((3 / MAX_POINTS) * 100));
});

test('weights matter: missing MFA costs more than missing a firewall', () => {
  const noMfa = scoreAssessment({ ...all('yes'), mfa: 'no' }).score;
  const noFirewall = scoreAssessment({ ...all('yes'), firewall: 'no' }).score;
  assert.ok(noMfa < noFirewall);
});

test('gaps are ordered biggest risk first', () => {
  const r = scoreAssessment({ ...all('yes'), firewall: 'no', backups: 'no', admin: 'partly' });
  assert.deepEqual(r.gaps.map((g) => g.id), ['backups', 'admin', 'firewall']);
});

test('an unknown answer is rejected', () => {
  assert.throws(() => scoreAssessment({ mfa: 'maybe' }), /Unknown answer/);
});

test('level bands', () => {
  assert.equal(levelFor(85), 'Strong foundation');
  assert.equal(levelFor(84), 'Good start, with gaps to fix');
  assert.equal(levelFor(60), 'Good start, with gaps to fix');
  assert.equal(levelFor(35), 'Needs improvement');
  assert.equal(levelFor(34), 'High risk');
});

test('control breakdown covers every control area', () => {
  const b = controlBreakdown({ ...all('yes'), patching: 'no' });
  assert.equal(b.length, Object.keys(CONTROLS).length);
  assert.equal(b.find((c) => c.key === 'patching').percent, 0);
  assert.equal(b.find((c) => c.key === 'backups').percent, 100);
});

test('action plan lists actions in priority order', () => {
  const r = scoreAssessment({ ...all('yes'), firewall: 'no', backups: 'no' });
  const text = actionPlanText(r, '11 October 2026');
  assert.match(text, /Score: \d+\/100/);
  assert.ok(text.indexOf('Back up important data') < text.indexOf("Check the router's firewall"));
});

test('action plan for a perfect score says there are no gaps', () => {
  assert.match(actionPlanText(scoreAssessment(all('yes')), 'today'), /No gaps found/);
});
