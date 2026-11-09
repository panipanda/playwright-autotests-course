'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, loadCourse } = require('./load');
const PW = require('../js/runner.js');
const SB = require('../js/sandbox.js');

const { COURSE, CARDS, GLOSS, WIDGETS, LABS, SCENES, SOURCES, SNIPPETS } = loadCourse();
const FULL = process.env.COURSE_STAGE !== 'partial';

test('modules have unique ids in order', () => {
  const ids = Array.from(COURSE, m => m.id);
  assert.deepEqual(ids, ids.map((_, i) => 'm' + (i + 1)));
  if (FULL) assert.equal(COURSE.length, 12);
});

test('every module has the required parts', () => {
  for (const m of COURSE) {
    for (const k of ['short', 'title', 'lead', 'body']) assert.ok(typeof m[k] === 'string' && m[k].length > 0, m.id + ' ' + k);
    for (const k of ['learn', 'takeaways', 'quiz']) assert.ok(Array.isArray(m[k]) && m[k].length > 0, m.id + ' ' + k);
    assert.ok(m.minutes > 0, m.id + ' minutes');
    const p = m.practice;
    assert.ok(p && p.id && p.title && p.brief && p.template && p.model, m.id + ' practice');
    assert.ok(typeof p.template === 'string' || (p.template.py && p.template.kt), m.id + ' template needs both languages');
    assert.ok(Array.isArray(p.checks) && p.checks.length > 0, m.id + ' checks');
  }
});

