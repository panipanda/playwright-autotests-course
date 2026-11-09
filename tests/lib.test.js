'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/lib.js');

test('L() puts both languages in the page', () => {
  const h = L.L('pip install x', './gradlew test');
  assert.match(h, /data-l="py">pip install x</);
  assert.match(h, /data-l="kt">\.\/gradlew test</);
});

test('code() escapes the source and keeps both languages', () => {
  const h = L.code({ py: 'a < b and "x"', kt: 'if (a < b) println("x")', file: { py: 'test_a.py', kt: 'ATest.kt' } });
  assert.match(h, /a &lt; b and &quot;x&quot;/);
  assert.match(h, /data-l="py"/);
  assert.match(h, /data-l="kt"/);
  assert.match(h, /test_a\.py/);
  assert.ok(!h.includes('a < b and'), 'raw source must not reach the page');
});

test('code() with all shows one block for both languages and sh() adds a terminal label', () => {
  const one = L.code({ all: 'git init' });
  assert.ok(!one.includes('data-l='));
  assert.match(L.sh('npm test'), /Terminal/);
  assert.match(L.sh({ py: 'pytest', kt: './gradlew test' }), /data-l="kt"/);
});

test('code blocks get unique ids and tagged ones are recorded for the examples check', () => {
  const before = L.SNIPPETS.length;
  const a = L.code({ py: 'x = 1', kt: 'val x = 1', ex: 'demo-1' });
  const b = L.code({ py: 'x = 2', kt: 'val x = 2' });
  const ids = [...(a + b).matchAll(/id="(cb\d+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(L.SNIPPETS.length, before + 1);
  assert.deepEqual(L.SNIPPETS[L.SNIPPETS.length - 1], { ex: 'demo-1', py: 'x = 1', kt: 'val x = 1', all: '' });
});

test('steps() numbers the steps per module and keeps language-only steps hidden by attribute', () => {
  const h = L.steps('m2', [
    { do: 'Create a folder', why: 'Keeps the project together', see: 'An empty folder' },
    { do: 'Create a virtual environment', why: 'Isolates packages', lang: 'py', code: L.sh('python -m venv .venv') },
    { do: 'Create build.gradle.kts', why: 'Gradle needs it', lang: 'kt' }
  ]);
  assert.match(h, /data-step="m2:s1"/);
  assert.match(h, /data-step="m2:s2"/);
  assert.match(h, /data-step="m2:s3"/);
  assert.match(h, /<li class="step" data-l="py">/);
  assert.match(h, /<li class="step" data-l="kt">/);
  assert.match(h, /<b>Why<\/b> Isolates packages/);
  assert.match(h, /<b>You should see<\/b> An empty folder/);
  assert.match(h, /Terminal/);
  assert.match(h, /python -m venv \.venv/);
});

test('short typed answers ignore case, quotes, backticks and spacing', () => {
  assert.equal(L.normFill('  `Get_By_Role`  '), 'get_by_role');
  assert.equal(L.fillOk('"get_by_role"', ['get_by_role']), true);
  assert.equal(L.fillOk('GET_BY_ROLE', ['getByRole', 'get_by_role']), true);
  assert.equal(L.fillOk('get by role', ['get_by_role']), false);
  assert.equal(L.fillOk('', ['x']), false, 'an empty answer is never right');
  assert.equal(L.fillOk(null, ['x']), false);
});

test('multiple choice with several right options needs the exact set', () => {
  assert.equal(L.sameSet([0, 2], [2, 0]), true);
  assert.equal(L.sameSet([0], [0, 2]), false);
  assert.equal(L.sameSet([0, 1, 2], [0, 2]), false);
  assert.equal(L.sameSet([], []), true);
});

test('numbers accept a dot or a comma', () => {
  assert.equal(L.parseNum('12,5'), 12.5);
  assert.equal(L.parseNum(' 3 '), 3);
  assert.ok(Number.isNaN(L.parseNum('abc')));
  assert.ok(Number.isNaN(L.parseNum('')));
});
