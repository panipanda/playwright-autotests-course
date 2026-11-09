'use strict';
/* Pure functions: no DOM access. Loaded as a plain script in the browser and with require() in Node tests.
   Holds the HTML helpers used by the course text, the answer checking and the progress state logic. */

/* ===== HTML helpers used by the course text ===== */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tbl = (head, rows) => '<div class="tbl"><table><thead><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
const co = (title, txt, warn) => `<div class="callout${warn ? ' warn' : ''}"><b>${title}</b>${txt}</div>`;

/* Text that differs by language. Both versions are in the page, and CSS shows the one that matches body[data-lang]. */
const L = (py, kt) => `<span data-l="py">${py}</span><span data-l="kt">${kt}</span>`;
const LB = (py, kt) => `<div data-l="py">${py}</div><div data-l="kt">${kt}</div>`;

/* Every code block that has an `ex` tag is recorded here, so a test can check it against the files in examples/. */
const SNIPPETS = [];
let CID = 0;
function codeOne(lang, src, file, label) {
  const id = 'cb' + (++CID);
  const attr = lang ? ` data-l="${lang}"` : '';
  const name = file || label || (lang === 'py' ? 'Python' : lang === 'kt' ? 'Kotlin' : 'Code');
  const body = lang && label !== 'Terminal' && typeof PW !== 'undefined' ? PW.highlight(src, lang) : esc(src);
  return `<div class="codeblock"${attr}><div class="cb-head"><span>${esc(name)}</span><button class="btn ghost sm" data-copy="${id}" aria-label="Copy ${esc(name)}">Copy</button></div><pre class="cb" id="${id}" tabindex="0"><code>${body}</code></pre></div>`;
}
/* code({py, kt, file:{py, kt}}) shows the block for the chosen language. code({all}) shows one block for both.
   sh(...) is the same for terminal commands. */
function code(o) {
  if (o.ex) SNIPPETS.push({ ex: o.ex, py: o.py || '', kt: o.kt || '', all: o.all || '' });
  if (o.all != null) return codeOne('', o.all, o.file, o.label);
  const f = o.file || {};
  return (o.py != null ? codeOne('py', o.py, f.py, o.label) : '') + (o.kt != null ? codeOne('kt', o.kt, f.kt, o.label) : '');
}
const sh = o => code(Object.assign({ label: 'Terminal' }, typeof o === 'string' ? { all: o } : o));

/* A step-by-step instruction. Each step: do (what), why (the reason), code (optional, ready HTML from code() or sh()), see (the expected result), lang (optional: show for one language only).
   The checkbox state is stored under "<module id>:s<number>". */
function steps(mod, list) {
  return '<ol class="steps">' + list.map((s, i) => {
    const id = mod + ':s' + (i + 1);
    const c = s.code || '';
    return `<li class="step"${s.lang ? ` data-l="${s.lang}"` : ''}><label class="st-head"><input type="checkbox" data-step="${id}"><span class="st-do"><b>Do</b> ${s.do}</span></label>${c}<p class="st-why"><b>Why</b> ${s.why}</p>${s.see ? `<p class="st-see"><b>You should see</b> ${s.see}</p>` : ''}</li>`;
  }).join('') + '</ol>';
}