test('practice ids are unique', () => {
  const ids = COURSE.map(m => m.practice.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every {{w:}}, {{lab:}} and {{watch:}} points to something that exists, and nothing is unused', () => {
  const usedW = new Set(), usedL = new Set(), usedS = new Set();
  for (const m of COURSE) {
    for (const mt of m.body.matchAll(/\{\{w:([\w-]+)\}\}/g)) { assert.ok(WIDGETS[mt[1]], m.id + ' trainer ' + mt[1]); usedW.add(mt[1]); }
    for (const mt of m.body.matchAll(/\{\{lab:([\w-]+)\}\}/g)) { assert.ok(LABS[mt[1]], m.id + ' lab ' + mt[1]); usedL.add(mt[1]); }
    for (const mt of m.body.matchAll(/\{\{watch:([\w-]+)\}\}/g)) { assert.ok(SCENES[mt[1]], m.id + ' scene ' + mt[1]); usedS.add(mt[1]); }
  }
  assert.deepEqual([...usedW].sort(), Object.keys(WIDGETS).filter(k => usedW.has(k)).sort());
  for (const n of Object.keys(WIDGETS)) { assert.equal(typeof WIDGETS[n].init, 'function', n); assert.ok(WIDGETS[n].title, n); assert.ok(usedW.has(n), 'trainer ' + n + ' is not used by any module'); }
  for (const n of Object.keys(LABS)) assert.ok(usedL.has(n), 'lab ' + n + ' is not used by any module');
  for (const n of Object.keys(SCENES)) assert.ok(usedS.has(n), 'scene ' + n + ' is not used by any module');
});

test('quiz questions are well formed', () => {
  for (const m of COURSE) {
    for (const q of m.quiz) {
      const t = q.type || 'mc';
      assert.ok(q.q && q.why, m.id + ' question needs text and an explanation');
      if (t === 'mc') {
        assert.ok(Array.isArray(q.o) && q.o.length >= 2, m.id + ' mc options');
        assert.ok(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length, m.id + ' mc answer index');
        assert.equal(new Set(q.o).size, q.o.length, m.id + ' duplicate options');
      } else if (t === 'multi') {
        assert.ok(Array.isArray(q.o) && q.o.length >= 3, m.id + ' multi options');
        assert.ok(Array.isArray(q.a) && q.a.length >= 2 && q.a.length < q.o.length && q.a.every(i => Number.isInteger(i) && i >= 0 && i < q.o.length), m.id + ' multi answers');
        assert.equal(new Set(q.o).size, q.o.length, m.id + ' duplicate options');
      } else if (t === 'fill') {
        assert.ok(Array.isArray(q.ans) && q.ans.length >= 1 && q.ans.every(a => typeof a === 'string' && a.trim()), m.id + ' fill answers');
      } else if (t === 'num') {
        assert.equal(typeof q.ans, 'number', m.id + ' num answer');
      } else if (t === 'order') {
        assert.ok(Array.isArray(q.items) && q.items.length >= 2, m.id + ' order items');
      } else {
        assert.fail(m.id + ' unknown question type ' + t);
      }
    }
  }
});

test('answer key did not change while editing the text', () => {
  const key = {};
  for (const m of COURSE) key[m.id] = Array.from(m.quiz, q => { const t = q.type || 'mc'; return t === 'mc' ? 'mc' + q.a : t === 'multi' ? 'multi' + q.a.join('') : t === 'fill' ? 'fill' + q.ans.length : t === 'num' ? 'num' + q.ans : 'order' + q.items.length; });
  const file = path.join(__dirname, 'answer-key.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(key, null, 1) + '\n');
  const known = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const id of Object.keys(key)) if (known[id]) assert.deepEqual(key[id], known[id], id + ' answer key changed');
  if (FULL) assert.deepEqual(Object.keys(key), Object.keys(known));
});

test('steps have a "do" and a "why", and language-only steps are marked', () => {
  let total = 0;
  for (const m of COURSE) {
    for (const mt of m.body.matchAll(/<li class="step"( data-l="(py|kt)")?>(.*?)<\/li>/gs)) {
      total++;
      assert.match(mt[3], /<b>Do<\/b>/, m.id);
      assert.match(mt[3], /<b>Why<\/b>/, m.id);
    }
  }
  assert.ok(total >= 20, 'only ' + total + ' steps');
});

test('every module that uses steps has them for both tracks', () => {
  for (const m of COURSE) {
    const py = (m.body.match(/<li class="step" data-l="py">/g) || []).length, kt = (m.body.match(/<li class="step" data-l="kt">/g) || []).length;
    if (py || kt) assert.ok(py > 0 && kt > 0, m.id + ' has steps for only one track');
  }
});

test('code blocks come in pairs: every Python block is matched by a Kotlin block', () => {
  for (const m of COURSE) {
    const body = m.body + m.practice.model + (m.practice.brief || '');
    const py = (body.match(/<div class="codeblock" data-l="py">/g) || []).length, kt = (body.match(/<div class="codeblock" data-l="kt">/g) || []).length;
    const stepsOnly = (body.match(/<li class="step" data-l="(py|kt)">.*?<\/li>/gs) || []).join('');
    const pyStep = (stepsOnly.match(/<div class="codeblock" data-l="py">/g) || []).length, ktStep = (stepsOnly.match(/<div class="codeblock" data-l="kt">/g) || []).length;
    assert.equal(py - pyStep, kt - ktStep, m.id + ': Python and Kotlin code blocks outside language-only steps must match');
  }
});

test('labs are complete, and every solution passes in both languages', () => {
  for (const id of Object.keys(LABS)) {
    const l = LABS[id];
    assert.ok(SB[l.app], id + ' app ' + l.app);
    for (const k of ['title', 'goal']) assert.ok(l[k], id + ' ' + k);
    for (const lang of ['py', 'kt']) {
      assert.ok(l.starter[lang] != null && l.solution[lang], id + ' ' + lang + ' starter and solution');
      const g = PW.grade(SB[l.app], l.solution[lang], lang, l.checks, l.cfg);
      assert.equal(g.result.error, null, id + ' ' + lang + ': ' + (g.result.error && g.result.error.text));
      const failed = g.rows.filter(r => !r.ok).map(r => r.t);
      assert.equal(failed.length, 0, id + ' ' + lang + ' solution fails checks: ' + failed.join('; '));
      assert.equal(g.passed, true, id + ' ' + lang);
      /* the starter alone must not pass */
      const s = PW.grade(SB[l.app], l.starter[lang], lang, l.checks, l.cfg);
      assert.equal(s.passed, false, id + ' ' + lang + ' starter must not pass already');
    }
    assert.ok(Array.isArray(l.hints) && l.hints.length >= 2, id + ' hints');
    assert.ok(l.checks.length >= 3 && l.checks.every(c => c.t && c.k), id + ' checks');
  }
});

test('scenes have both languages and their code runs', () => {
  for (const id of Object.keys(SCENES)) {
    const s = SCENES[id];
    assert.ok(s.title && s.steps.length >= 3, id);
    for (const lang of ['py', 'kt']) {
      s.steps.forEach((st, i) => { assert.ok(st[lang] && st.say, id + ' step ' + (i + 1) + ' ' + lang); });
      if (s.run === false) continue;
      assert.ok(SB[s.app], id + ' app');
      const codes = [''];
      s.steps.forEach((st, i) => codes.push(st.full || !codes[i] ? st[lang] : codes[i] + '\n' + st[lang]));
      codes.slice(1).forEach((c, i) => {
        const r = PW.run(SB[s.app], c, lang);
        /* a step may fail on purpose, but it has to say so in its text */
        if (r.error) assert.match(s.steps[i].say, /error|fail|refus|strict|not|cannot/i, id + ' step ' + (i + 1) + ' fails without saying so: ' + r.error.text);
      });
      assert.equal(PW.run(SB[s.app], codes[codes.length - 1], lang).error, null, id + ' ' + lang + ' the final code must work');
    }
  }
});

const EX = {
  deps: { py: 'python/requirements.txt', kt: 'kotlin/build.gradle.kts' },
  first: { py: 'python/tests/test_first.py', kt: 'kotlin/src/test/kotlin/course/FirstTest.kt' },
  base: { kt: 'kotlin/src/test/kotlin/course/BaseTest.kt' },
  locators: { py: 'python/tests/test_locators.py', kt: 'kotlin/src/test/kotlin/course/LocatorsTest.kt' },
  actions: { py: 'python/tests/test_actions.py', kt: 'kotlin/src/test/kotlin/course/ActionsTest.kt' }
};
const clean = s => s.replace(/\r/g, '').replace(/[ \t]+$/gm, '').trim();
test('code in the course that is tagged with ex: is exactly the code in examples/', () => {
  assert.ok(SNIPPETS.filter(s => s.ex).length >= 5);
  for (const s of SNIPPETS.filter(x => x.ex)) {
    const map = EX[s.ex]; assert.ok(map, 'unknown example tag ' + s.ex);
    for (const lang of ['py', 'kt']) {
      if (!s[lang]) continue;
      const file = path.join(root, 'examples', map[lang]);
      assert.ok(fs.existsSync(file), file);
      assert.equal(clean(s[lang]), clean(fs.readFileSync(file, 'utf8')), s.ex + ' (' + lang + ') differs from ' + map[lang]);
    }
  }
});

test('flashcards: unique ids, question and answer present', { skip: !FULL }, () => {
  const ids = CARDS.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(CARDS.length, 20);
  for (const c of CARDS) assert.ok(c.tag && c.q && c.a, c.id);
});

test('glossary: unique terms with a definition', { skip: !FULL }, () => {
  assert.ok(GLOSS.length >= 55);
  const terms = GLOSS.map(g => g.en);
  assert.equal(new Set(terms).size, terms.length);
  for (const g of GLOSS) assert.ok(g.en && g.d, g.en);
});

test('every module has https sources', { skip: !FULL }, () => {
  for (const m of COURSE) {
    const list = SOURCES[m.id];
    assert.ok(Array.isArray(list) && list.length > 0, m.id + ' sources');
    for (const s of list) assert.ok(s.t && /^https:\/\//.test(s.u), m.id + ' ' + s.u);
  }
});
