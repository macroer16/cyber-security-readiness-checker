// Browser UI. All scoring logic lives in assessment.js so it can be tested separately.
import { QUESTIONS, CONTROLS, scoreAssessment, actionPlanText } from './assessment.js';

const OPTIONS = [
  ['yes', 'Yes'],
  ['partly', 'Partly'],
  ['no', 'No'],
  ['unsure', 'Not sure'],
];
const HISTORY_KEY = 'csrc-history-v1';

const form = document.getElementById('assessment');
const groups = document.getElementById('question-groups');
const progress = document.getElementById('progress');
const formError = document.getElementById('form-error');
const results = document.getElementById('results');
let lastResult = null;

// Build the questions, grouped by control area, numbered in the order shown.
let number = 0;
for (const [key, name] of Object.entries(CONTROLS)) {
  const qs = QUESTIONS.filter((q) => q.control === key);
  const group = document.createElement('div');
  group.className = 'group';
  group.innerHTML = `<h2 class="group-title">${name}</h2>`;
  for (const q of qs) {
    number += 1;
    const n = number;
    const fs = document.createElement('fieldset');
    fs.className = 'question';
    fs.dataset.id = q.id;
    fs.innerHTML = `
      <legend><span class="qnum">${n}.</span> ${q.text}</legend>
      <p class="why">${q.why}</p>
      <div class="choices">
        ${OPTIONS.map(([value, label]) => `
          <label class="choice">
            <input type="radio" name="${q.id}" value="${value}" required>
            <span>${label}</span>
          </label>`).join('')}
      </div>`;
    group.appendChild(fs);
  }
  groups.appendChild(group);
}

function currentAnswers() {
  const data = new FormData(form);
  return Object.fromEntries(QUESTIONS.filter((q) => data.get(q.id)).map((q) => [q.id, data.get(q.id)]));
}

form.addEventListener('change', () => {
  const count = Object.keys(currentAnswers()).length;
  progress.textContent = `${count} of ${QUESTIONS.length} answered`;
  formError.hidden = true;
  document.querySelectorAll('.question.missing').forEach((el) => {
    if (currentAnswers()[el.dataset.id]) el.classList.remove('missing');
  });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const answers = currentAnswers();
  const missing = QUESTIONS.filter((q) => !answers[q.id]);
  if (missing.length) {
    missing.forEach((q) => document.querySelector(`.question[data-id="${q.id}"]`).classList.add('missing'));
    formError.textContent = `Answer all 10 questions to see your results. ${missing.length} left. If you don't know, choose "Not sure".`;
    formError.hidden = false;
    document.querySelector(`.question[data-id="${missing[0].id}"] input`).focus();
    return;
  }
  lastResult = scoreAssessment(answers);
  showResults(lastResult);
  saveToHistory(lastResult);
});

function showResults(r) {
  document.getElementById('score-number').textContent = r.score;
  const level = document.getElementById('score-level');
  level.textContent = r.level;
  level.dataset.band = r.score >= 85 ? 'good' : r.score >= 60 ? 'fair' : r.score >= 35 ? 'weak' : 'poor';

  document.getElementById('breakdown').innerHTML = r.byControl.map((c) => `
    <li>
      <span class="area">${c.name}</span>
      <span class="bar" role="img" aria-label="${c.percent}%"><span style="width:${c.percent}%" data-band="${band(c.percent)}"></span></span>
      <span class="pct">${c.percent}%</span>
    </li>`).join('');

  document.getElementById('actions').innerHTML = r.gaps.length
    ? r.gaps.map((g) => `<li><strong>${g.action}</strong><span>${g.why}</span></li>`).join('')
    : '<li><strong>No gaps found.</strong><span>Review these controls every 6 months and keep testing your backups.</span></li>';

  form.hidden = true;
  results.hidden = false;
  results.focus();
}

function band(p) {
  return p >= 85 ? 'good' : p >= 60 ? 'fair' : p >= 35 ? 'weak' : 'poor';
}

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}

function saveToHistory(r) {
  const entries = [{ date: new Date().toISOString(), score: r.score, level: r.level }, ...readHistory()].slice(0, 10);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch { /* storage unavailable */ }
  renderHistory();
}

function renderHistory() {
  const entries = readHistory();
  const section = document.getElementById('history');
  section.hidden = entries.length === 0;
  document.getElementById('history-rows').innerHTML = entries.map((e) => `
    <tr><td>${new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
    <td>${e.score}/100</td><td>${e.level}</td></tr>`).join('');
}

document.getElementById('download').addEventListener('click', () => {
  if (!lastResult) return;
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const blob = new Blob([actionPlanText(lastResult, date)], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cyber-action-plan-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('print').addEventListener('click', () => window.print());

document.getElementById('restart').addEventListener('click', () => {
  form.reset();
  progress.textContent = `0 of ${QUESTIONS.length} answered`;
  results.hidden = true;
  form.hidden = false;
  form.querySelector('input').focus();
});

document.getElementById('clear-history').addEventListener('click', () => {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
  renderHistory();
});

renderHistory();