/* A numeric answer may use a dot or a comma as the decimal separator. Returns NaN when it is not a plain number. */
function parseNum(s) {
  const t = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(',', '.');
  return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) ? parseFloat(t) : NaN;
}
const fmt = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ===== answer checking ===== */
/* A short typed answer is compared without case, quotes, backticks and extra spaces. */
function normFill(s) { return String(s == null ? '' : s).toLowerCase().replace(/[`"']/g, '').replace(/\s+/g, ' ').trim(); }
function fillOk(input, accepted) { const n = normFill(input); return n !== '' && accepted.some(a => normFill(a) === n); }
/* A multiple-choice question with several right options is correct only when the chosen set equals the right set. */
function sameSet(a, b) {
  const x = new Set(a), y = new Set(b);
  return x.size === y.size && [...x].every(v => y.has(v));
}

/* ===== progress state: shape, sanitizing, export, import, merge ===== */
const APP_ID = 'playwright-autotests-course';
const LS_KEY = 'playwright-autotests-course.v1';
const LIMITS = { keys: 400, note: 20000, file: 2000000, quizTotal: 200 };
const KEY_RE = /^[A-Za-z0-9_:-]{1,40}$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const LANGS = ['py', 'kt'];
const fresh = () => ({ v: 1, lang: 'py', done: {}, quiz: {}, qprog: {}, notes: {}, cards: {}, steps: {}, labs: {}, last: '', ts: 0 });

function clampInt(n, lo, hi) { n = Math.floor(+n); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; }
function clampTs(n) { n = +n; return isFinite(n) && n > 0 && n < 4e12 ? Math.floor(n) : 0; }
function eachKey(obj, fn) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  let n = 0;
  for (const k of Object.keys(obj)) {
    if (!KEY_RE.test(k) || BAD_KEYS.has(k)) continue;
    if (++n > LIMITS.keys) break;
    fn(k, obj[k]);
  }
}
/* Returns a clean copy of a state object, or null when the input does not have the expected shape. Unknown keys and oversized values are dropped. */
function sanitizeState(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return null;
  const s = fresh();
  if (LANGS.includes(o.lang)) s.lang = o.lang;
  eachKey(o.done, (k, v) => { if (v) s.done[k] = true; });
  eachKey(o.steps, (k, v) => { if (v) s.steps[k] = true; });
  eachKey(o.labs, (k, v) => {
    if (!v || typeof v !== 'object') return;
    const e = { ts: clampTs(v.ts) };
    LANGS.forEach(l => { if (v[l]) e[l] = 1; });
    if (e.py || e.kt) s.labs[k] = e;
  });
  eachKey(o.quiz, (k, v) => {
    if (!v || typeof v !== 'object') return;
    const total = clampInt(v.total, 1, LIMITS.quizTotal), best = clampInt(v.best, 0, total);
    s.quiz[k] = { best, total, last: clampInt(v.last == null ? best : v.last, 0, total) };
  });
  eachKey(o.qprog, (k, v) => { if (typeof v === 'string' && /^[cw-]{1,100}$/.test(v)) s.qprog[k] = v; });
  eachKey(o.notes, (k, v) => { if (v && typeof v === 'object' && typeof v.t === 'string' && v.t.length <= LIMITS.note) s.notes[k] = { t: v.t, ts: clampTs(v.ts) }; });
  eachKey(o.cards, (k, v) => { if (v && typeof v === 'object' && (v.k === 1 || v.k === 2)) s.cards[k] = { k: v.k, ts: clampTs(v.ts) }; });
  if (typeof o.last === 'string' && KEY_RE.test(o.last) && !BAD_KEYS.has(o.last)) s.last = o.last;
  s.ts = clampTs(o.ts);
  return s;
}
function serializeState(state, now) {
  const clean = sanitizeState(state) || fresh();
  return JSON.stringify({ app: APP_ID, v: 1, exported: new Date(now == null ? Date.now() : now).toISOString(), state: clean }, null, 1);
}
/* Parses the text of an exported file. Never throws. */
function parseImport(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
  if (text.length > LIMITS.file) return { ok: false, error: 'The file is too large.' };
  let o;
  try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'The file is not valid JSON.' }; }
  if (!o || typeof o !== 'object' || o.app !== APP_ID) return { ok: false, error: 'This is not a progress file from this course.' };
  if (o.v !== 1) return { ok: false, error: 'This file version is not supported.' };
  const s = sanitizeState(o.state);
  if (!s) return { ok: false, error: 'The progress data in the file is malformed.' };
  return { ok: true, state: s };
}
const answered = str => (str || '').replace(/-/g, '').length;
function mergeNewer(x, y) {
  const out = {};
  new Set(Object.keys(x || {}).concat(Object.keys(y || {}))).forEach(k => {
    const p = (x || {})[k], q = (y || {})[k];
    out[k] = !p ? q : (!q ? p : ((q.ts || 0) >= (p.ts || 0) ? q : p));
  });
  return out;
}
/* Merge keeps the best of both sides and never loses a finished module, a ticked step or a passed lab. b wins ties. */
function mergeStates(a, b) {
  const out = fresh();
  out.done = Object.assign({}, a.done, b.done);
  out.steps = Object.assign({}, a.steps, b.steps);
  new Set(Object.keys(a.labs || {}).concat(Object.keys(b.labs || {}))).forEach(k => {
    const x = (a.labs || {})[k] || {}, y = (b.labs || {})[k] || {};
    const e = { ts: Math.max(x.ts || 0, y.ts || 0) };
    LANGS.forEach(l => { if (x[l] || y[l]) e[l] = 1; });
    out.labs[k] = e;
  });
  new Set(Object.keys(a.quiz || {}).concat(Object.keys(b.quiz || {}))).forEach(k => {
    const x = (a.quiz || {})[k], y = (b.quiz || {})[k];
    out.quiz[k] = !x ? y : (!y ? x : ((y.best || 0) >= (x.best || 0) ? y : x));
  });
  new Set(Object.keys(a.qprog || {}).concat(Object.keys(b.qprog || {}))).forEach(k => {
    const x = (a.qprog || {})[k], y = (b.qprog || {})[k];
    out.qprog[k] = !x ? y : (!y ? x : (answered(y) >= answered(x) ? y : x));
  });
  out.notes = mergeNewer(a.notes, b.notes);
  out.cards = mergeNewer(a.cards, b.cards);
  out.ts = Math.max(a.ts || 0, b.ts || 0);
  /* The language and the last module come from the side that was used more recently. */
  const bNewer = (b.ts || 0) >= (a.ts || 0);
  out.last = bNewer ? (b.last || a.last || '') : (a.last || b.last || '');
  out.lang = bNewer ? (b.lang || a.lang) : (a.lang || b.lang);
  return out;
}
function doneCount(state, ids) { return ids.filter(id => state.done[id]).length; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { esc, tbl, co, L, LB, code, sh, steps, SNIPPETS, parseNum, fmt, normFill, fillOk, sameSet, APP_ID, LS_KEY, LIMITS, LANGS, fresh, sanitizeState, serializeState, parseImport, mergeStates, answered, doneCount };
}
